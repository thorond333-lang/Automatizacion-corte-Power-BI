// Lógica pura del corte: sin llamadas a Google, para poder probarla con node (tests/test_logica.js).
// Mismas reglas de comparación que la app de citas (appointment-manager-repo): email en minúsculas
// (sin '@' no cuenta) y teléfono = últimos 10 dígitos (menos de 7 dígitos no cuenta).

// Columnas que se llenan en Raw y ToConcentrado (mismas letras que en Concentrado).
var COLUMNA_INICIAL_SALIDA = 'B';
var COLUMNA_FINAL_SALIDA = 'K';

// Columna UnificadoPerfil del Excel -> columna F de Concentrado.
var MAPA_PERFIL = {
  'blue yellow': 'LP AZUL AMARILLO',
  'blue intermediate': 'LP AZUL INTERMEDIO',
  'blue white': 'LS AZUL BLANCO',
  'green yellow': 'LP VERDE AMARILLO',
  'green intermediate': 'LS VERDE INTERMEDIO',
  'green white': 'LS VERDE BLANCO'
};

// Columna IdFertilidadSucursal del Excel -> columna E de Concentrado. Cualquier otro código -> Internacional.
var MAPA_SUCURSAL = {
  'SCHOU': 'Houston',
  'IOC': 'Orange County',
  'INCOR': 'Corporativo'
};
var SUCURSAL_POR_DEFECTO = 'Internacional';

// Columna idiomaRespuesta del Excel -> primer texto de la columna H.
var MAPA_IDIOMA = { 'en': 'Ing', 'es': 'Esp' };

var ESTADO_NUEVO = 'NewLead';

function letraANumero(letra) {
  var n = 0;
  for (var i = 0; i < letra.length; i++) n = n * 26 + (letra.toUpperCase().charCodeAt(i) - 64);
  return n;
}

function texto_(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

function unaSolaLinea(valor) {
  return texto_(valor).replace(/\s*[\r\n]+\s*/g, ' ');
}

function soloDigitos(valor) {
  return texto_(valor).replace(/\D/g, '');
}

function claveEmail(valor) {
  var clave = texto_(valor).replace(/\s+/g, '').toLowerCase();
  return clave.indexOf('@') >= 0 ? clave : '';
}

function claveTelefono(valor) {
  var digitos = soloDigitos(valor);
  return digitos.length < 7 ? '' : digitos.slice(-10);
}

// Una celda K puede traer varios números separados por ',', ';' o '/': cuenta cada uno.
function clavesTelefonoDeCelda(valor) {
  var claves = [claveTelefono(valor)];
  var crudo = texto_(valor);
  if (/[,;\/]/.test(crudo)) {
    crudo.split(/[,;\/]+/).forEach(function (parte) { claves.push(claveTelefono(parte)); });
  }
  return claves.filter(function (c) { return c; });
}

// Emails y teléfonos de Concentrado (columnas D y K, cualquier largo) -> índice para buscar al instante.
function indiceConcentrado(emails, telefonos) {
  var indice = { emails: new Set(), telefonos: new Set() };
  (emails || []).forEach(function (v) {
    var c = claveEmail(v);
    if (c) indice.emails.add(c);
  });
  (telefonos || []).forEach(function (v) {
    clavesTelefonoDeCelda(v).forEach(function (c) { indice.telefonos.add(c); });
  });
  return indice;
}

// Una fila "ya está" en Concentrado si coincide el email O el teléfono.
function estaEnConcentrado(fila, indice) {
  return (fila.claveEmail && indice.emails.has(fila.claveEmail)) ||
    (fila.claveTelefono && indice.telefonos.has(fila.claveTelefono));
}

// Valores del Excel (fila 1 = títulos) -> filas como objetos {título: valor}, sin filas vacías ni duplicadas.
// Duplicada = mismo email o mismo teléfono que una fila anterior del mismo Excel (se queda la primera).
function prepararFilas(valores) {
  var titulos = (valores[0] || []).map(texto_);
  var iEmail = titulos.indexOf('Email');
  var iTelefono = titulos.indexOf('Phone');
  if (iEmail < 0) iEmail = letraANumero('E') - 1;
  if (iTelefono < 0) iTelefono = letraANumero('F') - 1;

  var resultado = { filas: [], totalExcel: 0, omitidasVacias: 0, omitidasDuplicadas: 0 };
  var emailsVistos = new Set();
  var telefonosVistos = new Set();
  for (var r = 1; r < valores.length; r++) {
    var crudo = valores[r];
    if (!crudo || crudo.every(function (v) { return texto_(v) === ''; })) continue;
    resultado.totalExcel++;
    var email = claveEmail(crudo[iEmail]);
    var telefono = claveTelefono(crudo[iTelefono]);
    if (!email && !telefono) {
      resultado.omitidasVacias++;
      continue;
    }
    if ((email && emailsVistos.has(email)) || (telefono && telefonosVistos.has(telefono))) {
      resultado.omitidasDuplicadas++;
      continue;
    }
    if (email) emailsVistos.add(email);
    if (telefono) telefonosVistos.add(telefono);

    var fila = { claveEmail: email, claveTelefono: telefono, datos: {} };
    titulos.forEach(function (t, i) { if (t) fila.datos[t] = crudo[i]; });
    fila.datos.Email = crudo[iEmail];
    fila.datos.Phone = crudo[iTelefono];
    resultado.filas.push(fila);
  }
  return resultado;
}

function soloFecha_(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor)) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  return texto_(valor);
}

// Fila preparada -> {letra de columna de Concentrado: valor}.
function formatearFila(fila) {
  var d = fila.datos;
  var perfil = MAPA_PERFIL[texto_(d.UnificadoPerfil).toLowerCase()] || '';
  var sucursal = MAPA_SUCURSAL[texto_(d.IdFertilidadSucursal).toUpperCase()] || SUCURSAL_POR_DEFECTO;
  var idioma = MAPA_IDIOMA[texto_(d.idiomaRespuesta).toLowerCase()] || texto_(d.idiomaRespuesta);
  var descripcion = [
    idioma,
    texto_(d.Firstname),
    texto_(d.edad),
    texto_(d.DescFertilidadUserpersona),
    texto_(d.PreguntaAbierta) || 'None'
  ].map(unaSolaLinea).join(' | ');
  return {
    B: '',
    C: soloFecha_(d.FechaDealCompleta),
    D: texto_(d.Email),
    E: sucursal,
    F: perfil,
    G: ESTADO_NUEVO,
    H: descripcion,
    I: '',
    J: '',
    K: soloDigitos(d.Phone)
  };
}

// Filas formateadas -> matriz para setValues, de COLUMNA_INICIAL_SALIDA a COLUMNA_FINAL_SALIDA.
function filasAMatriz(filasFormateadas) {
  var ini = letraANumero(COLUMNA_INICIAL_SALIDA);
  var fin = letraANumero(COLUMNA_FINAL_SALIDA);
  var letras = [];
  for (var c = ini; c <= fin; c++) letras.push(String.fromCharCode(64 + c));
  return filasFormateadas.map(function (f) {
    return letras.map(function (l) { return f[l] === undefined ? '' : f[l]; });
  });
}

// Todo el corte sin Google: valores del Excel + columnas D y K de Concentrado -> lo que va a cada pestaña.
function calcularCorte(valoresExcel, emailsConcentrado, telefonosConcentrado) {
  var preparado = prepararFilas(valoresExcel);
  var indice = indiceConcentrado(emailsConcentrado, telefonosConcentrado);
  var nuevas = preparado.filas.filter(function (f) { return !estaEnConcentrado(f, indice); });
  return {
    raw: preparado.filas.map(formatearFila),
    toConcentrado: nuevas.map(formatearFila),
    totalExcel: preparado.totalExcel,
    omitidasVacias: preparado.omitidasVacias,
    omitidasDuplicadas: preparado.omitidasDuplicadas,
    yaEnConcentrado: preparado.filas.length - nuevas.length
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    letraANumero: letraANumero, claveEmail: claveEmail, claveTelefono: claveTelefono,
    clavesTelefonoDeCelda: clavesTelefonoDeCelda, indiceConcentrado: indiceConcentrado,
    estaEnConcentrado: estaEnConcentrado, prepararFilas: prepararFilas, formatearFila: formatearFila,
    filasAMatriz: filasAMatriz, calcularCorte: calcularCorte, unaSolaLinea: unaSolaLinea
  };
}
