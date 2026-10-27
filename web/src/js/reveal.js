/* Copiado de Bersaglio (bersagliojewelry.github.io/js/core/reveal.js), brief 42 §2.9. Sin cambios de lógica. */
/**
 * Bersaglio Jewelry — Reveal-on-scroll utility.
 *
 * Primario: IntersectionObserver (eficiente, sin el polling por frame del kit).
 * Red de robustez: además revela lo que YA está en viewport al cargar y enlaza un
 * listener de scroll/resize PASIVO que se auto-remueve cuando todo quedó revelado.
 * Garantiza que el contenido NUNCA quede invisible aunque IO no dispare (algunos
 * contextos embebidos/headless no ejecutan IntersectionObserver).
 *
 * Uso:
 *   - class="reveal" (o "reveal reveal-soft"); stagger con style="--d: 120ms".
 *   - boot.js llama observeReveals() tras hidratar; re-llamable tras re-render.
 * Accesibilidad: con prefers-reduced-motion se revela de inmediato.
 */

const _tracked = new Set();
let _io = null;
let _scrollBound = false;

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function reveal(el) {
    el.classList.add('in');
    _tracked.delete(el);
    if (_io) _io.unobserve(el);
}

function inViewport(el, margin = 80) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < (vh - margin) && r.bottom > 0;
}

function sweep() {
    _tracked.forEach(el => { if (inViewport(el)) reveal(el); });
    return _tracked.size;
}

function onScrollOrResize() {
    if (sweep() === 0) {
        window.removeEventListener('scroll', onScrollOrResize);
        window.removeEventListener('resize', onScrollOrResize);
        _scrollBound = false;
    }
}

/**
 * Observa los `.reveal` aún no activados dentro de `root` (default: document).
 * @param {ParentNode} [root=document]
 */
export function observeReveals(root = document) {
    const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    const els = scope.querySelectorAll('.reveal:not(.in)');
    if (!els.length) return;

    // Movimiento reducido → mostrar de inmediato, sin transición ni observer.
    if (prefersReducedMotion()) {
        els.forEach(el => el.classList.add('in'));
        return;
    }

    // Lo que YA está a la vista en este primer paint se ASIENTA sin animar (`.reveal-static`
    // = transition:none). El reveal (slide + fade) es para lo que ENTRA al hacer scroll;
    // reproducirlo sobre algo ya visible se ve como un "salto/asentamiento" feo en CADA
    // recarga — y la promoción a capa GPU por el `transform` rasteriza/difumina las imágenes
    // durante la transición (lo que el usuario percibe como "imágenes que se acomodan/zoom").
    // Lo de abajo del pliegue se observa y SÍ anima al entrar (efecto intencional al scrollear).
    els.forEach(el => {
        if (inViewport(el, 0)) el.classList.add('reveal-static', 'in');
        else _tracked.add(el);
    });

    if (!_tracked.size) return;   // todo lo visible quedó asentado; nada que observar

    // Primario: IntersectionObserver (solo para lo aún NO visible).
    if (typeof IntersectionObserver !== 'undefined') {
        if (!_io) {
            _io = new IntersectionObserver(entries => {
                entries.forEach(e => { if (e.isIntersecting) reveal(e.target); });
            }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
        }
        _tracked.forEach(el => _io.observe(el));
    }

    // Red de robustez (IO ausente en headless/embebido): fallback por scroll/resize.
    if (!_scrollBound) {
        _scrollBound = true;
        window.addEventListener('scroll', onScrollOrResize, { passive: true });
        window.addEventListener('resize', onScrollOrResize, { passive: true });
    }
}

export default observeReveals;
