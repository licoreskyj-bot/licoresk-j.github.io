/**
 * LICORES K&J — video de fondo de una banda (hoy: el oro líquido detrás de la calculadora exprés).
 * main.js lo pide con import() tras «load» y en un momento libre, y ni lo descarga con «reducir
 * movimiento». Mismas reglas que el video de la portada (docs/44 §8):
 *  - El video NUNCA va en el HTML ni se precarga, ni lo guarda el service worker: hornear.mjs solo
 *    anuncia sus rutas (data-video-webm / data-video-mp4) si los archivos existen.
 *  - Solo con «4g» (o sin esa API) y sin «ahorro de datos», y solo cuando la banda está a la vista.
 *  - Se detiene fuera de la vista, con la pestaña oculta y con la capa de edad abierta. Sin botón de
 *    pausa, como la portada (Daniel, 27-oct).
 *  - Entra en dos tiempos, como la portada: la foto se funde, QUIETA, en el primer cuadro del video
 *    (1,4 s) y solo después el licor empieza a moverse. Si el navegador no deja reproducir o el video
 *    falla, queda la foto fija (si ya se veía, se desvanece de vuelta a la foto).
 */
const raiz = document.documentElement;
const rm = matchMedia('(prefers-reduced-motion: reduce)');
// AV1 con su cadena de códec: canPlayType lo descarta donde no hay AV1 y se usa el MP4 (H.264).
const AV1 = 'video/webm; codecs="av01.0.04M.08"';
const FUNDIDO = 1400; // = la transición de .expres-fondo video en estilos.css

function bandaConVideo(banda) {
    const fondo = banda.querySelector('[data-banda-fondo]');
    const { videoWebm, videoMp4 } = banda.dataset;
    const red = navigator.connection;
    if (!fondo || !(videoWebm || videoMp4) || (red && (red.saveData || (red.effectiveType && red.effectiveType !== '4g')))) return;
    const src = videoWebm && document.createElement('video').canPlayType(AV1) ? videoWebm : videoMp4;
    if (!src) return;

    let v = null;
    let fallo = false;
    let aLaVista = false;
    // 0: cargando (invisible) · 1: la foto se funde en el primer cuadro, con el video quieto · 2: andando.
    let fase = 0;
    const quieto = () => rm.matches;
    const activo = () => aLaVista && !document.hidden && !quieto() && !raiz.classList.contains('pedir-edad');

    const rendirse = () => {
        fallo = true;
        const viejo = v;
        v = null;
        if (!viejo) return;
        if (viejo.classList.contains('listo')) { viejo.classList.remove('listo'); setTimeout(() => viejo.remove(), FUNDIDO); }
        else viejo.remove();
        viejo.removeAttribute('src');
        viejo.load();
    };
    // Bloqueada la reproducción automática: foto fija. Otro rechazo (una pausa que cortó el play(), p.
    // ej. al salir de la vista) no cambia nada.
    const reproducir = () => v?.play().catch((e) => { if (e && e.name === 'NotAllowedError') rendirse(); });
    // Primer cuadro que de verdad se muestra: el video se detiene ahí y la foto se funde en él, quieta.
    const alMostrarse = () => {
        if (!v || fase) return;
        fase = 1;
        v.pause();
        v.classList.add('listo');
        setTimeout(() => { fase = 2; if (v && activo()) reproducir(); }, FUNDIDO);
    };
    const crear = () => {
        v = document.createElement('video');
        v.muted = v.defaultMuted = v.loop = v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('aria-hidden', 'true');
        v.disablePictureInPicture = true;
        v.preload = 'auto';
        v.addEventListener('playing', () => {
            if (fase) return;
            if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(alMostrarse);
            else setTimeout(alMostrarse, 40);
        });
        v.addEventListener('error', rendirse, { once: true });
        v.src = src;
        fondo.append(v);
    };
    // Durante el fundido (fase 1) el video sigue quieto aunque vuelva a estar activo: lo arranca el fin
    // del fundido.
    const avisar = () => {
        const si = activo();
        if (si && !v && !fallo) crear();
        if (!v) return;
        if (!si) v.pause();
        else if (fase !== 1) reproducir();
    };
    new IntersectionObserver(([e]) => { aLaVista = e.isIntersecting; avisar(); }, { rootMargin: '80px 0px' }).observe(banda);
    document.addEventListener('visibilitychange', avisar);
    rm.addEventListener?.('change', avisar);
    new MutationObserver(avisar).observe(raiz, { attributes: true, attributeFilter: ['class'] });
}

for (const banda of document.querySelectorAll('[data-banda-video]')) bandaConVideo(banda);
