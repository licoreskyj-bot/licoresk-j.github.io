import { defineConfig } from 'vite';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = import.meta.dirname;
const NO_SON_PAGINAS = new Set(['node_modules', 'dist', 'public', 'src', 'scripts']);

// Toda página .html horneada (inicio, catálogo, carrito, legales y producto/<slug>/) es una entrada.
function paginas(dir = RAIZ, entradas = {}) {
    for (const nombre of readdirSync(dir)) {
        if (NO_SON_PAGINAS.has(nombre)) continue;
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) paginas(ruta, entradas);
        else if (nombre.endsWith('.html')) entradas[relative(RAIZ, ruta).replace(/\\/g, '/').replace(/\.html$/, '')] = ruta;
    }
    return entradas;
}

export default defineConfig({
    build: { rollupOptions: { input: paginas() } },
});
