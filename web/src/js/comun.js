/**
 * LICORES K&J — utilidades compartidas por el navegador (main.js) y el horneado (scripts/hornear.mjs).
 * Sin DOM: este módulo también corre en Node.
 */

const FORMATO_COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const precio = (valor) => FORMATO_COP.format(valor);

// Tope ÚNICO de unidades por producto: carrito, ficha, calculadora y el HTML horneado lo leen de
// aquí (nunca un 99 suelto). Si Daniel lo cambia, se cambia solo en esta línea.
export const MAX_POR_PRODUCTO = 99;

// URLs limpias (cada página es una carpeta con su index.html).
export const RUTAS = {
    inicio: '/',
    catalogo: '/catalogo/',
    combos: '/catalogo/?c=combos',
    carrito: '/carrito/',
    calculadora: '/calculadora/',
    terminos: '/terminos/',
    privacidad: '/privacidad/',
};
export const rutaProducto = (p) => `/producto/${p.slug}/`;
export const rutaCategoria = (id) => `/catalogo/?c=${encodeURIComponent(id)}`;

// Ley 1480: precio por unidad de medida en cada ficha (por litro o por kilo). En un combo,
// `unidadMedida.de` dice de qué licor se cuentan los litros («por litro de aguardiente»).
export function precioPorUnidad(producto) {
    const um = producto.unidadMedida;
    if (!um || !um.cantidad) return null;
    const de = um.de ? ` de ${um.de}` : '';
    if (um.unidad === 'ml') return `${precio(Math.round(producto.precio / um.cantidad * 1000))} por litro${de}`;
    if (um.unidad === 'kg') return `${precio(Math.round(producto.precio / um.cantidad))} por kilo${de}`;
    return null;
}

// «29 % Vol.» con coma decimal, como se escribe en Colombia.
export const gradoTexto = (grado) => (grado ? `${String(grado).replace('.', ',')} % Vol.` : '');

// El regalo que ya ganó el pedido y el siguiente que podría ganar.
export function regalos(subtotal, escalera) {
    const ordenada = [...escalera].sort((a, b) => a.desde - b.desde);
    const ganado = ordenada.filter(r => subtotal >= r.desde).pop() || null;
    const siguiente = ordenada.find(r => subtotal < r.desde) || null;
    return { ganado, siguiente, falta: siguiente ? siguiente.desde - subtotal : 0 };
}

// Silueta GENÉRICA por categoría mientras no haya fotos reales (sin marcas: 42 §4.6). Cada
// categoría tiene su forma (aguardiente alta de hombro redondo, ron de hombro ancho, whisky
// licorera cuadrada, vodka esbelta) y el tratamiento 3D del logo: metal #kj-metal, volumen con
// brillo especular #kj-volumen, etiqueta, sombra de contacto, charco de luz y reflejo en el podio.
// Todas apoyan en y=66. Los degradados los declara una sola vez cada página (molde de hornear.mjs).
const FORMAS = {
    botella: {
        cuerpo: '<path d="M27 8h10v8c0 4 7 7 7 15v31a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V31c0-8 7-11 7-15z"/><rect x="25.5" y="3" width="13" height="6" rx="1.5"/>',
        etiqueta: '<rect x="20" y="40" width="24" height="12"/>',
        brillo: '<path d="M24.6 36c0-4 1.6-6.6 3.6-8.4"/><path d="M24.6 41v17"/>',
        ancho: 24,
    },
    aguardiente: {
        cuerpo: '<path d="M29 9h6v11c0 3.5 7 5.5 7 12.5v29.5a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V32.5c0-7 7-9 7-12.5z"/><rect x="27.8" y="2" width="8.4" height="8" rx="1.6"/>',
        etiqueta: '<rect x="22" y="40" width="20" height="16" rx="1"/>',
        brillo: '<path d="M25.6 36.5c.3-3 1.8-5 3.4-6.4"/><path d="M25.4 41v19"/>',
        ancho: 20,
    },
    ron: {
        cuerpo: '<path d="M28 10h8v7c0 2.5 11 2.5 11 9v36a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4V26c0-6.5 11-6.5 11-9z"/><rect x="26.5" y="3" width="11" height="8" rx="2"/>',
        etiqueta: '<ellipse cx="32" cy="45" rx="11.5" ry="8.5"/>',
        brillo: '<path d="M21.2 29.5c1.4-2 3.6-3 6.2-3.6"/><path d="M21 34v26"/>',
        ancho: 30,
    },
    whisky: {
        cuerpo: '<path d="M27.5 13h9v5l9.5 4.5c2 1 3 2.5 3 4.5v35a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V27c0-2 1-3.5 3-4.5l9.5-4.5z"/><path d="M25 13.5h14l-1.4-8.2a2 2 0 0 0-2-1.6h-7.2a2 2 0 0 0-2 1.6z"/>',
        etiqueta: '<rect x="19" y="38" width="26" height="15" rx="1"/>',
        brillo: '<path d="M19.4 28.5 26 25"/><path d="M19.2 32v28"/>',
        ancho: 34,
    },
    vodka: {
        cuerpo: '<path d="M29.6 8h4.8v8c0 6 6.6 9 6.6 16v30a4 4 0 0 1-4 4H27a4 4 0 0 1-4-4V32c0-7 6.6-10 6.6-16z"/><rect x="28.6" y="1.5" width="6.8" height="7.5" rx="1.4"/>',
        etiqueta: '<rect x="25.5" y="37" width="13" height="19" rx="1"/>',
        brillo: '<path d="M26.2 33c.6-3.4 2-6 3.6-8.6"/><path d="M26 38v22"/>',
        ancho: 18,
    },
    lata: {
        cuerpo: '<path d="M20 14h24a3 3 0 0 1 3 3v1.5c0 1-1 1.5-1 2.5v39c0 1 1 1.5 1 2.5V63a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3v-1.5c0-1 1-1.5 1-2.5V21c0-1-1-1.5-1-2.5V17a3 3 0 0 1 3-3z"/><rect x="21" y="10" width="22" height="5" rx="2"/>',
        etiqueta: '<rect x="18" y="29" width="28" height="20"/>',
        brillo: '<path d="M22.6 21v38"/>',
        ancho: 30,
    },
    combo: {
        cuerpo: '<path d="M16 15h7v7c0 3 5 5 5 11v29a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V33c0-6 5-8 5-11z"/><rect x="15" y="9" width="9" height="7" rx="1.5"/><path d="M36 33h14a3 3 0 0 1 3 3v27a3 3 0 0 1-3 3H36a3 3 0 0 1-3-3V36a3 3 0 0 1 3-3z"/><rect x="35" y="30" width="16" height="4" rx="1.5"/>',
        etiqueta: '<rect x="11" y="41" width="17" height="12" rx="1"/><rect x="33" y="43" width="20" height="12"/>',
        brillo: '<path d="M14 37v20"/><path d="M36.4 38v24"/>',
        ancho: 44,
    },
    hielo: {
        cuerpo: '<rect x="12" y="35" width="22" height="22" rx="4" transform="rotate(-8 23 46)"/><rect x="30" y="43" width="22" height="22" rx="4" transform="rotate(10 41 54)"/><rect x="23" y="20" width="17" height="17" rx="3.5" transform="rotate(16 31.5 28.5)"/>',
        etiqueta: '',
        brillo: '<path d="M16 41l7-1"/><path d="M33.6 48l6 1"/>',
        ancho: 42,
    },
};
const FORMA_DE = { cerveza: 'lata', aguardiente: 'aguardiente', ron: 'ron', whisky: 'whisky', vodka: 'vodka', combos: 'combo', acompanantes: 'hielo' };

/**
 * @param {string} categoria  id de categoría (o 'botella' para agua y mezcladores)
 * @param {string} clase      clase CSS del <svg>
 * @param {boolean} piso      con podio (sombra, charco de luz y reflejo); sin él, ícono compacto
 */
export function iconoProducto(categoria, clase = 'icono-producto', piso = true) {
    const f = FORMAS[FORMA_DE[categoria] || categoria] || FORMAS.botella;
    const r = f.ancho / 2;
    const suelo = piso
        ? `<ellipse cx="32" cy="66.5" rx="31" ry="6" fill="url(#kj-charco)"/><g transform="matrix(1 0 0 -1 0 132)" fill="url(#kj-reflejo)">${f.cuerpo}</g><ellipse cx="32" cy="66" rx="${r + 4}" ry="2.4" fill="rgb(17 14 13 / .6)"/>`
        : '';
    return `<svg class="${clase}" viewBox="0 0 64 ${piso ? 84 : 68}" aria-hidden="true" focusable="false">${suelo}<g fill="url(#kj-metal)">${f.cuerpo}</g>${f.etiqueta ? `<g fill="rgb(80 24 2 / .34)" stroke="rgb(253 237 167 / .45)" stroke-width=".6">${f.etiqueta}</g>` : ''}<g fill="url(#kj-volumen)">${f.cuerpo}</g><g fill="none" stroke="rgb(255 252 240 / .6)" stroke-width="1.05" stroke-linecap="round">${f.brillo}</g></svg>`;
}

// Foto real si el producto la tiene (public/productos/), si no la silueta dorada.
export function imagenProducto(p, clase = 'icono-producto') {
    if (p.imagen) {
        return `<img class="foto-producto" src="${escapar(p.imagen)}" alt="${escapar(p.nombre)}" width="600" height="600" loading="lazy" decoding="async">`;
    }
    return iconoProducto(p.categoria, clase);
}

// Íconos de interfaz (trazo de 24 px).
const ICONOS = {
    casa: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
    vitrina: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
    regalo: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12"/><path d="M12 8v12.5"/><path d="M12 8c-1.5-3-5-4-5.5-2S9 8 12 8Zm0 0c1.5-3 5-4 5.5-2S15 8 12 8Z"/>',
    bolsa: '<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    chat: '<path d="M4 19V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H7.5Z"/><path d="M8 9h8M8 12.5h5"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    calculadora: '<rect x="5" y="3" width="14" height="18" rx="2.2"/><rect x="8" y="6" width="8" height="3.5" rx=".8"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>',
    tarjeta: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    repetir: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
    cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    menos: '<path d="M5 12h14"/>',
    buscar: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    frio: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
    cedula: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h4M14.5 13.5h3"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
};
export const icono = (nombre, clase = 'ico') =>
    `<svg class="${clase}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre] || ''}</svg>`;

export const escapar = (texto) => String(texto)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
