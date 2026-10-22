# Formato de Raw y ToConcentrado

Las dos pestañas son una copia de Concentrado (mismos títulos, colores, listas desplegables y casillas,
tomados de la fila modelo `FILA_MODELO_CONCENTRADO`). La app solo escribe valores en las columnas **B a L**.

| Columna | Valor | Origen en el Excel |
|---|---|---|
| B | **Solo en ToConcentrado:** letra asignada (ver *Asignaciones*). En Raw queda vacía. | `CONFIG.ASIGNACION` |
| C | Fecha de contacto (sin hora), la del Excel | `FechaDealCompleta` |
| D | Email tal cual | `Email` (columna E) |
| E | Sucursal: `SCHOU`→Houston, `IOC`→Orange County, `INCOR`→Corporativo, cualquier otra→Internacional | `IdFertilidadSucursal` |
| F | Perfil: Blue Yellow→LP AZUL AMARILLO, Blue Intermediate→LP AZUL INTERMEDIO, Blue White→LS AZUL BLANCO, Green Yellow→LP VERDE AMARILLO, Green Intermediate→LS VERDE INTERMEDIO, Green White→LS VERDE BLANCO (si falta I o J, o la combinación no existe→vacío) | `DescFertilidadPerfil` (columna I) + `DescFertilidadScore` (columna J) |
| G | `NewLead` | fijo |
| H | `Idioma \| Nombre \| Edad \| Perfil de usuario \| Pregunta` (idioma en→Ing, es→Esp; pregunta vacía→None; en una sola línea) | `idiomaRespuesta`, `Firstname`, `edad`, `DescFertilidadUserpersona`, `PreguntaAbierta` |
| I, J | vacías | — |
| K | Teléfono, solo dígitos | `Phone` (columna F) |
| L | Círculo según F: AMARILLO→🟡, BLANCO→⚪, INTERMEDIO→🟠 (F vacía→vacía) | columna F ya calculada |

## Reglas de comparación y limpieza

- Ya está en Concentrado si coincide el **email** (minúsculas, sin espacios; sin `@` no cuenta) **o** el **teléfono**
  (solo dígitos, últimos 10; menos de 7 dígitos no cuenta). Una celda K con varios números separados por `,` `;` `/` cuenta cada uno.
- Se leen las columnas **D** y **K** de Concentrado en una sola lectura y se compara en memoria.
- Filas del Excel sin email ni teléfono: se omiten.
- Duplicadas dentro del mismo Excel (mismo email o mismo teléfono): se queda la primera.

Estas reglas están en `apps_script/Logica.gs` (`MAPA_SUCURSAL`, `MAPA_PERFIL`, `MAPA_IDIOMA`, `formatearFila`).

## Pestaña Comparación

En cada corte se reescribe la pestaña **Comparación** del archivo Corte (sin formato), con una fila por cada fila del Excel:
fila del Excel, email y teléfono tal como se compararon, resultado (`Ya está (email)`, `Ya está (teléfono)`,
`Ya está (email y teléfono)`, `NUEVA -> ToConcentrado`, `Omitida: …`) y la fila de Concentrado donde se encontró.
Sirve para revisar por qué una fila pasó (o no) a ToConcentrado.

## Asignaciones (columna B de ToConcentrado)

Las listas se leen **en cada corte** de la hoja compartida **"Asignaciones corte"** (`ID_HOJA_ASIGNACIONES` en `Config.gs`):
fila 1 = nombre del grupo (`Internacional`, `Corporativo`, `Branches`), debajo una letra por celda. Cambiarla no requiere publicar
nada. La editan solo el dueño y otra persona; el resto del equipo la puede ver (por vínculo).

**Respaldo:** si la hoja no está configurada o no se puede leer, o le falta la columna de un grupo, se usan las listas de
`Config.gs` → `ASIGNACION.listas` para ese grupo y la página muestra un aviso en rojo (también queda en la Bitácora).
Una columna con título pero sin letras = lista vacía a propósito: la B queda vacía y la página lo avisa.

| Grupo | Sucursales (columna E) | Lista inicial |
|---|---|---|
| Internacional | Internacional | RA2, AL2, RA2, AL2, RA2, AL2, M, T:, AH:, AB:, M |
| Corporativo | Corporativo | AH:, E, AL2, F:, E, F: |
| Branches | Houston + Orange County (un solo grupo) | T:, AB:, E, F: |

Reglas (decididas por el usuario):

- **Cantidad:** una letra repetida recibe más filas en esa proporción (RA2 ×3, M ×2, T: ×1 → M recibe el doble que T:).
  Se reparte con el método del resto mayor: las filas que sobran van a la fracción más grande y, si empatan, a la letra que
  aparece primero en la lista.
- **Se empieza de cero en cada corte** (no se recuerda lo del día anterior).
- **Mezcla pareja de leads:** dentro de cada grupo, cada tipo de lead (perfil de la columna F; se reparten primero los
  tipos con menos filas) se divide entre las letras en proporción a su parte del total, así a todas les toca un poco de cada uno.
- **Orden:** ToConcentrado conserva el orden del Excel; dentro de cada tipo las letras se van alternando.
- **Listas independientes:** mover a alguien de equipo = quitar su letra de una lista y ponerla en otra; los demás grupos no
  cambian. Una lista vacía (o una sucursal sin grupo) deja la B vacía y la página lo avisa.

La página muestra cuántas filas recibió cada letra, su mezcla de círculos (🟡 ⚪ 🟠) y la lista usada (hoja o respaldo), y la pestaña Comparación tiene la columna
**Asignado (B)**.

## ToConcentrado: lista para copiar

La columna **A** de ToConcentrado está oculta. El botón **ToConcentrado** de la página abre la pestaña con las celdas de datos
de la **B a la L** ya seleccionadas (en el enlace va `&range=B3:L…`), para copiarlas sin seleccionar a mano.

## ToRawDaniNew

Un archivo **ToRawDaniNew** en el Drive de cada usuario (uno solo; se reemplaza en cada corte y el enlace no cambia), con una
**copia exacta** de la hoja del Excel cargado (valores y formato) **sin la fila de títulos**, sin filas vacías, sin columnas
vacías al final y **hasta la última fila cuya columna A tiene fecha y hora** (se quitan `Total`, `Applied filters: …` y
todo lo que esté debajo; si ninguna fila tiene fecha en A, no se corta nada). Las columnas vacías de en medio (por ejemplo `DescFertilidadMotivo`) **se quedan**, para que cada dato siga
en la misma columna que en el Excel.
El botón **ToRawDaniNew** de la página abre el archivo con todas las celdas con datos ya seleccionadas, listas para copiar.

## Letras que no están en la lista desplegable de la columna B

La columna B de ToConcentrado tiene la lista desplegable copiada de Concentrado, que **rechaza** lo que no está en ella
(en el primer corte real faltaba `M` y el corte se detuvo). Ahora, en cada corte:

1. La B recupera su validación original (la de la fila modelo de Raw, donde la B nunca se llena).
2. Solo en las celdas cuya letra no está en la lista, la validación pasa a "mostrar advertencia" y la letra se escribe
   igual (triángulo de advertencia, sin color). Las demás celdas conservan la lista y sus colores.
3. La página avisa en rojo qué letras faltan. Para que salgan con color: agregarlas a la lista desplegable de la columna B
   de ToConcentrado en el archivo Corte (y en la plantilla, para los usuarios nuevos).
