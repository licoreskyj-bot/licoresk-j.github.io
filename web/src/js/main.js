/**
 * LICORES K&J — comportamiento de todas las páginas (Ola 1: sin pago en línea).
 * Las páginas ya vienen horneadas en HTML (scripts/hornear.mjs); aquí solo va lo interactivo.
 */
import { cart } from './cart.js';
import { precio, regalos, iconoProducto, escapar } from './comun.js';
import catalogo from '../data/catalogo.json';
import cfg from '../data/config.json';

const porSlug = new Map(catalogo.productos.map(p => [p.slug, p]));
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// ── Verificación de edad: capa sobre el contenido ya servido (Google la acepta así; no redirige).
const CLAVE_EDAD = 'kyj-edad-v1';
function puertaDeEdad() {
    const caja = $('#edad');
    if (!caja) return;
    let ok = false;
    try { ok = localStorage.getItem(CLAVE_EDAD) === 'si'; } catch {}
    if (ok) return;
    caja.hidden = false;
    document.documentElement.classList.add('sin-scroll');
    $('[data-edad="si"]', caja).focus();
    caja.addEventListener('click', (e) => {
        const r = e.target.closest('[data-edad]')?.dataset.edad;
        if (r === 'si') {
            try { localStorage.setItem(CLAVE_EDAD, 'si'); } catch {}
            caja.hidden = true;
            document.documentElement.classList.remove('sin-scroll');
        } else if (r === 'no') {
            location.href = 'https://www.icbf.gov.co/';
        }
    });
}

let temporizadorToast;
function avisar(texto) {
    const t = $('[data-toast]');
    if (!t) return;
    t.textContent = texto;
    t.classList.add('visible');
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => t.classList.remove('visible'), 2200);
}

function pintarContador() {
    for (const c of $$('[data-contador]')) c.textContent = cart.count();
}

function botonesAgregar() {
    document.addEventListener('click', (e) => {
        const boton = e.target.closest('[data-agregar]');
        if (!boton) return;
        const p = porSlug.get(boton.dataset.agregar);
        if (!p) return;
        const campo = boton.closest('.ficha-compra')?.querySelector('[data-cantidad]');
        const cantidad = Math.min(99, Math.max(1, parseInt(campo?.value, 10) || 1));
        cart.add(p.slug, cantidad);
        avisar(`${p.nombre} agregado al pedido`);
    });
}

// ── Catálogo: filtro por categoría (?c=) y búsqueda sobre las tarjetas ya horneadas.
function catalogoInteractivo() {
    const tarjetas = $$('.grilla .tarjeta');
    const buscar = $('[data-buscar]');
    let categoria = new URLSearchParams(location.search).get('c') || '';
    const aplicar = () => {
        const texto = (buscar?.value || '').trim().toLowerCase();
        let visibles = 0;
        for (const t of tarjetas) {
            const ver = (!categoria || t.dataset.categoria === categoria) && (!texto || t.dataset.nombre.includes(texto));
            t.hidden = !ver;
            if (ver) visibles++;
        }
        for (const f of $$('[data-filtro]')) f.classList.toggle('activo', f.dataset.filtro === categoria);
        const vacio = $('[data-vacio]');
        if (vacio) vacio.hidden = visibles > 0;
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
}

// ── Carrito y pedido.
function lineasDelCarrito() {
    return cart.getAll().map(i => ({ ...i, p: porSlug.get(i.slug) })).filter(l => l.p);
}

function calcular(form) {
    const lineas = lineasDelCarrito();
    const subtotal = lineas.reduce((s, l) => s + l.p.precio * l.qty, 0);
    const zona = cfg.zonas.find(z => z.id === form?.zona.value) || null;
    const domicilio = zona ? zona.tarifa : 0;
    return { lineas, subtotal, zona, domicilio, total: subtotal + domicilio, regalo: regalos(subtotal, cfg.regalos) };
}

function pintarCarrito() {
    const form = $('[data-formulario]');
    const { lineas, subtotal, zona, domicilio, total, regalo } = calcular(form);
    $('[data-carrito-vacio]').hidden = lineas.length > 0;
    form.hidden = lineas.length === 0;
    $('[data-lineas]').innerHTML = lineas.map(({ p, qty }) => `
      <div class="linea">
        ${iconoProducto(p.categoria, 'icono-linea')}
        <div class="linea-info">
          <a href="/producto/${p.slug}/">${escapar(p.nombre)}</a>
          <small>${escapar(p.presentacion)} · ${precio(p.precio)} c/u</small>
        </div>
        <div class="linea-cantidad">
          <button type="button" data-menos="${p.slug}" aria-label="Quitar uno">−</button>
          <span>${qty}</span>
          <button type="button" data-mas="${p.slug}" aria-label="Agregar uno">+</button>
        </div>
        <strong class="linea-total">${precio(p.precio * qty)}</strong>
        <button type="button" class="linea-quitar" data-quitar="${p.slug}" aria-label="Quitar ${escapar(p.nombre)}">×</button>
      </div>`).join('');

    const caja = $('[data-regalo]');
    caja.hidden = lineas.length === 0;
    const porcentaje = regalo.siguiente ? Math.min(100, Math.round(subtotal / regalo.siguiente.desde * 100)) : 100;
    caja.innerHTML = `
      ${regalo.ganado ? `<p>🎁 Ya ganaste: <strong>${escapar(regalo.ganado.regalo)}</strong> gratis</p>` : ''}
      ${regalo.siguiente ? `<p>Te faltan <strong>${precio(regalo.falta)}</strong> para llevarte ${escapar(regalo.siguiente.regalo)} gratis</p>` : '<p>¡Tienes el regalo más grande!</p>'}
      <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${porcentaje}"><span style="width:${porcentaje}%"></span></div>`;

    $('[data-resumen]').innerHTML = `
      <p><span>Productos</span><span>${precio(subtotal)}</span></p>
      <p><span>Domicilio</span><span>${zona ? precio(domicilio) : 'elige tu zona'}</span></p>
      <p class="resumen-total"><span>Total</span><span>${precio(total)}</span></p>
      ${subtotal > 0 && subtotal < cfg.pedidoMinimo ? `<p class="aviso">El pedido mínimo es ${precio(cfg.pedidoMinimo)}.</p>` : ''}`;
}

const edadEnAnios = (fecha) => {
    const n = new Date(`${fecha}T00:00:00`);
    if (Number.isNaN(n.getTime())) return -1;
    const hoy = new Date();
    let edad = hoy.getFullYear() - n.getFullYear();
    if (hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate())) edad--;
    return edad;
};

const codigoPedido = () => `KJ-${Date.now().toString(36).slice(-5).toUpperCase()}${Math.floor(Math.random() * 36 * 36).toString(36).padStart(2, '0').toUpperCase()}`;

function validar(form, datos) {
    const faltan = ['nombre', 'telefono', 'direccion', 'barrio', 'zona', 'nacimiento'].filter(c => !form[c].value.trim());
    if (faltan.length) return 'Completa todos los datos de entrega.';
    if (!/^3\d{9}$/.test(form.telefono.value.replace(/\D/g, ''))) return 'Escribe un celular colombiano de 10 dígitos.';
    if (edadEnAnios(form.nacimiento.value) < 18) return 'Solo vendemos a mayores de 18 años.';
    if (!form.mayor.checked) return 'Confirma que eres mayor de 18 años.';
    if (!form.acepto.checked) return 'Debes aceptar los términos y el tratamiento de datos.';
    if (datos.subtotal < cfg.pedidoMinimo) return `El pedido mínimo es ${precio(cfg.pedidoMinimo)}.`;
    return '';
}

function mensajeWhatsApp(codigo, form, d) {
    const pago = cfg.pagos.find(m => m.id === form.pago.value)?.nombre || '';
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
        '',
        `Nombre: ${form.nombre.value.trim()}`,
        `Celular: ${form.telefono.value.trim()}`,
        `Dirección: ${form.direccion.value.trim()} · ${form.barrio.value.trim()}`,
        form.notas.value.trim() ? `Notas: ${form.notas.value.trim()}` : '',
        'Confirmo que soy mayor de 18 años y mostraré mi cédula al recibir.',
    ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
}

function carritoInteractivo() {
    const form = $('[data-formulario]');
    pintarCarrito();
    cart.onChange(pintarCarrito);
    form.addEventListener('change', pintarCarrito);
    $('[data-lineas]').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const slug = b.dataset.mas || b.dataset.menos || b.dataset.quitar;
        const item = cart.get(slug);
        if (!item) return;
        if (b.dataset.mas) cart.updateQty(slug, Math.min(99, item.qty + 1));
        if (b.dataset.menos) cart.updateQty(slug, item.qty - 1);
        if (b.dataset.quitar) cart.remove(slug);
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = calcular(form);
        const error = validar(form, d);
        const caja = $('[data-error]');
        caja.textContent = error;
        caja.hidden = !error;
        if (error) return;
        const codigo = codigoPedido();
        const enlace = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(mensajeWhatsApp(codigo, form, d))}`;
        const confirmacion = $('[data-confirmacion]');
        confirmacion.innerHTML = `
          <h2>Tu pedido <span class="codigo">${codigo}</span> está listo</h2>
          <p>Envíalo por WhatsApp para confirmarlo. Te respondemos con el tiempo de entrega${form.pago.value === 'efectivo' ? '' : ' y los datos de pago'}.</p>
          <a class="boton" href="${enlace}" rel="noopener" data-enviar>Enviar por WhatsApp</a>
          <p class="leyenda-mini">Al entregar pedimos tu cédula. Prohíbase el expendio de bebidas embriagantes a menores de edad.</p>`;
        confirmacion.hidden = false;
        $('.pedido').hidden = true;
        $('[data-enviar]').addEventListener('click', () => cart.clear(), { once: true });
        confirmacion.scrollIntoView({ behavior: 'smooth' });
    });
}

puertaDeEdad();
pintarContador();
cart.onChange(pintarContador);
botonesAgregar();
const pagina = document.body.dataset.pagina;
if (pagina === 'catalogo') catalogoInteractivo();
if (pagina === 'carrito') carritoInteractivo();
