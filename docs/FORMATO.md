# Formato de Raw y ToConcentrado

Las dos pestañas son una copia de Concentrado (mismos títulos, colores, listas desplegables y casillas,
tomados de la fila modelo `FILA_MODELO_CONCENTRADO`). La app solo escribe valores en las columnas **B a K**.

| Columna | Valor | Origen en el Excel |
|---|---|---|
| B | *(vacía, pendiente de definir)* | — |
| C | Fecha (sin hora) | `FechaDealCompleta` |
| D | Email tal cual | `Email` (columna E) |
| E | Sucursal: `SCHOU`→Houston, `IOC`→Orange County, `INCOR`→Corporativo, cualquier otra→Internacional | `IdFertilidadSucursal` |
| F | Perfil: Blue Yellow→LP AZUL AMARILLO, Blue Intermediate→LP AZUL INTERMEDIO, Blue White→LS AZUL BLANCO, Green Yellow→LP VERDE AMARILLO, Green Intermediate→LS VERDE INTERMEDIO, Green White→LS VERDE BLANCO (otro→vacío) | `UnificadoPerfil` |
| G | `NewLead` | fijo |
| H | `Idioma \| Nombre \| Edad \| Perfil de usuario \| Pregunta` (idioma en→Ing, es→Esp; pregunta vacía→None; en una sola línea) | `idiomaRespuesta`, `Firstname`, `edad`, `DescFertilidadUserpersona`, `PreguntaAbierta` |
| I, J | vacías | — |
| K | Teléfono, solo dígitos | `Phone` (columna F) |

## Reglas de comparación y limpieza

- Ya está en Concentrado si coincide el **email** (minúsculas, sin espacios; sin `@` no cuenta) **o** el **teléfono**
  (solo dígitos, últimos 10; menos de 7 dígitos no cuenta). Una celda K con varios números separados por `,` `;` `/` cuenta cada uno.
- Se leen las columnas **D** y **K** de Concentrado en una sola lectura y se compara en memoria.
- Filas del Excel sin email ni teléfono: se omiten.
- Duplicadas dentro del mismo Excel (mismo email o mismo teléfono): se queda la primera.

Estas reglas están en `apps_script/Logica.gs` (`MAPA_SUCURSAL`, `MAPA_PERFIL`, `MAPA_IDIOMA`, `formatearFila`).
