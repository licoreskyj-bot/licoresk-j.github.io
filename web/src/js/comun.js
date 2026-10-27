/**
 * LICORES K&J — utilidades compartidas por el navegador (main.js) y el horneado (scripts/hornear.mjs).
 * Sin DOM: este módulo también corre en Node.
 */

const FORMATO_COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const precio = (valor) => FORMATO_COP.format(valor);

// Ley 1480: precio por unidad de medida en cada ficha (por litro o por kilo).
export function precioPorUnidad(producto) {
    const um = producto.unidadMedida;
    if (!um || !um.cantidad) return null;
    if (um.unidad === 'ml') return `${precio(Math.round(producto.precio / um.cantidad * 1000))} por litro`;
    if (um.unidad === 'kg') return `${precio(Math.round(producto.precio / um.cantidad))} por kilo`;
    return null;
}

// El regalo que ya ganó el pedido y el siguiente que podría ganar.
export function regalos(subtotal, escalera) {
    const ordenada = [...escalera].sort((a, b) => a.desde - b.desde);
    const ganado = ordenada.filter(r => subtotal >= r.desde).pop() || null;
    const siguiente = ordenada.find(r => subtotal < r.desde) || null;
    return { ganado, siguiente, falta: siguiente ? siguiente.desde - subtotal : 0 };
}

// Silueta por categoría mientras no haya fotos reales de producto.
const SILUETAS = {
    botella: '<path d="M27 6h10v10c0 4 7 7 7 15v31a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V31c0-8 7-11 7-15z"/><rect x="25" y="2" width="14" height="6" rx="1.5"/>',
    lata: '<rect x="18" y="10" width="28" height="52" rx="5"/><rect x="21" y="6" width="22" height="5" rx="2"/>',
    hielo: '<rect x="12" y="20" width="22" height="22" rx="4" transform="rotate(-8 23 31)"/><rect x="30" y="32" width="22" height="22" rx="4" transform="rotate(10 41 43)"/>',
    combo: '<path d="M17 8h8v8c0 3 5 6 5 12v28a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V28c0-6 5-9 5-12z"/><rect x="36" y="26" width="18" height="33" rx="4"/>',
};
const SILUETA_DE = { cerveza: 'lata', combos: 'combo', acompanantes: 'hielo' };

export function iconoProducto(categoria, clase = 'icono-producto') {
    const forma = SILUETAS[SILUETA_DE[categoria] || 'botella'];
    return `<svg class="${clase}" viewBox="0 0 64 68" aria-hidden="true" focusable="false"><g fill="currentColor">${forma}</g></svg>`;
}

export const escapar = (texto) => String(texto)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
