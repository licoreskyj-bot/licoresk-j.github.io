/**
 * Hornea TODAS las páginas de LICORES K&J desde src/data (catalogo.json + config.json): inicio,
 * catálogo, carrito, calculadora de fiesta, legales, 404 y una ficha HTML por producto (para que
 * Google la lea sin JavaScript). URLs limpias: cada página es <carpeta>/index.html.
 * Un solo molde de cabecera y pie: las leyendas legales del Decreto 1686/2012 art. 54 van en TODAS.
 * Las páginas generadas no se versionan (.gitignore): se rehacen en cada `npm run dev` / `build`.
 * Sistema visual: brain-private/licoreskyj/docs/42-SISTEMA-VISUAL-WEB.md.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    precio, precioPorUnidad, gradoTexto, iconoProducto, imagenProducto, icono, escapar,
    RUTAS, rutaProducto, rutaCategoria, MAX_POR_PRODUCTO,
} from '../src/js/comun.js';
import { SUPUESTOS, tragosTotales } from '../src/js/fiesta.js';

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

// Escena de la portada (pedido de Daniel del 27-oct: «la luz y el vapor se ven naturales» en la placa
// H01 y el logo «flotando como el diamante del index de Bersaglio»). La FOTO fija del escenario
// (public/escenas/escena-foco-<640|1024>.{avif,webp}, 1024×1024) va en el HTML: es el fondo de la
// escena y el candidato a LCP. El VIDEO de la misma toma (escena-foco-<ancho>.{webm,mp4}) NUNCA va en
// el HTML ni se precarga: solo se anuncia al JS si EXISTE al hornear (así no hay pedidos 404 mientras
// no esté, y el siguiente build lo toma solo; si hay varios anchos, el más ancho) y src/js/portada.js
// lo pide tras «load», con buena red, y lo pinta en un canvas encima de la foto. Si un archivo
// cambia, cambia el nombre (_headers: /escenas/* va con caché de 30 días).
const ESCENAS = join(RAIZ, 'public/escenas');
const enEscenas = existsSync(ESCENAS) ? readdirSync(ESCENAS) : [];
const FOTO_ESCENA = [640, 1024];
const faltanFotos = FOTO_ESCENA.flatMap(w => ['avif', 'webp'].map(f => `escena-foco-${w}.${f}`)).filter(n => !enEscenas.includes(n));
if (faltanFotos.length) avisos.push(`Escena de la portada: falta(n) ${faltanFotos.join(', ')} en public/escenas/ (la portada sale sin foto de fondo).`);
const videoEscena = { webm: '', mp4: '' };
const anchoVideo = { webm: -1, mp4: -1 };
for (const nombre of enEscenas) {
    const m = /^escena-foco-(\d+)\.(webm|mp4)$/.exec(nombre);
    if (m && Number(m[1]) > anchoVideo[m[2]]) { anchoVideo[m[2]] = Number(m[1]); videoEscena[m[2]] = `/escenas/${nombre}`; }
}
const DATOS_VIDEO = videoEscena.webm || videoEscena.mp4 ? ` data-video-webm="${videoEscena.webm}" data-video-mp4="${videoEscena.mp4}"` : '';
if (!DATOS_VIDEO) avisos.push('public/escenas/escena-foco-<ancho>.{webm,mp4} aún no existe: la portada sale con la foto fija (el logo flota igual).');
else if (!videoEscena.webm || !videoEscena.mp4) avisos.push(`Video de la escena: falta el ${videoEscena.webm ? 'MP4 (H.264, para iPhone sin AV1)' : 'WEBM (AV1)'} en public/escenas/: la portada usa solo el que hay.`);
// Tamaños mostrados (estilos.css «Portada en escena»): la foto mide --foto (celular ≈ 1,24 del ancho;
// ordenador ≤ 1040 px) y el logo el 44,1 % de la foto, como en la maqueta. El <link rel=preload> del
// logo usa el MISMO sizes, si no el navegador lo baja dos veces.
// El logo mide 0,441 × --foto y --foto ≤ 124vw en el celular: ≤ 54,7vw. Con 55vw, a 390@3 pedía 643 px y
// bajaba el de 1200 (103 KB) para verse a 640; con 54.6vw baja el de 640 (46 KB). No cambia ningún píxel.
const TAM_FOTO = '(min-width: 861px) 820px, 124vw';
const TAM_LOGO = '(min-width: 861px) 460px, 54.6vw';

// ── Fotos de ambiente del resto de la web (config.escenas; docs/44 §6 y §9). Cada una va en un
// <picture> AVIF → WebP con srcset y sizes, SIEMPRE con width/height (CLS 0) y, como van bajo el
// pliegue, con loading="lazy" + decoding="async" y sin fetchpriority (eso es solo de la escena de la
// portada). El alt describe la escena real; las texturas llevan alt="". Si falta un archivo, esa pieza
// sale sin foto (nunca un pedido 404) y el build lo avisa. Nada de /escenas/ entra al service worker.
const ANCHOS = { '4:5': [192, 480, 720, 1080], '3:4': [600, 900], '16:9': [960, 1280, 1920], '1:1': [320, 640, 1080] };
const PROPORCION = { '4:5': [4, 5], '3:4': [3, 4], '16:9': [16, 9], '1:1': [1, 1] };
const ESC = cfg.escenas || {};
const faltanEscenas = new Set();
function hayFoto(archivo, anchos) {
    if (!archivo) return false;
    const faltan = anchos.flatMap(w => ['avif', 'webp'].map(f => `${archivo}-${w}.${f}`)).filter(n => !enEscenas.includes(n));
    faltan.forEach(n => faltanEscenas.add(n));
    return !faltan.length;
}
const juego = (archivo, anchos, formato) => anchos.map(w => `/escenas/${archivo}-${w}.${formato} ${w}w`).join(', ');
const medidas = (formato, ancho) => { const [a, b] = PROPORCION[formato]; return `width="${ancho}" height="${Math.round(ancho * b / a)}"`; };
function foto({ archivo, formato, anchos = ANCHOS[formato], sizes, alt = '', clase = '', foco = '', pronto = false, alta = false }) {
    if (!hayFoto(archivo, anchos)) return '';
    const mayor = anchos.at(-1);
    const base = anchos.find(w => w >= 480) || mayor;
    return `<picture><source type="image/avif" srcset="${juego(archivo, anchos, 'avif')}" sizes="${sizes}"><img src="/escenas/${archivo}-${base}.webp" srcset="${juego(archivo, anchos, 'webp')}" sizes="${sizes}" ${medidas(formato, mayor)} alt="${escapar(alt)}"${clase ? ` class="${clase}"` : ''}${foco ? ` style="object-position:${foco}"` : ''}${pronto ? '' : ' loading="lazy"'}${alta ? ' fetchpriority="high"' : ''} decoding="async"></picture>`;
}
const escenaCategoria = (id) => ESC.categorias?.[id] || null;
const fotoCategoria = (id, opciones) => { const e = escenaCategoria(id); return e ? foto({ archivo: e.archivo, formato: '4:5', alt: e.alt, foco: e.foco, ...opciones }) : ''; };
// La gota (T03): estado vacío, 404 y numerales de «Así de fácil». Textura: alt="".
// «pronto»: arriba del todo de la página (404, pedido vacío), sin lazy.
const fotoGota = (sizes, clase = '', pronto = false) => foto({ archivo: ESC.gota, formato: '1:1', anchos: [320, 640], sizes, clase, pronto });
const luzVacia = (sizes = '150px', pronto = false) => {
    const gota = fotoGota(sizes, '', pronto);
    return gota ? `<div class="vacio-luz vacio-gota" aria-hidden="true">${gota}</div>`
        : '<div class="vacio-luz" aria-hidden="true"><img src="/marca/monograma-256.webp" alt="" width="256" height="176" loading="lazy" decoding="async"></div>';
};

// Video de fondo de la calculadora exprés (oro líquido, docs/44 §8): como el de la portada, NUNCA en
// el HTML ni precargado; solo se anuncia al JS si EXISTE al hornear (public/escenas/oro-liquido-<ancho>
// .{webm,mp4}; si hay varios anchos, el más ancho) y src/js/banda-video.js lo pone tras «load».
const videoOro = { webm: '', mp4: '' };
const anchoOro = { webm: -1, mp4: -1 };
for (const nombre of enEscenas) {
    const m = /^oro-liquido-(\d+)\.(webm|mp4)$/.exec(nombre);
    if (m && Number(m[1]) > anchoOro[m[2]]) { anchoOro[m[2]] = Number(m[1]); videoOro[m[2]] = `/escenas/${nombre}`; }
}
const VIDEO_ORO = videoOro.webm || videoOro.mp4 ? ` data-banda-video data-video-webm="${videoOro.webm}" data-video-mp4="${videoOro.mp4}"` : '';

// ── Banda 0: barra de anuncio (docs/44 §3). SOLO datos de config.json: la ciudad, el pedido mínimo y
// el primer regalo por monto (con su sello «propuesta» mientras sea modo de prueba). Rota cada 5 s;
// tocarla la detiene (su ícono de pausa se ve en TODAS las páginas); quieta con «reducir movimiento»
// (main.js). Con los pedidos en pausa (ley seca) no sale: manda el aviso de pausa.
// Atributos PROPIOS (data-barra-*): data-anuncio es la región viva del carrito (carritoInteractivo).
// Accesible: el nombre empieza por el aviso que se ve (WCAG 2.5.3; los otros van aria-hidden) y termina
// con una acción FIJA; el estado lo dice solo aria-pressed (main.js barraDeAnuncio).
const regaloMenor = [...(cfg.regalos || [])].sort((a, b) => a.desde - b.desde)[0];
const ANUNCIOS = cfg.pedidosPausados ? [] : [
    { ico: 'pin', texto: `Domicilios en ${escapar(cfg.ciudad)}` },
    cfg.pedidoMinimo ? { ico: 'bolsa', texto: `Pedido mínimo ${precio(cfg.pedidoMinimo)}` } : null,
    regaloMenor ? { ico: 'regalo', texto: `Regalo desde ${precio(regaloMenor.desde)}${cfg.modoPrueba ? ' <span class="sello-ejemplo">propuesta</span>' : ''}` } : null,
].filter(Boolean);
const ICO_PAUSA = '<svg class="ico ico-pausa" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/></svg>';
const ICO_SEGUIR = '<svg class="ico ico-seguir" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z" fill="currentColor"/></svg>';
// En el ordenador (≥ 861 px) los avisos van QUIETOS en una fila, sin rotar y sin el botón de pausa (Daniel,
// 27-oct: nada de «pausa» a la vista; sin rotación no hace falta, WCAG 2.2.2). En el celular rotan y el botón
// (el que lee el teclado) los detiene; toda la barra responde al toque (main.js).
const BARRA_ANUNCIO = ANUNCIOS.length < 2 ? '' : `<div class="anuncio" data-barra-anuncio>
    <div class="contenedor anuncio-fila">
      <p class="anuncio-lista">
${ANUNCIOS.map((a, i) => `        <span class="anuncio-msg${i ? '' : ' activo'}"${i ? ' aria-hidden="true"' : ''}>${icono(a.ico)}<span>${a.texto}</span></span>`).join('\n')}
      </p>
      <button type="button" class="anuncio-control" aria-pressed="false"><span class="oculto" data-barra-accion>Pausar los avisos</span>${ICO_PAUSA}${ICO_SEGUIR}</button>
    </div>
  </div>`;

// Antes del primer pintado: texto grande recordado, la categoría pedida en el catálogo (html[data-c]:
// su cabecera y su filtro se pintan ya desde el CSS, sin salto) y la capa de edad (sin parpadeo).
// La portada ya no tiene botón de pausa (Daniel, 27-oct: «no debe poderse pausar»): se BORRA la pausa
// que alguien haya guardado antes (kyj-quieto-v1), para que nadie quede con la portada congelada y sin
// botón para reanudarla. «Reducir movimiento» del sistema sigue dejando la portada quieta (CSS).
// Los parámetros `?prueba=` SOLO valen en un servidor local (capturas): nunca para visitantes reales.
const SCRIPT_INICIAL = `<script>(function(){var d=document.documentElement;d.classList.add('js');var c=/[?&]c=([a-z0-9-]+)/.exec(location.search);if(c)d.setAttribute('data-c',c[1]);var ok=false;try{if(localStorage.getItem('kyj-texto-v1')==='grande')d.classList.add('texto-grande');ok=localStorage.getItem('kyj-edad-v1')==='si';localStorage.removeItem('kyj-quieto-v1')}catch(e){}if(/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname)&&/[?&]prueba=[^&#]*sin-edad/.test(location.search))ok=true;if(!ok)d.classList.add('pedir-edad');setTimeout(function(){if(!window.kjListo)d.classList.add('sin-reveal')},2500)})();</script>`;

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
  ${precargarLogo ? `<link rel="preload" as="image" href="/marca/logo-principal-640.webp" imagesrcset="/marca/logo-principal-640.webp 640w, /marca/logo-principal-1200.webp 1200w" imagesizes="${TAM_LOGO}" fetchpriority="high">` : ''}
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
  ${BARRA_ANUNCIO}
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
      <nav class="pie-enlaces" aria-label="Tienda, legal y contacto">
        <div class="pie-grupo">
          <h2 class="pie-titulo">Tienda</h2>
          <a href="${RUTAS.catalogo}">Catálogo</a>
          <a href="${RUTAS.combos}">Combos</a>
          <a href="${RUTAS.calculadora}" class="pie-largo">Calculadora de fiesta</a>
        </div>
        <div class="pie-grupo">
          <h2 class="pie-titulo">Legal</h2>
          <a href="${RUTAS.terminos}" class="pie-largo">Términos y condiciones</a>
          <a href="${RUTAS.privacidad}" class="pie-largo">Tratamiento de datos</a>
        </div>
        <div class="pie-grupo pie-contacto">
          <h2 class="pie-titulo">Contacto</h2>
          <a href="${wa(`Hola ${cfg.marca}`)}" rel="noopener">${icono('chat')}<span>WhatsApp</span></a>
          <a href="https://www.instagram.com/${cfg.instagram}/" rel="noopener">${icono('camara')}<span>Instagram</span></a>
          <a href="mailto:${cfg.correo}" class="pie-correo">${icono('correo')}<span>${escapar(cfg.correo).replace('@', '@<wbr>')}</span></a>
        </div>
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
      <div class="edad-logo">${LOGO('alt="LICORES K&amp;J" sizes="260px" loading="lazy" decoding="async"')}</div>
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
          <div class="tarjeta-imagen escaparate" data-cat="${p.categoria}">${imagenProducto(p)}${p.frio ? `<span class="sello-frio">${icono('frio')}<span class="sello-frio-texto">Bien frío</span></span>` : ''}${p.ejemplo ? '<span class="sello-ejemplo sello-esquina">ejemplo</span>' : ''}</div>
          <h3 class="tarjeta-nombre">${escapar(p.nombre)}</h3>
        </a>
        ${datos(p)}
        <p class="tarjeta-precio">${precio(p.precio)}</p>
        ${unidad ? `<p class="tarjeta-unidad">${unidad}</p>` : '<p class="tarjeta-unidad">&nbsp;</p>'}
        ${botonAgregar(p, 'Agregar', 'boton-agregar')}
      </article>`;
}
const grilla = (lista) => `<div class="grilla" data-n="${lista.length}">\n${lista.map(tarjeta).join('\n')}\n      </div>`;

// Estado vacío elegante (docs/41 §3): la vitrina se ve completa aunque no haya productos.
// Estado vacío (docs/41 §3 y 44 §4.5): la gota (T03) o, dentro de una categoría, su foto.
const vitrinaVacia = (titulo = 'Estamos llenando la vitrina', luz = luzVacia(), texto = 'Muy pronto verás aquí cada producto con su precio. Mientras tanto, escríbenos por WhatsApp lo que necesitas y te confirmamos disponibilidad y precio.', mensaje = `Hola ${cfg.marca}, quiero hacer un pedido`) => `<div class="vacio-elegante">
        ${luz}
        <h3>${titulo}</h3>
        <p>${texto}</p>
        <div class="acciones">
          <a href="${wa(mensaje)}" class="boton boton-grande" rel="noopener">${icono('chat')}<span>Pedir por WhatsApp</span></a>
          <a href="${RUTAS.calculadora}" class="boton boton-vidrio boton-grande">${icono('calculadora')}<span>Calcular para mi fiesta</span></a>
        </div>
      </div>`;
// La foto de la categoría, redonda y con su luz, para el estado vacío dentro de una categoría. Es la
// misma foto que la cabecera de arriba: aquí es adorno (alt="").
const luzCategoria = (id) => {
    const e = escenaCategoria(id);
    const f = e ? foto({ archivo: e.archivo, formato: '4:5', anchos: [192, 480], sizes: '150px', foco: e.foco }) : '';
    return f ? `<div class="vacio-luz vacio-categoria" aria-hidden="true">${f}</div>` : luzVacia();
};

// Escalera de regalos (docs/44 §5): un nodo por nivel y un riel dorado que los une; el riel se llena una
// vez al entrar a la vista (main.js escaleraQueSeLlena). Vertical en el celular, horizontal en el ordenador.
const regalosOrden = [...cfg.regalos].sort((a, b) => a.desde - b.desde);
// Cada cosa del regalo en su propio bloque en línea («Hielo 7 kg» · «+ 4 bebidas hidratantes» · «+ 4 aguas»):
// las líneas se parten ENTRE cosas, nunca «+ 2 / aguas» ni «bebidas / hidratantes» si cabe. Cifra y unidad
// van juntas. El texto no cambia (solo espacios de no separación y envolturas).
const sinCortes = (t) => t.split(' + ').map((parte, i) => `<span class="regalo-parte">${i ? '+&nbsp;' : ''}${parte.replace(/(\d) /g, '$1&nbsp;')}</span>`).join(' ');
const escalera = regalosOrden.map((r, i) => `<li class="escalon" style="--i:${i}"><span class="escalon-punto" aria-hidden="true"></span><span class="escalon-nivel">${escapar(r.nivel)}</span><span class="escalon-monto"><small>desde</small> ${precio(r.desde)}</span><span class="escalon-regalo">${sinCortes(escapar(r.regalo))}</span></li>`).join('\n          ');

// Calculadora exprés (banda 4): la MISMA fórmula de /calculadora/ (fiesta.js), con sus supuestos a la
// vista. Arranca en 10 personas y 4 horas, como la calculadora completa.
const EXPRES = { personas: 10, horas: 4, min: 1, max: 50 };
const numeroCO = (n) => String(n).replace('.', ',');
const cifrasExpres = (personas) => ({
    tragos: tragosTotales(personas, EXPRES.horas),
    hielo: Math.ceil(personas * SUPUESTOS.hieloKgPorPersona),
    aguas: Math.ceil(personas * SUPUESTOS.aguasPorPersona),
});
const cifras0 = cifrasExpres(EXPRES.personas);
// «Formas de pago» (banda 7, bajo las 3 tarjetas de la promesa). NADA de pastillas (Daniel, 27-oct: «se ve
// todo como etiquetas, está terriblemente mal diseñado»): una fila por forma de pago con su ícono, su
// nombre y su detalle, los TRES de config.json (pagos[].nombre y .detalle). Lista en el celular, 4
// columnas en el ordenador. Lo que viene (tarjeta con Wompi) en UNA línea discreta debajo.
const pagosYa = cfg.pagos.filter(m => !m.proximamente);
const pagosPronto = cfg.pagos.filter(m => m.proximamente);
const minuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const ICONO_PAGO = { efectivo: 'billete', nequi: 'celular', breb: 'qr', transferencia: 'banco' };
const PAGOS = pagosYa.length ? `
      <div class="contenedor pagos" role="group" aria-labelledby="t-pagos">
        <h3 class="pagos-titulo" id="t-pagos">Formas de pago</h3>
        <ul class="pagos-lista">
${pagosYa.map(m => `          <li class="pago"><span class="pago-icono">${icono(ICONO_PAGO[m.id] || 'tarjeta')}</span><span class="pago-nombre">${escapar(m.nombre).replace(/ QR\b/g, '&nbsp;QR')}</span>${m.detalle ? `<span class="pago-detalle">${escapar(m.detalle)}</span>` : ''}</li>`).join('\n')}
        </ul>${pagosPronto.length ? `
        <p class="pago-pronto">${icono('tarjeta')}<span>Próximamente, pago en línea: ${escapar(pagosPronto.map(m => minuscula(m.nombre)).join(' y '))}.</span></p>` : ''}
      </div>` : '';

// ── Bandas de foto de la portada (docs/44 §3): una banda de foto grande cada 1-2 pantallas,
// alternando «vitrina» (tarjetas) y «revista» (foto a sangre con texto encima).
// Retícula de tarjetas (categorías y planes), sin filas cojas en ningún ancho (Daniel, 27-oct: «no es
// posible que queden 4 tarjetas arriba y 3 abajo»). La lista lleva data-n (cuántas hay) y el CSS
// reparte según ese número; estas columnas son LAS MISMAS de estilos.css («Retícula de tarjetas»):
//   celular (< 700 px): carril con scroll-snap, todas del mismo tamaño.
//   tableta (700-999): 2 → 2 · 3 → 3 · 4 → 2×2 · 5 → 1 a lo ancho + 2×2 · 6 → 3×2 · 7 → 1 a lo ancho + 3×2.
//   ordenador (≥ 1000): de 2 a 5 en una fila · 6 → 3×2 · 7 → MOSAICO de 5 columnas × 2 filas, la 1.ª
//   (Cerveza) de 2×2 y las otras 6 alrededor (un rectángulo completo, todas en proporción 4:5).
// tamRejilla() da el «sizes» de cada foto según el lugar que ocupa (el contenedor mide ≤ 1200 px, 16 px
// de separación).
const COLS = { tableta: { 2: 2, 3: 3, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4 }, ordenador: { 2: 2, 3: 3, 4: 4, 5: 5, 6: 3, 7: 5, 8: 4 } };
const aLoAncho = (n, i) => i === 0 && (n === 5 || n === 7); // tableta: la 1.ª, banda apaisada
const enGrande = (n, i) => i === 0 && n === 7; // ordenador: la 1.ª del mosaico, 2×2
function tamRejilla(n, i, celular) {
    const t = COLS.tableta[n] || 3;
    const c = COLS.ordenador[n] || 4;
    const s = enGrande(n, i) ? 2 : 1;
    const fijo = Math.round(((1200 - 16 * (c - 1)) / c) * s + 16 * (s - 1));
    const fluido = `calc((100vw - ${32 + 16 * (c - 1)}px) * ${s} / ${c}${s > 1 ? ` + ${16 * (s - 1)}px` : ''})`;
    const tableta = aLoAncho(n, i) ? 'calc(100vw - 32px)' : `calc((100vw - ${32 + 16 * (t - 1)}px) / ${t})`;
    return `(min-width: 1232px) ${fijo}px, (min-width: 1000px) ${fluido}, (min-width: 700px) ${tableta}, ${celular}`;
}
// «¿Qué se te antoja?»: la tarjeta entera es el enlace (sin flecha: Daniel, 27-oct, «las flechas
// amarillas no cumplen ninguna función si se puede dar click en cualquier lugar»).
const tarjetaAntojo = (c, i, n, prefijo) => `          <li><a class="antojo-tarjeta" href="${rutaCategoria(c.id)}" aria-labelledby="${prefijo}-${c.id}">${fotoCategoria(c.id, { sizes: tamRejilla(n, i, 'min(74vw, 300px)'), clase: 'antojo-foto' }) || `<span class="antojo-sin-foto escaparate">${iconoProducto(c.id)}</span>`}<span class="antojo-nombre" id="${prefijo}-${c.id}">${escapar(c.nombre)}</span></a></li>`;
const listaAntojo = (cats, prefijo) => `<ul class="antojo-lista reveal" data-n="${cats.length}">
${cats.map((c, i) => tarjetaAntojo(c, i, cats.length, prefijo)).join('\n')}
        </ul>`;
// Revista: una foto por pantalla (P01 3:4 en el celular, P02 16:9 desde 600 px), a todo el ancho.
const REV = ESC.revista || {};
const FOTO_REVISTA = (() => {
    const cel = hayFoto(REV.celular, ANCHOS['3:4']);
    const comp = hayFoto(REV.computador, ANCHOS['16:9']);
    if (!cel || !comp) return '';
    const ancha = (f) => `<source media="(min-width: 600px)" type="image/${f}" srcset="${juego(REV.computador, ANCHOS['16:9'], f)}" sizes="100vw" ${medidas('16:9', 1920)}>`;
    return `<picture>${ancha('avif')}${ancha('webp')}<source type="image/avif" srcset="${juego(REV.celular, ANCHOS['3:4'], 'avif')}" sizes="100vw"><img src="/escenas/${REV.celular}-600.webp" srcset="${juego(REV.celular, ANCHOS['3:4'], 'webp')}" sizes="100vw" ${medidas('3:4', 900)} alt="${escapar(REV.alt || '')}" loading="lazy" decoding="async"></picture>`;
})();
// Texturas (alt=""): oro líquido detrás de la calculadora exprés y hielo detrás de los regalos.
// En el celular la banda exprés mide ~375×789 y la foto 16:9 la cubre («cover»): pide ~1410 px de ancho.
const FOTO_ORO = foto({ archivo: ESC.calculadora, formato: '16:9', sizes: '(max-width: 860px) 1410px, 100vw', clase: 'banda-foto' });
// El hielo, en el celular, es una franja de 340 px de alto (estilos.css): cubrirla pide ≥ 605 px de ancho.
const FOTO_HIELO = foto({ archivo: ESC.regalos, formato: '16:9', sizes: '(max-width: 604px) 605px, 100vw', clase: 'banda-foto' });

// ── Banda 3 «¿Cuál es el plan?» y sus páginas /plan/<slug>/ (docs/44 §3 y §4). Datos: config.ocasiones.
// Solo salen las de «publicar»: true y con su foto en public/escenas/ (Día de partido espera la revisión
// legal, V6). En las tarjetas la foto es adorno (alt=""): el enlace ya se nombra con su título.
const ANCHOS_OCASION = [480, 720, 1080];
const OCASIONES = (cfg.ocasiones || []).filter(o => o.publicar && o.slug && hayFoto(o.archivo, ANCHOS_OCASION));
const rutaPlan = (o) => `/plan/${o.slug}/`;
const fotoOcasion = (o, opciones) => foto({ archivo: o.archivo, formato: '4:5', anchos: ANCHOS_OCASION, alt: o.alt, foco: o.foco, ...opciones });
// Celular: carril de tarjetas de ~78 % del ancho (la siguiente asoma ≥ 50 px a 375). Tableta: 2×2 (o 3 en fila). Ordenador: todas en una
// fila (la misma retícula de arriba). La tarjeta entera es el enlace, sin flecha.
const tarjetaPlan = (o, i, n) => `          <li><a class="plan-tarjeta" href="${rutaPlan(o)}">${fotoOcasion(o, { sizes: tamRejilla(n, i, 'min(78vw, 340px)'), clase: 'plan-foto', alt: '' })}<span class="plan-texto"><span class="plan-nombre">${escapar(o.titulo)}</span><span class="plan-linea">${escapar(o.linea)}</span></span></a></li>`;
const bandaPlanes = (lista, { titulo = '¿Cuál es el plan?', id = 't-planes', enlace = true } = {}) => (lista.length ? `
    <section class="seccion planes" id="planes" aria-labelledby="${id}">
      <div class="contenedor seccion-cabeza reveal"><h2 id="${id}">${titulo}</h2>${enlace ? `<a href="${RUTAS.calculadora}" class="enlace-mas">Calculadora de fiesta</a>` : ''}</div>
      <div class="planes-carril">
        <ul class="planes-lista" data-n="${lista.length}">
${lista.map((o, i) => tarjetaPlan(o, i, lista.length)).join('\n')}
        </ul>
      </div>
    </section>` : '');
const planFiesta = OCASIONES.find(o => o.calculadora) || OCASIONES[0] || null;

// ── Banda 7 «La promesa» (docs/44 §3): 3 tarjetas grandes con su foto a sangre, el nombre y una línea sobre
// un velo (la MISMA gramática de «¿Cuál es el plan?»). Celular y tableta: carril con scroll-snap; desde 940
// px, 3 en fila. Solo lo que ya está construido: el sello «Bien frío», la entrega programada (y su hora de
// cierre) y los pagos de config.json. Las fotos son 1:1; «foco» (config.escenas.promesa) elige el recorte
// de la tarjeta 4:5. Sin el botón suelto «¿Llegamos a tu barrio?» (Daniel, 27-oct): ya está en la portada
// y como «Tu zona» en la cabecera.
const PRO = ESC.promesa || {};
const TAM_PROMESA = '(min-width: 1232px) 389px, (min-width: 940px) calc((100vw - 64px) / 3), min(78vw, 340px)';
const fotoPromesa = (e) => (e ? foto({ archivo: e.archivo, formato: '1:1', anchos: [480, 720], sizes: TAM_PROMESA, alt: e.alt, foco: e.foco, clase: 'promesa-img' }) : '');
const PROMESA = [
    { titulo: 'Llega frío', foto: PRO.frio, texto: 'Lo que lleva el sello «Bien frío» te llega frío, listo para servir.' },
    { titulo: 'Programa tu entrega', foto: PRO.entrega, texto: `${APERTURA ? 'Lo antes posible, o el día y la franja que prefieras' : 'Elige el día y la franja que prefieras'} al confirmar tu pedido. ${sinEntregas}` },
    { titulo: 'Paga como prefieras', foto: PRO.pago, texto: 'Eliges cómo pagar al confirmar tu pedido por WhatsApp.' },
];

// Calculadora exprés (banda 4): en el inicio y en las páginas de plan. La animación de su video (si
// existe) la pone banda-video.js: quieta con «reducir movimiento», fuera de la vista y con la pestaña
// oculta. Sin botón de pausa, como la portada (Daniel, 27-oct: el video de ambiente no se pausa).
const bandaExpres = () => `
    <section class="expres" aria-labelledby="t-cuantos"${VIDEO_ORO}>
      ${FOTO_ORO ? `<div class="expres-fondo" data-banda-fondo aria-hidden="true">${FOTO_ORO}</div>` : ''}
      <div class="contenedor expres-fila">
        <form class="expres-panel" data-expres action="${RUTAS.calculadora}" method="get" novalidate>
          <p class="antetitulo reveal">${icono('calculadora')}<span>Calculadora de fiesta</span></p>
          <h2 id="t-cuantos" class="reveal">¿Cuántos son?</h2>
          <div class="expres-control">
            <label class="etiqueta" for="x-personas">Personas en tu plan</label>
            <div class="expres-deslizador">
              <button type="button" class="boton-paso" data-expres-paso="-1" aria-label="Una persona menos">${icono('menos')}</button>
              <input id="x-personas" name="personas" type="range" min="${EXPRES.min}" max="${EXPRES.max}" step="1" value="${EXPRES.personas}" aria-valuetext="${EXPRES.personas} personas" aria-describedby="x-supuestos" data-expres-personas>
              <button type="button" class="boton-paso" data-expres-paso="1" aria-label="Una persona más">${icono('mas')}</button>
            </div>
          </div>
          <output class="expres-resultado" for="x-personas" data-expres-resultado>
            <span class="expres-quien"><strong data-x="personas">${EXPRES.personas}</strong> <span data-x="personas-texto">personas</span>, ${EXPRES.horas} horas</span>
            <span class="expres-cifras"><span><span class="expres-aprox">≈</span> <strong data-x="tragos">${cifras0.tragos}</strong> tragos</span><span><strong data-x="hielo">${cifras0.hielo}</strong> kg de hielo</span><span><strong data-x="aguas">${cifras0.aguas}</strong> <span data-x="aguas-texto">aguas</span></span></span>
          </output>
          <p class="expres-supuestos" id="x-supuestos">Para ${EXPRES.horas} horas: ${SUPUESTOS.tragosPrimeraHora} tragos por persona la primera hora y ${SUPUESTOS.tragosPorHoraSiguiente} por cada hora siguiente (un trago son ${SUPUESTOS.porcionLicorMl} ml). Hielo: ${numeroCO(SUPUESTOS.hieloKgPorPersona)} kg y ${SUPUESTOS.aguasPorPersona} agua por persona. Es una guía para planear, no una meta.</p>
          <div class="acciones">
            <a href="${RUTAS.calculadora}?personas=${EXPRES.personas}" class="boton boton-grande" data-expres-armar>${icono('bolsa')}<span>Armar mi pedido</span></a>
          </div>
        </form>
      </div>
    </section>`;

// Los 3 pasos de siempre (docs/44 §3, banda 10), como una línea de tiempo con numerales grandes en oro.
// La foto de la gota (T03) va ENTERA, sin recorte en círculo (Daniel, 27-oct: «está como cortada en un
// círculo, no se ve bien»): se funde con la página («screen», como la escena de la portada). Celular: arriba
// a todo el ancho y el título entra sobre su parte baja. Ordenador: la columna derecha.
const PASOS = [
    ['Elige', 'Agrega tus productos al pedido o usa la calculadora de fiesta.'],
    ['Confirma', 'Envíalo por WhatsApp con tu código de pedido y elige cómo pagar.'],
    ['Recibe frío', 'Al entregar pedimos tu cédula: no vendemos a menores de edad.'],
];
// sizes = el ancho real de .facil-foto (estilos.css): hasta 860 px, todo el ancho con tope de 560 px; desde
// 861, media retícula (100vw − 32 px de márgenes − 4vw de calle, entre 2) y desde 1232 px, ≈ 575 px.
const FOTO_GOTA_GRANDE = foto({ archivo: ESC.gota, formato: '1:1', anchos: [320, 640, 1080], sizes: '(min-width: 1232px) 575px, (min-width: 861px) calc(48vw - 16px), min(100vw, 560px)', clase: 'facil-gota' });

const paginas = {};

// ── Inicio ──────────────────────────────────────────────────────────────────────────────────
// «Lo más pedido» solo con productos REALES (docs/44 §3): los de ejemplo no salen en la portada.
// Orden (docs/44 §3, alternando vitrina y revista): portada · antojo · revista · planes · calculadora ·
// promesa · regalos · así de fácil · leyendas (pie). El combo de la semana (banda 5) y «Lo más pedido»
// salen solos cuando haya combo y precio reales; las recetas (banda 9) esperan sus fotos y la revisión
// legal (docs/44 §11, fase 0).
const destacados = productos.filter(p => p.destacado && !p.ejemplo);
paginas['index.html'] = molde({
    titulo: `${cfg.marca} · Licor frío a domicilio en ${cfg.ciudad}`,
    descripcion: `Cerveza, aguardiente, ron, whisky y vodka bien fríos a domicilio en ${cfg.ciudad}. Pide en línea; venta solo a mayores de 18 años.`,
    pagina: 'inicio',
    ruta: '/',
    precargarLogo: true,
    jsonld: { '@context': 'https://schema.org', '@type': 'OnlineStore', name: cfg.marca, email: cfg.correo, areaServed: cfg.ciudad, sameAs: [`https://www.instagram.com/${cfg.instagram}/`], ...(DOMINIO ? { url: absoluta('/'), logo: absoluta('/marca/icono-512.png') } : {}) },
    // Portada «escena»: el escenario es una foto (la luz y la neblina las pone la placa H01) y el logo
    // flota sobre su charco de luz con su sombra de contacto (estilos.css «Portada en escena»). La foto
    // y el logo se pintan desde el primer cuadro (LCP); el video, si llega, va encima en un canvas.
    cuerpo: `    <section class="portada" aria-labelledby="t-portada">
      <div class="contenedor portada-fila">
        <div class="portada-escena" data-escena${DATOS_VIDEO}>
          <div class="escena-ventana" aria-hidden="true">
            <div class="escena-foto" data-foto>
              <picture>
                <source type="image/avif" srcset="/escenas/escena-foco-640.avif 640w, /escenas/escena-foco-1024.avif 1024w" sizes="${TAM_FOTO}">
                <img src="/escenas/escena-foco-1024.webp" srcset="/escenas/escena-foco-640.webp 640w, /escenas/escena-foco-1024.webp 1024w" sizes="${TAM_FOTO}" width="1024" height="1024" alt="" fetchpriority="high">
              </picture>
            </div>
          </div>
          <div class="escena-pieza">
            <span class="escena-halo" aria-hidden="true"></span>
            <span class="escena-sombra" aria-hidden="true"></span>
            <div class="escena-flota">
              <div class="escena-logo" data-logo>
                ${LOGO(`class="portada-logo" alt="LICORES K&amp;J" sizes="${TAM_LOGO}" fetchpriority="high" decoding="async"`)}
                <span class="logo-licor" aria-hidden="true"><i></i></span>
                <span class="logo-brillo" aria-hidden="true"><i></i></span>
                <span class="logo-reflejo" aria-hidden="true"><i data-reflejo></i></span>
              </div>
            </div>
          </div>
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
    <section class="seccion antojo" aria-labelledby="t-antojo">
      <div class="contenedor seccion-cabeza reveal"><h2 id="t-antojo">¿Qué se te antoja?</h2><a href="${RUTAS.catalogo}" class="enlace-mas">Ver todo el catálogo</a></div>
      <div class="antojo-carril" data-carril>
        ${listaAntojo(categorias, 'antojo')}
        <p class="carril-aviso" data-carril-aviso hidden aria-hidden="true">Desliza${icono('flecha')}</p>
      </div>
    </section>${destacados.length ? `
    <section class="seccion contenedor" aria-labelledby="t-destacados">
      <div class="seccion-cabeza reveal"><h2 id="t-destacados">Lo más pedido</h2><a href="${RUTAS.catalogo}" class="enlace-mas">Ver catálogo</a></div>
      ${grilla(destacados)}
    </section>` : ''}
    <section class="revista${FOTO_REVISTA ? '' : ' revista-sin-foto'}" aria-labelledby="t-frio">
      ${FOTO_REVISTA ? `<div class="revista-foto">${FOTO_REVISTA}</div>` : ''}
      <div class="contenedor revista-fila">
        <div class="revista-texto">
          <h2 id="t-frio" class="oro reveal">Te lo llevamos frío</h2>
          <p class="revista-lead">Para la fiesta, la reunión o la rumba en casa: arma tu pedido aquí, confírmalo por WhatsApp y te lo llevamos a la puerta.</p>
          <p class="revista-dato">${icono(cfg.horario ? 'reloj' : 'bolsa')}<span>${cfg.horario ? `Horario de domicilios: ${escapar(cfg.horario)} · ` : ''}Pedido mínimo ${precio(cfg.pedidoMinimo)}</span></p>
          <p class="revista-dato">${icono('pin')}<span data-zona-bento>Elige tu zona una vez y la recordamos.</span></p>
          <div class="acciones">
            ${planFiesta ? `<a href="${rutaPlan(planFiesta)}" class="boton boton-grande">${icono('flecha')}<span>Arma tu ${escapar(minuscula(planFiesta.titulo))}</span></a>` : `<a href="${RUTAS.combos}" class="boton boton-grande">${icono('regalo')}<span>Ver combos</span></a>`}
          </div>
        </div>
      </div>
    </section>${bandaPlanes(OCASIONES)}${bandaExpres()}
    <section class="seccion promesa" aria-labelledby="t-promesa">
      <div class="contenedor seccion-cabeza reveal"><h2 id="t-promesa">Tú eliges cuándo y cómo</h2></div>
      <div class="promesa-carril">
        <ul class="promesa-lista reveal" data-carril-teclado aria-labelledby="t-promesa">
${PROMESA.map(x => `          <li class="promesa-tarjeta">${fotoPromesa(x.foto)}<div class="promesa-texto"><h3>${x.titulo}</h3><p>${x.texto}</p></div></li>`).join('\n')}
        </ul>
      </div>${PAGOS}
    </section>
    <section class="regalos${FOTO_HIELO ? '' : ' regalos-sin-foto'}" aria-labelledby="t-regalos">
      ${FOTO_HIELO ? `<div class="regalos-fondo" aria-hidden="true">${FOTO_HIELO}</div>` : ''}
      <div class="contenedor">
        <div class="regalos-panel">
          <h2 id="t-regalos" class="reveal">Regalos por tu compra${cfg.modoPrueba ? ' <span class="sello-ejemplo">propuesta</span>' : ''}</h2>
          <p>Según el valor de tu pedido te llevamos algo frío de regalo, sin alcohol.</p>
          <ol class="escalera" data-escalera>
          ${escalera}
          </ol>
          <div class="acciones">
            <a href="${RUTAS.combos}" class="boton boton-grande">${icono('regalo')}<span>Ver combos</span></a>
          </div>
        </div>
      </div>
    </section>
    <section class="seccion facil${FOTO_GOTA_GRANDE ? '' : ' facil-sin-foto'}" aria-labelledby="t-pasos">
      ${FOTO_GOTA_GRANDE ? `<div class="facil-foto" aria-hidden="true">${FOTO_GOTA_GRANDE}</div>` : ''}
      <div class="contenedor facil-texto">
        <h2 id="t-pasos" class="facil-titulo">Así de fácil</h2>
        <ol class="pasos">
${PASOS.map(([titulo, texto], i) => `          <li class="paso reveal" style="--d:${i * 100}ms"><span class="paso-numero" aria-hidden="true">${i + 1}</span><div class="paso-cuerpo"><h3>${titulo}</h3><p>${texto}</p></div></li>`).join('\n')}
        </ol>
        <div class="acciones facil-acciones">
          <a href="${RUTAS.catalogo}" class="boton boton-grande">${icono('bolsa')}<span>Empezar mi pedido</span></a>
          <a href="${wa(`Hola ${cfg.marca}, quiero hacer un pedido`)}" class="boton boton-vidrio boton-grande" rel="noopener">${icono('chat')}<span>Prefiero escribir</span></a>
        </div>
      </div>
    </section>`,
});

// ── Páginas de plan /plan/<slug>/ (docs/44 §4): cabecera partida con la foto de la ocasión, lo que va con
// ese plan (sus categorías), la calculadora exprés (o, para regalar, el canal por WhatsApp) y los otros
// planes. Las leyendas van en el pie, como en todas. Sin combos ni recetas hasta que existan de verdad.
const porCategoria = Object.fromEntries(categorias.map(c => [c.id, c]));
for (const o of OCASIONES) {
    const cats = (o.categorias || []).map(id => porCategoria[id]).filter(Boolean);
    const otros = OCASIONES.filter(x => x.slug !== o.slug);
    const mensaje = o.mensaje || `Hola ${cfg.marca}, quiero armar un pedido para ${minuscula(o.titulo)}`;
    paginas[`plan/${o.slug}/index.html`] = molde({
        titulo: `${o.titulo} · ${cfg.marca}`,
        descripcion: `${o.linea} ${o.bajada}`,
        pagina: 'plan',
        ruta: rutaPlan(o),
        jsonld: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluta('/') },
            { '@type': 'ListItem', position: 2, name: o.titulo },
        ] },
        cuerpo: `    <section class="contenedor seccion seccion-primera">
      <nav class="migas" aria-label="Ruta"><a href="/">Inicio</a><span aria-hidden="true">›</span><a href="/#planes">Planes</a><span aria-hidden="true">›</span><span aria-current="page">${escapar(o.titulo)}</span></nav>
      <header class="cat-partida plan-partida">
        <div class="cat-partida-texto">
          <p class="antetitulo">¿Cuál es el plan?</p>
          <h1 class="oro">${escapar(o.titulo)}</h1>
          <p class="plan-linea-grande">${escapar(o.linea)}</p>
          <p>${escapar(o.bajada)}</p>
          <div class="acciones">
            ${o.calculadora ? `<a href="#t-cuantos" class="boton boton-grande">${icono('calculadora')}<span>Calcular cuánto llevar</span></a>` : `<a href="${wa(mensaje)}" class="boton boton-grande" rel="noopener">${icono('chat')}<span>Armar el regalo por WhatsApp</span></a>`}
            <a href="${RUTAS.catalogo}" class="boton boton-vidrio boton-grande">${icono('vitrina')}<span>Ver catálogo</span></a>
          </div>
        </div>
        <div class="cat-partida-foto">${fotoOcasion(o, { sizes: '(min-width: 861px) 480px, 100vw', pronto: true, alta: true })}</div>
      </header>
    </section>${cats.length ? `
    <section class="seccion antojo" aria-labelledby="t-va">
      <div class="contenedor seccion-cabeza reveal"><h2 id="t-va">Lo que va con este plan</h2><a href="${RUTAS.catalogo}" class="enlace-mas">Ver todo el catálogo</a></div>
      <div class="antojo-carril" data-carril>
        ${listaAntojo(cats, 'va')}
        <p class="carril-aviso" data-carril-aviso hidden aria-hidden="true">Desliza${icono('flecha')}</p>
      </div>
    </section>` : ''}${o.calculadora ? bandaExpres() : `
    <section class="seccion contenedor">
      <div class="vacio-elegante plan-regalo">
        ${luzVacia()}
        <h2>¿Qué quieres regalar?</h2>
        <p>Cuéntanos para quién es y cuánto quieres gastar; te ayudamos a escoger la botella. Al entregar pedimos la cédula.</p>
        <div class="acciones">
          <a href="${wa(mensaje)}" class="boton boton-grande" rel="noopener">${icono('chat')}<span>Escribir por WhatsApp</span></a>
          <a href="${RUTAS.combos}" class="boton boton-vidrio boton-grande">${icono('regalo')}<span>Ver combos</span></a>
        </div>
      </div>
    </section>`}${bandaPlanes(otros, { titulo: 'Otros planes', id: 't-otros', enlace: false })}`,
    });
}

// ── Catálogo ────────────────────────────────────────────────────────────────────────────────
// Catálogo (docs/44 §4): fila de «pasillos» con la FOTO REDONDA de cada categoría (C0x a 96 px con el
// archivo de 192), cabecera partida por categoría (foto + nombre + una línea) y estado vacío con la
// foto de la categoría. La categoría llega en ?c= y el script del <head> la pone en html[data-c]: estas
// reglas pintan su cabecera, su pasillo y su filtro desde el primer cuadro (sin salto al cargar el JS).
// Se generan aquí porque las categorías son datos (catalogo.json).
// En el celular solo la primera frase (la columna de texto es angosta).
const lineaCategoria = (c) => (c.linea ? escapar(c.linea) : `${escapar(c.nombre)} a domicilio en ${escapar(cfg.ciudad)}.<span class="solo-ancho"> Arma tu pedido, confírmalo por WhatsApp y te lo llevamos frío.</span>`);
const TAM_CABEZA = '(min-width: 1232px) 480px, (min-width: 861px) 40vw, 42vw';
const reglasCategorias = categorias.map(({ id }) => {
    const s = `html[data-c="${id}"]`;
    return `${s} [data-cabeza="${id}"]{display:var(--d,block)}${s} [data-cabeza=""]{display:none}${s} .grilla>.tarjeta:not([data-categoria="${id}"]){display:none}${s} .pasillo[data-pasillo="${id}"]{--activo:1}`;
}).join('') + 'html:not([data-c]) .pasillo[data-pasillo=""]{--activo:1}' + (() => {
    const cuantos = (id) => productos.filter(p => p.categoria === id).length;
    const en4 = categorias.map(c => c.id).filter(id => { const n = cuantos(id); return n && n % 5 && (n <= 4 || n % 4 === 0); });
    return en4.length ? `@media (min-width:1200px){${en4.map(id => `html[data-c="${id}"] .grilla`).join(',')}{--cols:4}}` : '';
})();
const fotoPasillo = (id) => {
    const e = escenaCategoria(id);
    return (e && foto({ archivo: e.archivo, formato: '4:5', anchos: [192], sizes: '96px', foco: e.foco, pronto: true })) || iconoProducto(id, 'icono-chip', false);
};
const PASILLO_TODO = '<img src="/marca/monograma-96.webp" alt="" width="96" height="66" decoding="async">';
const pasillos = (boton) => `<div class="pasillos" role="group" aria-label="${boton ? 'Filtrar por categoría' : 'Categorías'}">
        <ul class="pasillos-lista">
          <li>${boton ? '<button type="button" class="pasillo" data-filtro="" data-pasillo="" aria-pressed="true">' : `<a class="pasillo" href="${RUTAS.catalogo}" data-pasillo="">`}<span class="pasillo-foto pasillo-todo">${PASILLO_TODO}</span><span class="pasillo-nombre">Todo</span>${boton ? '</button>' : '</a>'}</li>
${categorias.map(c => `          <li>${boton ? `<button type="button" class="pasillo" data-filtro="${c.id}" data-pasillo="${c.id}" aria-pressed="false">` : `<a class="pasillo" href="${rutaCategoria(c.id)}" data-pasillo="${c.id}">`}<span class="pasillo-foto">${fotoPasillo(c.id)}</span><span class="pasillo-nombre">${escapar(c.nombre)}</span>${boton ? '</button>' : '</a>'}</li>`).join('\n')}
        </ul>
      </div>`;
const cabecerasCategorias = categorias.map(c => `      <header class="cat-partida por-cat" data-cabeza="${c.id}">
        <div class="cat-partida-texto">
          <p class="antetitulo"><a href="${RUTAS.catalogo}">Catálogo</a></p>
          <h1 class="oro">${escapar(c.nombre)}</h1>
          <p>${lineaCategoria(c)}</p>
        </div>
        <div class="cat-partida-foto">${fotoCategoria(c.id, { sizes: TAM_CABEZA })}</div>
      </header>`).join('\n');

// Cada 8 fichas, una banda «revista» con un plan (docs/44 §4.4) para romper la rejilla. Solo sin filtro
// ni búsqueda: con html[data-c] (estilos.css) o con la búsqueda escrita (main.js, .buscando) se esconde.
// La foto es la de la ocasión, nunca junto a un precio: la banda va entre fichas, en su propia fila.
const revistaCatalogo = (o) => `        <div class="cat-revista">
          <a class="cat-revista-enlace" href="${rutaPlan(o)}" aria-labelledby="cr-${o.slug} cr-${o.slug}-ir">
            <span class="cat-revista-foto">${fotoOcasion(o, { sizes: '(min-width: 861px) 520px, calc(100vw - 32px)', alt: '' })}</span>
            <span class="cat-revista-texto"><span class="antetitulo">¿Cuál es el plan?</span><span class="cat-revista-titulo" id="cr-${o.slug}">${escapar(o.titulo)}</span><span class="cat-revista-linea">${escapar(o.linea)}</span><span class="boton boton-vidrio" id="cr-${o.slug}-ir">Ver el plan${icono('flecha')}</span></span>
          </a>
        </div>`;
function grillaCatalogo(lista) {
    const piezas = [];
    lista.forEach((p, i) => {
        piezas.push(tarjeta(p));
        const n = i + 1;
        const o = OCASIONES[n / 8 - 1];
        if (n % 8 === 0 && n < lista.length && o) piezas.push(revistaCatalogo(o));
    });
    return `<div class="grilla" data-grilla>\n${piezas.join('\n')}\n      </div>`;
}
// LCP de /catalogo/?c=<categoría>: la foto de SU cabecera sale sin «lazy» (las otras 6 siguen lazy y, como
// están ocultas, no se bajan). Corre justo después de las cabeceras, antes del primer pintado.
const FOTO_CABEZA_PRONTO = `<script>(function(){var c=document.documentElement.getAttribute('data-c');if(!c)return;var i=document.querySelector('[data-cabeza="'+c+'"] .cat-partida-foto img');if(i)i.loading='eager'})();</script>`;

paginas['catalogo/index.html'] = molde({
    titulo: `Catálogo · ${cfg.marca}`,
    descripcion: `Catálogo de ${cfg.marca}: cerveza, aguardiente, ron, whisky, vodka, combos y hielo a domicilio en ${cfg.ciudad}.`,
    pagina: 'catalogo',
    ruta: RUTAS.catalogo,
    cuerpo: `    <style>${reglasCategorias}</style>
    <section class="contenedor seccion seccion-primera">
      <header class="pagina-cabeza" data-cabeza="">
        <h1 class="oro">Catálogo</h1>
        <p>${hayCatalogo ? 'Elige una categoría o busca por nombre. Cada ficha muestra el precio, el precio por litro y el % Vol.' : 'Las categorías ya están listas. Los productos con su precio llegan muy pronto.'}</p>
      </header>
${cabecerasCategorias}
      ${FOTO_CABEZA_PRONTO}
      ${pasillos(hayCatalogo)}
${hayCatalogo ? `      <label class="buscador">${icono('buscar')}<span class="oculto">Buscar producto</span><input type="search" placeholder="Buscar producto" data-buscar autocomplete="off"></label>
      ${grillaCatalogo(productos)}
      <div class="vacio-filtro" data-vacio hidden>
        <div data-cabeza="">${luzVacia('120px')}</div>
${categorias.map(c => `        <div class="por-cat" data-cabeza="${c.id}">${luzCategoria(c.id)}</div>`).join('\n')}
        <p>No hay productos con ese filtro.</p>
        <a href="${wa(`Hola ${cfg.marca}, estoy buscando un producto`)}" class="boton boton-vidrio" rel="noopener" data-vacio-wa>${icono('chat')}<span>Pregúntanos qué hay</span></a>
      </div>` : `      <div data-cabeza="">${vitrinaVacia('El catálogo se está preparando')}</div>
${categorias.map(c => `      <div class="por-cat" data-cabeza="${c.id}">${vitrinaVacia('Pregúntanos qué hay', luzCategoria(c.id), 'Muy pronto verás aquí cada producto con su precio. Escríbenos por WhatsApp y te confirmamos disponibilidad y precio.', `Hola ${cfg.marca}, ¿qué tienen de ${c.nombre.toLowerCase()}?`)}</div>`).join('\n')}`}
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
        ${luzVacia('150px', true)}
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
        ${luzVacia('150px', true)}
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
        <div class="ficha-imagen escaparate" data-cat="${p.categoria}">${imagenProducto(p)}${p.frio ? `<span class="sello-frio">${icono('frio')}Bien frío</span>` : ''}</div>
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
for (const viejo of ['producto', 'plan', 'catalogo', 'carrito', 'calculadora', 'terminos', 'privacidad',
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
const rutasPublicas = ['/', RUTAS.catalogo, RUTAS.calculadora, RUTAS.terminos, RUTAS.privacidad, ...OCASIONES.map(rutaPlan), ...productos.map(rutaProducto)];
const conSitemap = Boolean(DOMINIO && cfg.indexable);
writeFileSync(join(RAIZ, 'public/robots.txt'), `User-agent: *\nAllow: /\n${conSitemap ? `\nSitemap: ${absoluta('/sitemap.xml')}\n` : ''}`);
rmSync(join(RAIZ, 'public/sitemap.xml'), { force: true });
if (conSitemap) {
    writeFileSync(join(RAIZ, 'public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rutasPublicas.map(r => `  <url><loc>${absoluta(r)}</loc></url>`).join('\n')}\n</urlset>\n`);
}

console.log(`horneadas ${Object.keys(paginas).length} páginas (${productos.length} fichas de producto)`);
if (faltanEscenas.size) avisos.push(`Fotos de ambiente: falta(n) ${[...faltanEscenas].sort().join(', ')} en public/escenas/ (esas piezas salen sin foto).`);
if (!VIDEO_ORO) avisos.push('public/escenas/oro-liquido-<ancho>.{webm,mp4} aún no existe: la calculadora exprés sale con la foto fija del oro líquido.');
for (const a of avisos) console.warn(`⚠ ${a}`);
