/**
 * LICORES K&J — comportamiento de todas las páginas (Ola 1: sin pago en línea).
 * Las páginas ya vienen horneadas en HTML (scripts/hornear.mjs); aquí solo va lo interactivo.
 * Sistema visual y lecciones: brain-private/licoreskyj/docs/42-SISTEMA-VISUAL-WEB.md.
 */
import { cart, MAX_POR_PRODUCTO } from './cart.js';
import { observeReveals } from './reveal.js';
import { precio, precioPorUnidad, regalos, imagenProducto, iconoProducto, icono, escapar, RUTAS, rutaProducto } from './comun.js';
import { sugerirFiesta, tragosTotales, SUPUESTOS } from './fiesta.js';
import catalogo from '../data/catalogo.json';
import cfg from '../data/config.json';

const porSlug = new Map(catalogo.productos.map(p => [p.slug, p]));
const disponible = (slug) => porSlug.has(slug) && !porSlug.get(slug).agotado;
const nombreCategoria = Object.fromEntries(catalogo.categorias.map(c => [c.id, c.nombre]));
const MENSAJE_PAUSA = cfg.mensajePausa || 'Por ahora no estamos recibiendo pedidos. Vuelve pronto.';
const TOPE_TEXTO = `Máximo ${MAX_POR_PRODUCTO} unidades por producto. Para más, escríbenos por WhatsApp.`;
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const wa = (texto) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(texto)}`;
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Memoria del navegador: SOLO comodidades (nunca datos de entrega). Puede fallar (modo privado).
// (La pausa de la portada, «kyj-quieto-v1», ya no existe: el script del <head> la borra si quedó guardada.)
const CLAVES = { edad: 'kyj-edad-v1', texto: 'kyj-texto-v1', zona: 'kyj-zona-v1', ultimo: 'kyj-ultimo-v1', desliza: 'kyj-desliza-v1' };
const memoria = {
    leer(clave) { try { return localStorage.getItem(clave); } catch { return null; } },
    guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin memoria: sigue funcionando */ } },
};

// Parámetros de prueba (capturas): SOLO en un servidor local, nunca para visitantes reales.
const esLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const PRUEBA = esLocal ? (new URLSearchParams(location.search).get('prueba') || '').split(',') : [];

// ── Bloqueo de scroll compatible con iPhone (position:fixed, no overflow) [[BERS:L-01]].
let yBloqueo = 0;
let bloqueos = 0;
function bloquearScroll() {
    if (bloqueos++) return;
    yBloqueo = scrollY;
    Object.assign(document.body.style, { position: 'fixed', top: `-${yBloqueo}px`, left: '0', right: '0' });
}
function desbloquearScroll() {
    if (--bloqueos > 0) return;
    bloqueos = 0;
    Object.assign(document.body.style, { position: '', top: '', left: '', right: '' });
    scrollTo(0, yBloqueo);
}

// ── Verificación de edad: capa sobre el contenido ya servido (no redirige). La pinta el script
// del <head> (clase .pedir-edad) para que no haya parpadeo; aquí se atiende la respuesta.
function puertaDeEdad() {
    const raiz = document.documentElement;
    const caja = $('#edad');
    if (!caja || !raiz.classList.contains('pedir-edad')) return;
    const fondo = $$('body > :not(#edad):not(script)');
    fondo.forEach(el => { el.inert = true; });
    document.body.classList.add('con-edad');
    $('[data-edad="si"]', caja).focus();
    caja.addEventListener('click', (e) => {
        const r = e.target.closest('[data-edad]')?.dataset.edad;
        if (r === 'si') {
            memoria.guardar(CLAVES.edad, 'si');
            raiz.classList.remove('pedir-edad');
            document.body.classList.remove('con-edad');
            fondo.forEach(el => { el.inert = false; });
            $('#contenido')?.focus({ preventScroll: true });
            if (avisoPendiente) { avisar(avisoPendiente); avisoPendiente = ''; }
        } else if (r === 'no') {
            location.href = 'https://www.icbf.gov.co/';
        }
    });
}

// ── Texto grande (recordado).
function textoGrande() {
    const raiz = document.documentElement;
    const pintar = () => $$('[data-texto-grande]').forEach(b => b.setAttribute('aria-pressed', String(raiz.classList.contains('texto-grande'))));
    pintar();
    document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-texto-grande]')) return;
        const grande = raiz.classList.toggle('texto-grande');
        memoria.guardar(CLAVES.texto, grande ? 'grande' : 'normal');
        pintar();
        avisar(grande ? 'Texto grande activado' : 'Texto normal');
    });
}

// ── Cabecera «isla»: se compacta a los 30 px, se oculta al bajar y vuelve al subir (BJ header.js).
function cabeceraIsla() {
    const c = $('[data-cabecera]');
    if (!c) return;
    let ultimo = scrollY;
    let raf = 0;
    const leer = () => {
        raf = 0;
        const y = Math.max(0, scrollY);
        c.classList.toggle('compacta', y > 30);
        if (y > ultimo + 6) {
            if (y > 260 && !c.contains(document.activeElement)) c.classList.add('oculta');
            ultimo = y;
        } else if (y < ultimo - 6) {
            c.classList.remove('oculta');
            ultimo = y;
        }
    };
    addEventListener('scroll', () => { raf ||= requestAnimationFrame(leer); }, { passive: true });
    c.addEventListener('focusin', () => c.classList.remove('oculta'));
    leer();
}

// ── Avisos. Con la capa de edad abierta el aviso no se ve: se guarda y sale al entrar.
let temporizadorToast;
let avisoPendiente = '';
function avisar(texto, verPedido = false) {
    const t = $('[data-toast]');
    if (!t) return;
    if (document.body.classList.contains('con-edad')) { avisoPendiente = texto; return; }
    $('[data-toast-texto]', t).textContent = texto;
    const enlace = $('[data-toast-enlace]', t);
    enlace.hidden = !verPedido || document.body.dataset.pagina === 'carrito';
    t.toggleAttribute('data-sin-enlace', enlace.hidden);
    t.classList.add('visible');
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => t.classList.remove('visible'), verPedido ? 3600 : 2400);
}

// El contador cuenta lo MISMO que el carrito muestra: solo productos del catálogo y no agotados.
function pintarContador() {
    const n = cart.getAll().filter(i => disponible(i.slug)).reduce((s, i) => s + (i.qty || 1), 0);
    for (const c of $$('[data-contador]')) {
        c.textContent = n;
        c.classList.toggle('lleno', n > 0);
    }
}

// Al arrancar se quita lo que ya no está en el catálogo (cambio de catálogo, producto borrado desde
// el panel) o quedó agotado, y se avisa con nombre cuando se conoce.
function depurarCarrito() {
    const fuera = cart.getAll().filter(i => !disponible(i.slug));
    if (!fuera.length) return;
    for (const i of fuera) cart.remove(i.slug);
    const nombres = fuera.map(i => porSlug.get(i.slug)?.nombre).filter(Boolean);
    avisar(nombres.length === fuera.length && nombres.length <= 2
        ? `${nombres.join(' y ')} ya no ${nombres.length === 1 ? 'está disponible' : 'están disponibles'}: lo quitamos de tu pedido`
        : `Quitamos de tu pedido ${fuera.length} ${fuera.length === 1 ? 'producto que ya no está disponible' : 'productos que ya no están disponibles'}`);
}

// ── Zona de domicilio («¿Llegamos a tu barrio?»), recordada y usada en el carrito.
const zonaGuardada = () => cfg.zonas.find(z => z.id === memoria.leer(CLAVES.zona)) || null;
function pintarZona() {
    const z = zonaGuardada();
    for (const el of $$('[data-zona-etiqueta]')) el.textContent = z ? z.nombre : 'Tu zona';
    for (const el of $$('[data-zona-chip]')) el.textContent = z ? `Entregamos en ${z.nombre}` : '¿Llegamos a tu barrio?';
    for (const el of $$('[data-zona-bento]')) el.textContent = z ? `Tu zona: ${z.nombre}. Domicilio ${precio(z.tarifa)}.` : 'Elige tu zona una vez y la recordamos.';
    for (const b of $$('[data-abrir-zona]')) b.classList.toggle('con-zona', Boolean(z));
}
function zonaDeDomicilio() {
    const dialogo = $('#zona');
    if (!dialogo) return;
    const abrir = () => {
        const actual = memoria.leer(CLAVES.zona);
        for (const r of $$('input[name="zona"]', dialogo)) r.checked = r.value === actual;
        if (typeof dialogo.showModal === 'function') dialogo.showModal(); else dialogo.setAttribute('open', '');
        bloquearScroll();
        ($('input[name="zona"]:checked', dialogo) || $('input[name="zona"]', dialogo))?.focus();
    };
    document.addEventListener('click', (e) => { if (e.target.closest('[data-abrir-zona]')) abrir(); });
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close('cerrar'); });
    dialogo.addEventListener('close', () => {
        desbloquearScroll();
        if (dialogo.returnValue !== 'guardar') return;
        const elegida = $('input[name="zona"]:checked', dialogo)?.value;
        if (!elegida) return;
        memoria.guardar(CLAVES.zona, elegida);
        pintarZona();
        const sel = $('[data-formulario] select[name="zona"]');
        if (sel) { sel.value = elegida; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        avisar(`Zona guardada: ${cfg.zonas.find(z => z.id === elegida).nombre}`);
    });
    pintarZona();
}

// ── Agregar al pedido (delegación) y selector de cantidad de la ficha.
function botonesAgregar() {
    document.addEventListener('click', (e) => {
        const paso = e.target.closest('[data-cant]');
        if (paso) {
            const campo = paso.closest('.ficha-compra')?.querySelector('[data-cantidad]');
            if (campo) campo.value = Math.min(MAX_POR_PRODUCTO, Math.max(1, (parseInt(campo.value, 10) || 1) + Number(paso.dataset.cant)));
            return;
        }
        const boton = e.target.closest('[data-agregar]');
        if (!boton) return;
        const p = porSlug.get(boton.dataset.agregar);
        if (!p || p.agotado) return;
        // La barra fija de la ficha usa la misma cantidad que el selector de la ficha.
        const zona = boton.closest('.ficha-compra') || (boton.closest('[data-compra-fija]') ? $('.ficha-compra') : null);
        const campo = zona?.querySelector('[data-cantidad]');
        const pedida = Math.min(MAX_POR_PRODUCTO, Math.max(1, parseInt(campo?.value, 10) || 1));
        if (campo) campo.value = pedida;
        const entro = cart.add(p.slug, pedida);
        if (!entro) { avisar(TOPE_TEXTO, true); return; }
        avisar(`${entro > 1 ? `${entro} × ` : ''}${p.nombre} en tu pedido${entro < pedida ? ` (máximo ${MAX_POR_PRODUCTO})` : ''}`, true);
    });
    // Al salir del campo, la cantidad escrita queda dentro del rango.
    document.addEventListener('change', (e) => {
        const campo = e.target.closest?.('[data-cantidad]');
        if (campo) campo.value = Math.min(MAX_POR_PRODUCTO, Math.max(1, parseInt(campo.value, 10) || 1));
    });
}

// ── Ficha en el teléfono: barra fija con precio y «Agregar» mientras el bloque de compra no se ve
// (41 §2: como las apps de domicilios). Bandera en body para que el aviso flotante ceda [[BERS:L-63]].
function compraFija() {
    const barra = $('[data-compra-fija]');
    const compra = $('.ficha-compra');
    if (!barra || !compra || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => {
        const ver = !e.isIntersecting;
        barra.classList.toggle('visible', ver);
        document.body.classList.toggle('con-compra-fija', ver);
    }, { rootMargin: '0px 0px -80px 0px' }); // los 80 px de abajo son de la barra inferior
    io.observe(compra);
}

// ── «Pedir lo mismo»: el último pedido (solo productos y cantidades) se guarda al enviarlo.
function ultimoPedido() {
    try {
        const lista = JSON.parse(memoria.leer(CLAVES.ultimo) || '[]');
        return Array.isArray(lista) ? lista.filter(i => disponible(i.slug) && i.qty > 0) : [];
    } catch { return []; }
}
function pedirLoMismo() {
    const items = ultimoPedido();
    if (!items.length) return false;
    for (const i of items) cart.add(i.slug, i.qty);
    return true;
}
function repetirEnInicio() {
    const caja = $('[data-repetir]');
    const items = ultimoPedido();
    if (!caja || !items.length) return;
    const n = items.reduce((s, i) => s + i.qty, 0);
    caja.innerHTML = `<span class="repetir-icono" aria-hidden="true">${icono('repetir')}</span>
      <p><strong>¿Lo mismo de la última vez?</strong> ${n} ${n === 1 ? 'producto' : 'productos'}: ${escapar(items.slice(0, 3).map(i => porSlug.get(i.slug).nombre).join(', '))}${items.length > 3 ? '…' : ''}</p>
      <button type="button" class="boton" data-repetir-boton>${icono('repetir')}<span>Pedir lo mismo</span></button>`;
    caja.hidden = false;
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-repetir-boton]')) return;
    if (pedirLoMismo()) location.href = RUTAS.carrito;
});

// ── Barras de navegación: «Combos» es el catálogo con ?c=combos.
function navActiva() {
    if (document.body.dataset.pagina !== 'catalogo') return;
    const combos = new URLSearchParams(location.search).get('c') === 'combos';
    for (const a of $$('[data-nav="combos"]')) combos ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    for (const a of $$('[data-nav="catalogo"]')) combos ? a.removeAttribute('aria-current') : a.setAttribute('aria-current', 'page');
}

// ── Catálogo: filtro por categoría (?c=) y búsqueda sobre las tarjetas ya horneadas.
function catalogoInteractivo() {
    const tarjetas = $$('.grilla .tarjeta');
    if (!tarjetas.length) { pasillosEnlace(); return; }
    const buscar = $('[data-buscar]');
    const ids = new Set(catalogo.categorias.map(c => c.id));
    let categoria = new URLSearchParams(location.search).get('c') || '';
    if (!ids.has(categoria)) categoria = '';
    const tituloBase = document.title;
    const aplicar = () => {
        const texto = (buscar?.value || '').trim().toLowerCase();
        let visibles = 0;
        for (const t of tarjetas) {
            const ver = (!categoria || t.dataset.categoria === categoria) && (!texto || t.dataset.nombre.includes(texto));
            t.hidden = !ver;
            if (ver) visibles++;
        }
        for (const f of $$('[data-filtro]')) f.setAttribute('aria-pressed', String(f.dataset.filtro === categoria));
        // La pestaña dice la categoría (el h1 visible ya la dice). Las bandas «revista» salen solo sin búsqueda.
        document.title = categoria ? `${nombreCategoria[categoria]} · Catálogo · ${cfg.marca}` : tituloBase;
        $('[data-grilla]')?.classList.toggle('buscando', Boolean(texto));
        // La cabecera partida, el anillo del pasillo y el filtro inicial los pinta el CSS con html[data-c].
        if (categoria) document.documentElement.dataset.c = categoria; else delete document.documentElement.dataset.c;
        const vacio = $('[data-vacio]');
        if (vacio) {
            vacio.hidden = visibles > 0;
            const que = categoria ? nombreCategoria[categoria].toLowerCase() : (texto || 'un producto');
            $('[data-vacio-wa]', vacio).href = wa(categoria && !texto ? `Hola ${cfg.marca}, ¿qué tienen de ${que}?` : `Hola ${cfg.marca}, estoy buscando ${que}`);
        }
        navActiva();
    };
    for (const f of $$('[data-filtro]')) {
        f.addEventListener('click', () => {
            categoria = f.dataset.filtro;
            history.replaceState(null, '', categoria ? `?c=${categoria}` : location.pathname);
            aplicar();
        });
    }
    buscar?.addEventListener('input', aplicar);
    aplicar();
    pasilloALaVista();
    bandasEnLaRejilla();
}

// El carril de pasillos (celular) trae a la vista el pasillo de la categoría abierta, centrado.
function pasilloALaVista() {
    const carril = $('.pasillos-lista');
    const activo = carril && $('.pasillo[aria-pressed="true"], .pasillo[aria-current]', carril);
    if (!activo || carril.scrollWidth - carril.clientWidth < 8) return;
    const c = carril.getBoundingClientRect();
    const a = activo.getBoundingClientRect();
    carril.scrollLeft += (a.left + a.width / 2) - (c.left + c.width / 2);
}

// Bandas «revista» del catálogo (cada 8 fichas): con 5 columnas (ordenador) la 8.ª ficha no cierra la fila y
// la banda dejaba huecos; se corre al final de esa fila. Se mueve en el DOM, así el orden de lectura y el de
// la pantalla siguen siendo el mismo. Si ya no quedan fichas después, la banda no sale.
// Ninguna fila coja (Daniel, 27-oct): si la última fila de fichas queda incompleta, la ÚLTIMA banda la cierra
// ocupando los huecos que quedan (data-relleno y --span = cuántas columnas cubre; estilos.css la pinta como
// una tarjeta de plan cuando es angosta).
function bandasEnLaRejilla() {
    const grilla = $('[data-grilla]');
    const bandas = grilla ? $$('.cat-revista', grilla) : [];
    if (!bandas.length) return;
    const recolocar = () => {
        // Las columnas las fija estilos.css (--cols de .grilla, por punto de quiebre y por categoría).
        const cols = parseInt(getComputedStyle(grilla).getPropertyValue('--cols'), 10) || 1;
        const fichas = $$(':scope > .tarjeta', grilla);
        const resto = fichas.length % cols;
        bandas.forEach((b, k) => {
            const relleno = resto > 0 && k === bandas.length - 1;
            const n = relleno ? fichas.length : Math.ceil((8 * (k + 1)) / cols) * cols;
            b.hidden = !relleno && n >= fichas.length;
            b.toggleAttribute('data-relleno', relleno);
            if (relleno) b.style.setProperty('--span', String(cols - resto)); else b.style.removeProperty('--span');
            if (!b.hidden && fichas[n - 1].nextElementSibling !== b) fichas[n - 1].after(b);
        });
    };
    let raf = 0;
    addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(recolocar); });
    recolocar();
}

// Catálogo sin productos: los pasillos son enlaces (?c=); el de la categoría abierta queda marcado.
function pasillosEnlace() {
    const ids = new Set(catalogo.categorias.map(c => c.id));
    const c = new URLSearchParams(location.search).get('c') || '';
    const actual = ids.has(c) ? c : '';
    if (!actual) delete document.documentElement.dataset.c;
    else document.title = `${nombreCategoria[actual]} · Catálogo · ${cfg.marca}`;
    for (const a of $$('a.pasillo')) a.dataset.pasillo === actual ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    pasilloALaVista();
}

// ── Carrito y pedido.
const lineasDelCarrito = () => cart.getAll().filter(i => disponible(i.slug)).map(i => ({ ...i, p: porSlug.get(i.slug) }));

function calcular(form) {
    const lineas = lineasDelCarrito();
    const subtotal = lineas.reduce((s, l) => s + l.p.precio * l.qty, 0);
    const zona = cfg.zonas.find(z => z.id === form?.zona.value) || null;
    const domicilio = zona ? zona.tarifa : 0;
    return { lineas, subtotal, zona, domicilio, total: subtotal + domicilio, regalo: regalos(subtotal, cfg.regalos) };
}

// El repintado rehace la lista: se recuerda qué botón tenía el foco y se le devuelve (o al vecino
// si su línea desapareció), para que el teclado y el lector de pantalla no vuelvan al principio.
function focoEnLineas(contenedor) {
    const activo = document.activeElement;
    if (!activo || !contenedor.contains(activo)) return null;
    const tipo = ['mas', 'menos', 'quitar'].find(k => activo.dataset[k]);
    if (!tipo) return null;
    const slugs = $$('.linea', contenedor).map(l => l.dataset.slug);
    return { tipo, slug: activo.dataset[tipo], indice: slugs.indexOf(activo.dataset[tipo]) };
}
function devolverFoco(contenedor, foco) {
    if (!foco) return;
    const mismo = $(`[data-${foco.tipo}="${CSS.escape(foco.slug)}"]`, contenedor);
    if (mismo) { mismo.focus(); return; }
    const lineas = $$('.linea', contenedor);
    const vecina = lineas[Math.min(foco.indice, lineas.length - 1)];
    $(`[data-${foco.tipo}]`, vecina || contenedor)?.focus();
}

function pintarCarrito() {
    const form = $('[data-formulario]');
    const { lineas, subtotal, zona, domicilio, total, regalo } = calcular(form);
    const vacio = lineas.length === 0;
    const confirmado = !$('[data-confirmacion]').hidden;
    const contenedor = $('[data-lineas]');
    const foco = focoEnLineas(contenedor);
    $('[data-carrito-vacio]').hidden = !vacio || confirmado;
    $('[data-pedido]').hidden = vacio || confirmado;
    $('[data-repetir-boton]').hidden = !ultimoPedido().length;
    if (vacio) {
        if (foco) $('[data-vacio-titulo]')?.focus();
        return;
    }

    contenedor.innerHTML = lineas.map(({ p, qty }) => `
      <div class="linea" data-slug="${p.slug}">
        <a class="linea-imagen escaparate" href="${rutaProducto(p)}" tabindex="-1" aria-hidden="true">${imagenProducto(p, 'icono-linea')}</a>
        <div class="linea-info">
          <a href="${rutaProducto(p)}">${escapar(p.nombre)}</a>
          <small>${escapar(p.presentacion)} · ${precio(p.precio)} c/u</small>
        </div>
        <div class="linea-pie">
          <div class="paso-numero-control paso-chico" role="group" aria-label="Cantidad de ${escapar(p.nombre)}">
            <button type="button" class="boton-paso" data-menos="${p.slug}" aria-label="Quitar uno de ${escapar(p.nombre)}">${icono('menos')}</button>
            <span class="paso-valor">${qty}</span>
            <button type="button" class="boton-paso" data-mas="${p.slug}" aria-label="Agregar uno de ${escapar(p.nombre)}">${icono('mas')}</button>
          </div>
          <strong class="linea-total">${precio(p.precio * qty)}</strong>
        </div>
        <button type="button" class="boton-icono linea-quitar" data-quitar="${p.slug}" aria-label="Quitar ${escapar(p.nombre)} del pedido">${icono('cerrar')}</button>
      </div>`).join('');
    devolverFoco(contenedor, foco);

    const caja = $('[data-regalo]');
    const avance = regalo.siguiente ? Math.min(1, subtotal / regalo.siguiente.desde) : 1;
    caja.innerHTML = `
      <span class="regalo-icono" aria-hidden="true">${icono('regalo')}</span>
      <div class="regalo-texto">
        ${regalo.ganado ? `<p>Ya ganaste: <strong>${escapar(regalo.ganado.regalo)}</strong> gratis</p>` : ''}
        ${regalo.siguiente ? `<p>Te faltan <strong>${precio(regalo.falta)}</strong> para llevarte ${escapar(regalo.siguiente.regalo)} gratis</p>` : '<p>¡Tienes el regalo más grande!</p>'}
        <div class="barra" role="progressbar" aria-label="Avance hacia el siguiente regalo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(avance * 100)}"><span style="--p:${avance}"></span></div>
      </div>`;

    $('[data-resumen]').innerHTML = `
      <p><span>Productos</span><span>${precio(subtotal)}</span></p>
      <p><span>Domicilio${zona ? ` (${escapar(zona.nombre)})` : ''}</span><span>${zona ? precio(domicilio) : 'elige tu zona'}</span></p>
      ${regalo.ganado ? `<p class="resumen-regalo"><span>Regalo</span><span>${escapar(regalo.ganado.regalo)}</span></p>` : ''}
      <p class="resumen-total"><span>Total</span><span>${precio(total)}</span></p>
      ${subtotal < cfg.pedidoMinimo ? `<p class="aviso">El pedido mínimo es ${precio(cfg.pedidoMinimo)}. Te faltan ${precio(cfg.pedidoMinimo - subtotal)}.</p>` : ''}`;
}

const edadEnAnios = (anio, mes, dia) => {
    const n = new Date(anio, mes - 1, dia);
    if (n.getFullYear() !== anio || n.getMonth() !== mes - 1 || n.getDate() !== dia) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - anio;
    if (hoy.getMonth() < mes - 1 || (hoy.getMonth() === mes - 1 && hoy.getDate() < dia)) edad--;
    return edad;
};

// Código corto y legible para dictarlo por teléfono (sin 0/O ni 1/I).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function codigoPedido() {
    const n = new Uint32Array(4);
    crypto.getRandomValues(n);
    return `KJ-${[...n].map(x => ALFABETO[x % ALFABETO.length]).join('')}`;
}

const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fechaLarga = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

// Errores en palabras claras, junto a cada campo.
function validar(form, datos) {
    const errores = [];
    const v = (n) => form[n].value.trim();
    if (!v('nombre')) errores.push(['nombre', 'Escribe tu nombre completo.']);
    if (!v('telefono')) errores.push(['telefono', 'Escribe tu número de celular.']);
    else if (!/^3\d{9}$/.test(v('telefono').replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, ''))) errores.push(['telefono', 'Escribe un celular colombiano de 10 dígitos que empiece por 3.']);
    if (!v('direccion')) errores.push(['direccion', 'Escribe la dirección de entrega.']);
    if (!v('barrio')) errores.push(['barrio', 'Escribe el barrio.']);
    if (!v('zona')) errores.push(['zona', 'Elige tu zona de domicilio.']);
    if (form.cuando.value === 'programar') {
        if (!v('fecha')) errores.push(['fecha', 'Elige el día de entrega.']);
        else if (v('fecha') < hoyISO()) errores.push(['fecha', 'Ese día ya pasó. Elige hoy o un día futuro.']);
        if (!v('franja')) errores.push(['franja', 'Elige una franja.']);
    }
    const dia = parseInt(v('nacDia'), 10);
    const mes = parseInt(v('nacMes'), 10);
    const anio = parseInt(v('nacAnio'), 10);
    if (!dia || !mes || !anio || v('nacAnio').length !== 4) errores.push(['nacimiento', 'Completa tu fecha de nacimiento: día, mes y año (4 cifras).']);
    else {
        const edad = edadEnAnios(anio, mes, dia);
        if (edad === null || edad > 120) errores.push(['nacimiento', 'Esa fecha no existe. Revisa el día, el mes y el año.']);
        else if (edad < 18) errores.push(['nacimiento', 'Solo vendemos a mayores de 18 años.']);
    }
    if (!form.mayor.checked) errores.push(['mayor', 'Marca la casilla para confirmar que eres mayor de 18 años.']);
    if (!form.acepto.checked) errores.push(['acepto', 'Debes aceptar los términos y el tratamiento de datos.']);
    const general = cfg.pedidosPausados ? MENSAJE_PAUSA
        : form.cuando.value === 'pronto' && !prontoDisponible() ? 'A esta hora no hacemos entregas «lo antes posible». Elige «Programar».'
            : datos.subtotal < cfg.pedidoMinimo ? `El pedido mínimo es ${precio(cfg.pedidoMinimo)}. Agrega ${precio(cfg.pedidoMinimo - datos.subtotal)} más.` : '';
    return { errores, general };
}

// ── Horario de entregas (docs/40 §4: sin domicilios después de la medianoche hasta la respuesta
// de la Alcaldía). Entre horaCierre y horaApertura (hora de Bogotá) no se ofrece «Lo antes posible»;
// sin horaApertura confirmada no se ofrece nunca. pedidosPausados (ley seca) lo apaga todo.
const horaValida = (h) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
const CIERRE = horaValida(cfg.horaCierre) ? cfg.horaCierre : '00:00';
const APERTURA = horaValida(cfg.horaApertura) ? cfg.horaApertura : null;
function horaDeBogota() {
    try {
        return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    } catch {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
}
function prontoDisponible() {
    if (cfg.pedidosPausados || !APERTURA) return false;
    const ahora = horaDeBogota();
    const cerrado = CIERRE <= APERTURA ? (ahora >= CIERRE && ahora < APERTURA) : (ahora >= CIERRE || ahora < APERTURA);
    return !cerrado;
}
function horarioDeEntrega(form) {
    const radio = form.querySelector('input[name="cuando"][value="pronto"]');
    const tarjeta = radio?.closest('[data-opcion-pronto]');
    const nota = $('[data-pronto-nota]', tarjeta || form);
    if (!radio || !tarjeta) return;
    const ok = prontoDisponible();
    radio.disabled = !ok;
    tarjeta.classList.toggle('opcion-pronto', !ok);
    if (!ok && radio.checked) form.querySelector('input[name="cuando"][value="programar"]').checked = true;
    $('[data-programar]').hidden = form.cuando.value !== 'programar';
    if (nota) {
        nota.textContent = ok ? 'Te confirmamos el tiempo de entrega por WhatsApp.'
            : cfg.pedidosPausados ? MENSAJE_PAUSA
                : APERTURA ? `${CIERRE === '00:00' ? 'Después de la medianoche' : `Después de las ${CIERRE}`} no hacemos entregas. Programa tu pedido: desde las ${APERTURA} vuelve esta opción.`
                    : 'Disponible cuando confirmemos el horario de domicilios. Por ahora, programa tu pedido.';
    }
}

function mostrarErrores(form, { errores, general }) {
    for (const p of $$('.campo-error', form)) { p.hidden = true; p.textContent = ''; }
    for (const el of $$('[aria-invalid]', form)) el.removeAttribute('aria-invalid');
    for (const [campo, texto] of errores) {
        const p = $(`#e-${campo}`);
        if (p) { p.textContent = texto; p.hidden = false; }
        const control = campo === 'nacimiento' ? form.nacDia : form[campo];
        control?.setAttribute('aria-invalid', 'true');
        if (campo === 'nacimiento') for (const n of ['nacMes', 'nacAnio']) form[n].setAttribute('aria-invalid', 'true');
    }
    const caja = $('[data-error]');
    const resumen = [general, errores.length ? `Revisa ${errores.length === 1 ? 'el campo marcado' : `los ${errores.length} campos marcados`}.` : ''].filter(Boolean).join(' ');
    caja.textContent = resumen;
    caja.hidden = !resumen;
    if (errores.length) {
        const [campo] = errores[0];
        const control = campo === 'nacimiento' ? form.nacDia : form[campo];
        control?.focus();
        control?.closest('.campo')?.scrollIntoView({ block: 'center', behavior: movimientoReducido ? 'auto' : 'smooth' });
    }
}

function mensajeWhatsApp(codigo, form, d) {
    const pago = cfg.pagos.find(m => m.id === form.pago.value)?.nombre || '';
    const entrega = form.cuando.value === 'programar'
        ? `Entrega programada: ${fechaLarga(form.fecha.value)}, ${form.franja.value.toLowerCase()}`
        : 'Entrega: lo antes posible';
    return [
        `Hola ${cfg.marca}, quiero confirmar mi pedido *${codigo}*`,
        '',
        ...d.lineas.map(({ p, qty }) => `• ${qty} × ${p.nombre} (${p.presentacion}) = ${precio(p.precio * qty)}`),
        '',
        `Productos: ${precio(d.subtotal)}`,
        `Domicilio (${d.zona.nombre}): ${precio(d.domicilio)}`,
        `*Total: ${precio(d.total)}*`,
        d.regalo.ganado ? `Regalo: ${d.regalo.ganado.regalo}` : '',
        `Pago: ${pago}`,
        entrega,
        '',
        `Nombre: ${form.nombre.value.trim()}`,
        `Celular: ${form.telefono.value.trim()}`,
        `Dirección: ${form.direccion.value.trim()} · ${form.barrio.value.trim()}`,
        form.notas.value.trim() ? `Indicaciones: ${form.notas.value.trim()}` : '',
        'Confirmo que soy mayor de 18 años y mostraré mi cédula al recibir.',
    ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
}

function carritoInteractivo() {
    const form = $('[data-formulario]');
    const zona = zonaGuardada();
    if (zona) form.zona.value = zona.id;
    form.fecha.min = hoyISO();
    horarioDeEntrega(form);
    setInterval(() => horarioDeEntrega(form), 60000); // si la página queda abierta al pasar la medianoche
    pintarCarrito();
    cart.onChange(pintarCarrito);
    form.addEventListener('change', (e) => {
        if (e.target.name === 'zona' && e.target.value) { memoria.guardar(CLAVES.zona, e.target.value); pintarZona(); }
        if (e.target.name === 'cuando') $('[data-programar]').hidden = form.cuando.value !== 'programar';
        pintarCarrito();
    });
    form.addEventListener('input', (e) => {
        const nombre = e.target.name?.startsWith('nac') ? 'nacimiento' : e.target.name;
        const p = $(`#e-${nombre}`);
        if (p && !p.hidden) { p.hidden = true; e.target.removeAttribute('aria-invalid'); }
    });
    // Una sola región viva que no se rehace: anuncia la cantidad nueva de forma fiable. (La barra de
    // anuncio usa data-barra-anuncio: antes compartían atributo y esto escribía en la barra.)
    const anuncio = $('p[data-anuncio]');
    const anunciar = (texto) => { if (anuncio) { anuncio.textContent = ''; requestAnimationFrame(() => { anuncio.textContent = texto; }); } };
    $('[data-lineas]').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const slug = b.dataset.mas || b.dataset.menos || b.dataset.quitar;
        const item = cart.get(slug);
        if (!item) return;
        const nombre = porSlug.get(slug).nombre;
        const antes = item.qty;
        if (b.dataset.mas) {
            if (antes >= MAX_POR_PRODUCTO) { avisar(TOPE_TEXTO); return; }
            cart.updateQty(slug, antes + 1);
            anunciar(`${nombre}: ${antes + 1} en tu pedido`);
        }
        if (b.dataset.menos) {
            cart.updateQty(slug, antes - 1);
            anunciar(antes > 1 ? `${nombre}: ${antes - 1} en tu pedido` : `${nombre} quitado del pedido`);
        }
        if (b.dataset.quitar) { cart.remove(slug); avisar(`${nombre} quitado del pedido`); }
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = calcular(form);
        const resultado = validar(form, d);
        mostrarErrores(form, resultado);
        if (resultado.errores.length || resultado.general) return;
        const codigo = codigoPedido();
        const enlace = wa(mensajeWhatsApp(codigo, form, d));
        const items = d.lineas.map(({ slug, qty }) => ({ slug, qty }));
        const confirmacion = $('[data-confirmacion]');
        confirmacion.innerHTML = `
          <p class="confirmacion-etiqueta">Código de tu pedido</p>
          <p class="codigo">${codigo}</p>
          <h2>Tu pedido está listo para enviar</h2>
          <p>Envíalo por WhatsApp para confirmarlo. Te respondemos con el tiempo de entrega${form.pago.value === 'efectivo' ? '' : ' y los datos de pago'}.</p>
          <a class="boton boton-grande" href="${enlace}" rel="noopener" data-enviar>${icono('chat')}<span>Enviar por WhatsApp</span></a>
          <p class="cajon-nota">${icono('cedula')}<span>Al entregar pedimos tu cédula.</span></p>
          <div class="leyendas-caja" role="note"><p class="leyenda">El exceso de alcohol es perjudicial para la salud.</p><p class="leyenda">Prohíbase el expendio de bebidas embriagantes a menores de edad.</p></div>`;
        confirmacion.hidden = false;
        $('[data-pedido]').hidden = true;
        $('[data-enviar]').addEventListener('click', () => {
            memoria.guardar(CLAVES.ultimo, JSON.stringify(items));
            cart.clear();
        }, { once: true });
        confirmacion.focus({ preventScroll: true });
        confirmacion.scrollIntoView({ behavior: movimientoReducido ? 'auto' : 'smooth', block: 'start' });
    });
}

// ── Calculadora de fiesta.
function calculadoraInteractiva() {
    const form = $('[data-calc]');
    const caja = $('[data-calc-resultado]');
    if (!form || !caja) return;
    // Mientras se escribe NO se toca el campo (borrar y escribir «25» da 25, no 125): se calcula con
    // el valor dentro del rango y el campo se corrige solo al salir de él (change) o con − / +.
    const leer = (input, corregir) => {
        const min = Number(input.min);
        const max = Number(input.max);
        const n = parseInt(input.value, 10);
        if (!Number.isFinite(n)) {
            if (!corregir) return { vacio: true };
            input.value = min;
            return { valor: min };
        }
        const valor = Math.min(max, Math.max(min, n));
        if (corregir && String(valor) !== input.value.trim()) input.value = valor;
        return { valor, pasado: n > max ? max : 0 };
    };
    let sugerencia = null;
    const pintar = (corregir = false) => {
        const lp = leer(form.personas, corregir);
        const lh = leer(form.horas, corregir);
        if (lp.vacio || lh.vacio) {
            caja.innerHTML = `<p class="calc-vacio">${lp.vacio ? 'Escribe cuántas personas.' : 'Escribe cuántas horas.'}</p>`;
            sugerencia = null;
            return;
        }
        const personas = lp.valor;
        const horas = lh.valor;
        const aviso = [
            lp.pasado ? `Calculamos hasta ${lp.pasado} personas.` : '',
            lh.pasado ? `Calculamos hasta ${lh.pasado} horas.` : '',
            lp.pasado ? 'Para un grupo más grande, escríbenos por WhatsApp.' : lh.pasado ? 'Para una fiesta más larga, escríbenos por WhatsApp.' : '',
        ].filter(Boolean).join(' ');
        const gustos = $$('input[name="gusto"]:checked', form).map(i => i.value);
        const error = $('[data-calc-error]');
        error.hidden = gustos.length > 0;
        error.textContent = gustos.length ? '' : 'Elige al menos un gusto para calcular.';
        if (!gustos.length) {
            caja.innerHTML = '<p class="calc-vacio">Elige al menos un gusto y te mostramos la sugerencia.</p>';
            sugerencia = null;
            return;
        }
        const s = sugerirFiesta({ personas, horas, gustos }, catalogo.productos, nombreCategoria);
        sugerencia = { ...s, personas, horas };
        const lineaHtml = (l) => {
            const silueta = l.tipo === 'hielo' ? 'acompanantes' : ['agua', 'mezclador'].includes(l.tipo) ? 'botella' : l.producto?.categoria || l.tipo;
            const ico = iconoProducto(silueta, 'icono-linea');
            if (!l.producto) return `<li><span class="calc-ico escaparate">${ico}</span><span class="calc-texto">${escapar(l.texto)}</span></li>`;
            const p = l.producto;
            return `<li><span class="calc-ico escaparate">${ico}</span><span class="calc-texto"><strong>${l.qty} × ${escapar(p.nombre)}</strong><small>${escapar(p.presentacion)}${precioPorUnidad(p) ? ` · ${precioPorUnidad(p)}` : ''}</small></span><span class="calc-precio">${precio(p.precio * l.qty)}</span></li>`;
        };
        const faltan = s.lineas.filter(l => !l.producto);
        const sobreTope = s.enCatalogo.some(l => l.qty > MAX_POR_PRODUCTO);
        caja.innerHTML = `
          <p class="calc-total"><span class="calc-numero">${s.tragos}</span><span>tragos en total para ${personas} ${personas === 1 ? 'persona' : 'personas'} en ${horas} ${horas === 1 ? 'hora' : 'horas'}</span></p>
          ${aviso ? `<p class="calc-nota calc-aviso">${aviso}</p>` : ''}
          <h2 class="calc-titulo">Te sugerimos llevar</h2>
          <ul class="calc-lista">${s.lineas.map(lineaHtml).join('')}</ul>
          ${s.enCatalogo.length ? `<p class="calc-subtotal"><span>Lo que está en el catálogo</span><strong>${precio(s.subtotal)}</strong></p>` : ''}
          ${faltan.length && s.enCatalogo.length ? '<p class="calc-nota">Lo que aún no está en el catálogo te lo cotizamos por WhatsApp.</p>' : ''}
          ${sobreTope ? `<p class="calc-nota calc-aviso">Algún producto pasa de ${MAX_POR_PRODUCTO} unidades, el máximo por producto en el pedido en línea: pídelo completo por WhatsApp.</p>` : ''}
          <div class="acciones">
            ${s.enCatalogo.length && !sobreTope ? `<button type="button" class="boton boton-grande" data-calc-agregar>${icono('bolsa')}<span>Agregar todo al pedido</span></button>` : ''}
            <a class="boton ${s.enCatalogo.length && !sobreTope ? 'boton-vidrio' : ''} boton-grande" href="${wa(mensajeFiesta(sugerencia))}" rel="noopener">${icono('chat')}<span>Pedir esto por WhatsApp</span></a>
          </div>
          <p class="calc-nota">Es una guía: ajústala a tu grupo. Toma con moderación y alterna con agua.</p>`;
    };
    form.addEventListener('input', () => pintar(false));
    form.addEventListener('change', () => pintar(true));
    form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-paso]');
        if (!b) return;
        const input = form[b.dataset.campo];
        input.value = Math.min(Number(input.max), Math.max(Number(input.min), (parseInt(input.value, 10) || 0) + Number(b.dataset.paso)));
        pintar(true);
    });
    // Llegada desde la calculadora exprés de la portada: ?personas=N (dentro del rango del campo).
    const pedidas = parseInt(new URLSearchParams(location.search).get('personas'), 10);
    if (Number.isFinite(pedidas)) form.personas.value = Math.min(Number(form.personas.max), Math.max(Number(form.personas.min), pedidas));
    caja.addEventListener('click', (e) => {
        if (!e.target.closest('[data-calc-agregar]') || !sugerencia) return;
        // Agrega exactamente lo que se ve; si algo no cabe (ya había unidades en el pedido), lo dice.
        let recortado = false;
        for (const l of sugerencia.enCatalogo) {
            if (cart.add(l.producto.slug, l.qty) < l.qty) recortado = true;
        }
        avisar(recortado ? `Agregado, con el máximo de ${MAX_POR_PRODUCTO} por producto. Revisa tu pedido.` : 'Sugerencia agregada a tu pedido', true);
    });
    pintar(true);
}

function mensajeFiesta(s) {
    const texto = (l) => (l.producto ? `${l.qty} × ${l.producto.nombre} (${l.producto.presentacion})` : l.texto);
    return [
        `Hola ${cfg.marca}, quiero armar un pedido para una fiesta de ${s.personas} ${s.personas === 1 ? 'persona' : 'personas'} y ${s.horas} ${s.horas === 1 ? 'hora' : 'horas'}.`,
        'La calculadora me sugirió:',
        ...s.lineas.map(l => `• ${texto(l)}`),
        '¿Qué me recomiendan y cuánto sale?',
    ].join('\n');
}

// ── Inclinación 3D y brillo que sigue al cursor (solo ordenador, escucha atada a la tarjeta).
function inclinacion() {
    const fino = matchMedia('(hover: hover) and (pointer: fine)').matches && !movimientoReducido;
    if (!fino) return;
    for (const t of $$('.tarjeta, .antojo-tarjeta')) {
        let raf = 0;
        let x = 0.5;
        let y = 0.5;
        const mover = (e) => {
            const r = t.getBoundingClientRect();
            x = (e.clientX - r.left) / r.width;
            y = (e.clientY - r.top) / r.height;
            raf ||= requestAnimationFrame(() => {
                raf = 0;
                t.style.setProperty('--mx', `${x * 100}%`);
                t.style.setProperty('--my', `${y * 100}%`);
                t.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 6}deg) translateY(-4px)`;
            });
        };
        t.addEventListener('pointerenter', () => t.addEventListener('pointermove', mover, { passive: true }));
        t.addEventListener('pointerleave', () => {
            t.removeEventListener('pointermove', mover);
            cancelAnimationFrame(raf);
            raf = 0;
            t.style.transform = '';
        });
    }
}

// ── Portada con movimiento (solo inicio). SIN botón de pausa (Daniel, 27-oct: «el video de portada no
// debe poderse pausar, es muy ligero»). El movimiento se detiene solo con «reducir movimiento» del
// sistema (CSS: la portada queda quieta, sin video), fuera de la vista y con la pestaña oculta.
// Las capas de luz del logo (brillo, licor, reflejo) aparecen cuando el logo está listo (estilos.css:
// sin .lista no existen): sus máscaras se piden después, así no compiten con el LCP. Si el logo
// tarda, a los 3 s aparecen igual.
function portadaLista() {
    const portada = $('.portada');
    const img = portada?.querySelector('.portada-logo');
    if (!img) return;
    const lista = () => portada.classList.add('lista');
    (img.decode ? img.decode() : Promise.resolve()).then(lista, lista);
    setTimeout(lista, 3000);
}
// Video de la escena, reflejo que sigue al cursor y destello al tocar: src/js/portada.js, pedido tras
// «load» y en un momento libre. Con «reducir movimiento» ni se descarga (tampoco lo precarga el
// service worker: vite.config.js lo deja fuera de la precarga).
function portadaEnMovimiento() {
    if (movimientoReducido || !$('[data-escena]')) return;
    const cargar = () => import('./portada.js').catch(() => { /* la portada CSS sigue completa */ });
    const libre = () => ('requestIdleCallback' in window ? requestIdleCallback(cargar, { timeout: 1500 }) : setTimeout(cargar, 200));
    if (document.readyState === 'complete') libre();
    else addEventListener('load', libre, { once: true });
}

// Videos de fondo de las bandas (hoy: el oro líquido de la calculadora exprés). Mismas reglas que la
// portada: nunca en el HTML ni precargado; se pide el módulo tras «load», en un momento libre, y con
// «reducir movimiento» ni se descarga.
function videosDeBanda() {
    if (movimientoReducido || !$('[data-banda-video]')) return;
    const cargar = () => import('./banda-video.js').catch(() => { /* queda la foto fija */ });
    const libre = () => ('requestIdleCallback' in window ? requestIdleCallback(cargar, { timeout: 2000 }) : setTimeout(cargar, 300));
    if (document.readyState === 'complete') libre();
    else addEventListener('load', libre, { once: true });
}

// ── Web-app instalable: service worker solo en producción (el de desarrollo no se registra).
function registrarServiceWorker() {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { /* sin PWA: el sitio sigue igual */ }));
}

// ── Banda 0: barra de anuncio. Celular y tableta: rota cada 5 s (solo transform y opacity); tocar la barra
// (o su botón, la parada del teclado) la detiene y otro toque la reanuda. Quieta fuera de la vista, con la
// pestaña oculta y con la capa de edad abierta. Con «reducir movimiento» no rota: cada toque muestra el aviso
// siguiente. Ordenador (≥ 861 px): los avisos quietos en una fila (estilos.css), sin rotar y sin botón.
function barraDeAnuncio() {
    const barra = $('[data-barra-anuncio]');
    const msgs = barra ? $$('.anuncio-msg', barra) : [];
    const control = barra ? $('.anuncio-control', barra) : null;
    if (msgs.length < 2 || !control) return;
    const raiz = document.documentElement;
    const accion = $('[data-barra-accion]', barra);
    const rm = matchMedia('(prefers-reduced-motion: reduce)');
    const fila = matchMedia('(min-width: 861px)'); // la MISMA medida de estilos.css («avisos quietos en una fila»)
    const manual = () => rm.matches;
    let i = 0;
    let tocada = false;
    let encima = false;
    let enfocada = false; // con el foco del teclado dentro tampoco rota (patrón de carrusel de la APG)
    let aLaVista = true;
    let reloj = 0;
    const mostrar = (n, conPaso) => {
        const antes = msgs[i];
        i = (n + msgs.length) % msgs.length;
        for (const m of msgs) m.classList.toggle('sin-paso', !conPaso);
        antes.classList.remove('activo');
        antes.setAttribute('aria-hidden', 'true');
        if (conPaso) antes.classList.add('sale');
        msgs[i].classList.remove('sale');
        msgs[i].classList.add('activo');
        msgs[i].removeAttribute('aria-hidden'); // el lector lee el aviso que se ve, no los escondidos
        // El que salió vuelve abajo sin verse (sin transición), listo para su próxima entrada.
        if (conPaso) setTimeout(() => { if (!antes.classList.contains('activo')) { antes.classList.add('sin-paso'); antes.classList.remove('sale'); } }, 750);
    };
    const corre = () => !fila.matches && !manual() && !tocada && !encima && !enfocada && aLaVista && !document.hidden && !raiz.classList.contains('pedir-edad');
    const programar = () => {
        clearTimeout(reloj);
        if (corre()) reloj = setTimeout(() => { mostrar(i + 1, true); programar(); }, 5000);
    };
    // El estado lo dice SOLO aria-pressed; el nombre del botón queda fijo (si cambiara con el estado, el lector
    // oiría «Seguir con los avisos, presionado»: dos verdades). En modo manual no hay estado: cada toque avanza.
    const pintarModo = () => {
        // En la fila del ordenador se ven todos: el lector los lee todos.
        for (const m of msgs) (fila.matches || m.classList.contains('activo')) ? m.removeAttribute('aria-hidden') : m.setAttribute('aria-hidden', 'true');
        if (manual()) {
            barra.dataset.manual = '';
            control.removeAttribute('aria-pressed');
            accion.textContent = 'Ver el aviso siguiente';
        } else {
            delete barra.dataset.manual;
            control.setAttribute('aria-pressed', String(tocada));
            accion.textContent = 'Pausar los avisos';
        }
        programar();
    };
    const tocar = () => {
        if (fila.matches) return;
        if (manual()) { mostrar(i + 1, false); return; }
        tocada = !tocada;
        pintarModo();
    };
    control.addEventListener('click', (e) => { e.stopPropagation(); tocar(); });
    barra.addEventListener('click', tocar); // toda la barra responde al dedo (44 px de alto a todo el ancho)
    barra.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { encima = true; programar(); } });
    barra.addEventListener('pointerleave', () => { encima = false; programar(); });
    barra.addEventListener('focusin', () => { enfocada = true; programar(); });
    barra.addEventListener('focusout', () => { enfocada = false; programar(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { aLaVista = e.isIntersecting; programar(); }).observe(barra);
    document.addEventListener('visibilitychange', programar);
    rm.addEventListener?.('change', pintarModo);
    fila.addEventListener?.('change', pintarModo);
    // Al cerrar la capa de edad (html.pedir-edad) empieza a rotar.
    new MutationObserver(pintarModo).observe(raiz, { attributes: true, attributeFilter: ['class'] });
    pintarModo();
}

// ── Carriles del celular con teclado. Al llegar con Tab a una tarjeta que asoma a medias, el carril la trae
// entera a la vista (el navegador no lo hace si ya se ve un borde); sin animación con «reducir movimiento».
// Un carril sin enlaces (la promesa) se vuelve enfocable solo mientras se desliza, para recorrerlo con las
// flechas; en el ordenador, donde no se desliza, no suma una parada de Tab.
function carrilesConTeclado() {
    const listas = $$('.antojo-lista, .planes-lista, [data-carril-teclado]');
    if (!listas.length) return;
    const ajustar = () => {
        for (const l of $$('[data-carril-teclado]')) {
            if (l.scrollWidth - l.clientWidth > 8) l.setAttribute('tabindex', '0');
            else l.removeAttribute('tabindex');
        }
    };
    for (const lista of listas) {
        lista.addEventListener('focusin', (e) => {
            const tarjeta = e.target.closest('li');
            if (!tarjeta || lista.scrollWidth - lista.clientWidth < 8) return;
            const r = tarjeta.getBoundingClientRect();
            const c = lista.getBoundingClientRect();
            if (r.left >= c.left - 1 && r.right <= c.right + 1) return;
            tarjeta.scrollIntoView({ block: 'nearest', inline: 'start', behavior: movimientoReducido ? 'auto' : 'smooth' });
        });
    }
    ajustar();
    let espera = 0;
    addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(ajustar, 200); }, { passive: true });
}

// ── «¿Qué se te antoja?»: el aviso «Desliza» sale solo la primera vez, en el celular y si el carril
// de verdad se desliza; al deslizar (o a los 6 s) se va. Se recuerda desde que se ve (memoria con
// try/catch: en modo privado puede volver a salir, sin romper nada).
function avisoDesliza() {
    const carril = $('[data-carril]');
    const lista = carril?.querySelector('.antojo-lista');
    const aviso = carril?.querySelector('[data-carril-aviso]');
    if (!lista || !aviso || memoria.leer(CLAVES.desliza) === 'visto') return;
    if (lista.scrollWidth - lista.clientWidth < 24) return; // ordenador: retícula, no se desliza
    let listo = false;
    const irse = () => {
        if (listo) return;
        listo = true;
        memoria.guardar(CLAVES.desliza, 'visto');
        aviso.classList.add('se-va');
        setTimeout(() => { aviso.hidden = true; }, 450);
    };
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        aviso.hidden = false;
        memoria.guardar(CLAVES.desliza, 'visto'); // ya se vio: no vuelve a salir
        setTimeout(irse, 6000);
    }, { threshold: 0.6 }) : null;
    if (io) io.observe(lista); else aviso.hidden = false;
    lista.addEventListener('scroll', irse, { passive: true, once: true });
}

// ── Banda 4: calculadora exprés. La misma fórmula que /calculadora/ (fiesta.js), en vivo, y el botón
// lleva las personas a la calculadora completa para armar el pedido.
function calculadoraExpres() {
    const form = $('[data-expres]');
    const rango = form?.querySelector('[data-expres-personas]');
    if (!rango) return;
    const horas = 4;
    const min = Number(rango.min);
    const max = Number(rango.max);
    const poner = (sel, valor) => { for (const el of $$(`[data-x="${sel}"]`, form)) el.textContent = valor; };
    const pintar = () => {
        const n = Math.min(max, Math.max(min, parseInt(rango.value, 10) || min));
        poner('personas', n);
        poner('personas-texto', n === 1 ? 'persona' : 'personas');
        poner('tragos', tragosTotales(n, horas));
        poner('hielo', Math.ceil(n * SUPUESTOS.hieloKgPorPersona));
        const aguas = Math.ceil(n * SUPUESTOS.aguasPorPersona);
        poner('aguas', aguas);
        poner('aguas-texto', aguas === 1 ? 'agua' : 'aguas');
        rango.setAttribute('aria-valuetext', `${n} ${n === 1 ? 'persona' : 'personas'}`);
        rango.style.setProperty('--p', `${((n - min) / (max - min)) * 100}%`);
        const armar = $('[data-expres-armar]', form);
        if (armar) armar.href = `${RUTAS.calculadora}?personas=${n}`;
    };
    rango.addEventListener('input', pintar);
    form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-expres-paso]');
        if (!b) return;
        rango.value = Math.min(max, Math.max(min, (parseInt(rango.value, 10) || min) + Number(b.dataset.expresPaso)));
        pintar();
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); location.href = $('[data-expres-armar]', form).href; });
    pintar();
}

// ── Regalos: el riel de la escalera se llena (transform) al entrar a la vista; con «reducir movimiento»,
// lleno de una vez. Los niveles, los montos y los regalos se ven siempre (solo el riel y los nodos se animan).
function escaleraQueSeLlena() {
    const escalera = $('[data-escalera]');
    if (!escalera) return;
    const llenar = () => escalera.classList.add('llena');
    if (movimientoReducido || !('IntersectionObserver' in window)) { llenar(); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { llenar(); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(escalera);
}

// ── Arranque.
if (PRUEBA.includes('carrito') && cart.count() === 0) {
    catalogo.productos.filter(p => !p.agotado).slice(0, 3).forEach((p, i) => cart.add(p.slug, i === 0 ? 2 : 1));
}
puertaDeEdad();
depurarCarrito();
textoGrande();
cabeceraIsla();
pintarContador();
cart.onChange(pintarContador);
zonaDeDomicilio();
botonesAgregar();
navActiva();
barraDeAnuncio();
const pagina = document.body.dataset.pagina;
if (pagina === 'producto') compraFija();
if (pagina === 'inicio') { repetirEnInicio(); portadaLista(); portadaEnMovimiento(); avisoDesliza(); calculadoraExpres(); escaleraQueSeLlena(); videosDeBanda(); }
if (pagina === 'plan') { avisoDesliza(); calculadoraExpres(); videosDeBanda(); }
carrilesConTeclado();
if (pagina === 'catalogo') catalogoInteractivo();
if (pagina === 'carrito') carritoInteractivo();
if (pagina === 'calculadora') calculadoraInteractiva();
inclinacion();
observeReveals();
window.kjListo = true;
registrarServiceWorker();
