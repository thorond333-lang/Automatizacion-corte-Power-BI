// Parte que habla con Google: la página web, el Excel, Concentrado y el archivo Corte de cada usuario.
// La app web se publica "ejecutar como: el usuario que accede", así que todo se hace con la cuenta
// de quien la usa: su Corte queda en su Drive y lee Concentrado con su propio acceso.

var PROPIEDAD_ID_CORTE = 'ID_CORTE';          // propiedad de cada usuario: su archivo Corte
var PROPIEDAD_ID_PLANTILLA = 'ID_PLANTILLA';  // propiedad del script (común a todos): la plantilla

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Corte Power BI')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Lo que la página muestra al abrir.
function obtenerEstado() {
  var corte = abrirCorteDelUsuario_(false);
  return {
    usuario: Session.getActiveUser().getEmail(),
    urlCorte: corte ? corte.getUrl() : '',
    plantillaLista: !!idPlantilla_()
  };
}

// El corte completo. Lo llama la página con el Excel en base64.
function ejecutarCorte(base64, nombreArchivo, tipoArchivo) {
  var candado = LockService.getUserLock();
  if (!candado.tryLock(1000)) {
    throw new Error('Ya hay un corte en curso con tu cuenta. Espera a que termine.');
  }
  try {
    var inicio = Date.now();
    var tiempos = {};
    var marca = Date.now();

    var valoresExcel = leerExcel_(base64, nombreArchivo, tipoArchivo);
    tiempos.excel = segundosDesde_(marca);
    marca = Date.now();

    var concentrado = leerConcentrado_();
    tiempos.concentrado = segundosDesde_(marca);
    marca = Date.now();

    var corte = calcularCorte(valoresExcel, concentrado.emails, concentrado.telefonos);

    var archivo = abrirCorteDelUsuario_(true);
    escribirPestana_(archivo, CONFIG.PESTANA_RAW, filasAMatriz(corte.raw));
    var hojaTo = escribirPestana_(archivo, CONFIG.PESTANA_TO_CONCENTRADO, filasAMatriz(corte.toConcentrado));
    SpreadsheetApp.flush();
    tiempos.escritura = segundosDesde_(marca);

    var resumen = {
      archivo: nombreArchivo,
      totalExcel: corte.totalExcel,
      omitidasVacias: corte.omitidasVacias,
      omitidasDuplicadas: corte.omitidasDuplicadas,
      enRaw: corte.raw.length,
      yaEnConcentrado: corte.yaEnConcentrado,
      aToConcentrado: corte.toConcentrado.length,
      filasConcentrado: concentrado.filas,
      tiempos: tiempos,
      segundos: segundosDesde_(inicio),
      urlCorte: archivo.getUrl(),
      urlToConcentrado: archivo.getUrl() + '#gid=' + hojaTo.getSheetId()
    };
    anotarBitacora_(archivo, resumen);
    return resumen;
  } finally {
    candado.releaseLock();
  }
}

function segundosDesde_(marca) {
  return Math.round((Date.now() - marca) / 100) / 10;
}

// Excel -> valores (fila 1 = títulos). Se convierte a una hoja de Google temporal, se lee y se borra.
function leerExcel_(base64, nombreArchivo, tipoArchivo) {
  var blob = Utilities.newBlob(Utilities.base64Decode(base64),
    tipoArchivo || MimeType.MICROSOFT_EXCEL, nombreArchivo);
  var temporal = Drive.Files.create(
    { name: 'Corte temporal - ' + nombreArchivo, mimeType: MimeType.GOOGLE_SHEETS }, blob);
  try {
    return SpreadsheetApp.openById(temporal.id).getSheets()[0].getDataRange().getValues();
  } finally {
    try {
      Drive.Files.remove(temporal.id);
    } catch (e) {
      DriveApp.getFileById(temporal.id).setTrashed(true);
    }
  }
}

// La "copia local" de Concentrado: solo las columnas de email y teléfono, en UNA lectura,
// y luego todo se compara en memoria (nada se lee celda por celda ni se escribe en Document 2).
function leerConcentrado_() {
  var desde = CONFIG.FILAS_ENCABEZADO + 1;
  var pestana = "'" + CONFIG.PESTANA_CONCENTRADO.replace(/'/g, "''") + "'!";
  var rangos = [CONFIG.COLUMNA_EMAIL_CONCENTRADO, CONFIG.COLUMNA_TELEFONO_CONCENTRADO].map(function (col) {
    return pestana + col + desde + ':' + col;
  });
  var respuesta = Sheets.Spreadsheets.Values.batchGet(CONFIG.ID_DOCUMENTO_2,
    { ranges: rangos, majorDimension: 'COLUMNS' });
  var columna = function (i) {
    var vr = respuesta.valueRanges[i];
    return (vr && vr.values && vr.values[0]) || [];
  };
  var emails = columna(0);
  var telefonos = columna(1);
  return { emails: emails, telefonos: telefonos, filas: Math.max(emails.length, telefonos.length) };
}

// Reemplaza los datos de una pestaña. Los formatos no se tocan: cada fila nueva copia el formato y las
// listas desplegables de la primera fila de datos (la "fila modelo" que viene de Concentrado).
function escribirPestana_(archivo, nombre, matriz) {
  var hoja = archivo.getSheetByName(nombre);
  if (!hoja) throw new Error('Tu archivo Corte no tiene la pestaña "' + nombre + '".');
  var inicio = CONFIG.FILAS_ENCABEZADO + 1;
  var columnas = hoja.getMaxColumns();

  var filtro = hoja.getFilter();
  if (filtro) filtro.remove();

  var maxFilas = hoja.getMaxRows();
  hoja.getRange(inicio, 1, maxFilas - inicio + 1, columnas).clearContent();

  var necesarias = inicio + matriz.length - 1;
  if (necesarias > maxFilas) {
    hoja.insertRowsAfter(maxFilas, necesarias - maxFilas);
    var modelo = hoja.getRange(inicio, 1, 1, columnas);
    var nuevas = hoja.getRange(maxFilas + 1, 1, necesarias - maxFilas, columnas);
    modelo.copyTo(nuevas, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    modelo.copyTo(nuevas, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  }

  if (matriz.length) {
    hoja.getRange(inicio, letraANumero(COLUMNA_INICIAL_SALIDA), matriz.length, matriz[0].length)
      .setValues(matriz);
  }
  hoja.getRange(CONFIG.FILAS_ENCABEZADO, 1, Math.max(matriz.length, 1) + 1, columnas).createFilter();
  return hoja;
}

// Sin datos personales: solo quién, cuándo y cuántas filas.
function anotarBitacora_(archivo, r) {
  var hoja = archivo.getSheetByName(CONFIG.PESTANA_BITACORA) || archivo.insertSheet(CONFIG.PESTANA_BITACORA);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(['Fecha', 'Usuario', 'Archivo', 'Filas en Excel', 'Sin email ni teléfono', 'Duplicadas',
      'En Raw', 'Ya en Concentrado', 'A ToConcentrado', 'Filas leídas de Concentrado', 'Segundos']);
    hoja.setFrozenRows(1);
  }
  hoja.appendRow([new Date(), Session.getActiveUser().getEmail(), r.archivo, r.totalExcel, r.omitidasVacias,
    r.omitidasDuplicadas, r.enRaw, r.yaEnConcentrado, r.aToConcentrado, r.filasConcentrado, r.segundos]);
}

function idPlantilla_() {
  return PropertiesService.getScriptProperties().getProperty(PROPIEDAD_ID_PLANTILLA);
}

// El archivo Corte del usuario. Si no tiene (o lo borró), con crear=true se le hace uno desde la plantilla.
function abrirCorteDelUsuario_(crear) {
  var propiedades = PropertiesService.getUserProperties();
  var id = propiedades.getProperty(PROPIEDAD_ID_CORTE);
  if (id) {
    try {
      if (!DriveApp.getFileById(id).isTrashed()) return SpreadsheetApp.openById(id);
    } catch (e) {
      // Borrado o sin acceso: se crea otro abajo.
    }
  }
  if (!crear) return null;
  var plantilla = idPlantilla_();
  if (!plantilla) {
    throw new Error('La app todavía no tiene plantilla. Quien la administra debe ejecutar crearPlantilla() una vez.');
  }
  var copia = DriveApp.getFileById(plantilla).makeCopy(CONFIG.NOMBRE_CORTE);
  propiedades.setProperty(PROPIEDAD_ID_CORTE, copia.getId());
  return SpreadsheetApp.openById(copia.getId());
}

// UNA VEZ, desde el editor de Apps Script, por quien administra la app.
// Crea la plantilla de Corte copiando la pestaña Concentrado (formatos, colores, listas desplegables,
// casillas) y dejando solo los títulos y la fila modelo vacía. Cada usuario recibe una copia de ella.
function crearPlantilla() {
  var origen = SpreadsheetApp.openById(CONFIG.ID_DOCUMENTO_2).getSheetByName(CONFIG.PESTANA_CONCENTRADO);
  if (!origen) throw new Error('Document 2 no tiene la pestaña "' + CONFIG.PESTANA_CONCENTRADO + '".');
  var plantilla = SpreadsheetApp.create('Corte (plantilla) - no editar');
  var hojaInicial = plantilla.getSheets()[0];

  var raw = origen.copyTo(plantilla).setName(CONFIG.PESTANA_RAW);
  var filtro = raw.getFilter();
  if (filtro) filtro.remove();
  var encabezado = CONFIG.FILAS_ENCABEZADO;
  var modelo = CONFIG.FILA_MODELO_CONCENTRADO;
  var maxFilas = raw.getMaxRows();
  if (maxFilas > modelo) raw.deleteRows(modelo + 1, maxFilas - modelo);
  if (modelo - 1 > encabezado) raw.deleteRows(encabezado + 1, modelo - 1 - encabezado);
  var filaModelo = raw.getRange(encabezado + 1, 1, 1, raw.getMaxColumns());
  filaModelo.clearContent();
  filaModelo.clearNote();

  raw.copyTo(plantilla).setName(CONFIG.PESTANA_TO_CONCENTRADO);
  plantilla.deleteSheet(hojaInicial);

  PropertiesService.getScriptProperties().setProperty(PROPIEDAD_ID_PLANTILLA, plantilla.getId());
  Logger.log('Plantilla creada: ' + plantilla.getUrl());
  Logger.log('Compártela como "Lector" con quienes usarán la app.');
}
