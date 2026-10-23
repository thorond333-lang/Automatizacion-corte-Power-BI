// Pruebas de apps_script/Logica.gs con datos inventados (nunca datos reales).
// Ejecutar: node tests/test_logica.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const archivo = path.join(__dirname, '..', 'apps_script', 'Logica.gs');
const m = new Module(archivo);
m._compile(fs.readFileSync(archivo, 'utf8'), archivo);
const L = m.exports;

const TITULOS = ['FechaDealCompleta', 'DealID', 'unidadNegocio', 'Firstname', 'Email', 'Phone', 'UnificadoPerfil',
  'DescFertilidadPerfil', 'DescFertilidadScore',
  'DescFertilidadUserpersona', 'edad', 'IdFertilidadSucursal', 'PreguntaAbierta', 'idiomaRespuesta'];

function fila(o) {
  return TITULOS.map((t) => (t in o ? o[t] : ''));
}

let pruebas = 0;
function prueba(nombre, fn) {
  fn();
  pruebas++;
  console.log('ok -', nombre);
}

prueba('claveTelefono: solo dígitos, últimos 10, mínimo 7', () => {
  assert.strictEqual(L.claveTelefono('+1 (555) 123-4567'), '5551234567');
  assert.strictEqual(L.claveTelefono('+1+52 8112345678'), '8112345678');
  assert.strictEqual(L.claveTelefono(15551234567), '5551234567');
  assert.strictEqual(L.claveTelefono('12345'), '');
  assert.strictEqual(L.claveTelefono(null), '');
});

prueba('claveEmail: minúsculas, sin espacios, necesita @', () => {
  assert.strictEqual(L.claveEmail('  Ana.Prueba@Example.COM '), 'ana.prueba@example.com');
  assert.strictEqual(L.claveEmail('-'), '');
  assert.strictEqual(L.claveEmail(''), '');
});

prueba('celda K con varios números cuenta cada uno', () => {
  assert.deepStrictEqual([...new Set(L.clavesTelefonoDeCelda('15551234567 / 15559876543'))].sort(),
    ['5551234567', '5559876543']);
  const indice = L.indiceConcentrado([], ['15551234567 / 15559876543']);
  assert.ok(indice.telefonos.has('5559876543'));
  assert.ok(indice.telefonos.has('5551234567'));
});

prueba('prepararFilas omite vacías y duplicadas (por email o por teléfono)', () => {
  const r = L.prepararFilas([
    TITULOS,
    fila({ Email: 'a@x.com', Phone: '+15550000001' }),
    fila({ Email: 'A@X.com', Phone: '+15550000002' }),   // mismo email
    fila({ Email: 'b@x.com', Phone: '+1 555 000 0001' }), // mismo teléfono
    fila({ Firstname: 'Sin datos', Email: '', Phone: '' }), // sin email ni teléfono
    fila({ Email: 'c@x.com', Phone: '' }),
    fila({ Email: '', Phone: '+15550000003' }),
    TITULOS.map(() => '')                                  // fila totalmente vacía: no cuenta
  ]);
  assert.strictEqual(r.totalExcel, 6);
  assert.strictEqual(r.omitidasVacias, 1);
  assert.strictEqual(r.omitidasDuplicadas, 2);
  assert.deepStrictEqual(r.filas.map((f) => f.claveEmail || f.claveTelefono), ['a@x.com', 'c@x.com', '5550000003']);
});

prueba('sin títulos Email/Phone usa las columnas E y F', () => {
  const sinTitulos = ['a', 'b', 'c', 'd', 'x', 'y'];
  const r = L.prepararFilas([sinTitulos, ['', '', '', '', 'e@x.com', '+15551112222']]);
  assert.strictEqual(r.filas[0].claveEmail, 'e@x.com');
  assert.strictEqual(r.filas[0].claveTelefono, '5551112222');
});

prueba('comparación O: basta email o teléfono', () => {
  const excel = [
    TITULOS,
    fila({ Email: 'esta@x.com', Phone: '+15550000010' }),     // email en Concentrado
    fila({ Email: 'nueva1@x.com', Phone: '+15550000020' }),   // teléfono en Concentrado (sin el 1)
    fila({ Email: 'nueva2@x.com', Phone: '+15550000030' }),   // no está
    fila({ Email: '', Phone: '+15550000040' })                // no está, sin email
  ];
  const r = L.calcularCorte(excel, ['Correo1', 'ESTA@x.com', ''], ['Telefono1', '5550000020', '']);
  assert.strictEqual(r.raw.length, 4);
  assert.strictEqual(r.yaEnConcentrado, 2);
  assert.deepStrictEqual(r.toConcentrado.map((f) => f.K), ['15550000030', '15550000040']);
});

prueba('comparación fila por fila: resultado y fila de Concentrado donde se encontró', () => {
  const excel = [
    TITULOS,
    fila({ Email: 'esta@x.com', Phone: '+15550000010' }),       // fila 2 del Excel
    fila({ Email: 'nueva@x.com', Phone: '+15550000020' }),      // fila 3: teléfono en Concentrado
    fila({ Email: 'ESTA@x.com', Phone: '+15550000099' }),       // fila 4: duplicada de la 2
    fila({ Firstname: 'Sin datos' }),                           // fila 5: sin email ni teléfono
    fila({ Email: 'otra@x.com', Phone: '+15550000030' })        // fila 6: nueva
  ];
  // Primer valor de las listas = fila 3 de la hoja (2 filas de títulos). 'esta@x.com' sale dos veces: gana la más nueva.
  const r = L.calcularCorte(excel, ['esta@x.com', '', 'esta@x.com'], ['', '5550000020', ''], 3);
  assert.deepStrictEqual(r.comparacion, [
    [2, 'esta@x.com', '5550000010', 'Ya está (email)', 5, '', ''],
    [3, 'nueva@x.com', '5550000020', 'Ya está (teléfono)', '', 4, ''],
    [4, 'esta@x.com', '5550000099', 'Omitida: duplicada de la fila 2 del Excel', '', '', ''],
    [5, '', '', 'Omitida: sin email ni teléfono', '', '', ''],
    [6, 'otra@x.com', '5550000030', 'NUEVA -> ToConcentrado', '', '', '']
  ]);
  assert.deepStrictEqual(r.toConcentrado.map((f) => f.D), ['otra@x.com']);
});

prueba('formatearFila arma las columnas de Concentrado', () => {
  const r = L.prepararFilas([TITULOS, fila({
    FechaDealCompleta: new Date(2026, 9, 19, 14, 30), Firstname: 'Ana', Email: ' ana@x.com ',
    Phone: '+1 555-000-0099', DescFertilidadPerfil: 'Blue', DescFertilidadScore: 'Yellow', DescFertilidadUserpersona: 'Single Woman',
    edad: '33', IdFertilidadSucursal: 'SCHOU', PreguntaAbierta: 'Línea uno\nLínea dos', idiomaRespuesta: 'en'
  })]);
  const f = L.formatearFila(r.filas[0]);
  assert.strictEqual(f.C.getTime(), new Date(2026, 9, 19).getTime());
  assert.strictEqual(f.D, 'ana@x.com');
  assert.strictEqual(f.E, 'Houston');
  assert.strictEqual(f.F, 'LP AZUL AMARILLO');
  assert.strictEqual(f.G, 'NewLead');
  assert.strictEqual(f.H, 'Ing | Ana | 33 | Single Woman | Línea uno Línea dos');
  assert.strictEqual(f.K, '15550000099');
  assert.strictEqual(f.L, '🟡');
});

prueba('columna L: círculo según el perfil', () => {
  assert.strictEqual(L.circuloDePerfil('LP AZUL AMARILLO'), '🟡');
  assert.strictEqual(L.circuloDePerfil('LP VERDE AMARILLO'), '🟡');
  assert.strictEqual(L.circuloDePerfil('LS AZUL BLANCO'), '⚪');
  assert.strictEqual(L.circuloDePerfil('LS VERDE BLANCO'), '⚪');
  assert.strictEqual(L.circuloDePerfil('LP AZUL INTERMEDIO'), '🟠');
  assert.strictEqual(L.circuloDePerfil('LS VERDE INTERMEDIO'), '🟠');
  assert.strictEqual(L.circuloDePerfil(''), '');
});

prueba('mapas de sucursal, perfil e idioma', () => {
  const base = { Email: 'z@x.com' };
  const f = (o) => L.formatearFila(L.prepararFilas([TITULOS, fila(Object.assign({}, base, o))]).filas[0]);
  assert.strictEqual(f({ IdFertilidadSucursal: 'IOC' }).E, 'Orange County');
  assert.strictEqual(f({ IdFertilidadSucursal: 'INCOR' }).E, 'Corporativo');
  assert.strictEqual(f({ IdFertilidadSucursal: 'INCUN' }).E, 'Internacional');
  assert.strictEqual(f({ DescFertilidadPerfil: 'Green', DescFertilidadScore: 'White' }).F, 'LS VERDE BLANCO');
  assert.strictEqual(f({ DescFertilidadPerfil: 'Blue', DescFertilidadScore: 'Intermediate' }).F, 'LP AZUL INTERMEDIO');
  // El perfil sale de I + J aunque G (UnificadoPerfil) venga vacía o distinta.
  assert.strictEqual(f({ UnificadoPerfil: '', DescFertilidadPerfil: 'Blue', DescFertilidadScore: 'Yellow' }).F, 'LP AZUL AMARILLO');
  // Falta I o J -> F y L vacías.
  const soloColor = f({ UnificadoPerfil: 'Blue', DescFertilidadPerfil: 'Blue', DescFertilidadScore: '' });
  assert.strictEqual(soloColor.F, '');
  assert.strictEqual(soloColor.L, '');
  assert.strictEqual(f({ DescFertilidadPerfil: '', DescFertilidadScore: 'Yellow' }).F, '');
  assert.strictEqual(f({ idiomaRespuesta: 'es', PreguntaAbierta: '' }).H, 'Esp |  |  |  | None');
});

prueba('filasAMatriz va de B a L', () => {
  const m = L.filasAMatriz([{ B: 'b', D: 'd', K: 'k', L: 'l' }]);
  assert.strictEqual(m[0].length, 11);
  assert.strictEqual(m[0][10], 'l');
  assert.strictEqual(m[0][0], 'b');
  assert.strictEqual(m[0][2], 'd');
  assert.strictEqual(m[0][9], 'k');
});

const ASIGNACION = {
  listas: {
    Internacional: ['RA2', 'AL2', 'RA2', 'AL2', 'RA2', 'AL2', 'M', 'T:', 'AH:', 'AB:', 'M'],
    Corporativo: ['AH:', 'E', 'AL2', 'F:', 'E', 'F:'],
    Branches: ['T:', 'AB:', 'E', 'F:']
  },
  grupos: { Internacional: 'Internacional', Corporativo: 'Corporativo', Houston: 'Branches', 'Orange County': 'Branches' }
};
const PERFILES = ['LP AZUL AMARILLO', 'LS AZUL BLANCO', 'LP AZUL INTERMEDIO', 'LP VERDE AMARILLO', 'LS VERDE BLANCO', 'LS VERDE INTERMEDIO'];

function contar(lista) {
  return lista.reduce((a, x) => { a[x] = (a[x] || 0) + 1; return a; }, {});
}

prueba('pesos: una letra repetida pesa más', () => {
  assert.deepStrictEqual(L.pesosDeLista(ASIGNACION.listas.Internacional), [
    { letra: 'RA2', peso: 3 }, { letra: 'AL2', peso: 3 }, { letra: 'M', peso: 2 },
    { letra: 'T:', peso: 1 }, { letra: 'AH:', peso: 1 }, { letra: 'AB:', peso: 1 }]);
  assert.deepStrictEqual(L.pesosDeLista([' E ', '', null, 'E']), [{ letra: 'E', peso: 2 }]);
});

prueba('cupos exactos y proporcionales (22 Internacional = 6/6/4/2/2/2)', () => {
  const pesos = L.pesosDeLista(ASIGNACION.listas.Internacional);
  assert.deepStrictEqual(L.repartirCupos(22, pesos), [6, 6, 4, 2, 2, 2]);
  assert.deepStrictEqual(L.repartirCupos(11, pesos), [3, 3, 2, 1, 1, 1]);
  // 5 filas en Branches: la de más es para la primera de la lista (se empieza de cero cada corte).
  assert.deepStrictEqual(L.repartirCupos(5, L.pesosDeLista(ASIGNACION.listas.Branches)), [2, 1, 1, 1]);
  assert.deepStrictEqual(L.repartirCupos(0, pesos), [0, 0, 0, 0, 0, 0]);
});

prueba('M recibe el doble que T: y la mezcla de tipos es pareja', () => {
  // 44 filas Internacional: 4 de cada uno de 11 "tipos" repartidos en orden.
  const tipos = [];
  for (let i = 0; i < 44; i++) tipos.push(PERFILES[i % 4]);
  const letras = L.asignarGrupo(tipos, ASIGNACION.listas.Internacional);
  const total = contar(letras);
  assert.deepStrictEqual(total, { RA2: 12, AL2: 12, M: 8, 'T:': 4, 'AH:': 4, 'AB:': 4 });
  // Cada tipo tiene 11 filas = una vuelta exacta de la lista: 3/3/2/1/1/1 por tipo.
  PERFILES.slice(0, 4).forEach((p) => {
    const deEste = contar(letras.filter((l, i) => tipos[i] === p));
    assert.deepStrictEqual(deEste, { RA2: 3, AL2: 3, M: 2, 'T:': 1, 'AH:': 1, 'AB:': 1 }, p);
  });
});

prueba('un tipo escaso no le toca siempre a la misma letra', () => {
  // Branches: 8 filas, 4 de un tipo común y 4 de uno escaso -> cada letra 1 y 1.
  const tipos = ['A', 'A', 'B', 'A', 'B', 'A', 'B', 'B'];
  const letras = L.asignarGrupo(tipos, ASIGNACION.listas.Branches);
  ['T:', 'AB:', 'E', 'F:'].forEach((l) => {
    assert.strictEqual(letras.filter((x, i) => x === l && tipos[i] === 'A').length, 1, l);
    assert.strictEqual(letras.filter((x, i) => x === l && tipos[i] === 'B').length, 1, l);
  });
});

prueba('las letras se alternan en el orden del Excel (no quedan todas juntas)', () => {
  const letras = L.asignarGrupo(new Array(8).fill('A'), ASIGNACION.listas.Branches);
  assert.deepStrictEqual(letras, ['T:', 'AB:', 'E', 'F:', 'T:', 'AB:', 'E', 'F:']);
});

prueba('asignarLetras: Houston y Orange County son un solo grupo (Branches)', () => {
  const filas = [
    { E: 'Houston', F: 'LP AZUL AMARILLO', L: '🟡' },
    { E: 'Orange County', F: 'LP AZUL AMARILLO', L: '🟡' },
    { E: 'Houston', F: 'LP AZUL AMARILLO', L: '🟡' },
    { E: 'Orange County', F: 'LP AZUL AMARILLO', L: '🟡' },
    { E: 'Corporativo', F: 'LS AZUL BLANCO', L: '⚪' }
  ];
  const r = L.asignarLetras(filas, ASIGNACION);
  // Una sola fila de Corporativo: le toca a la letra con más peso (E aparece 2 veces), no a la primera.
  assert.deepStrictEqual(filas.map((f) => f.B), ['T:', 'AB:', 'E', 'F:', 'E']);
  assert.strictEqual(r.grupos.Branches['T:'].total, 1);
  assert.deepStrictEqual(r.grupos.Corporativo.E.porCirculo, { '⚪': 1 });
  assert.strictEqual(r.grupos.Corporativo['AH:'].total, 0);
  assert.deepStrictEqual(r.sinLista, []);
});

prueba('mover a alguien de equipo no rompe al otro; lista vacía deja B vacía y avisa', () => {
  // T: sale de Branches y entra a Corporativo.
  const config = JSON.parse(JSON.stringify(ASIGNACION));
  config.listas.Branches = ['AB:', 'E', 'F:'];
  config.listas.Corporativo.push('T:');
  const filas = [1, 2, 3, 4, 5, 6].map(() => ({ E: 'Houston', F: 'LP AZUL AMARILLO' }));
  L.asignarLetras(filas, config);
  assert.deepStrictEqual(contar(filas.map((f) => f.B)), { 'AB:': 2, E: 2, 'F:': 2 });

  config.listas.Corporativo = [];
  const corp = [{ E: 'Corporativo', F: '' }, { E: 'Desconocida', F: '' }];
  const r = L.asignarLetras(corp, config);
  assert.deepStrictEqual(corp.map((f) => f.B), [undefined, undefined]);
  assert.deepStrictEqual(r.sinLista.sort(), ['Corporativo (1)', 'Sin grupo (1)']);
});

prueba('calcularCorte asigna solo en ToConcentrado y lo anota en Comparación', () => {
  const excel = [
    TITULOS,
    fila({ Email: 'esta@x.com', IdFertilidadSucursal: 'SCHOU' }),
    fila({ Email: 'n1@x.com', IdFertilidadSucursal: 'SCHOU' }),
    fila({ Email: 'n2@x.com', IdFertilidadSucursal: 'IOC' })
  ];
  const r = L.calcularCorte(excel, ['esta@x.com'], [], 3, ASIGNACION);
  assert.deepStrictEqual(r.raw.map((f) => f.B), ['', '', '']);
  assert.deepStrictEqual(r.toConcentrado.map((f) => f.B), ['T:', 'AB:']);
  assert.deepStrictEqual(r.comparacion.map((c) => c[6]), ['', 'T:', 'AB:']);
});

prueba('listas desde la hoja de asignaciones: por nombre de columna, respaldo si falta un grupo', () => {
  const hoja = [
    ['Branches', 'T:', 'AB:', '', 'E'],            // celda vacía en medio: se ignora
    ['  internacional ', 'RA2', 'M', 'M'],          // mayúsculas/espacios en el título no importan
    ['Notas', 'esto no es un grupo']               // columna desconocida: se ignora
  ];
  const r = L.listasDeAsignacion(hoja, ASIGNACION.listas);
  assert.deepStrictEqual(r.listas.Branches, ['T:', 'AB:', 'E']);
  assert.deepStrictEqual(r.listas.Internacional, ['RA2', 'M', 'M']);
  assert.deepStrictEqual(r.listas.Corporativo, ASIGNACION.listas.Corporativo);
  assert.deepStrictEqual(r.fuente, { Branches: 'hoja', Internacional: 'hoja', Corporativo: 'respaldo' });
  assert.strictEqual(r.avisos.length, 1);
  assert.ok(r.avisos[0].includes('Corporativo'));
  // Columna con título pero sin letras = lista vacía a propósito (B vacía), no respaldo.
  const vacia = L.listasDeAsignacion([['Branches'], ['Internacional', 'M'], ['Corporativo', 'E']], ASIGNACION.listas);
  assert.deepStrictEqual(vacia.listas.Branches, []);
  assert.deepStrictEqual(vacia.avisos, []);
});

prueba('ToRawDaniNew: quita títulos, filas vacías, lo de abajo de la última fecha y columnas vacías del final', () => {
  const f = new Date(2026, 9, 21, 8, 30);
  const valores = [
    ['A', 'B', 'C', 'D', 'E'],       // 1 títulos
    [f, '', 'z', '', ''],            // 2
    ['', '', '', '', ''],            // 3 vacía
    ['', '', '', '', ''],            // 4 vacía
    [f, '', '', 'w', ''],            // 5 última con fecha en A
    [null, '', '', '', '']           // 6 vacía
  ];
  const r = L.limpiezaToRaw(valores);
  assert.deepStrictEqual(r.bloquesFilas, [[6, 1], [3, 2], [1, 1]]);  // de abajo hacia arriba
  assert.strictEqual(r.filasQueQuedan, 2);
  assert.strictEqual(r.ultimaColumna, 4);                        // E (solo título) se va; B (vacía en medio) se queda
  // Lo de abajo de la última fecha en A (Total, filtros aplicados) se va, aunque tenga datos en otras columnas.
  const conTotal = [['Fecha', 'X'], [f, 'a'], [f, 'b'], ['Total', 'b'], [null, null], ['Applied filters:\nFechaDia…', null]];
  assert.deepStrictEqual(L.limpiezaToRaw(conTotal), { bloquesFilas: [[4, 3], [1, 1]], filasQueQuedan: 2, ultimaColumna: 2 });
  // Sin ninguna fecha en A (otro formato de Excel) no se corta nada: solo títulos y filas vacías.
  assert.strictEqual(L.limpiezaToRaw([['Fecha'], ['texto'], [''], ['Total']]).filasQueQuedan, 2);
  assert.deepStrictEqual(L.limpiezaToRaw([['solo títulos']]),
    { bloquesFilas: [[1, 1]], filasQueQuedan: 0, ultimaColumna: 0 });
});

prueba('rango para seleccionar ToConcentrado: B a L de las filas con datos', () => {
  assert.strictEqual(L.rangoDatosSalida(3, 10), 'B3:L12');
  assert.strictEqual(L.rangoDatosSalida(3, 1), 'B3:L3');
  assert.strictEqual(L.rangoDatosSalida(3, 0), '');
});

prueba('letras de la columna B que no están en la lista desplegable', () => {
  const lista = ['DV:', 'AH:', 'F:', 'AR', 'AL2', 'LR2', 'RA2', 'U:', 'YI', 'NA', 'PENDIENTE', 'AT:', 'B:', 'T:', 'AB:', 'E'];
  const r = L.letrasFueraDeLista(['RA2', 'M', 'AL2', '', 'M', 'X1 ', 'T:'], lista);
  assert.deepStrictEqual(r, { filas: [1, 4, 5], letras: ['M', 'X1'] });
  assert.deepStrictEqual(L.letrasFueraDeLista(['RA2', 'E'], lista), { filas: [], letras: [] });
});

prueba('plantilla: títulos con valores; fila modelo solo con formato y listas', () => {
  const lista = { condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'M' }] }, strict: true, showCustomUi: true };
  const rowData = [{ values: [
    { userEnteredValue: { stringValue: 'Correo1' }, userEnteredFormat: { textFormat: { bold: true } }, note: 'n' },
    {}
  ] }];
  assert.deepStrictEqual(L.filasParaPlantilla(rowData, true), [{ values: [
    { userEnteredValue: { stringValue: 'Correo1' }, note: 'n', userEnteredFormat: { textFormat: { bold: true } } }, {}] }]);
  const modelo = [{ values: [{ userEnteredValue: { stringValue: 'E' }, note: 'x', userEnteredFormat: { a: 1 }, dataValidation: lista }] }];
  assert.deepStrictEqual(L.filasParaPlantilla(modelo, false), [{ values: [{ userEnteredFormat: { a: 1 }, dataValidation: lista }] }]);
  // La conversión de validaciones se aplica; undefined = sin validación.
  assert.deepStrictEqual(L.filasParaPlantilla(modelo, false, () => undefined), [{ values: [{ userEnteredFormat: { a: 1 } }] }]);
});

prueba('plantilla: anchos/altos y ocultas', () => {
  const r = L.dimensionesParaPlantilla([{ pixelSize: 120 }, {}, { pixelSize: 21, hiddenByUser: true }], 'ROWS', 7, 2);
  assert.deepStrictEqual(r, [
    { updateDimensionProperties: { range: { sheetId: 7, dimension: 'ROWS', startIndex: 2, endIndex: 3 },
      properties: { pixelSize: 120 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: 7, dimension: 'ROWS', startIndex: 4, endIndex: 5 },
      properties: { pixelSize: 21, hiddenByUser: true }, fields: 'pixelSize,hiddenByUser' } }]);
});

prueba('plantilla: formato condicional solo de la fila modelo, hasta el final de la hoja', () => {
  const regla = (ranges) => ({ ranges, booleanRule: { condition: { type: 'TEXT_EQ' }, format: {} } });
  const reglas = [
    regla([{ sheetId: 1, startRowIndex: 2, endRowIndex: 60000, startColumnIndex: 4, endColumnIndex: 5 }]), // E3:E60000
    regla([{ sheetId: 1, startColumnIndex: 6, endColumnIndex: 7 }]),                                     // G (toda)
    regla([{ sheetId: 1, startRowIndex: 0, endRowIndex: 2 }]),                                           // solo títulos
    regla([{ sheetId: 1, startRowIndex: 40000, startColumnIndex: 10, endColumnIndex: 11 }])              // K40001 en adelante
  ];
  const r = L.reglasCondicionalesParaPlantilla(reglas, 51362, 2, 9);
  assert.deepStrictEqual(r.map((p) => p.addConditionalFormatRule.rule.ranges), [
    [{ sheetId: 9, startRowIndex: 2, startColumnIndex: 4, endColumnIndex: 5 }],
    [{ sheetId: 9, startRowIndex: 0, startColumnIndex: 6, endColumnIndex: 7 }],
    [{ sheetId: 9, startRowIndex: 2, startColumnIndex: 10, endColumnIndex: 11 }]
  ]);
  assert.deepStrictEqual(r.map((p) => p.addConditionalFormatRule.index), [0, 1, 2]);
});

prueba('plantilla: solo las celdas combinadas de los títulos', () => {
  const r = L.combinadasParaPlantilla([
    { sheetId: 1, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
    { sheetId: 1, startRowIndex: 5, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 1 }], 2, 9);
  assert.deepStrictEqual(r, [{ mergeCells: { mergeType: 'MERGE_ALL',
    range: { sheetId: 9, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 } } }]);
});

prueba('correos de prueba: solo prueba@ y test@ exactos, sin importar mayúsculas ni dominio', () => {
  const n = ['prueba', 'test'];
  ['prueba@gmail.com', 'TEST@hotmail.com', ' Prueba@empresa.mx '].forEach((e) => assert.ok(L.esCorreoDePrueba(e, n), e));
  ['tester@gmail.com', 'prueba1@gmail.com', 'ana.test@gmail.com', 'mi@test.com', '', 'test'].forEach((e) =>
    assert.ok(!L.esCorreoDePrueba(e, n), e));
  assert.ok(!L.esCorreoDePrueba('prueba@gmail.com', []));
});

prueba('correos de prueba no cuentan: ni Raw, ni ToConcentrado, ni para duplicados', () => {
  const excel = [
    TITULOS,
    fila({ Email: 'prueba@gmail.com', Phone: '+15550000001' }),   // 2: prueba
    fila({ Email: 'real@x.com', Phone: '+15550000001' }),         // 3: mismo teléfono que la de prueba -> NO es duplicada
    fila({ Email: 'Test@Hotmail.com', Phone: '' })                // 4: prueba
  ];
  const r = L.calcularCorte(excel, [], [], 3, undefined, ['prueba', 'test']);
  assert.strictEqual(r.omitidasPrueba, 2);
  assert.strictEqual(r.omitidasDuplicadas, 0);
  assert.deepStrictEqual(r.raw.map((f) => f.D), ['real@x.com']);
  assert.deepStrictEqual(r.toConcentrado.map((f) => f.D), ['real@x.com']);
  assert.deepStrictEqual(r.comparacion.map((c) => c[3]), ['Omitida: correo de prueba', 'NUEVA -> ToConcentrado',
    'Omitida: correo de prueba']);
  // Sin lista, todo cuenta como antes.
  assert.strictEqual(L.calcularCorte(excel, [], [], 3).raw.length, 2);
});

console.log(`\n${pruebas} pruebas OK`);
