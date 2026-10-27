/**
 * LICORES K&J — carrito (copiado de Bersaglio, js/core/cart.js) (localStorage backed).
 *
 * API:
 *   cart.getAll()                  → array of {slug, qty, addedAt}
 *   cart.get(slug)                 → single item or null
 *   cart.has(slug)                 → boolean
 *   cart.add(slug, qty=1)          → add or increment (tope MAX_POR_PRODUCTO); returns units added
 *   cart.remove(slug)              → remove all quantities of slug
 *   cart.toggle(slug)              → returns true if added, false if removed
 *   cart.updateQty(slug, qty)      → set absolute qty (1..MAX_POR_PRODUCTO, or removes if <=0)
 *   cart.clear()
 *   cart.count()                   → total items (sum of qty)
 *   cart.onChange(cb)              → returns unsubscribe fn
 */

import { MAX_POR_PRODUCTO } from './comun.js';

// El tope ÚNICO vive en comun.js (también lo lee el horneado para el max del campo de la ficha).
export { MAX_POR_PRODUCTO };

const STORAGE_KEY = 'kyj-carrito-v1';
const tope = (n) => Math.min(MAX_POR_PRODUCTO, Math.max(1, Math.floor(Number(n)) || 1));
const _listeners = new Set();
let _items = load();

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const lista = raw ? JSON.parse(raw) : [];
        // Saneado: lo guardado antes del tope (p. ej. 198) vuelve a quedar dentro del rango.
        return Array.isArray(lista)
            ? lista.filter(i => i && typeof i.slug === 'string').map(i => ({ ...i, qty: tope(i.qty) }))
            : [];
    } catch {
        return [];
    }
}

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_items));
    } catch {
        // Storage quota exceeded or disabled — silently degrade.
    }
}

function notify() {
    persist();
    for (const cb of _listeners) {
        try { cb([..._items]); } catch (e) { console.error('[cart] listener error:', e); }
    }
}

export const cart = {
    getAll() { return [..._items]; },
    get(slug) { return _items.find(i => i.slug === slug) || null; },
    has(slug) { return _items.some(i => i.slug === slug); },
    count() { return _items.reduce((sum, i) => sum + (i.qty || 1), 0); },

    // Devuelve cuántas unidades entraron de verdad (0 si ya estaba en el tope).
    add(slug, qty = 1) {
        const existing = _items.find(i => i.slug === slug);
        const antes = existing ? existing.qty || 1 : 0;
        const despues = tope(antes + qty);
        if (existing) {
            if (despues === antes) return 0;
            existing.qty = despues;
        } else {
            _items.push({ slug, qty: despues, addedAt: Date.now() });
        }
        notify();
        return despues - antes;
    },

    remove(slug) {
        const before = _items.length;
        _items = _items.filter(i => i.slug !== slug);
        if (_items.length !== before) notify();
    },

    toggle(slug) {
        if (this.has(slug)) {
            this.remove(slug);
            return false;
        }
        this.add(slug, 1);
        return true;
    },

    updateQty(slug, qty) {
        const item = _items.find(i => i.slug === slug);
        if (!item) return;
        if (qty <= 0) {
            this.remove(slug);
        } else if (tope(qty) !== item.qty) {
            item.qty = tope(qty);
            notify();
        }
    },

    clear() {
        if (!_items.length) return;
        _items = [];
        notify();
    },

    onChange(cb) {
        _listeners.add(cb);
        return () => _listeners.delete(cb);
    },
};

// Sync between tabs via storage event
window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY) return;
    _items = load();
    for (const cb of _listeners) {
        try { cb([..._items]); } catch {}
    }
});

export default cart;
