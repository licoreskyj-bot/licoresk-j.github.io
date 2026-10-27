/**
 * LICORES K&J — calculadora de fiesta (lógica pura, sin DOM: también se prueba en Node).
 * Es una GUÍA para planear, no una promesa ni una invitación a tomar más: los supuestos se
 * muestran al cliente tal cual (calculadora/index.html, «¿Cómo lo calculamos?»).
 */

export const SUPUESTOS = {
    tragosPrimeraHora: 2,     // por persona
    tragosPorHoraSiguiente: 1, // por persona
    porcionMl: { cerveza: 330 }, // una lata o botella
    porcionLicorMl: 45,        // un trago servido
    mezcladorPorTragoMl: 150,  // gaseosa o soda por trago de ron, whisky o vodka
    hieloKgPorPersona: 0.5,
    aguasPorPersona: 1,
    botellaGenericaMl: 750,
    mezcladorGenericoMl: 1500,
};

const CON_MEZCLADOR = new Set(['ron', 'whisky', 'vodka']);
const S = SUPUESTOS;

export const tragosTotales = (personas, horas) =>
    Math.ceil(personas * (S.tragosPrimeraHora + Math.max(0, horas - 1) * S.tragosPorHoraSiguiente));

const esHielo = (p) => p.uso === 'hielo' || (p.unidadMedida?.unidad === 'kg' && /hielo/i.test(p.nombre));
const esAgua = (p) => p.uso === 'agua' || /^agua\b/i.test(p.nombre);
const esMezclador = (p) => p.uso === 'mezclador' || /gaseosa|soda|t[oó]nica/i.test(p.nombre);

// La presentación que menos sobra para cubrir `necesidad` (ml o kg); empate → menos unidades.
function mejorPresentacion(candidatos, necesidad) {
    let mejor = null;
    for (const p of candidatos) {
        const tam = p.unidadMedida.cantidad;
        const qty = Math.max(1, Math.ceil(necesidad / tam));
        const sobra = qty * tam - necesidad;
        if (!mejor || sobra < mejor.sobra || (sobra === mejor.sobra && qty < mejor.qty)) mejor = { p, qty, sobra };
    }
    return mejor;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * @param {{personas:number, horas:number, gustos:string[]}} entrada
 * @param {object[]} productos  catalogo.productos (vacío = solo sugerencia en texto)
 * @param {Record<string,string>} nombres  id de categoría → nombre visible
 */
export function sugerirFiesta({ personas, horas, gustos }, productos = [], nombres = {}) {
    const total = tragosTotales(personas, horas);
    const vendibles = productos.filter(p => !p.agotado && p.unidadMedida?.cantidad);
    const lineas = [];
    const porGusto = gustos.length ? Math.ceil(total / gustos.length) : 0;
    let tragosConMezcla = 0;

    for (const g of gustos) {
        const nombre = (nombres[g] || g).toLowerCase();
        if (g === 'cerveza') {
            const ml = porGusto * S.porcionMl.cerveza;
            const m = mejorPresentacion(vendibles.filter(p => p.categoria === g && p.unidadMedida.unidad === 'ml'), ml);
            lineas.push(m
                ? { tipo: 'cerveza', producto: m.p, qty: m.qty }
                : { tipo: 'cerveza', texto: `${plural(porGusto, 'cerveza', 'cervezas')} de 330 ml (unos ${plural(Math.ceil(porGusto / 6), 'six-pack', 'six-pack')})` });
            continue;
        }
        const ml = porGusto * S.porcionLicorMl;
        if (CON_MEZCLADOR.has(g)) tragosConMezcla += porGusto;
        const m = mejorPresentacion(vendibles.filter(p => p.categoria === g && p.unidadMedida.unidad === 'ml'), ml);
        const botellas = Math.ceil(ml / S.botellaGenericaMl);
        lineas.push(m
            ? { tipo: g, producto: m.p, qty: m.qty }
            : { tipo: g, texto: `${plural(botellas, 'botella', 'botellas')} de 750 ml de ${nombre}` });
    }

    if (tragosConMezcla) {
        const ml = tragosConMezcla * S.mezcladorPorTragoMl;
        const m = mejorPresentacion(vendibles.filter(p => esMezclador(p) && p.unidadMedida.unidad === 'ml'), ml);
        lineas.push(m
            ? { tipo: 'mezclador', producto: m.p, qty: m.qty }
            : { tipo: 'mezclador', texto: `${plural(Math.ceil(ml / S.mezcladorGenericoMl), 'botella', 'botellas')} de 1,5 L de gaseosa o soda para mezclar` });
    }

    if (gustos.length) {
        const kg = personas * S.hieloKgPorPersona;
        const hielo = mejorPresentacion(vendibles.filter(p => esHielo(p) && p.unidadMedida.unidad === 'kg'), kg);
        lineas.push(hielo
            ? { tipo: 'hielo', producto: hielo.p, qty: hielo.qty }
            : { tipo: 'hielo', texto: `${Math.ceil(kg)} kg de hielo` });

        const aguas = Math.ceil(personas * S.aguasPorPersona);
        const agua = vendibles.find(esAgua);
        lineas.push(agua
            ? { tipo: 'agua', producto: agua, qty: aguas }
            : { tipo: 'agua', texto: `${plural(aguas, 'agua', 'aguas')} para hidratarse` });
    }

    const enCatalogo = lineas.filter(l => l.producto);
    const subtotal = enCatalogo.reduce((s, l) => s + l.producto.precio * l.qty, 0);
    return { tragos: total, porGusto, lineas, enCatalogo, subtotal };
}
