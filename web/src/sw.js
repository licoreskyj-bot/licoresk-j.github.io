/**
 * LICORES K&J — service worker (plantilla; vite.config.js la escribe en dist/sw.js en cada build
 * con su versión y su lista de precarga). Reglas (docs/41 §2.1):
 *  - Nunca sirve versiones viejas: las páginas van SIEMPRE a la red primero; la copia guardada
 *    solo se usa sin conexión. Cada build tiene su propia caché y al activarse borra las demás.
 *  - Nunca guarda el carrito ni datos personales: el carrito vive en el navegador (localStorage),
 *    aquí solo se guardan archivos públicos del sitio; las páginas se guardan sin «?…» y nada
 *    que no sea GET del mismo sitio pasa por aquí (WhatsApp, Wompi y demás quedan fuera).
 */
const VERSION = '__KJ_VERSION__';
const PRECARGA = __KJ_PRECARGA__;
const CACHE = `kyj-${VERSION}`;

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(PRECARGA.map(url => new Request(url, { cache: 'reload' }))))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(claves => Promise.all(claves.filter(k => k.startsWith('kyj-') && k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

const SIN_CONEXION = `<!doctype html><html lang="es-CO"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sin conexión · LICORES K&amp;J</title><body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#110E0D;color:#F8EEDB;font:400 17px/1.6 system-ui,sans-serif;text-align:center;padding:24px"><main><h1 style="font-family:Georgia,serif;color:#FACE70">Sin conexión</h1><p>Revisa tu señal e inténtalo de nuevo. Tu pedido sigue guardado en este teléfono.</p><p><strong>El exceso de alcohol es perjudicial para la salud.</strong><br><strong>Prohíbase el expendio de bebidas embriagantes a menores de edad.</strong></p></main></body></html>`;

async function paginaRedPrimero(peticion) {
    const url = new URL(peticion.url);
    const clave = url.origin + url.pathname; // sin «?…»: nunca se guarda lo que venga en la URL
    const cache = await caches.open(CACHE);
    try {
        const respuesta = await fetch(peticion);
        if (respuesta.ok && respuesta.type === 'basic') cache.put(clave, respuesta.clone());
        return respuesta;
    } catch {
        return (await cache.match(clave)) || (await cache.match(`${url.origin}/`))
            || new Response(SIN_CONEXION, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
}

async function archivoCachePrimero(peticion) {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(peticion);
    if (guardada) return guardada;
    const respuesta = await fetch(peticion);
    if (respuesta.ok && respuesta.type === 'basic') cache.put(peticion, respuesta.clone());
    return respuesta;
}

self.addEventListener('fetch', (e) => {
    const peticion = e.request;
    if (peticion.method !== 'GET') return;
    const url = new URL(peticion.url);
    if (url.origin !== self.location.origin || url.pathname === '/sw.js') return;
    if (peticion.mode === 'navigate') { e.respondWith(paginaRedPrimero(peticion)); return; }
    // Archivos con huella (/assets/*) o públicos del sitio: no cambian dentro de una versión.
    if (!url.search && /^\/(assets|marca|fuentes|productos)\//.test(url.pathname)) e.respondWith(archivoCachePrimero(peticion));
});
