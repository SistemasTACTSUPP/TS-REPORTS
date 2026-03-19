# Logos en el PDF

Los logos del encabezado y el fondo se cargan por **URL** para que funcionen en Supabase sin depender del sistema de archivos del deploy.

## Opción recomendada: Supabase Storage

1. En el panel de Supabase: **Storage** → **New bucket**.
2. Crea un bucket público, por ejemplo: `ctpat-logs`.
3. Sube estos archivos a la raíz del bucket:
   - `ctpat.png` (izquierda)
   - `caterpillar.png` (centro, por defecto)
   - `oea.jpeg` (derecha)
   - `logo.png` (fondo de página)
   - `caja.jpg` (diagrama de puntos de verificación en página 2)
   - Opcionales: `komatsu.png`, `john_deere.png` si usas otros servicios.
4. Asegúrate de que el bucket sea **público** (Policy: permitir lectura pública).
5. En la Edge Function, añade la variable de entorno (opcional si el bucket se llama `ctpat-logs`):
   - `LOGO_BUCKET` = `ctpat-logs`

La URL que usará la función será:
`https://<tu-proyecto>.supabase.co/storage/v1/object/public/ctpat-logs/ctpat.png`

## Opción alternativa: URL base propia

Si usas otro almacenamiento (CDN, S3, etc.):

1. Sube ahí los mismos archivos.
2. En la Edge Function define la variable de entorno:
   - `LOGO_BASE_URL` = `https://tu-dominio.com/ruta/logos`
3. La función cargará: `LOGO_BASE_URL/ctpat.png`, etc.

## Orden de carga

1. Si existe `LOGO_BASE_URL` → se usa esa URL base.
2. Si no, si existe `SUPABASE_URL` → se usa Storage: `.../storage/v1/object/public/<LOGO_BUCKET>/<archivo>`.
3. Si no, se intenta leer desde `./assets/` (solo funciona en entornos donde los archivos están en disco).
