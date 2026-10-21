// Configuración de la app. Lo que normalmente haría falta cambiar está aquí.

var CONFIG = {
  // Document 2 (UpdateInConcert) y su pestaña Concentrado. Solo se LEE, nunca se escribe.
  ID_DOCUMENTO_2: '1-8_Da8pSun1DWgCrTfSHkmjRLKLYqq8XzTGyqSRZmAk',
  PESTANA_CONCENTRADO: 'Concentrado',

  // Filas de títulos arriba de los datos en Concentrado (en la captura los títulos están en la fila 2).
  // Raw y ToConcentrado usan las mismas filas de títulos, porque salen de una copia de Concentrado.
  FILAS_ENCABEZADO: 2,

  // Fila de Concentrado cuyo formato (colores, listas desplegables, casillas) copian Raw y ToConcentrado.
  // Solo la usa crearPlantilla(), una vez.
  FILA_MODELO_CONCENTRADO: 51414,

  // Columnas de Concentrado donde están el email y el teléfono (las que se comparan).
  COLUMNA_EMAIL_CONCENTRADO: 'D',
  COLUMNA_TELEFONO_CONCENTRADO: 'K',

  // Archivo de cada usuario y sus pestañas.
  NOMBRE_CORTE: 'Corte',
  PESTANA_RAW: 'Raw',
  PESTANA_TO_CONCENTRADO: 'ToConcentrado',
  PESTANA_BITACORA: 'Bitácora'
};
