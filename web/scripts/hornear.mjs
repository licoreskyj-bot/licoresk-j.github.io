/**
 * Hornea TODAS las páginas de LICORES K&J desde src/data (catalogo.json + config.json): inicio,
 * catálogo, carrito, calculadora de fiesta, legales, 404 y una ficha HTML por producto (para que
 * Google la lea sin JavaScript). URLs limpias: cada página es <carpeta>/index.html.
 * Un solo molde de cabecera y pie: las leyendas legales del Decreto 1686/2012 art. 54 van en TODAS.
 * Las páginas generadas no se versionan (.gitignore): se rehacen en cada `npm run dev` / `build`.
 * Sistema visual: brain-private/licoreskyj/docs/42-SISTEMA-VISUAL-WEB.md.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
    precio, precioPorUnidad, gradoTexto, iconoProducto, imagenProducto, icono, escapar,
    RUTAS, rutaProducto, rutaCategoria, MAX_POR_PRODUCTO,
} from '../src/js/comun.js';
import { SUPUESTOS, sugerirFiesta } from '../src/js/fiesta.js';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r) => JSON.parse(readFileSync(join(RAIZ, r), 'utf8'));
const { categorias, productos } = leer('src/data/catalogo.json');
const cfg = leer('src/data/config.json');
const nombreCategoria = Object.fromEntries(categorias.map(c => [c.id, c.nombre]));
const wa = (texto) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(texto)}`;
const ANIO = new Date().getFullYear();
const hayCatalogo = productos.length > 0;
const marca = escapar(cfg.marca);
const avisos = [];

// ── Regla que no se rompe: % Vol. y precio por unidad en CADA ficha (Ley 1480; 42 §4.5). El build
// se detiene si un producto con alcohol no trae grado, o si alguno no trae unidad de medida. Así
// también queda protegido lo que se cargue después desde el panel local (docs/41 §4).
const SIN_ALCOHOL = new Set(['acompanantes']);
const fallas = [];
for (const p of productos) {
    if (!SIN_ALCOHOL.has(p.categoria) && !(Number(p.grado) > 0)) fallas.push(`${p.slug}: falta «grado» (% Vol.)`);
    if (!precioPorUnidad(p)) fallas.push(`${p.slug}: falta «unidadMedida» válida (cantidad + unidad ml/kg) para el precio por unidad`);
    if (!nombreCategoria[p.categoria]) fallas.push(`${p.slug}: la categoría «${p.categoria}» no existe`);
}
if (fallas.length) {
    console.error(`\n✖ hornear: ${fallas.length} producto(s) sin los datos legales obligatorios:\n  - ${fallas.join('\n  - ')}\n`);
    process.exit(1);
}

// ── Dominio (SEO y vista previa al compartir por WhatsApp): sin él, todo queda relativo.
const DOMINIO = typeof cfg.dominio === 'string' && /^https:\/\/[^/]+/.test(cfg.dominio) ? cfg.dominio.replace(/\/+$/, '') : null;
const absoluta = (ruta) => (DOMINIO ? new URL(ruta, `${DOMINIO}/`).href : ruta);
if (!DOMINIO) avisos.push('config.dominio vacío: og:image queda relativa (WhatsApp/Facebook pueden no mostrar la imagen) y no hay canonical, og:url ni sitemap.xml. Llénalo antes de cambiar «indexable».');

// ── Entregas (docs/40 §4): sin domicilios después de la medianoche hasta la respuesta de la Alcaldía.
const horaValida = (h) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
const CIERRE = horaValida(cfg.horaCierre) ? cfg.horaCierre : '00:00';
const APERTURA = horaValida(cfg.horaApertura) ? cfg.horaApertura : null;
const hastaCierre = CIERRE === '00:00' ? 'hasta la medianoche' : `hasta las ${CIERRE}`;
const sinEntregas = CIERRE === '00:00' ? 'Sin entregas después de la medianoche.' : `Sin entregas después de las ${CIERRE}.`;
if (!APERTURA) avisos.push('config.horaApertura vacío: el carrito NO ofrece «Lo antes posible» (solo programar). Daniel decide la hora.');
if (cfg.pedidosPausados) avisos.push('config.pedidosPausados = true: el sitio NO acepta pedidos (ley seca).');

const LEYENDAS = `<p class="leyenda">El exceso de alcohol es perjudicial para la salud.</p>
        <p class="leyenda">Prohíbase el expendio de bebidas embriagantes a menores de edad.</p>`;

// Logo maestro (docs/41 §1). 640×463 y 1200×868, transparentes.
const LOGO = (extra = '') => `<img src="/marca/logo-principal-640.webp" srcset="/marca/logo-principal-640.webp 640w, /marca/logo-principal-1200.webp 1200w" width="640" height="463" ${extra}>`;

// Antes del primer pintado: texto grande recordado y la capa de edad (sin parpadeo). Los
// parámetros `?prueba=` SOLO valen en un servidor local (capturas): nunca para visitantes reales.
const SCRIPT_INICIAL = `<script>(function(){var d=document.documentElement;d.classList.add('js');var ok=false;try{if(localStorage.getItem('kyj-texto-v1')==='grande')d.classList.add('texto-grande');ok=localStorage.getItem('kyj-edad-v1')==='si'}catch(e){}if(/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname)&&/[?&]prueba=[^&#]*sin-edad/.test(location.search))ok=true;if(!ok)d.classList.add('pedir-edad');setTimeout(function(){if(!window.kjListo)d.classList.add('sin-reveal')},2500)})();</script>`;

// «de fiesta» se esconde en anchos medios para que la isla no se parta (estilos.css).
const NAV = [
    { id: 'catalogo', texto: 'Catálogo', href: RUTAS.catalogo },
    { id: 'combos', texto: 'Combos', href: RUTAS.combos },
    { id: 'calculadora', texto: '<span>Calculadora<span class="nav-largo"> de fiesta</span></span>', href: RUTAS.calculadora },
];
const actual = (pagina, id) => (pagina === id ? ' aria-current="page"' : '');

// Degradados compartidos por todas las siluetas (comun.js iconoProducto): metal del logo, volumen
// con brillo especular, reflejo en el podio (se apaga 20 unidades bajo la base) y charco de luz.
const DEFS = `<linearGradient id="kj-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDEDA7"/><stop offset=".3" stop-color="#FACE70"/><stop offset=".58" stop-color="#E6AC4A"/><stop offset=".82" stop-color="#C78A31"/><stop offset="1" stop-color="#A66B1D"/></linearGradient><linearGradient id="kj-volumen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#110E0D" stop-opacity=".62"/><stop offset=".13" stop-color="#110E0D" stop-opacity=".16"/><stop offset=".24" stop-color="#FFFBEA" stop-opacity="0"/><stop offset=".31" stop-color="#FFFBEA" stop-opacity=".62"/><stop offset=".4" stop-color="#FFFBEA" stop-opacity="0"/><stop offset=".64" stop-color="#110E0D" stop-opacity="0"/><stop offset=".86" stop-color="#110E0D" stop-opacity=".3"/><stop offset="1" stop-color="#110E0D" stop-opacity=".66"/></linearGradient><linearGradient id="kj-reflejo" gradientUnits="userSpaceOnUse" x1="0" y1="52" x2="0" y2="66"><stop offset="0" stop-color="#C78A31" stop-opacity="0"/><stop offset=".7" stop-color="#E6AC4A" stop-opacity=".1"/><stop offset="1" stop-color="#FACE70" stop-opacity=".24"/></linearGradient><radialGradient id="kj-charco"><stop offset="0" stop-color="#FACE70" stop-opacity=".5"/><stop offset=".45" stop-color="#D0680F" stop-opacity=".2"/><stop offset="1" stop-color="#D0680F" stop-opacity="0"/></radialGradient>`;

function molde({ titulo, descripcion, pagina, cuerpo, jsonld, ruta, precargarLogo = false }) {
    const robots = cfg.indexable ? 'index, follow' : 'noindex, nofollow';
    const ld = [].concat(jsonld || []).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n  ');
    const canonico = DOMINIO && ruta ? `<link rel="canonical" href="${absoluta(ruta)}">\n  <meta property="og:url" content="${absoluta(ruta)}">` : '';
    return `<!doctype html>
<html lang="es-CO">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapar(titulo)}</title>
  <meta name="description" content="${escapar(descripcion)}">
  <meta name="robots" content="${robots}">
  <meta name="theme-color" content="#110E0D">
  <meta name="color-scheme" content="dark">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="es_CO">
  <meta property="og:site_name" content="${marca}">
  <meta property="og:title" content="${escapar(titulo)}">
  <meta property="og:description" content="${escapar(descripcion)}">
  <meta property="og:image" content="${absoluta('/marca/og-1200x630.jpg')}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  ${canonico}
  <link rel="icon" href="/marca/favicon-48.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/marca/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="apple-mobile-web-app-title" content="K&amp;J">
  <link rel="preload" href="/fuentes/montserrat-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fuentes/playfair-display-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  ${precargarLogo ? '<link rel="preload" as="image" href="/marca/logo-principal-640.webp" imagesrcset="/marca/logo-principal-640.webp 640w, /marca/logo-principal-1200.webp 1200w" imagesizes="(min-width: 860px) 520px, 82vw" fetchpriority="high">' : ''}
  ${SCRIPT_INICIAL}
  <link rel="stylesheet" href="/src/css/estilos.css">
  ${ld}
</head>
<body data-pagina="${pagina}">
  <div class="kj-mundo" aria-hidden="true"></div>
  <svg class="kj-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${DEFS}</defs></svg>
  <a class="saltar" href="#contenido">Saltar al contenido</a>
  ${cfg.modoPrueba ? '<div class="aviso-prueba">Sitio de prueba: productos y precios de <strong>EJEMPLO</strong>. Todavía no es la tienda real.</div>' : ''}
  ${cfg.pedidosPausados ? `<div class="aviso-pausa" role="note">${escapar(cfg.mensajePausa || 'Por ahora no estamos recibiendo pedidos. Vuelve pronto.')}</div>` : ''}
  <header class="cabecera" data-cabecera>
    <div class="isla kj-filo">
      <a href="/" class="marca"${actual(pagina, 'inicio')}><img src="/marca/monograma-96.webp" alt="" width="96" height="66"><span>LICORES K&amp;J</span></a>
      <nav class="menu" aria-label="Principal">
${NAV.map(n => `        <a href="${n.href}" data-nav="${n.id}"${pagina === n.id ? ' aria-current="page"' : ''}>${n.texto}</a>`).join('\n')}
      </nav>
      <div class="cabecera-acciones">
        <button type="button" class="boton-icono boton-zona" data-abrir-zona aria-haspopup="dialog">${icono('pin')}<span class="zona-texto" data-zona-etiqueta>Tu zona</span></button>
        <button type="button" class="boton-icono boton-texto" data-texto-grande aria-pressed="false"><span aria-hidden="true">A+</span><span class="oculto">Texto grande</span></button>
        <a href="${RUTAS.carrito}" class="boton-pedido" data-nav="carrito"${actual(pagina, 'carrito')}>${icono('bolsa')}<span>Pedido</span><span class="contador" data-contador>0</span></a>
      </div>
    </div>
  </header>
  <main id="contenido" tabindex="-1">
${cuerpo}
  </main>
  <footer class="pie">
    <div class="pie-leyendas" role="note" aria-label="Advertencias legales">
      <div class="contenedor">
        ${LEYENDAS}
      </div>
    </div>
    <div class="contenedor pie-fila">
      <div class="pie-marca">
        <img src="/marca/monograma-256.webp" alt="" width="256" height="176" loading="lazy" decoding="async">
        <p>Venta exclusiva para mayores de 18 años.<br>Domicilios en ${escapar(cfg.ciudad)}.</p>
      </div>
      <nav class="pie-enlaces" aria-label="Legal y contacto">
        <a href="${RUTAS.catalogo}">Catálogo</a>
        <a href="${RUTAS.calculadora}">Calculadora de fiesta</a>
        <a href="${RUTAS.terminos}">Términos y condiciones</a>
        <a href="${RUTAS.privacidad}">Tratamiento de datos</a>
        <a href="${wa(`Hola ${cfg.marca}`)}" rel="noopener">WhatsApp</a>
        <a href="https://www.instagram.com/${cfg.instagram}/" rel="noopener">Instagram</a>
        <a href="mailto:${cfg.correo}">${cfg.correo}</a>
      </nav>
    </div>
    <p class="contenedor pie-legal">© ${ANIO} ${marca} · Comerciante: Daniel Romero (persona natural). Matrícula mercantil en trámite.</p>
  </footer>
  <nav class="barra-app" aria-label="Accesos rápidos">
    <a href="/" data-nav="inicio"${actual(pagina, 'inicio')}>${icono('casa')}<span>Inicio</span></a>
    <a href="${RUTAS.catalogo}" data-nav="catalogo"${actual(pagina, 'catalogo')}>${icono('vitrina')}<span>Catálogo</span></a>
    <a href="${RUTAS.combos}" data-nav="combos">${icono('regalo')}<span>Combos</span></a>
    <a href="${RUTAS.carrito}" data-nav="carrito"${actual(pagina, 'carrito')}><span class="barra-icono">${icono('bolsa')}<span class="contador" data-contador>0</span></span><span>Pedido</span></a>
  </nav>
  <div class="edad" id="edad" role="dialog" aria-modal="true" aria-labelledby="edad-titulo" aria-describedby="edad-texto">
    <div class="edad-caja kj-filo">
      <div class="edad-logo">${LOGO('alt="LICORES K&amp;J" sizes="260px" decoding="async"')}</div>
      <h2 id="edad-titulo">¿Eres mayor de 18 años?</h2>
      <p id="edad-texto">Para entrar a ${marca} debes ser mayor de edad. Al entregar el pedido te pedimos la cédula.</p>
      <div class="edad-botones">
        <button type="button" class="boton boton-grande" data-edad="si">Sí, soy mayor de 18</button>
        <button type="button" class="boton boton-vidrio boton-grande" data-edad="no">No, soy menor de edad</button>
      </div>
      <div class="edad-leyendas">
        ${LEYENDAS}
      </div>
    </div>
  </div>
  <dialog class="dialogo" id="zona" aria-labelledby="zona-titulo">
    <form method="dialog" class="dialogo-caja kj-filo" data-form-zona>
      <button type="submit" class="dialogo-cerrar boton-icono" value="cerrar" aria-label="Cerrar">${icono('cerrar')}</button>
      <h2 id="zona-titulo">¿Llegamos a tu barrio?</h2>
      <p>Elige tu zona de domicilio. La recordamos para tus próximos pedidos y la usamos para calcular el domicilio.</p>
      ${cfg.zonas.some(z => z.ejemplo) ? '<p class="nota-ejemplo">Zonas y tarifas de ejemplo: la cobertura real está por confirmar.</p>' : ''}
      <fieldset class="opciones">
        <legend class="oculto">Zona de domicilio</legend>
${cfg.zonas.map(z => `        <label class="opcion-tarjeta"><input type="radio" name="zona" value="${z.id}"><span class="opcion-cuerpo"><strong>${escapar(z.nombre)}</strong><small>Domicilio ${precio(z.tarifa)}${Array.isArray(z.barrios) && z.barrios.length ? ` · ${escapar(z.barrios.join(', '))}` : ''}</small></span></label>`).join('\n')}
      </fieldset>
      <p class="dialogo-ayuda">¿No ves tu barrio? <a href="${wa(`Hola ${cfg.marca}, ¿llegan a mi barrio? Estoy en: `)}" rel="noopener">Pregúntanos por WhatsApp</a>.</p>
      <div class="dialogo-botones">
        <button type="submit" class="boton boton-grande" value="guardar">Guardar mi zona</button>
      </div>
    </form>
  </dialog>
  <div class="aviso-toast kj-filo" data-toast role="status" aria-live="polite"><span data-toast-texto></span><a href="${RUTAS.carrito}" class="toast-enlace" data-toast-enlace hidden>Ver pedido</a></div>
  <script type="module" src="/src/js/main.js"></script>
</body>
</html>
`;
}

// ── Piezas ──────────────────────────────────────────────────────────────────────────────────
const sello = (p) => (p.ejemplo ? ' <span class="sello-ejemplo">ejemplo</span>' : '');
const detalle = (p) => [p.presentacion, gradoTexto(p.grado)].filter(Boolean).join(' · ');
const datos = (p) => `<ul class="datos">${p.presentacion ? `<li>${escapar(p.presentacion)}</li>` : ''}${p.grado ? `<li class="dato-vol">${gradoTexto(p.grado)}</li>` : ''}</ul>`;
const botonAgregar = (p, texto = 'Agregar', extra = '') => p.agotado
    ? `<button type="button" class="boton boton-agotado ${extra}" disabled>Agotado</button>`
    : `<button type="button" class="boton ${extra}" data-agregar="${p.slug}">${icono('mas')}<span>${texto}</span></button>`;

function tarjeta(p) {
    const unidad = precioPorUnidad(p);
    return `      <article class="tarjeta vitrina" data-categoria="${p.categoria}" data-nombre="${escapar(p.nombre.toLowerCase())}">
        <a href="${rutaProducto(p)}" class="tarjeta-enlace">
          <div class="tarjeta-imagen escaparate">${imagenProducto(p)}${p.frio ? `<span class="sello-frio">${icono('frio')}Bien frío</span>` : ''}${p.ejemplo ? '<span class="sello-ejemplo sello-esquina">ejemplo</span>' : ''}</div>
          <h3 class="tarjeta-nombre">${escapar(p.nombre)}</h3>
        </a>
        ${datos(p)}
        <p class="tarjeta-precio">${precio(p.precio)}</p>
        ${unidad ? `<p class="tarjeta-unidad">${unidad}</p>` : '<p class="tarjeta-unidad">&nbsp;</p>'}
        ${botonAgregar(p, 'Agregar', 'boton-agregar')}
      </article>`;
}
const grilla = (lista) => `<div class="grilla">\n${lista.map(tarjeta).join('\n')}\n      </div>`;

// Estado vacío elegante (docs/41 §3): la vitrina se ve completa aunque no haya productos.
const vitrinaVacia = (titulo = 'Estamos llenando la vitrina') => `<div class="vacio-elegante">
        <div class="vacio-luz" aria-hidden="true"><img src="/marca/monograma-256.webp" alt="" width="256" height="176" loading="lazy" decoding="async"></div>
        <h3>${titulo}</h3>
        <p>Muy pronto verás aquí cada producto con su precio. Mientras tanto, escríbenos por WhatsApp lo que necesitas y te confirmamos disponibilidad y precio.</p>
        <div class="acciones">
          <a href="${wa(`Hola ${cfg.marca}, quiero hacer un pedido`)}" class="boton boton-grande" rel="noopener">${icono('chat')}<span>Pedir por WhatsApp</span></a>
          <a href="${RUTAS.calculadora}" class="boton boton-vidrio boton-grande">${icono('calculadora')}<span>Calcular para mi fiesta</span></a>
        </div>
      </div>`;

const cuenta = (id) => productos.filter(p => p.categoria === id).length;
const escalera = cfg.regalos.map((r, i) => `<li style="--i:${i}"><span class="escalon-nivel">${escapar(r.nivel)}</span><span class="escalon-monto">${precio(r.desde)}</span><span class="escalon-regalo">${escapar(r.regalo)}</span></li>`).join('\n            ');

// Ejemplo REAL de la calculadora: la misma fórmula que usa /calculadora/ (no es un dato inventado).
const EJEMPLO_FIESTA = { personas: 10, horas: 4, gustos: categorias.some(c => c.id === 'aguardiente') ? ['aguardiente'] : [] };
const ejemploFiesta = EJEMPLO_FIESTA.gustos.length ? sugerirFiesta(EJEMPLO_FIESTA, productos, nombreCategoria) : null;
const categoriaDeLinea = (l) => (l.tipo === 'hielo' ? 'acompanantes' : ['agua', 'mezclador'].includes(l.tipo) ? 'botella' : l.producto?.categoria || l.tipo);
const ticketFiesta = !ejemploFiesta ? '' : `<div class="calc-ticket">
            <p class="calc-ticket-titulo">Ejemplo: ${EJEMPLO_FIESTA.personas} personas, ${EJEMPLO_FIESTA.horas} horas, aguardiente</p>
            <ul>
${ejemploFiesta.lineas.slice(0, 3).map(l => `              <li><span class="calc-ico escaparate">${iconoProducto(categoriaDeLinea(l), 'icono-linea')}</span><span>${escapar(l.producto ? `${l.qty} × ${l.producto.nombre}` : l.texto)}</span></li>`).join('\n')}
            </ul>
          </div>`;
const pagosChips = cfg.pagos.map(m => `<li${m.proximamente ? ' class="chip-pronto"' : ''}>${escapar(m.nombre)}${m.proximamente ? ' <span class="sello-pronto">próximamente</span>' : ''}</li>`).join('');

const paginas = {};

// ── Inicio ──────────────────────────────────────────────────────────────────────────────────
const destacados = productos.filter(p => p.destacado);
paginas['index.html'] = molde({
    titulo: `${cfg.marca} · Licor frío a domicilio en ${cfg.ciudad}`,
    descripcion: `Cerveza, aguardiente, ron, whisky y vodka bien fríos a domicilio en ${cfg.ciudad}. Pide en línea; venta solo a mayores de 18 años.`,
    pagina: 'inicio',
    ruta: '/',
    precargarLogo: true,
    jsonld: { '@context': 'https://schema.org', '@type': 'OnlineStore', name: cfg.marca, email: cfg.correo, areaServed: cfg.ciudad, sameAs: [`https://www.instagram.com/${cfg.instagram}/`], ...(DOMINIO ? { url: absoluta('/'), logo: absoluta('/marca/icono-512.png') } : {}) },
    cuerpo: `    <section class="portada" aria-labelledby="t-portada">
      <div class="contenedor portada-fila">
        <div class="portada-escena">
          <div class="portada-haz" aria-hidden="true"></div>
          ${LOGO('class="portada-logo" alt="LICORES K&amp;J" sizes="(min-width: 860px) 520px, 82vw" fetchpriority="high" decoding="async"')}
          <div class="podio" aria-hidden="true"><span class="podio-lado"></span><span class="podio-cara"></span></div>
        </div>
        <div class="portada-texto">
          <button type="button" class="chip-zona" data-abrir-zona aria-haspopup="dialog">${icono('pin')}<span data-zona-chip>¿Llegamos a tu barrio?</span></button>
          <h1 id="t-portada" class="oro">Licor frío a domicilio, listo para tu plan</h1>
          <p class="portada-lead">Cerveza, aguardiente, ron, whisky y vodka en ${escapar(cfg.ciudad)}. Arma tu pedido, confírmalo por WhatsApp y te lo llevamos frío.</p>
          <div class="acciones">
            <a href="${RUTAS.catalogo}" class="boton boton-grande">${icono('vitrina')}<span>Ver catálogo</span></a>
            <a href="${wa(`Hola ${cfg.marca}, quiero hacer un pedido`)}" class="boton boton-vidrio boton-grande" rel="noopener">${icono('chat')}<span>Pedir por WhatsApp</span></a>
          </div>
          <p class="portada-nota">${icono('cedula')}<span>Solo para mayores de 18 años. Al entregar pedimos la cédula.</span></p>
        </div>
      </div>
    </section>
    <div class="contenedor"><div class="repetir kj-filo" data-repetir hidden></div></div>
    <section class="seccion contenedor" aria-labelledby="t-categorias">
      <div class="seccion-cabeza reveal"><h2 id="t-categorias">Categorías</h2><a href="${RUTAS.catalogo}" class="enlace-mas">Ver todo el catálogo</a></div>
      <ul class="categorias">
${categorias.map((c, i) => `        <li class="reveal" style="--d:${Math.min(i, 6) * 60}ms"><a class="categoria vitrina" href="${rutaCategoria(c.id)}"><span class="categoria-icono escaparate">${iconoProducto(c.id)}</span><span class="categoria-nombre">${escapar(c.nombre)}</span><span class="categoria-cuenta">${cuenta(c.id) ? `${cuenta(c.id)} ${cuenta(c.id) === 1 ? 'producto' : 'productos'}` : 'Pregunta disponibilidad'}</span></a></li>`).join('\n')}
      </ul>
    </section>
    <section class="seccion contenedor" aria-labelledby="t-destacados">
      <div class="seccion-cabeza reveal"><h2 id="t-destacados">${destacados.length ? 'Destacados' : 'La vitrina'}</h2>${destacados.length ? `<a href="${RUTAS.catalogo}" class="enlace-mas">Ver catálogo</a>` : ''}</div>
      ${destacados.length ? grilla(destacados) : vitrinaVacia()}
    </section>
    <section class="seccion contenedor" aria-labelledby="t-plan">
      <div class="seccion-cabeza reveal"><h2 id="t-plan">Todo para tu plan</h2></div>
      <div class="bento">
        <article class="bento-ficha bento-calc reveal">
          <div class="bento-calc-luz" aria-hidden="true"></div>
          <h3>Calculadora de fiesta</h3>
          <p>Dinos cuántas personas, cuántas horas y qué les gusta. Te sugerimos cuánto llevar, con hielo y agua incluidos.</p>
          ${ticketFiesta}
          <a href="${RUTAS.calculadora}" class="boton boton-grande">${icono('calculadora')}<span>Calcular mi pedido</span></a>
        </article>
        <article class="bento-ficha bento-regalos reveal" style="--d:80ms">
          <h3>Regalos por tu compra${cfg.modoPrueba ? ' <span class="sello-ejemplo">propuesta</span>' : ''}</h3>
          <p>Según el valor de tu pedido te llevamos algo frío de regalo, sin alcohol.</p>
          <ol class="escalera">
            ${escalera}
          </ol>
        </article>
        <article class="bento-ficha bento-zona reveal" style="--d:120ms">
          <span class="bento-icono anillos" aria-hidden="true">${icono('pin')}</span>
          <h3>¿Llegamos a tu barrio?</h3>
          <p data-zona-bento>Elige tu zona una vez y la recordamos.</p>
          <button type="button" class="boton boton-vidrio" data-abrir-zona aria-haspopup="dialog">Elegir mi zona</button>
        </article>
        <article class="bento-ficha bento-whatsapp reveal" style="--d:160ms">
          <span class="bento-icono" aria-hidden="true">${icono('chat')}</span>
          <h3>¿Prefieres escribir?</h3>
          <p>Cuéntanos qué necesitas y te ayudamos a armar el pedido.</p>
          <a href="${wa(`Hola ${cfg.marca}, quiero hacer un pedido`)}" class="boton boton-vidrio" rel="noopener">Abrir WhatsApp</a>
        </article>
        <article class="bento-ficha bento-programar reveal">
          <span class="bento-icono" aria-hidden="true">${icono('calendario')}</span>
          <h3>Programa la entrega</h3>
          <p>${APERTURA ? 'Lo antes posible, o el día y la franja que prefieras' : 'Elige el día y la franja que prefieras'}: lo eliges al confirmar tu pedido. ${sinEntregas}</p>
          <p class="bento-dato">Horario de domicilios: ${cfg.horario ? escapar(cfg.horario) : 'por confirmar'} · Pedido mínimo ${precio(cfg.pedidoMinimo)}</p>
        </article>
        <article class="bento-ficha bento-pagos reveal" style="--d:80ms">
          <span class="bento-icono" aria-hidden="true">${icono('tarjeta')}</span>
          <h3>Paga como prefieras</h3>
          <ul class="chips">${pagosChips}</ul>
        </article>
      </div>
    </section>
    <section class="seccion contenedor" aria-labelledby="t-pasos">
      <div class="seccion-cabeza reveal"><h2 id="t-pasos">Así de fácil</h2></div>
      <ol class="pasos">
        <li class="paso reveal"><span class="paso-numero" aria-hidden="true">1</span><h3>Elige</h3><p>Agrega tus productos al pedido o usa la calculadora de fiesta.</p></li>
        <li class="paso reveal" style="--d:100ms"><span class="paso-numero" aria-hidden="true">2</span><h3>Confirma</h3><p>Envíalo por WhatsApp con tu código de pedido y elige cómo pagar.</p></li>
        <li class="paso reveal" style="--d:200ms"><span class="paso-numero" aria-hidden="true">3</span><h3>Recibe frío</h3><p>Al entregar pedimos tu cédula: no vendemos a menores de edad.</p></li>
      </ol>
    </section>`,
});

// ── Catálogo ────────────────────────────────────────────────────────────────────────────────
paginas['catalogo/index.html'] = molde({
    titulo: `Catálogo · ${cfg.marca}`,
    descripcion: `Catálogo de ${cfg.marca}: cerveza, aguardiente, ron, whisky, vodka, combos y hielo a domicilio en ${cfg.ciudad}.`,
    pagina: 'catalogo',
    ruta: RUTAS.catalogo,
    cuerpo: `    <section class="contenedor seccion seccion-primera">
      <header class="pagina-cabeza">
        <h1 class="oro">Catálogo</h1>
        <p>${hayCatalogo ? 'Elige una categoría o busca por nombre. Cada ficha muestra el precio, el precio por litro y el % Vol.' : 'Las categorías ya están listas. Los productos con su precio llegan muy pronto.'}</p>
      </header>
${hayCatalogo ? `      <div class="filtros" role="toolbar" aria-label="Filtrar por categoría">
        <button type="button" class="filtro" data-filtro="" aria-pressed="true">Todo</button>
${categorias.map(c => `        <button type="button" class="filtro" data-filtro="${c.id}" aria-pressed="false">${escapar(c.nombre)}</button>`).join('\n')}
      </div>
      <label class="buscador">${icono('buscar')}<span class="oculto">Buscar producto</span><input type="search" placeholder="Buscar producto" data-buscar autocomplete="off"></label>
      ${grilla(productos)}
      <div class="vacio-filtro" data-vacio hidden>
        <p>No hay productos con ese filtro.</p>
        <a href="${wa(`Hola ${cfg.marca}, estoy buscando un producto`)}" class="boton boton-vidrio" rel="noopener" data-vacio-wa>Pregúntanos por WhatsApp</a>
      </div>` : `      ${vitrinaVacia('El catálogo se está preparando')}
      <h2 class="titulo-pregunta">Pregunta por una categoría</h2>
      <ul class="chips chips-grandes">
${categorias.map(c => `        <li><a href="${wa(`Hola ${cfg.marca}, ¿qué tienen de ${c.nombre.toLowerCase()}?`)}" rel="noopener">${iconoProducto(c.id, 'icono-chip', false)}<span>${escapar(c.nombre)}</span></a></li>`).join('\n')}
      </ul>`}
    </section>`,
});

// ── Carrito y pedido ────────────────────────────────────────────────────────────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// La franja nocturna dice su hora de cierre (docs/40 §4). Las horas de las demás las decide Daniel.
const FRANJAS = Array.isArray(cfg.franjas) && cfg.franjas.length ? cfg.franjas : ['En la mañana', 'En la tarde', `En la noche, ${hastaCierre}`];
const campo = (nombre, etiqueta, entrada, ayuda = '') => {
    const describe = `${ayuda ? `a-${nombre} ` : ''}e-${nombre}`;
    const atributos = `id="c-${nombre}" name="${nombre}" aria-describedby="${describe}"`;
    return `<div class="campo">
            <label for="c-${nombre}">${etiqueta}</label>
            ${ayuda ? `<p class="campo-ayuda" id="a-${nombre}">${ayuda}</p>` : ''}
            ${entrada.replace(/^<(input|select)/, `<$1 ${atributos}`)}
            <p class="campo-error" id="e-${nombre}" hidden></p>
          </div>`;
};

paginas['carrito/index.html'] = molde({
    titulo: `Tu pedido · ${cfg.marca}`,
    descripcion: `Arma y confirma tu pedido de ${cfg.marca}.`,
    pagina: 'carrito',
    ruta: RUTAS.carrito,
    cuerpo: `    <section class="contenedor seccion seccion-primera">
      <header class="pagina-cabeza">
        <h1 class="oro">Tu pedido</h1>
        <p>Revisa tus productos, dinos dónde y cuándo entregar, y envíalo por WhatsApp con su código.</p>
      </header>
      <div class="vacio-elegante" data-carrito-vacio hidden>
        <div class="vacio-luz" aria-hidden="true"><img src="/marca/monograma-256.webp" alt="" width="256" height="176" loading="lazy" decoding="async"></div>
        <h2 tabindex="-1" data-vacio-titulo>Tu pedido está vacío</h2>
        <p>Agrega productos desde el catálogo, usa la calculadora de fiesta o escríbenos por WhatsApp.</p>
        <div class="acciones">
          <button type="button" class="boton boton-grande" data-repetir-boton hidden>${icono('repetir')}<span>Pedir lo mismo de la última vez</span></button>
          <a href="${RUTAS.catalogo}" class="boton boton-grande">${icono('vitrina')}<span>Ver catálogo</span></a>
          <a href="${RUTAS.calculadora}" class="boton boton-vidrio boton-grande">${icono('calculadora')}<span>Calculadora de fiesta</span></a>
          <a href="${wa(`Hola ${cfg.marca}, quiero hacer un pedido`)}" class="boton boton-vidrio boton-grande" rel="noopener">${icono('chat')}<span>Pedir por WhatsApp</span></a>
        </div>
      </div>
      <div class="pedido" data-pedido>
        <div class="pedido-principal">
          <section class="panel" aria-labelledby="t-productos">
            <h2 id="t-productos" class="panel-titulo">Productos</h2>
            <div class="lineas" data-lineas></div>
            <p class="oculto" data-anuncio aria-live="polite"></p>
            <div class="regalo" data-regalo></div>
          </section>
          <form class="formulario" id="form-pedido" data-formulario novalidate>
            <fieldset class="paso-form panel">
              <legend class="paso-titulo"><span class="paso-n" aria-hidden="true">1</span>Tus datos</legend>
              ${campo('nombre', 'Nombre completo', '<input autocomplete="name" required>')}
              ${campo('telefono', 'Celular', '<input type="tel" inputmode="numeric" autocomplete="tel-national" required>', 'Te escribimos a este número por WhatsApp.')}
            </fieldset>
            <fieldset class="paso-form panel">
              <legend class="paso-titulo"><span class="paso-n" aria-hidden="true">2</span>Dónde entregamos</legend>
              ${campo('direccion', 'Dirección', '<input autocomplete="street-address" required>')}
              ${campo('barrio', 'Barrio', '<input autocomplete="address-level3" required>')}
              ${campo('zona', 'Zona de domicilio', `<select required>
              <option value="">Elige tu zona</option>
${cfg.zonas.map(z => `              <option value="${z.id}">${escapar(z.nombre)} · ${precio(z.tarifa)}</option>`).join('\n')}
            </select>`, cfg.zonas.some(z => z.ejemplo) ? 'Zonas y tarifas de ejemplo: la cobertura real está por confirmar.' : '')}
              <div class="campo">
                <label for="c-notas">Indicaciones para el domiciliario <span class="opcional">(opcional)</span></label>
                <textarea id="c-notas" name="notas" rows="2" maxlength="300"></textarea>
              </div>
            </fieldset>
            <fieldset class="paso-form panel">
              <legend class="paso-titulo"><span class="paso-n" aria-hidden="true">3</span>Cuándo lo quieres</legend>
              <div class="opciones opciones-2">
                <label class="opcion-tarjeta${APERTURA ? '' : ' opcion-pronto'}" data-opcion-pronto><input type="radio" name="cuando" value="pronto"${APERTURA ? ' checked' : ' disabled'}><span class="opcion-cuerpo"><strong>Lo antes posible</strong><small data-pronto-nota>${APERTURA ? 'Te confirmamos el tiempo de entrega por WhatsApp.' : 'Disponible cuando confirmemos el horario de domicilios. Por ahora, programa tu pedido.'}</small></span></label>
                <label class="opcion-tarjeta"><input type="radio" name="cuando" value="programar"${APERTURA ? '' : ' checked'}><span class="opcion-cuerpo"><strong>Programar</strong><small>Elige el día y la franja.</small></span></label>
              </div>
              <div class="programar" data-programar${APERTURA ? ' hidden' : ''}>
                ${campo('fecha', 'Día de entrega', '<input type="date">')}
                ${campo('franja', 'Franja', `<select>
                  <option value="">Elige una franja</option>
${FRANJAS.map(f => `                  <option>${escapar(f)}</option>`).join('\n')}
                </select>`)}
              </div>
              <p class="campo-ayuda">Horario de domicilios: ${cfg.horario ? escapar(cfg.horario) : 'por confirmar'}. ${sinEntregas} Te confirmamos la hora por WhatsApp.</p>
            </fieldset>
            <fieldset class="paso-form panel">
              <legend class="paso-titulo"><span class="paso-n" aria-hidden="true">4</span>Cómo pagas</legend>
              <div class="opciones opciones-2">
${cfg.pagos.map((m, i) => `                <label class="opcion-tarjeta${m.proximamente ? ' opcion-pronto' : ''}"><input type="radio" name="pago" value="${m.id}"${i === 0 ? ' checked' : ''}${m.proximamente ? ' disabled' : ''}><span class="opcion-cuerpo"><strong>${escapar(m.nombre)}${m.proximamente ? ' <span class="sello-pronto">próximamente</span>' : ''}</strong>${m.detalle ? `<small>${escapar(m.detalle)}</small>` : ''}</span></label>`).join('\n')}
              </div>
            </fieldset>
            <fieldset class="paso-form panel">
              <legend class="paso-titulo"><span class="paso-n" aria-hidden="true">5</span>Confirma tu edad</legend>
              <div class="campo">
                <span class="etiqueta" id="l-nacimiento">Fecha de nacimiento</span>
                <div class="nacimiento" role="group" aria-labelledby="l-nacimiento" aria-describedby="e-nacimiento">
                  <label><span>Día</span><select name="nacDia" autocomplete="bday-day"><option value="">Día</option>${Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></label>
                  <label><span>Mes</span><select name="nacMes" autocomplete="bday-month"><option value="">Mes</option>${MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></label>
                  <label><span>Año</span><input name="nacAnio" inputmode="numeric" autocomplete="bday-year" maxlength="4" placeholder="Ej. 1990"></label>
                </div>
                <p class="campo-error" id="e-nacimiento" hidden></p>
              </div>
              <div class="campo">
                <label class="casilla"><input type="checkbox" name="mayor" aria-describedby="e-mayor"><span>Confirmo que soy mayor de 18 años y mostraré mi cédula al recibir.</span></label>
                <p class="campo-error" id="e-mayor" hidden></p>
              </div>
              <div class="campo">
                <label class="casilla"><input type="checkbox" name="acepto" aria-describedby="e-acepto"><span>Acepto los <a href="${RUTAS.terminos}">términos</a> y el <a href="${RUTAS.privacidad}">tratamiento de mis datos</a>.</span></label>
                <p class="campo-error" id="e-acepto" hidden></p>
              </div>
            </fieldset>
          </form>
        </div>
        <aside class="cajon kj-filo" aria-labelledby="t-resumen">
          <h2 id="t-resumen" class="panel-titulo">Resumen</h2>
          <div class="resumen" data-resumen></div>
          ${cfg.pedidosPausados ? `<p class="resumen-pausa" role="note">${escapar(cfg.mensajePausa || 'Por ahora no estamos recibiendo pedidos. Vuelve pronto.')}</p>` : ''}
          <p class="error-general" data-error role="alert" hidden></p>
          <button type="submit" form="form-pedido" class="boton boton-grande boton-ancho"${cfg.pedidosPausados ? ' disabled' : ''}>${icono('chat')}<span>Enviar pedido por WhatsApp</span></button>
          <p class="cajon-nota">${icono('cedula')}<span>Al recibir te pedimos la cédula. No vendemos a menores de edad.</span></p>
        </aside>
      </div>
      <div class="confirmacion kj-filo" data-confirmacion tabindex="-1" hidden></div>
    </section>`,
});

// ── Calculadora de fiesta ───────────────────────────────────────────────────────────────────
const GUSTOS = categorias.filter(c => !['combos', 'acompanantes'].includes(c.id));
const contadorGrande = (nombre, etiqueta, valor, min, max, menos, mas) => `<div class="calc-campo">
            <label class="etiqueta" for="k-${nombre}">${etiqueta}</label>
            <div class="paso-numero-control">
              <button type="button" class="boton-paso" data-paso="-1" data-campo="${nombre}" aria-label="${menos}">${icono('menos')}</button>
              <input id="k-${nombre}" name="${nombre}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${valor}">
              <button type="button" class="boton-paso" data-paso="1" data-campo="${nombre}" aria-label="${mas}">${icono('mas')}</button>
            </div>
          </div>`;

paginas['calculadora/index.html'] = molde({
    titulo: `Calculadora de fiesta · ${cfg.marca}`,
    descripcion: `¿Cuánto licor, hielo y agua llevar para tu fiesta? Calcula por personas, horas y gustos y pide a domicilio en ${cfg.ciudad}.`,
    pagina: 'calculadora',
    ruta: RUTAS.calculadora,
    cuerpo: `    <section class="contenedor seccion seccion-primera">
      <header class="pagina-cabeza">
        <h1 class="oro">Calculadora de fiesta</h1>
        <p>Dinos cuántas personas, cuántas horas y qué les gusta. Te sugerimos cuánto llevar, con hielo y agua incluidos.</p>
      </header>
      <div class="calc">
        <form class="calc-form panel" data-calc novalidate>
          ${contadorGrande('personas', '¿Cuántas personas?', 10, 1, 200, 'Una persona menos', 'Una persona más')}
          ${contadorGrande('horas', '¿Cuántas horas?', 4, 1, 12, 'Una hora menos', 'Una hora más')}
          <fieldset class="calc-gustos">
            <legend class="etiqueta">¿Qué les gusta? <span class="opcional">Puedes elegir varios.</span></legend>
            <div class="gustos">
${GUSTOS.map(g => `              <label class="gusto"><input type="checkbox" name="gusto" value="${g.id}"${g.id === 'aguardiente' ? ' checked' : ''}><span class="gusto-cuerpo">${iconoProducto(g.id, 'icono-gusto', false)}<span>${escapar(g.nombre)}</span></span></label>`).join('\n')}
            </div>
            <p class="campo-error" data-calc-error hidden></p>
          </fieldset>
        </form>
        <div class="calc-resultado kj-filo" data-calc-resultado aria-live="polite">
          <p class="calc-sin-js">Activa JavaScript para ver la sugerencia, o <a href="${wa(`Hola ${cfg.marca}, quiero armar un pedido para una fiesta`)}" rel="noopener">pídenos ayuda por WhatsApp</a>.</p>
        </div>
      </div>
      <details class="supuestos panel">
        <summary>¿Cómo lo calculamos?</summary>
        <ul>
          <li>${SUPUESTOS.tragosPrimeraHora} tragos por persona la primera hora y ${SUPUESTOS.tragosPorHoraSiguiente} por cada hora siguiente.</li>
          <li>Un trago de licor son ${SUPUESTOS.porcionLicorMl} ml (una botella de 750 ml rinde unos ${Math.floor(750 / SUPUESTOS.porcionLicorMl)}); una cerveza son 330 ml.</li>
          <li>Si eligen varios gustos, repartimos los tragos por partes iguales.</li>
          <li>Ron, whisky y vodka: ${SUPUESTOS.mezcladorPorTragoMl} ml de gaseosa o soda por trago.</li>
          <li>Hielo: ${String(SUPUESTOS.hieloKgPorPersona).replace('.', ',')} kg por persona. Agua: ${SUPUESTOS.aguasPorPersona} por persona.</li>
        </ul>
        <p>Es una guía para planear, no una meta: ajústala a tu grupo. Toma con moderación y alterna con agua.</p>
      </details>
      <div class="leyendas-caja" role="note">
        ${LEYENDAS}
      </div>
    </section>`,
});

// ── 404 y legales ───────────────────────────────────────────────────────────────────────────
paginas['404.html'] = molde({
    titulo: `Página no encontrada · ${cfg.marca}`, descripcion: 'Esta página no existe.', pagina: 'error',
    cuerpo: `    <section class="contenedor seccion seccion-primera error-404">
      <div class="vacio-elegante">
        <div class="vacio-luz" aria-hidden="true"><img src="/marca/monograma-256.webp" alt="" width="256" height="176" decoding="async"></div>
        <h1 class="oro">Esta página no existe</h1>
        <p>Puede que el enlace esté mal escrito o que el producto ya no esté.</p>
        <div class="acciones">
          <a href="/" class="boton boton-grande">${icono('casa')}<span>Volver al inicio</span></a>
          <a href="${RUTAS.catalogo}" class="boton boton-vidrio boton-grande">${icono('vitrina')}<span>Ver catálogo</span></a>
        </div>
      </div>
    </section>`,
});

const legal = (carpeta, titulo, secciones) => {
    paginas[`${carpeta}/index.html`] = molde({
        titulo: `${titulo} · ${cfg.marca}`, descripcion: `${titulo} de ${cfg.marca}.`, pagina: 'legal', ruta: `/${carpeta}/`,
        cuerpo: `    <section class="contenedor seccion seccion-primera texto-legal">
      <header class="pagina-cabeza"><h1 class="oro">${titulo}</h1></header>
      <p class="aviso-borrador">BORRADOR pendiente de revisión legal y de la matrícula mercantil. No es la versión final.</p>
${secciones.map(([h, t]) => `      <h2>${h}</h2>\n      <p>${t}</p>`).join('\n')}
    </section>`,
    });
};

legal('terminos', 'Términos y condiciones', [
    ['Quién vende', `${marca} es el nombre comercial de Daniel Romero, persona natural. Los datos completos del comerciante (identificación, matrícula mercantil y dirección de notificación) se publicarán aquí al quedar registrados.`],
    ['Solo para mayores de edad', 'Vendemos bebidas alcohólicas únicamente a mayores de 18 años. Al entregar pedimos la cédula y no entregamos a menores de edad ni a personas en evidente estado de embriaguez.'],
    ['Precios y pedidos', 'Los precios incluyen los impuestos que correspondan. El pedido queda confirmado cuando te respondemos por WhatsApp con su código.'],
    ['Derecho de retracto', 'En las ventas a distancia puedes retractarte dentro de los 5 días hábiles siguientes a la entrega, en las condiciones de la Ley 1480 de 2011; los costos de transporte de la devolución corren por tu cuenta.'],
]);
legal('privacidad', 'Tratamiento de datos personales', [
    ['Responsable', `Daniel Romero, persona natural, con el nombre comercial ${marca}. Contacto: ${cfg.correo}.`],
    ['Qué datos y para qué', 'Usamos tu nombre, celular, dirección y fecha de nacimiento solo para entregar tu pedido y verificar que eres mayor de edad. No guardamos fotos de tu cédula.'],
    ['En tu navegador', 'Tu pedido en curso, tu zona, la preferencia de texto grande, la confirmación de edad y los productos de tu último pedido se guardan solo en tu propio navegador para que no tengas que repetirlos. Tus datos de entrega no se guardan.'],
    ['Tus derechos', 'Puedes conocer, actualizar, rectificar y pedir la supresión de tus datos (Ley 1581 de 2012) escribiendo al correo de contacto.'],
]);

// ── Fichas de producto ──────────────────────────────────────────────────────────────────────
for (const p of productos) {
    const unidad = precioPorUnidad(p);
    const relacionados = productos.filter(o => o.categoria === p.categoria && o.slug !== p.slug).slice(0, 4);
    paginas[`producto/${p.slug}/index.html`] = molde({
        titulo: `${p.nombre} ${p.presentacion} · ${cfg.marca}`,
        descripcion: `${p.nombre}, ${detalle(p)}, a domicilio en ${cfg.ciudad}. Precio: ${precio(p.precio)}.`,
        pagina: 'producto',
        ruta: rutaProducto(p),
        // URLs absolutas solo con dominio. La imagen va solo si hay foto real: el logo no es el producto.
        jsonld: [{
            '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, description: `${p.nombre} · ${detalle(p)}`,
            category: nombreCategoria[p.categoria],
            url: absoluta(rutaProducto(p)),
            ...(p.imagen ? { image: absoluta(p.imagen) } : {}),
            offers: { '@type': 'Offer', price: p.precio, priceCurrency: 'COP', url: absoluta(rutaProducto(p)), availability: p.agotado ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' },
        }, {
            '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluta('/') },
                { '@type': 'ListItem', position: 2, name: nombreCategoria[p.categoria], item: absoluta(rutaCategoria(p.categoria)) },
                { '@type': 'ListItem', position: 3, name: p.nombre },
            ],
        }],
        cuerpo: `    <section class="contenedor seccion seccion-primera">
      <nav class="migas" aria-label="Ruta"><a href="/">Inicio</a><span aria-hidden="true">›</span><a href="${rutaCategoria(p.categoria)}">${escapar(nombreCategoria[p.categoria])}</a><span aria-hidden="true">›</span><span aria-current="page">${escapar(p.nombre)}</span></nav>
      <div class="ficha">
        <div class="ficha-imagen escaparate">${imagenProducto(p)}${p.frio ? `<span class="sello-frio">${icono('frio')}Bien frío</span>` : ''}</div>
        <div class="ficha-info">
          <h1 class="oro">${escapar(p.nombre)}</h1>
          ${datos(p)}
          <p class="ficha-precio">${precio(p.precio)}${sello(p)}</p>
          ${unidad ? `<p class="ficha-unidad">${unidad}</p>` : ''}
          <div class="ficha-compra">
            <div class="paso-numero-control" role="group" aria-label="Cantidad">
              <button type="button" class="boton-paso" data-cant="-1" aria-label="Uno menos">${icono('menos')}</button>
              <input type="number" min="1" max="${MAX_POR_PRODUCTO}" value="1" inputmode="numeric" data-cantidad aria-label="Cantidad">
              <button type="button" class="boton-paso" data-cant="1" aria-label="Uno más">${icono('mas')}</button>
            </div>
            ${botonAgregar(p, 'Agregar<span class="solo-ancho"> al pedido</span>', 'boton-grande')}
          </div>
          <ul class="ficha-garantias">
            <li>${icono('chat')}<span>Confirmas por WhatsApp con tu código de pedido.</span></li>
            <li>${icono('cedula')}<span>Al entregar pedimos la cédula.</span></li>
          </ul>
          <div class="leyendas-caja" role="note">
            ${LEYENDAS}
          </div>
        </div>
      </div>
      <div class="compra-fija kj-filo" data-compra-fija aria-label="Comprar ${escapar(p.nombre)}" role="region">
        <p class="compra-fija-precio"><strong>${precio(p.precio)}</strong><small>${gradoTexto(p.grado) || unidad}</small></p>
        ${botonAgregar(p, 'Agregar')}
      </div>
    </section>${relacionados.length ? `
    <section class="contenedor seccion" aria-labelledby="t-relacionados">
      <div class="seccion-cabeza"><h2 id="t-relacionados">Más de ${escapar(nombreCategoria[p.categoria].toLowerCase())}</h2><a href="${rutaCategoria(p.categoria)}" class="enlace-mas">Ver todo</a></div>
      ${grilla(relacionados)}
    </section>` : ''}`,
    });
}

// ── Escribir (borra lo horneado antes, también las rutas viejas *.html) ──────────────────────
for (const viejo of ['producto', 'catalogo', 'carrito', 'calculadora', 'terminos', 'privacidad',
    'catalogo.html', 'carrito.html', 'terminos.html', 'privacidad.html']) {
    rmSync(join(RAIZ, viejo), { recursive: true, force: true });
}
for (const [archivo, html] of Object.entries(paginas)) {
    const destino = join(RAIZ, archivo);
    mkdirSync(join(destino, '..'), { recursive: true });
    writeFileSync(destino, html);
}

// robots.txt siempre permite rastrear: si se bloqueara, Google no vería el «noindex» de cada página.
// El sitemap solo existe con dominio y con el sitio indexable (public/ lo copia Vite a dist/).
const rutasPublicas = ['/', RUTAS.catalogo, RUTAS.calculadora, RUTAS.terminos, RUTAS.privacidad, ...productos.map(rutaProducto)];
const conSitemap = Boolean(DOMINIO && cfg.indexable);
writeFileSync(join(RAIZ, 'public/robots.txt'), `User-agent: *\nAllow: /\n${conSitemap ? `\nSitemap: ${absoluta('/sitemap.xml')}\n` : ''}`);
rmSync(join(RAIZ, 'public/sitemap.xml'), { force: true });
if (conSitemap) {
    writeFileSync(join(RAIZ, 'public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rutasPublicas.map(r => `  <url><loc>${absoluta(r)}</loc></url>`).join('\n')}\n</urlset>\n`);
}

console.log(`horneadas ${Object.keys(paginas).length} páginas (${productos.length} fichas de producto)`);
for (const a of avisos) console.warn(`⚠ ${a}`);
