# Instalación (una sola vez, con tu cuenta personal de Google)

La app se instala en **tu cuenta personal** (Gmail). Cada persona del equipo la usa con **su propia cuenta**, personal o
del trabajo: la página corre con la cuenta de quien la abre, su archivo Corte se crea en **su** Drive y lee Concentrado
con **su** acceso.

## Antes de empezar: el acceso a UpdateInConcert

La app lee Concentrado con la cuenta de quien la usa, así que **cada cuenta que use la app (empezando por tu cuenta
personal) debe poder ver UpdateInConcert**. Para probar con tu cuenta personal tienes dos caminos:

- **A. Que te den acceso:** pide a quien administra UpdateInConcert que lo comparta como **Lector** con tu cuenta personal.
- **B. Un documento de prueba:** en tu cuenta personal, crea una hoja con una pestaña **Concentrado** con los mismos
  títulos y columnas y algunas filas, y pon su ID en `ID_DOCUMENTO_2` (paso 4). El ID es la parte del enlace entre
  `/d/` y `/edit`.

UpdateInConcert tiene datos personales de pacientes. Antes de copiar datos reales a una cuenta personal, confirma que tu
empresa lo permite.

## 1. Crea el proyecto

1. Entra a <https://script.google.com> con tu **cuenta personal**.
2. Haz clic en **Nuevo proyecto** y ponle de nombre **Automatización corte Power BI**.

## 2. Muestra el manifiesto

**Engrane** (Configuración del proyecto) → marca **Mostrar el archivo de manifiesto "appsscript.json" en el editor** →
regresa al editor (**< >**).

## 3. Pega los archivos

Los archivos están en la carpeta `apps_script/` del repositorio. En GitHub, ábrelos y usa el botón **copiar**.

| En el editor | Cómo se crea | Contenido |
|---|---|---|
| `appsscript.json` | ya existe | `appsscript.json` (reemplaza todo) |
| `Código.gs` | ya existe | `Codigo.gs` (reemplaza todo) |
| `Config.gs` | **+** → Secuencia de comandos → `Config` | `Config.gs` |
| `Logica.gs` | **+** → Secuencia de comandos → `Logica` | `Logica.gs` |
| `Index.html` | **+** → HTML → `Index` (con I mayúscula) | `Index.html` |

Guarda con **Ctrl + S**. En **Servicios** (barra izquierda) deben aparecer **Drive** y **Sheets**. Si no aparecen, agrégalos con
**+**: *Drive API* (v3, identificador `Drive`) y *Google Sheets API* (identificador `Sheets`).

## 4. Revisa `Config`

- `ID_DOCUMENTO_2`: deja el de UpdateInConcert (camino A) o pon el de tu documento de prueba (camino B).
- `FILAS_ENCABEZADO: 2`: los títulos de Concentrado están en la fila 2. Si están solo en la fila 1, pon 1.
- `FILA_MODELO_CONCENTRADO: 51414`: la fila cuyo formato se copia. En un documento de prueba, pon una fila que exista
  y tenga el formato correcto (por ejemplo, la 3).

## 5. Crea la plantilla

1. En la lista de funciones (junto a **Ejecutar**) elige **crearPlantilla** → **Ejecutar**.
2. Permisos: **Revisar permisos** → tu cuenta → si aparece *"Google no verificó esta app"*: **Configuración avanzada** →
   **Ir a Automatización corte Power BI (no seguro)** → **Permitir**. Sale porque la app es tuya y no está publicada
   en Google; es normal.
3. Espera a que termine (puede tardar un par de minutos). Concentrado **no se modifica**, solo se lee.
4. En el **Registro de ejecución** aparece la URL de la plantilla. Revisa que tenga las pestañas **Raw** y **ToConcentrado**,
   los títulos, el formato y **ningún dato**.
5. **Compartir** → en *Acceso general* elige **Cualquier persona que tenga el vínculo** como **Lector**. Así cualquier
   cuenta (personal o del trabajo) puede hacer su copia. La plantilla no tiene datos.

> Para copiar el formato exacto, la función copia Concentrado completo y luego borra las filas de datos. El historial de
> versiones de la plantilla conserva ese momento: solo lo ve quien puede **editar** la plantilla (tú), no los lectores.

## 5b. Hoja de asignaciones (columna B)

1. En tu Drive: **Nuevo → Hojas de cálculo de Google**, nombre **Asignaciones corte**.
2. En la **primera pestaña**, fila 1: `Internacional` (A1), `Corporativo` (B1), `Branches` (C1). Debajo de cada título, una
   letra por celda, sin dejar huecos (una letra repetida recibe más filas).
3. **Compartir:** agrega a la otra persona que podrá cambiarla como **Editor**; en *Acceso general* elige
   **Cualquier persona que tenga el vínculo** como **Lector** (así la app la puede leer con la cuenta de cualquiera).
4. Copia su ID (la parte del enlace entre `/d/` y `/edit`) y pégalo en `Config` → `ID_HOJA_ASIGNACIONES: '...'`.
   Guarda (**Ctrl + S**).

Si la hoja no se puede leer, la app usa las listas de respaldo de `Config` y lo avisa en rojo.

## 6. Publica la página

1. **Implementar** → **Nueva implementación** → engrane → **Aplicación web**.
2. **Ejecutar como:** **Usuario que accede a la aplicación web**.
3. **Quién tiene acceso:** **Cualquier usuario con una Cuenta de Google**.
4. **Implementar** → copia la **URL de la aplicación web** (termina en `/exec`). Es la página para todo el equipo.

## 7. Prueba tú primero

Abre la URL `/exec` con tu cuenta personal, acepta los permisos, sube el Excel y haz clic en **Ejecutar corte**. Se crea tu
archivo **Corte** en tu Drive y la página muestra el resumen.

## 8. Dale acceso al equipo

Para cada persona:

1. Que su cuenta (personal o del trabajo) pueda **ver UpdateInConcert** (o el documento de `ID_DOCUMENTO_2`).
2. Mándale la URL `/exec`. La primera vez verá *"Google no verificó esta app"*: **Configuración avanzada** →
   **Ir a Automatización corte Power BI (no seguro)** → **Permitir**.

Notas:

- **Si alguien tiene abiertas varias cuentas de Google en el navegador**, la página puede fallar o usar otra cuenta.
  Que la abra en una ventana de incógnito o en un perfil del navegador con solo la cuenta que va a usar.
- **Con cuentas del trabajo:** el administrador de la empresa puede bloquear apps no verificadas de fuera de la
  empresa (*"Acceso bloqueado"*). En ese caso, esa persona usa su cuenta personal o se le pide al administrador
  que permita la app.
- Google permite hasta **100 usuarios** en una app no verificada; para un equipo alcanza.

## Si después cambio el código

Pega los archivos nuevos → **Implementar** → **Administrar implementaciones** → lápiz → **Versión: Nueva versión** →
**Implementar**. La URL no cambia y todos reciben el cambio.
