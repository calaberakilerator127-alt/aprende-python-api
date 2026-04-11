# 🚀 Guía de Despliegue Profesional (Render.com)

Esta guía detalla los pasos de nivel Senior para desplegar el proyecto "Aprende Python" en Render, asegurando que el frontend y el backend estén perfectamente sincronizados.

## 1. Base de Datos (PostgreSQL)

1. En el panel de Render, haz clic en **New** > **PostgreSQL**.
2. **Name:** `aprende-python-db`
3. **Region:** Selecciona la misma región para todos los servicios (ej. `Oregon`).
4. Una vez creada, copia el **Internal Database URL** (para el backend) y el **External Database URL** (para tu uso local si lo necesitas).

## 2. Backend (Web Service)

1. **New** > **Web Service** > Conecta tu repositorio.
2. **Name:** `aprende-python-api`
3. **Root Directory:** `server`
4. **Environment:** `Node`
5. **Build Command:** `npm install`
6. **Start Command:** `node index.js`
7. **Environment Variables:**
   - `DATABASE_URL`: (Pega el *Internal Database URL* del paso anterior)
   - `JWT_SECRET`: (Genera una cadena aleatoria larga)
   - `NODE_ENV`: `production`
   - `ALLOWED_ORIGINS`: `https://tu-dominio-vercel.app,http://localhost:5173` (Actualiza esto cuando tengas el link de Vercel)
   - `PORT`: `10000` (Render lo asigna automáticamente, pero es bueno tenerlo de respaldo)

## 3. Frontend (Static Site)

1. **New** > **Static Site** > Conecta tu repositorio.
2. **Name:** `aprende-python-web`
3. **Root Directory:** `.` (La raíz del proyecto)
4. **Build Command:** `npm run render-build`
5. **Publish Directory:** `dist`
6. **Environment Variables:**
   - `VITE_API_URL`: `https://aprende-python-api.onrender.com/api` (Usa el link de tu Web Service)
7. **Redirects (SPA handling):**
   - No necesitas configurar esto manualmente en el dashboard porque ya creamos el archivo `public/_redirects` que Render detecta automáticamente.

## 4. Inicialización de la Base de Datos

Para crear las tablas iniciales:
1. Conéctate a tu base de datos usando una herramienta como **DBeaver** o **TablePlus** usando el *External Database URL*.
2. Ejecuta el contenido del archivo `server/schema.sql`.

## 5. Verificación Final

Una vez desplegado:
- Visita `https://aprende-python-api.onrender.com/api/health` para confirmar que el backend y la DB están conectados.
- Abre tu sitio frontend y verifica que no haya errores de CORS en la consola del navegador.

> [!TIP]
> Si cambias el dominio de Vercel, recuerda actualizar la variable `ALLOWED_ORIGINS` en el Web Service de Render y reiniciar el servicio.
