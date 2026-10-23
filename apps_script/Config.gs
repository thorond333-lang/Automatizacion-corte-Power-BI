// Configuración de la app. Lo que normalmente haría falta cambiar está aquí.

var CONFIG = {
  // Document 2 (UpdateInConcert) y su pestaña Concentrado. Solo se LEE, nunca se escribe.
  ID_DOCUMENTO_2: '1-8_Da8pSun1DWgCrTfSHkmjRLKLYqq8XzTGyqSRZmAk',
  PESTANA_CONCENTRADO: 'Concentrado',

  // Filas de títulos arriba de los datos en Concentrado (en la captura los títulos están en la fila 2).
  // Raw y ToConcentrado usan las mismas filas de títulos, porque salen de una copia de Concentrado.
  FILAS_ENCABEZADO: 2,

  // Fila de Concentrado cuyo formato (colores, listas desplegables, casillas) copian Raw y ToConcentrado.
  // Solo la usa crearPlantilla(). Para cambiarla: cambiar el número, ejecutar crearPlantilla y publicar una Nueva
  // versión; cada usuario recibe un Corte nuevo con este formato en su siguiente corte.
  FILA_MODELO_CONCENTRADO: 51362,

  // Columnas de Concentrado donde están el email y el teléfono (las que se comparan).
  COLUMNA_EMAIL_CONCENTRADO: 'D',
  COLUMNA_TELEFONO_CONCENTRADO: 'K',

  // Archivo de cada usuario y sus pestañas.
  NOMBRE_CORTE: 'Corte',
  PESTANA_RAW: 'Raw',
  PESTANA_TO_CONCENTRADO: 'ToConcentrado',
  PESTANA_COMPARACION: 'Comparación',  // detalle de cada fila del Excel: encontrada o no, y en qué fila
  PESTANA_BITACORA: 'Bitácora',

  // Correos de prueba: si la parte antes de la @ es exactamente una de estas (sin importar mayúsculas ni dominio),
  // la fila no cuenta para el corte (no va a Raw ni a ToConcentrado). Ej.: prueba@gmail.com, test@hotmail.com.
  CORREOS_DE_PRUEBA: ['prueba', 'test'],

  // Archivo (y pestaña) con la copia del Excel sin títulos; uno por usuario, se reemplaza en cada corte.
  NOMBRE_TORAW: 'ToRawDaniNew',

  // ---------- Asignaciones (columna B de ToConcentrado) ----------
  // Las listas se leen en cada corte de la hoja compartida "Asignaciones corte": fila 1 = nombre del grupo
  // (Internacional, Corporativo, Branches) y debajo una letra por celda. Una letra repetida recibe más filas
  // (2 veces = el doble). Cambiarla ahí NO requiere publicar nada.
  // ID de esa hoja = la parte del enlace entre /d/ y /edit. Vacío = se usan las listas de respaldo de abajo.
  ID_HOJA_ASIGNACIONES: '1lRA2PtUIS7NffO0PUVY4vLtVRJt2MEzZvIwHuSD-ysU',

  ASIGNACION: {
    // Respaldo: se usan (con un aviso en rojo en la página) si la hoja no se puede leer o le falta un grupo.
    // Cambiar estas requiere guardar y publicar una Nueva versión.
    listas: {
      Internacional: ['RA2', 'AL2', 'RA2', 'AL2', 'RA2', 'AL2', 'M', 'T:', 'AH:', 'AB:', 'M'],
      Corporativo: ['AH:', 'E', 'AL2', 'F:', 'E', 'F:'],
      Branches: ['T:', 'AB:', 'E', 'F:']
    },
    // Columna E (sucursal) -> grupo de la lista de arriba.
    grupos: {
      'Internacional': 'Internacional',
      'Corporativo': 'Corporativo',
      'Houston': 'Branches',
      'Orange County': 'Branches'
    }
  }
};
