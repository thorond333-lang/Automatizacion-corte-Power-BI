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
    [2, 'esta@x.com', '5550000010', 'Ya está (email)', 5, ''],
    [3, 'nueva@x.com', '5550000020', 'Ya está (teléfono)', '', 4],
    [4, 'esta@x.com', '5550000099', 'Omitida: duplicada de la fila 2 del Excel', '', ''],
    [5, '', '', 'Omitida: sin email ni teléfono', '', ''],
    [6, 'otra@x.com', '5550000030', 'NUEVA -> ToConcentrado', '', '']
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

console.log(`\n${pruebas} pruebas OK`);
