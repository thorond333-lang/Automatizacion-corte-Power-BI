// Lógica pura del corte: sin llamadas a Google, para poder probarla con node (tests/test_logica.js).
// Mismas reglas de comparación que la app de citas (appointment-manager-repo): email en minúsculas
// (sin '@' no cuenta) y teléfono = últimos 10 dígitos (menos de 7 dígitos no cuenta).

// Columnas que se llenan en Raw y ToConcentrado (mismas letras que en Concentrado).
var COLUMNA_INICIAL_SALIDA = 'B';
var COLUMNA_FINAL_SALIDA = 'L';

// Columnas I (DescFertilidadPerfil, color) + J (DescFertilidadScore) del Excel -> columna F de Concentrado.
// Si falta cualquiera de las dos, F (y L) quedan vacías.
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

// Columna L: círculo según la segunda parte del perfil (columna F).
var CIRCULOS_PERFIL = [
  ['AMARILLO', '🟡'],
  ['BLANCO', '⚪'],
  ['INTERMEDIO', '🟠']
];

function circuloDePerfil(perfil) {
  for (var i = 0; i < CIRCULOS_PERFIL.length; i++) {
    if (perfil.indexOf(CIRCULOS_PERFIL[i][0]) >= 0) return CIRCULOS_PERFIL[i][1];
  }
  return '';
}

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

// Emails y teléfonos de Concentrado (columnas D y K) -> índice {clave: fila de la hoja} para buscar al instante.
// `primeraFila` = fila de la hoja del primer valor de las listas. Si se repite, gana la fila más nueva (la de más abajo).
function indiceConcentrado(emails, telefonos, primeraFila) {
  var inicio = primeraFila || 1;
  var indice = { emails: new Map(), telefonos: new Map() };
  (emails || []).forEach(function (v, i) {
    var c = claveEmail(v);
    if (c) indice.emails.set(c, inicio + i);
  });
  (telefonos || []).forEach(function (v, i) {
    clavesTelefonoDeCelda(v).forEach(function (c) { indice.telefonos.set(c, inicio + i); });
  });
  return indice;
}

// En qué fila de Concentrado está el email y en cuál el teléfono (0 = no está).
function buscarEnConcentrado(fila, indice) {
  return {
    filaEmail: (fila.claveEmail && indice.emails.get(fila.claveEmail)) || 0,
    filaTelefono: (fila.claveTelefono && indice.telefonos.get(fila.claveTelefono)) || 0
  };
}

// Una fila "ya está" en Concentrado si coincide el email O el teléfono.
function estaEnConcentrado(fila, indice) {
  var b = buscarEnConcentrado(fila, indice);
  return !!(b.filaEmail || b.filaTelefono);
}

// Valores del Excel (fila 1 = títulos) -> filas como objetos {título: valor}, sin filas vacías ni duplicadas.
// Duplicada = mismo email o mismo teléfono que una fila anterior del mismo Excel (se queda la primera).
function prepararFilas(valores) {
  var titulos = (valores[0] || []).map(texto_);
  var iEmail = titulos.indexOf('Email');
  var iTelefono = titulos.indexOf('Phone');
  if (iEmail < 0) iEmail = letraANumero('E') - 1;
  if (iTelefono < 0) iTelefono = letraANumero('F') - 1;

  var resultado = { filas: [], omitidas: [], totalExcel: 0, omitidasVacias: 0, omitidasDuplicadas: 0 };
  var emailsVistos = new Map();     // clave -> fila del Excel donde apareció primero
  var telefonosVistos = new Map();
  for (var r = 1; r < valores.length; r++) {
    var crudo = valores[r];
    if (!crudo || crudo.every(function (v) { return texto_(v) === ''; })) continue;
    resultado.totalExcel++;
    var email = claveEmail(crudo[iEmail]);
    var telefono = claveTelefono(crudo[iTelefono]);
    var filaExcel = r + 1;
    if (!email && !telefono) {
      resultado.omitidasVacias++;
      resultado.omitidas.push({ filaExcel: filaExcel, claveEmail: '', claveTelefono: '',
        motivo: 'Omitida: sin email ni teléfono' });
      continue;
    }
    var primera = (email && emailsVistos.get(email)) || (telefono && telefonosVistos.get(telefono));
    if (primera) {
      resultado.omitidasDuplicadas++;
      resultado.omitidas.push({ filaExcel: filaExcel, claveEmail: email, claveTelefono: telefono,
        motivo: 'Omitida: duplicada de la fila ' + primera + ' del Excel' });
      continue;
    }
    if (email) emailsVistos.set(email, filaExcel);
    if (telefono && !telefonosVistos.has(telefono)) telefonosVistos.set(telefono, filaExcel);

    var fila = { filaExcel: filaExcel, claveEmail: email, claveTelefono: telefono, datos: {} };
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
  var color = texto_(d.DescFertilidadPerfil);
  var score = texto_(d.DescFertilidadScore);
  var perfil = color && score ? MAPA_PERFIL[(color + ' ' + score).toLowerCase()] || '' : '';
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
    K: soloDigitos(d.Phone),
    L: circuloDePerfil(perfil)
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

var TITULOS_COMPARACION = ['Fila del Excel', 'Email (comparado)', 'Teléfono (últimos 10)', 'Resultado',
  'Fila en Concentrado (email)', 'Fila en Concentrado (teléfono)'];

// Todo el corte sin Google: valores del Excel + columnas D y K de Concentrado -> lo que va a cada pestaña.
// `primeraFilaConcentrado` = fila de la hoja del primer valor de esas columnas (para mostrar dónde se encontró).
function calcularCorte(valoresExcel, emailsConcentrado, telefonosConcentrado, primeraFilaConcentrado) {
  var preparado = prepararFilas(valoresExcel);
  var indice = indiceConcentrado(emailsConcentrado, telefonosConcentrado, primeraFilaConcentrado);
  var nuevas = [];
  var comparacion = [];
  preparado.filas.forEach(function (f) {
    var b = buscarEnConcentrado(f, indice);
    var resultado;
    if (b.filaEmail && b.filaTelefono) resultado = 'Ya está (email y teléfono)';
    else if (b.filaEmail) resultado = 'Ya está (email)';
    else if (b.filaTelefono) resultado = 'Ya está (teléfono)';
    else {
      resultado = 'NUEVA -> ToConcentrado';
      nuevas.push(f);
    }
    comparacion.push([f.filaExcel, f.claveEmail, f.claveTelefono, resultado, b.filaEmail || '', b.filaTelefono || '']);
  });
  preparado.omitidas.forEach(function (o) {
    comparacion.push([o.filaExcel, o.claveEmail, o.claveTelefono, o.motivo, '', '']);
  });
  comparacion.sort(function (a, b) { return a[0] - b[0]; });
  return {
    raw: preparado.filas.map(formatearFila),
    toConcentrado: nuevas.map(formatearFila),
    comparacion: comparacion,
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
    estaEnConcentrado: estaEnConcentrado, buscarEnConcentrado: buscarEnConcentrado, prepararFilas: prepararFilas, formatearFila: formatearFila,
    filasAMatriz: filasAMatriz, circuloDePerfil: circuloDePerfil, calcularCorte: calcularCorte, unaSolaLinea: unaSolaLinea
  };
}
