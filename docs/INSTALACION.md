# Instalación (una sola vez, la hace quien administra la app)

## 1. Crear el proyecto

1. Entra a <https://script.google.com> → **Nuevo proyecto**. Ponle de nombre *Automatización corte Power BI*.
2. **Configuración del proyecto** (engrane) → marca **Mostrar el archivo de manifiesto "appsscript.json" en el editor**.
3. En **Editor**, crea estos archivos y pega el contenido del mismo nombre de la carpeta `apps_script/`:
   - Secuencias de comandos: `Config`, `Logica`, `Codigo` (borra el `Código.gs` que viene vacío o pega ahí `Codigo`).
   - HTML: `Index`.
   - Reemplaza todo `appsscript.json`.
4. Guarda. En **Servicios** deben aparecer **Drive** y **Sheets** (vienen en el manifiesto; si no aparecen, agrégalos con **+**).

## 2. Revisar `Config`

- `FILAS_ENCABEZADO`: cuántas filas de títulos tiene Concentrado arriba de los datos (en la captura: **2**).
- `FILA_MODELO_CONCENTRADO`: la fila cuyo formato se copia (**51414**).

## 3. Crear la plantilla

1. Arriba, elige la función **crearPlantilla** → **Ejecutar**. Acepta los permisos.
2. Copia la URL que aparece en el **Registro de ejecución**. Se crea "Corte (plantilla) - no editar" en tu Drive con las
   pestañas Raw y ToConcentrado, con los títulos y el formato de Concentrado y **sin datos**.
3. Compártela como **Lector** con quienes usarán la app (o con todo el dominio).

> Para tomar el formato exacto, la función copia la pestaña Concentrado completa a la plantilla y luego borra todas las filas
> de datos. El historial de versiones de la plantilla conserva ese momento; las copias de cada usuario no lo traen.

## 4. Publicar la página

1. **Implementar → Nueva implementación** → tipo **App web**.
2. **Ejecutar como:** *Usuario que accede a la app web*. **Quién tiene acceso:** *Cualquier usuario de tu organización*.
3. **Implementar** y copia la URL `/exec`. Esa es la página que usa todo el equipo.

Cada persona necesita poder **ver** Document 2 y la plantilla. La primera vez que abre la página, Google le pide permisos,
y en su primer corte se crea su archivo **Corte** en su Drive.

## Actualizar la app después de un cambio

Pega los archivos nuevos → **Implementar → Administrar implementaciones** → lápiz → **Versión: Nueva versión** → **Implementar**.
La URL no cambia y todos reciben el cambio.
