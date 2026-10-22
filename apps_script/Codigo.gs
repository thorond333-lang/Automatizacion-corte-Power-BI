// Parte que habla con Google: la página web, el Excel, Concentrado y el archivo Corte de cada usuario.
// La app web se publica "ejecutar como: el usuario que accede", así que todo se hace con la cuenta
// de quien la usa: su Corte queda en su Drive y lee Concentrado con su propio acceso.

var PROPIEDAD_ID_CORTE = 'ID_CORTE';          // propiedad de cada usuario: su archivo Corte
var PROPIEDAD_ID_TORAW = 'ID_TORAW';          // propiedad de cada usuario: su archivo ToRawDaniNew
var PROPIEDAD_ID_PLANTILLA = 'ID_PLANTILLA';  // propiedad del script (común a todos): la plantilla
var PROPIEDAD_PLANTILLA_DEL_CORTE = 'PLANTILLA_DEL_CORTE';  // propiedad de cada usuario: de qué plantilla salió su Corte

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Corte Power BI')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Lo que la página muestra al abrir.
function obtenerEstado() {
  var corte = abrirCorteDelUsuario_(false);
  var toRaw = abrirArchivoGuardado_(PROPIEDAD_ID_TORAW);
  return {
    usuario: Session.getActiveUser().getEmail(),
    urlCorte: corte ? corte.getUrl() : '',
    urlToRaw: toRaw ? urlToRaw_(toRaw) : '',
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

    var idTemporal = convertirExcel_(base64, nombreArchivo, tipoArchivo);
    try {
      var hojaExcel = SpreadsheetApp.openById(idTemporal).getSheets()[0];
      var valoresExcel = hojaExcel.getDataRange().getValues();
      var toRaw = escribirToRawDaniNew_(hojaExcel, valoresExcel);
    } finally {
      borrarArchivo_(idTemporal);
    }
    tiempos.excel = segundosDesde_(marca);
    marca = Date.now();

    var concentrado = leerConcentrado_();
    tiempos.concentrado = segundosDesde_(marca);
    marca = Date.now();

    var asignacion = leerAsignaciones_();
    var corte = calcularCorte(valoresExcel, concentrado.emails, concentrado.telefonos, CONFIG.FILAS_ENCABEZADO + 1,
      { listas: asignacion.listas, grupos: CONFIG.ASIGNACION.grupos });
    corte.asignaciones.listas = asignacion.listas;
    corte.asignaciones.fuente = asignacion.fuente;
    corte.asignaciones.avisos = asignacion.avisos;

    var archivo = abrirCorteDelUsuario_(true);
    escribirPestana_(archivo, CONFIG.PESTANA_RAW, filasAMatriz(corte.raw));
    var letrasFueraDeListaB = [];
    var hojaTo = escribirPestana_(archivo, CONFIG.PESTANA_TO_CONCENTRADO, filasAMatriz(corte.toConcentrado),
      letrasFueraDeListaB);
    hojaTo.hideColumns(1);  // se ve (y se copia) de la B en adelante
    var rangoTo = rangoDatosSalida(CONFIG.FILAS_ENCABEZADO + 1, corte.toConcentrado.length);
    var hojaComparacion = escribirComparacion_(archivo, corte.comparacion);
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
      asignaciones: corte.asignaciones,
      letrasFueraDeListaB: letrasFueraDeListaB,
      filasConcentrado: concentrado.filas,
      tiempos: tiempos,
      segundos: segundosDesde_(inicio),
      urlCorte: archivo.getUrl(),
      // &range= abre la hoja con las celdas de datos (B a L) ya seleccionadas, listas para copiar.
      urlToConcentrado: archivo.getUrl() + '#gid=' + hojaTo.getSheetId() + (rangoTo ? '&range=' + rangoTo : ''),
      urlToRaw: urlToRaw_(toRaw),
      urlComparacion: archivo.getUrl() + '#gid=' + hojaComparacion.getSheetId()
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

// Excel -> hoja de Google temporal (se borra al terminar con borrarArchivo_). Devuelve su ID.
function convertirExcel_(base64, nombreArchivo, tipoArchivo) {
  var blob = Utilities.newBlob(Utilities.base64Decode(base64),
    tipoArchivo || MimeType.MICROSOFT_EXCEL, nombreArchivo);
  return Drive.Files.create(
    { name: 'Corte temporal - ' + nombreArchivo, mimeType: MimeType.GOOGLE_SHEETS }, blob).id;
}

function borrarArchivo_(id) {
  try {
    Drive.Files.remove(id);
  } catch (e) {
    DriveApp.getFileById(id).setTrashed(true);
  }
}

// ToRawDaniNew: copia exacta de la hoja del Excel (valores y formato) sin la fila de títulos, sin filas vacías y sin
// columnas vacías al final. Un solo archivo por usuario, que se reemplaza en cada corte (el enlace no cambia).
function escribirToRawDaniNew_(hojaExcel, valores) {
  var archivo = abrirArchivoGuardado_(PROPIEDAD_ID_TORAW);
  if (!archivo) {
    archivo = SpreadsheetApp.create(CONFIG.NOMBRE_TORAW);
    PropertiesService.getUserProperties().setProperty(PROPIEDAD_ID_TORAW, archivo.getId());
  }
  var hoja = hojaExcel.copyTo(archivo);
  archivo.getSheets().forEach(function (h) {
    if (h.getSheetId() !== hoja.getSheetId()) archivo.deleteSheet(h);
  });
  hoja.setName(CONFIG.NOMBRE_TORAW);
  var filtro = hoja.getFilter();
  if (filtro) filtro.remove();
  hoja.setFrozenRows(0);

  var limpieza = limpiezaToRaw(valores);
  if (!limpieza.filasQueQuedan) {
    hoja.clear();
    return archivo;
  }
  limpieza.bloquesFilas.forEach(function (b) { hoja.deleteRows(b[0], b[1]); });
  var maxFilas = hoja.getMaxRows();
  if (maxFilas > limpieza.filasQueQuedan) hoja.deleteRows(limpieza.filasQueQuedan + 1, maxFilas - limpieza.filasQueQuedan);
  var maxColumnas = hoja.getMaxColumns();
  if (maxColumnas > limpieza.ultimaColumna) {
    hoja.deleteColumns(limpieza.ultimaColumna + 1, maxColumnas - limpieza.ultimaColumna);
  }
  return archivo;
}

// Enlace a ToRawDaniNew que lo abre con todas las celdas con datos ya seleccionadas, listas para copiar.
function urlToRaw_(archivo) {
  var hoja = archivo.getSheets()[0];
  if (!hoja.getLastRow()) return archivo.getUrl();
  return archivo.getUrl() + '#gid=' + hoja.getSheetId() + '&range=' + hoja.getDataRange().getA1Notation();
}

// Un archivo guardado en las propiedades del usuario, o null si no tiene, lo borró o ya no tiene acceso.
function abrirArchivoGuardado_(propiedad) {
  var id = PropertiesService.getUserProperties().getProperty(propiedad);
  if (!id) return null;
  try {
    if (!DriveApp.getFileById(id).isTrashed()) return SpreadsheetApp.openById(id);
  } catch (e) {
    // Borrado o sin acceso.
  }
  return null;
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
// Con `letrasFueraDeListaB` (un arreglo), revisa la lista desplegable de la columna B y deja ahí las letras que no tiene.
function escribirPestana_(archivo, nombre, matriz, letrasFueraDeListaB) {
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

  if (letrasFueraDeListaB) {
    Array.prototype.push.apply(letrasFueraDeListaB, permitirLetrasFueraDeLista_(archivo, hoja, inicio, matriz));
  }
  if (matriz.length) {
    hoja.getRange(inicio, letraANumero(COLUMNA_INICIAL_SALIDA), matriz.length, matriz[0].length)
      .setValues(matriz);
  }
  hoja.getRange(CONFIG.FILAS_ENCABEZADO, 1, Math.max(matriz.length, 1) + 1, columnas).createFilter();
  return hoja;
}

// La lista desplegable de la columna B (copiada de Concentrado) RECHAZA las letras que no tiene, y eso detendría el
// corte. Primero la B recupera su validación original (la de la fila modelo de Raw, donde la B nunca se llena, así
// que nunca se modifica); luego, solo en las celdas cuya letra no está en la lista, la validación pasa a "mostrar
// advertencia" para que se pueda escribir. Las demás celdas conservan la lista y sus colores.
// Devuelve las letras que no estaban en la lista.
function permitirLetrasFueraDeLista_(archivo, hoja, inicio, matriz) {
  if (!matriz.length) return [];
  var columnaB = letraANumero(COLUMNA_INICIAL_SALIDA);  // la matriz empieza en la B
  var celdasB = hoja.getRange(inicio, columnaB, matriz.length, 1);
  var raw = archivo.getSheetByName(CONFIG.PESTANA_RAW);
  if (raw) raw.getRange(inicio, columnaB).copyTo(celdasB, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);

  var regla = hoja.getRange(inicio, columnaB).getDataValidation();
  if (!regla || regla.getAllowInvalid()) return [];
  var permitidas = valoresPermitidos_(regla);
  if (!permitidas) return [];
  var fuera = letrasFueraDeLista(matriz.map(function (fila) { return fila[0]; }), permitidas);
  if (fuera.filas.length) {
    var conAdvertencia = regla.copy().setAllowInvalid(true).build();
    fuera.filas.forEach(function (i) { hoja.getRange(inicio + i, columnaB).setDataValidation(conAdvertencia); });
  }
  return fuera.letras;
}

// Valores de una lista desplegable (lista escrita o lista desde un rango); null si la regla es de otro tipo.
function valoresPermitidos_(regla) {
  var criterio = regla.getCriteriaValues();
  var tipo = regla.getCriteriaType();
  if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) return criterio[0].map(String);
  if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    return [].concat.apply([], criterio[0].getDisplayValues());
  }
  return null;
}

// Listas de asignación de la hoja compartida (ID_HOJA_ASIGNACIONES). Si no se puede leer, las de respaldo de Config
// con un aviso: el corte nunca se detiene por esto.
function leerAsignaciones_() {
  var respaldo = CONFIG.ASIGNACION.listas;
  var columnas = null;
  var problema = '';
  if (!CONFIG.ID_HOJA_ASIGNACIONES) {
    problema = 'No hay hoja de asignaciones configurada (ID_HOJA_ASIGNACIONES en Config)';
  } else {
    try {
      var filas = SpreadsheetApp.openById(CONFIG.ID_HOJA_ASIGNACIONES).getSheets()[0].getDataRange().getValues();
      columnas = (filas[0] || []).map(function (_, c) {
        return filas.map(function (fila) { return fila[c]; });
      });
    } catch (e) {
      problema = 'No se pudo leer la hoja de asignaciones (' + e.message + ')';
    }
  }
  if (problema) {
    var fuente = {};
    Object.keys(respaldo).forEach(function (g) { fuente[g] = 'respaldo'; });
    return { listas: respaldo, fuente: fuente, avisos: [problema + ': se usaron las listas de respaldo de Config.'] };
  }
  return listasDeAsignacion(columnas, respaldo);
}

// Pestaña simple (sin formato de Concentrado) con el resultado de cada fila del Excel, para revisar la comparación.
function escribirComparacion_(archivo, filas) {
  var hoja = archivo.getSheetByName(CONFIG.PESTANA_COMPARACION) || archivo.insertSheet(CONFIG.PESTANA_COMPARACION);
  hoja.clearContents();
  var matriz = [TITULOS_COMPARACION].concat(filas);
  if (hoja.getMaxRows() < matriz.length) hoja.insertRowsAfter(hoja.getMaxRows(), matriz.length - hoja.getMaxRows());
  hoja.getRange(1, 1, matriz.length, TITULOS_COMPARACION.length).setValues(matriz);
  hoja.getRange(1, 1, 1, TITULOS_COMPARACION.length).setFontWeight('bold');
  hoja.setFrozenRows(1);
  return hoja;
}

// Sin datos personales: solo quién, cuándo y cuántas filas.
function anotarBitacora_(archivo, r) {
  var hoja = archivo.getSheetByName(CONFIG.PESTANA_BITACORA) || archivo.insertSheet(CONFIG.PESTANA_BITACORA);
  var titulos = ['Fecha', 'Usuario', 'Archivo', 'Filas en Excel', 'Sin email ni teléfono', 'Duplicadas',
    'En Raw', 'Ya en Concentrado', 'A ToConcentrado', 'Filas leídas de Concentrado', 'Segundos', 'Listas de asignación'];
  hoja.getRange(1, 1, 1, titulos.length).setValues([titulos]);
  hoja.setFrozenRows(1);
  var avisos = (r.asignaciones && r.asignaciones.avisos) || [];
  hoja.appendRow([new Date(), Session.getActiveUser().getEmail(), r.archivo, r.totalExcel, r.omitidasVacias,
    r.omitidasDuplicadas, r.enRaw, r.yaEnConcentrado, r.aToConcentrado, r.filasConcentrado, r.segundos,
    avisos.length ? 'RESPALDO: ' + avisos.join(' ') : 'Hoja']);
}

function idPlantilla_() {
  return PropertiesService.getScriptProperties().getProperty(PROPIEDAD_ID_PLANTILLA);
}

// El archivo Corte del usuario. Con crear=true: si no tiene (o lo borró) se le hace uno desde la plantilla, y si su
// Corte salió de una plantilla anterior (se cambió la fila modelo y se volvió a ejecutar crearPlantilla), se le hace
// uno nuevo con el formato nuevo: el anterior se queda en su Drive como "Corte (formato anterior)" y su Bitácora pasa
// al nuevo.
function abrirCorteDelUsuario_(crear) {
  var existente = abrirArchivoGuardado_(PROPIEDAD_ID_CORTE);
  if (!crear) return existente;
  var propiedades = PropertiesService.getUserProperties();
  var plantilla = idPlantilla_();
  if (existente && (!plantilla || propiedades.getProperty(PROPIEDAD_PLANTILLA_DEL_CORTE) === plantilla)) return existente;
  if (!plantilla) {
    throw new Error('La app todavía no tiene plantilla. Quien la administra debe ejecutar crearPlantilla() una vez.');
  }
  var nuevo = SpreadsheetApp.openById(DriveApp.getFileById(plantilla).makeCopy(CONFIG.NOMBRE_CORTE).getId());
  if (existente) {
    var bitacora = existente.getSheetByName(CONFIG.PESTANA_BITACORA);
    if (bitacora) bitacora.copyTo(nuevo).setName(CONFIG.PESTANA_BITACORA);
    existente.rename(CONFIG.NOMBRE_CORTE + ' (formato anterior)');
  }
  propiedades.setProperty(PROPIEDAD_ID_CORTE, nuevo.getId());
  propiedades.setProperty(PROPIEDAD_PLANTILLA_DEL_CORTE, plantilla);
  return nuevo;
}

// UNA VEZ, desde el editor de Apps Script, por quien administra la app (y otra vez si cambia la fila modelo).
// Crea la plantilla de Corte copiando la pestaña Concentrado (formatos, colores, listas desplegables,
// casillas) y dejando solo los títulos y la fila modelo vacía. Cada usuario recibe una copia de ella.
// Todo con la API de Sheets: SpreadsheetApp.openById tiene que cargar Document 2 completo y, como es tan pesado,
// a veces falla con "No se puede cargar el documento". La API copia la pestaña del lado de Google sin cargarlo.
function crearPlantilla() {
  var info = Sheets.Spreadsheets.get(CONFIG.ID_DOCUMENTO_2,
    { fields: 'sheets(properties(sheetId,title),basicFilter.range)' });
  var origen = info.sheets.filter(function (h) { return h.properties.title === CONFIG.PESTANA_CONCENTRADO; })[0];
  if (!origen) throw new Error('Document 2 no tiene la pestaña "' + CONFIG.PESTANA_CONCENTRADO + '".');

  var plantilla = SpreadsheetApp.create('Corte (plantilla) - no editar');
  try {
    var idHojaInicial = plantilla.getSheets()[0].getSheetId();
    var copia = copiarConcentrado_(plantilla.getId(), origen.properties.sheetId);
    var idRaw = copia.sheetId;
    var filas = copia.gridProperties.rowCount;
    var encabezado = CONFIG.FILAS_ENCABEZADO;
    var modelo = CONFIG.FILA_MODELO_CONCENTRADO;
    if (modelo > filas) throw new Error('La fila modelo ' + modelo + ' no existe en Concentrado (tiene ' + filas + ' filas).');

    var filasDe = function (desde, hasta) {  // filas desde..hasta (1 = primera), en índices de la API
      return { range: { sheetId: idRaw, dimension: 'ROWS', startIndex: desde - 1, endIndex: hasta } };
    };
    var pedidos = [];
    if (origen.basicFilter) pedidos.push({ clearBasicFilter: { sheetId: idRaw } });
    if (filas > modelo) pedidos.push({ deleteDimension: filasDe(modelo + 1, filas) });
    if (modelo - 1 > encabezado) pedidos.push({ deleteDimension: filasDe(encabezado + 1, modelo - 1) });
    pedidos.push(
      // Fila modelo (ahora justo debajo de los títulos): sin valores ni notas, conserva formato y listas.
      { updateCells: { range: { sheetId: idRaw, startRowIndex: encabezado, endRowIndex: encabezado + 1 },
        fields: 'userEnteredValue,note' } },
      { updateSheetProperties: { properties: { sheetId: idRaw, title: CONFIG.PESTANA_RAW }, fields: 'title' } },
      { duplicateSheet: { sourceSheetId: idRaw, insertSheetIndex: 1, newSheetName: CONFIG.PESTANA_TO_CONCENTRADO } },
      { deleteSheet: { sheetId: idHojaInicial } });
    Sheets.Spreadsheets.batchUpdate({ requests: pedidos }, plantilla.getId());
  } catch (e) {
    DriveApp.getFileById(plantilla.getId()).setTrashed(true);  // no dejar una plantilla a medias
    throw e;
  }

  PropertiesService.getScriptProperties().setProperty(PROPIEDAD_ID_PLANTILLA, plantilla.getId());
  Logger.log('Plantilla creada: ' + plantilla.getUrl());
  try {
    DriveApp.getFileById(plantilla.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('Compartida: cualquier persona con el vínculo puede verla (no tiene datos).');
  } catch (e) {
    Logger.log('No se pudo compartir sola (' + e.message + '). Compártela a mano: cualquier persona con el vínculo, Lector.');
  }
  Logger.log('Cada usuario recibirá un Corte nuevo con este formato en su siguiente corte.');
}

// Concentrado es tan pesado que Google a veces contesta "Internal error" al copiarlo: hasta 3 intentos, con espera.
function copiarConcentrado_(idDestino, idHoja) {
  var esperas = [0, 20, 40];  // segundos antes de cada intento
  for (var intento = 0; ; intento++) {
    if (esperas[intento]) {
      Logger.log('Google no pudo copiar Concentrado; intento ' + (intento + 1) + ' de ' + esperas.length +
        ' en ' + esperas[intento] + ' s.');
      Utilities.sleep(esperas[intento] * 1000);
    }
    try {
      return Sheets.Spreadsheets.Sheets.copyTo({ destinationSpreadsheetId: idDestino }, CONFIG.ID_DOCUMENTO_2, idHoja);
    } catch (e) {
      if (intento === esperas.length - 1) {
        throw new Error('Google no pudo copiar Concentrado después de ' + esperas.length + ' intentos (' + e.message +
          '). Prueba más tarde, o edita a mano la plantilla actual y ejecuta publicarCambiosDePlantilla.');
      }
    }
  }
}

// PLAN B (si crearPlantilla no logra copiar Concentrado): edita a mano la plantilla actual (por ejemplo, agrega una
// letra a la lista desplegable de la columna B en Raw y ToConcentrado) y ejecuta esta función. Hace una copia de la
// plantilla y la app pasa a usar esa copia, así cada usuario recibe un Corte nuevo con los cambios en su siguiente corte.
function publicarCambiosDePlantilla() {
  var actual = idPlantilla_();
  if (!actual) throw new Error('Todavía no hay plantilla: ejecuta crearPlantilla.');
  var archivoActual = DriveApp.getFileById(actual);
  var copia = archivoActual.makeCopy('Corte (plantilla) - no editar');
  archivoActual.setName('Corte (plantilla anterior) - se puede borrar');
  PropertiesService.getScriptProperties().setProperty(PROPIEDAD_ID_PLANTILLA, copia.getId());
  Logger.log('Plantilla publicada: ' + copia.getUrl());
  try {
    copia.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('Compartida: cualquier persona con el vínculo puede verla (no tiene datos).');
  } catch (e) {
    Logger.log('No se pudo compartir sola (' + e.message + '). Compártela a mano: cualquier persona con el vínculo, Lector.');
  }
  Logger.log('Cada usuario recibirá un Corte nuevo con estos cambios en su siguiente corte.');
}
