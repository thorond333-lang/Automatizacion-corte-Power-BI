# Automatización corte Power BI

App web (Google Apps Script) que hace el corte diario:

1. Se sube el Excel del día en la página.
2. Sus filas, ya con el formato de Concentrado, se escriben en la pestaña **Raw** del archivo **Corte** de quien la usa.
3. Se comparan con la pestaña **Concentrado** de Document 2 (UpdateInConcert): una fila ya existe si coincide el **email O el teléfono** (teléfono = últimos 10 dígitos).
4. Las filas que no están en Concentrado se escriben en la pestaña **ToConcentrado**.

Raw y ToConcentrado se reemplazan completas en cada corte. Document 2 solo se lee.
Cada persona tiene su propio archivo Corte en su Drive (se crea solo la primera vez), y todos usan la misma página web.

- Instalación y publicación: [docs/INSTALACION.md](docs/INSTALACION.md)
- Reglas de formato (qué columna del Excel va en cada columna): [docs/FORMATO.md](docs/FORMATO.md)

## Archivos

| Archivo | Qué es |
|---|---|
| `apps_script/Config.gs` | IDs, nombres de pestañas, filas de títulos y fila modelo |
| `apps_script/Logica.gs` | Comparación y formato (sin llamadas a Google; probado con node) |
| `apps_script/Codigo.gs` | Página web, lectura del Excel y de Concentrado, escritura en Corte, `crearPlantilla()` |
| `apps_script/Index.html` | La página |
| `apps_script/appsscript.json` | Manifiesto: app web "ejecutar como el usuario", servicios Drive y Sheets |
| `tests/test_logica.js` | Pruebas con datos inventados: `node tests/test_logica.js` |
