# Automatización corte Power BI: contexto para Claude Code

App web en **Google Apps Script** (ver README.md). El usuario escribe en español; responde en español, simple.
Se usa una vez al día por varias personas; cada una tiene su archivo **Corte** propio. Se instala en la cuenta
personal (Gmail) del usuario y se publica para "cualquier usuario con cuenta de Google" (personal o del trabajo),
ejecutándose como quien la abre: cada cuenta necesita poder ver Document 2.

- **Document 2 = UpdateInConcert**, pestaña **Concentrado**: solo se LEE (columnas D email y K teléfono). Nunca escribir ahí.
  Es el mismo documento del proyecto `thorond333-lang/appointment-manager-repo` (app de escritorio de citas); las reglas de
  email/teléfono (`claveEmail`, `claveTelefono`, `clavesTelefonoDeCelda`) copian las de ese proyecto.
- **Datos personales:** nunca subir Excel/CSV ni datos reales; las pruebas usan datos inventados.
- Lógica pura en `apps_script/Logica.gs` (probar con `node tests/test_logica.js`); llamadas a Google en `Codigo.gs`.
- Desde el entorno de Claude no hay acceso a Google (docs.google.com/drive bloqueados): lo de `Codigo.gs` no se ha podido
  probar aquí. Decirlo siempre.
- Formato de salida, comparación y **asignaciones de la columna B** (reglas del usuario): `docs/FORMATO.md`.
  Las listas de asignación cambian seguido: se leen en cada corte de la hoja compartida "Asignaciones corte"
  (`ID_HOJA_ASIGNACIONES`); si falla, respaldo `Config.gs` → `ASIGNACION.listas` + aviso en rojo (decisión del usuario).
