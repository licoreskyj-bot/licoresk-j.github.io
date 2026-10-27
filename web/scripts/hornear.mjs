/**
 * Hornea TODAS las páginas de LICORES K&J desde src/data (catalogo.json + config.json): inicio,
 * catálogo, carrito, legales y una ficha HTML por producto (para que Google la lea sin JavaScript).
 * Un solo molde de cabecera y pie: las leyendas legales del Decreto 1686/2012 art. 54 van en TODAS.
 * Las páginas generadas no se versionan (.gitignore): se rehacen en cada `npm run dev` / `build`.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { precio, precioPorUnidad, iconoProducto, escapar } from '../src/js/comun.js';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r) => JSON.parse(readFileSync(join(RAIZ, r), 'utf8'));
const { categorias, productos } = leer('src/data/catalogo.json');
const cfg = leer('src/data/config.json');
const nombreCategoria = Object.fromEntries(categorias.map(c => [c.id, c.nombre]));
const wa = (texto) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(texto)}`;

const LEYENDAS = `<p class="leyenda">El exceso de alcohol es perjudicial para la salud.</p>
      <p class="leyenda">Prohíbase el expendio de bebidas embriagantes a menores de edad.</p>`;

function molde({ titulo, descripcion, pagina, cuerpo, jsonld }) {
    const robots = cfg.indexable ? 'index, follow' : 'noindex, nofollow';
    return `<!doctype html>
<html lang="es-CO">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapar(titulo)}</title>
  <meta name="description" content="${escapar(descripcion)}">
  <meta name="robots" content="${robots}">
  <meta name="theme-color" content="#000000">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/src/css/estilos.css">
  ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body data-pagina="${pagina}">
  ${cfg.modoPrueba ? '<div class="aviso-prueba">Sitio de prueba: productos y precios de <strong>EJEMPLO</strong>. Todavía no es la tienda real.</div>' : ''}
  <header class="cabecera">
    <div class="contenedor cabecera-fila">
      <a href="/" class="marca"><img src="/logo/logo-kyj-icono.svg" alt="" height="42" width="42"><span>LICORES K&amp;J</span></a>
      <nav class="menu" aria-label="Principal">
        <a href="/catalogo.html">Catálogo</a>
        <a href="/catalogo.html?c=combos">Combos</a>
      </nav>
      <a href="/carrito.html" class="boton-carrito">Pedido <span class="contador" data-contador>0</span></a>
    </div>
  </header>
  <main>
${cuerpo}
  </main>
  <footer class="pie">
    <div class="contenedor">
      ${LEYENDAS}
      <p>Venta exclusiva para mayores de 18 años · Domicilios en ${cfg.ciudad}</p>
      <nav class="pie-enlaces" aria-label="Legal y contacto">
        <a href="/terminos.html">Términos y condiciones</a>
        <a href="/privacidad.html">Tratamiento de datos</a>
        <a href="https://www.instagram.com/${cfg.instagram}/" rel="noopener">Instagram</a>
        <a href="mailto:${cfg.correo}">${cfg.correo}</a>
      </nav>
      <p class="pie-legal">© 2026 ${escapar(cfg.marca)} · Comerciante: Daniel Romero (persona natural). Matrícula mercantil en trámite.</p>
    </div>
  </footer>
  <div class="edad" id="edad" hidden role="dialog" aria-modal="true" aria-labelledby="edad-titulo">
    <div class="edad-caja">
      <img src="/logo/logo-kyj-sobre-negro-plano.svg" alt="" width="180">
      <h2 id="edad-titulo">¿Eres mayor de 18 años?</h2>
      <p>Para entrar a ${escapar(cfg.marca)} debes ser mayor de edad.</p>
      <div class="edad-botones">
        <button type="button" class="boton" data-edad="si">Sí, soy mayor de 18</button>
        <button type="button" class="boton boton-secundario" data-edad="no">No</button>
      </div>
      <p class="leyenda-mini">Prohíbase el expendio de bebidas embriagantes a menores de edad.</p>
    </div>
  </div>
  <div class="aviso-toast" data-toast role="status" aria-live="polite"></div>
  <script type="module" src="/src/js/main.js"></script>
</body>
</html>
`;
}

const ruta = (p) => `/producto/${p.slug}/`;
const sello = (p) => (p.ejemplo ? ' <span class="sello-ejemplo">ejemplo</span>' : '');
const detalle = (p) => [p.presentacion, p.grado ? `${String(p.grado).replace('.', ',')} % Vol.` : ''].filter(Boolean).join(' · ');

function tarjeta(p) {
    return `      <article class="tarjeta" data-categoria="${p.categoria}" data-nombre="${escapar(p.nombre.toLowerCase())}">
        <a href="${ruta(p)}" class="tarjeta-enlace">
          <div class="tarjeta-imagen">${iconoProducto(p.categoria)}${p.frio ? '<span class="sello-frio">Bien frío</span>' : ''}</div>
          <h3>${escapar(p.nombre)}</h3>
          <p class="tarjeta-detalle">${escapar(detalle(p))}</p>
        </a>
        <p class="tarjeta-precio">${precio(p.precio)}${sello(p)}</p>
        <button type="button" class="boton boton-agregar" data-agregar="${p.slug}">Agregar</button>
      </article>`;
}

const grilla = (lista) => `<div class="grilla">\n${lista.map(tarjeta).join('\n')}\n    </div>`;

const escalera = cfg.regalos.map(r =>
    `<li><strong>${precio(r.desde)}</strong><span>${escapar(r.regalo)} gratis</span><em>${escapar(r.nivel)}</em></li>`).join('\n          ');

const paginas = {};

paginas['index.html'] = molde({
    titulo: `${cfg.marca} · Licor frío a domicilio en ${cfg.ciudad}`,
    descripcion: `Cerveza, aguardiente, ron, whisky y vodka bien fríos a domicilio en ${cfg.ciudad}. Pide en línea; venta solo a mayores de 18 años.`,
    pagina: 'inicio',
    jsonld: { '@context': 'https://schema.org', '@type': 'OnlineStore', name: cfg.marca, email: cfg.correo, areaServed: cfg.ciudad, sameAs: [`https://www.instagram.com/${cfg.instagram}/`] },
    cuerpo: `    <section class="portada">
      <div class="contenedor portada-fila">
        <div>
          <p class="antetitulo">Punto frío · ${cfg.ciudad}</p>
          <h1>Licor frío a domicilio, listo para tu plan</h1>
          <p class="portada-texto">Cerveza, aguardiente, ron, whisky y vodka. Arma tu pedido, confírmalo por WhatsApp y te llega frío.</p>
          <div class="portada-acciones">
            <a href="/catalogo.html" class="boton">Ver catálogo</a>
            <a href="${wa(`Hola ${cfg.marca}, quiero hacer un pedido`)}" class="boton boton-secundario" rel="noopener">Pedir por WhatsApp</a>
          </div>
        </div>
        <img class="portada-logo" src="/logo/logo-kyj-sobre-negro-plano.svg" alt="" width="360">
      </div>
    </section>
    <section class="contenedor seccion">
      <h2>Categorías</h2>
      <div class="categorias">
${categorias.map(c => `        <a class="categoria" href="/catalogo.html?c=${c.id}">${iconoProducto(c.id)}<span>${escapar(c.nombre)}</span></a>`).join('\n')}
      </div>
    </section>
    <section class="contenedor seccion">
      <h2>Los más pedidos</h2>
    ${grilla(productos.filter(p => p.destacado))}
    </section>
    <section class="contenedor seccion">
      <h2>Regalos por tu compra</h2>
      <p class="seccion-intro">Según el valor de tu pedido te llevamos algo frío de regalo, sin alcohol.${cfg.modoPrueba ? ' <span class="sello-ejemplo">propuesta</span>' : ''}</p>
      <ol class="escalera">
          ${escalera}
      </ol>
    </section>
    <section class="contenedor seccion pasos">
      <h2>Así de fácil</h2>
      <ol>
        <li><strong>Elige</strong> tus productos y agrégalos al pedido.</li>
        <li><strong>Confirma</strong> por WhatsApp con tu código de pedido.</li>
        <li><strong>Recibe frío.</strong> Al entregar pedimos tu cédula: no vendemos a menores de edad.</li>
      </ol>
    </section>
    <section class="contenedor seccion">
      <h2>Pagos y domicilios</h2>
      <ul class="lista">
${cfg.pagos.map(m => `        <li>${escapar(m.nombre)}</li>`).join('\n')}
      </ul>
      <p class="seccion-intro">Horario de domicilios: ${cfg.horario ? escapar(cfg.horario) : 'por confirmar'} · Pedido mínimo ${precio(cfg.pedidoMinimo)}.</p>
    </section>`,
});

paginas['catalogo.html'] = molde({
    titulo: `Catálogo · ${cfg.marca}`,
    descripcion: `Catálogo de ${cfg.marca}: cerveza, aguardiente, ron, whisky, vodka, combos y hielo a domicilio en ${cfg.ciudad}.`,
    pagina: 'catalogo',
    cuerpo: `    <section class="contenedor seccion">
      <h1>Catálogo</h1>
      <div class="filtros" role="toolbar" aria-label="Filtrar por categoría">
        <button type="button" class="filtro activo" data-filtro="">Todo</button>
${categorias.map(c => `        <button type="button" class="filtro" data-filtro="${c.id}">${escapar(c.nombre)}</button>`).join('\n')}
      </div>
      <label class="buscador"><span class="oculto">Buscar</span><input type="search" placeholder="Buscar producto" data-buscar></label>
    ${grilla(productos)}
      <p class="vacio" data-vacio hidden>No hay productos con ese filtro.</p>
    </section>`,
});

paginas['carrito.html'] = molde({
    titulo: `Tu pedido · ${cfg.marca}`,
    descripcion: `Arma y confirma tu pedido de ${cfg.marca}.`,
    pagina: 'carrito',
    cuerpo: `    <section class="contenedor seccion">
      <h1>Tu pedido</h1>
      <div class="pedido">
        <div>
          <div data-lineas></div>
          <p class="vacio" data-carrito-vacio hidden>Tu pedido está vacío. <a href="/catalogo.html">Ve al catálogo</a>.</p>
          <div class="regalo" data-regalo hidden></div>
        </div>
        <form class="formulario" data-formulario novalidate>
          <h2>Datos de entrega</h2>
          <label>Nombre completo<input name="nombre" autocomplete="name" required></label>
          <label>Celular<input name="telefono" type="tel" inputmode="numeric" autocomplete="tel" required></label>
          <label>Dirección<input name="direccion" autocomplete="street-address" required></label>
          <label>Barrio e indicaciones<input name="barrio" required></label>
          <label>Zona de domicilio
            <select name="zona" required>
              <option value="">Elige tu zona</option>
${cfg.zonas.map(z => `              <option value="${z.id}">${escapar(z.nombre)} · ${precio(z.tarifa)}</option>`).join('\n')}
            </select>
          </label>
          <fieldset>
            <legend>Forma de pago</legend>
${cfg.pagos.map((m, i) => `            <label class="opcion"><input type="radio" name="pago" value="${m.id}"${i === 0 ? ' checked' : ''}> ${escapar(m.nombre)}</label>`).join('\n')}
          </fieldset>
          <label>Fecha de nacimiento<input name="nacimiento" type="date" required></label>
          <label>Notas para el domiciliario (opcional)<textarea name="notas" rows="2"></textarea></label>
          <label class="opcion"><input type="checkbox" name="mayor" required> Confirmo que soy mayor de 18 años y mostraré mi cédula al recibir.</label>
          <label class="opcion"><input type="checkbox" name="acepto" required> Acepto los <a href="/terminos.html">términos</a> y el <a href="/privacidad.html">tratamiento de mis datos</a>.</label>
          <div class="resumen" data-resumen></div>
          <p class="error" data-error role="alert" hidden></p>
          <button type="submit" class="boton boton-ancho">Enviar pedido por WhatsApp</button>
        </form>
      </div>
      <div class="confirmacion" data-confirmacion hidden></div>
    </section>`,
});

const legal = (archivo, titulo, secciones) => {
    paginas[archivo] = molde({
        titulo: `${titulo} · ${cfg.marca}`, descripcion: `${titulo} de ${cfg.marca}.`, pagina: 'legal',
        cuerpo: `    <section class="contenedor seccion texto-legal">
      <h1>${titulo}</h1>
      <p class="aviso-borrador">BORRADOR pendiente de revisión legal y de la matrícula mercantil. No es la versión final.</p>
${secciones.map(([h, t]) => `      <h2>${h}</h2>\n      <p>${t}</p>`).join('\n')}
    </section>`,
    });
};

legal('terminos.html', 'Términos y condiciones', [
    ['Quién vende', `${cfg.marca} es el nombre comercial de Daniel Romero, persona natural. Los datos completos del comerciante (identificación, matrícula mercantil y dirección de notificación) se publicarán aquí al quedar registrados.`],
    ['Solo para mayores de edad', 'Vendemos bebidas alcohólicas únicamente a mayores de 18 años. Al entregar pedimos la cédula y no entregamos a menores de edad ni a personas en evidente estado de embriaguez.'],
    ['Precios y pedidos', 'Los precios incluyen los impuestos que correspondan. El pedido queda confirmado cuando te respondemos por WhatsApp con su código.'],
    ['Derecho de retracto', 'En las ventas a distancia puedes retractarte dentro de los 5 días hábiles siguientes a la entrega, en las condiciones de la Ley 1480 de 2011; los costos de transporte de la devolución corren por tu cuenta.'],
]);
legal('privacidad.html', 'Tratamiento de datos personales', [
    ['Responsable', `Daniel Romero, persona natural, con el nombre comercial ${cfg.marca}. Contacto: ${cfg.correo}.`],
    ['Qué datos y para qué', 'Usamos tu nombre, celular, dirección y fecha de nacimiento solo para entregar tu pedido y verificar que eres mayor de edad. No guardamos fotos de tu cédula.'],
    ['Tus derechos', 'Puedes conocer, actualizar, rectificar y pedir la supresión de tus datos (Ley 1581 de 2012) escribiendo al correo de contacto.'],
]);

for (const p of productos) {
    const unidad = precioPorUnidad(p);
    paginas[`producto/${p.slug}/index.html`] = molde({
        titulo: `${p.nombre} ${p.presentacion} · ${cfg.marca}`,
        descripcion: `${p.nombre}, ${detalle(p)}, a domicilio en ${cfg.ciudad}. Precio: ${precio(p.precio)}.`,
        pagina: 'producto',
        jsonld: {
            '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, description: `${p.nombre} · ${detalle(p)}`,
            category: nombreCategoria[p.categoria],
            offers: { '@type': 'Offer', price: p.precio, priceCurrency: 'COP', availability: 'https://schema.org/InStock' },
        },
        cuerpo: `    <section class="contenedor seccion">
      <nav class="migas" aria-label="Ruta"><a href="/">Inicio</a> › <a href="/catalogo.html?c=${p.categoria}">${escapar(nombreCategoria[p.categoria])}</a> › <span>${escapar(p.nombre)}</span></nav>
      <div class="ficha">
        <div class="ficha-imagen">${iconoProducto(p.categoria)}${p.frio ? '<span class="sello-frio">Bien frío</span>' : ''}</div>
        <div class="ficha-info">
          <h1>${escapar(p.nombre)}</h1>
          <p class="ficha-detalle">${escapar(detalle(p))}</p>
          <p class="ficha-precio">${precio(p.precio)}${sello(p)}</p>
          ${unidad ? `<p class="ficha-unidad">${unidad}</p>` : ''}
          <div class="ficha-compra">
            <label class="cantidad"><span class="oculto">Cantidad</span><input type="number" min="1" max="99" value="1" data-cantidad></label>
            <button type="button" class="boton" data-agregar="${p.slug}">Agregar al pedido</button>
          </div>
          <div class="ficha-leyendas">${LEYENDAS}</div>
        </div>
      </div>
    </section>`,
    });
}

rmSync(join(RAIZ, 'producto'), { recursive: true, force: true });
for (const [archivo, html] of Object.entries(paginas)) {
    const destino = join(RAIZ, archivo);
    mkdirSync(join(destino, '..'), { recursive: true });
    writeFileSync(destino, html);
}
console.log(`horneadas ${Object.keys(paginas).length} páginas (${productos.length} fichas de producto)`);
