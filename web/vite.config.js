import { defineConfig } from 'vite';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const RAIZ = import.meta.dirname;
const NO_SON_PAGINAS = new Set(['node_modules', 'dist', 'public', 'src', 'scripts']);

// Toda página horneada (index.html, 404.html y <carpeta>/index.html) es una entrada.
function paginas(dir = RAIZ, entradas = {}) {
    for (const nombre of readdirSync(dir)) {
        if (NO_SON_PAGINAS.has(nombre) || nombre.startsWith('.')) continue;
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) paginas(ruta, entradas);
        else if (nombre.endsWith('.html')) entradas[relative(RAIZ, ruta).replace(/\\/g, '/').replace(/\.html$/, '')] = ruta;
    }
    return entradas;
}

// Todos los archivos de una carpeta (rutas relativas con «/»), en orden estable.
function archivosDe(dir, base = dir, lista = []) {
    for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) archivosDe(ruta, base, lista);
        else lista.push(relative(base, ruta).replace(/\\/g, '/'));
    }
    return lista.sort();
}

// Service worker versionado por build: la versión es la huella de TODO lo que queda en dist/,
// también lo que Vite copia tal cual desde public/ (fotos de /productos/, /marca/, /fuentes/).
// Así, si el panel reemplaza una foto con el mismo nombre, cambia la versión, el SW estrena caché
// y borra la anterior (nunca sirve una versión vieja).
function serviceWorker() {
    return {
        name: 'kyj-service-worker',
        apply: 'build',
        // writeBundle: Vite ya copió public/ (prepareOutDir va antes de escribir) y descartó los
        // trozos vacíos de cada página, así que dist/ tiene exactamente lo que se despliega.
        writeBundle({ dir }) {
            const huella = createHash('sha256');
            const archivos = archivosDe(dir).filter(n => n !== 'sw.js');
            for (const nombre of archivos) {
                huella.update(nombre);
                huella.update(readFileSync(join(dir, nombre)));
            }
            const version = huella.digest('hex').slice(0, 12);
            // Precarga solo lo que toda visita usa. El logo grande NO: según la pantalla se pide el
            // de 640 o el de 1200, y el SW guarda el que de verdad se pidió.
            const precarga = [
                '/', '/catalogo/', '/carrito/', '/calculadora/',
                ...archivos.filter(n => /^assets\/.+\.(js|css|woff2)$/.test(n)).map(n => `/${n}`),
                '/fuentes/montserrat-latin-wght-normal.woff2',
                '/fuentes/playfair-display-latin-wght-normal.woff2',
                '/marca/monograma-96.webp',
            ];
            const plantilla = readFileSync(join(RAIZ, 'src/sw.js'), 'utf8');
            writeFileSync(join(dir, 'sw.js'), plantilla.replace('__KJ_VERSION__', version).replace('__KJ_PRECARGA__', JSON.stringify(precarga)));
        },
    };
}

export default defineConfig({
    appType: 'mpa',
    build: { rollupOptions: { input: paginas() } },
    plugins: [serviceWorker()],
});
