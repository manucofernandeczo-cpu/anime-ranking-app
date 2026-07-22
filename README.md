# Mi Ranking de Anime

App para llevar tu lista de anime con imagen y orden personalizado (drag & drop).

## Cómo subirla a internet y ponerla en tu celular (gratis)

### Opción recomendada: Vercel + GitHub

1. **Crea una cuenta gratis** en https://github.com (si no tienes) y otra en https://vercel.com (puedes entrar directamente con tu cuenta de GitHub).
2. **Sube esta carpeta a un repositorio de GitHub**:
   - Ve a https://github.com/new, crea un repositorio (por ejemplo `anime-list-app`).
   - Sube todos estos archivos ahí (puedes arrastrar la carpeta completa en la web de GitHub, usando "uploading an existing file").
3. **Conecta ese repositorio con Vercel**:
   - Entra a https://vercel.com/new
   - Elige "Import" en el repositorio que acabas de crear.
   - Vercel detecta automáticamente que es un proyecto Vite/React. Solo dale a "Deploy".
   - En 1-2 minutos te da una URL como `https://anime-list-app.vercel.app`.
4. **Instálala en tu celular**:
   - Abre esa URL en Chrome (Android) o Safari (iPhone).
   - Android (Chrome): menú (⋮) → "Añadir a pantalla de inicio" o "Instalar app".
   - iPhone (Safari): botón compartir (□↑) → "Añadir a pantalla de inicio".
   - Quedará como un ícono normal, abre a pantalla completa, sin barra de navegador.

Cada vez que quieras actualizar la app, subes los cambios a GitHub y Vercel la vuelve a publicar sola.

### Subir imágenes desde tu galería
En vez de pegar una URL, toca el cuadro de imagen junto al nombre y elige una foto de tu celular (cámara o galería). La imagen se redimensiona y comprime automáticamente antes de guardarse, para no ocupar mucho espacio.

### Uso sin conexión (offline)
La primera vez que abras la app necesitas internet (para que el celular la descargue). Después de eso:
- El "Service Worker" guarda una copia de la app en el celular, así que abre sin conexión.
- Las imágenes y la lista se guardan con IndexedDB (más espacio que localStorage), directamente en tu dispositivo.
- Si actualizas la app (subes cambios nuevos a Vercel), la próxima vez que tengas internet se actualiza sola en segundo plano.

### Nota sobre tus datos
- Tus datos (lista + imágenes) quedan en TU dispositivo, nadie más los ve, y no requieren conexión para usarse.
- Si borras los datos del navegador o desinstalas la app, se pierde la lista.
- No se sincroniza entre dispositivos (por ejemplo, celular y computador son listas separadas).

Si más adelante quieres que se sincronice entre dispositivos, se puede agregar una base de datos (por ejemplo Supabase, que también tiene plan gratis) — avísame y lo armamos.
