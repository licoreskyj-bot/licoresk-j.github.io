/**
 * LICORES K&J — portada con movimiento (SOLO el inicio; main.js la pide con import() tras «load» y
 * en un momento libre, y ni la descarga con «reducir movimiento»). Sin librerías.
 *
 * El CSS ya hace la flotación del logo, su sombra de contacto, el barrido de brillo, el licor y la
 * cascada del texto (estilos.css «Portada en escena»). Aquí va solo lo que necesita JS:
 *   1. El video de la escena (la misma toma que la foto fija): se pinta en un CANVAS encima de la foto,
 *      dentro de la misma ventana (el canvas no es candidato a LCP; un <video> del tamaño de la foto
 *      podía serlo y llegar después de «load»). Entra en dos tiempos para que no se note: primero la
 *      foto se convierte, QUIETA, en el primer cuadro del video (un fundido de 1,4 s entre dos imágenes
 *      casi iguales: ~3 niveles de diferencia, < 0,5 por refresco), y solo después la neblina empieza a
 *      moverse. Fundir con el video ya andando mezclaba dos neblinas que no coinciden (y el charco ya
 *      corrido): una doble imagen breve. Solo con «4g» (o sin esa API), sin «ahorro de datos» y con la
 *      portada a la vista. Si el navegador no deja reproducir (iPhone en «bajo consumo») o el video
 *      falla, queda la foto fija (si el lienzo ya se veía, se desvanece de vuelta a la foto).
 *   2. Ordenador: un reflejo dorado que sigue al cursor (con muelle); se apaga lejos del logo. El logo
 *      NO se inclina ni gira (Daniel, 27-oct: «debe flotar sin torcerse sino ahí fijo de frente»).
 *      Celular: al tocar el logo, un destello donde cae el dedo.
 * Todo se detiene fuera de pantalla (y el CSS de la escena se congela con .fuera), con la pestaña
 * oculta, con «reducir movimiento» (también si se activa con la página abierta: el CSS esconde el video
 * y vuelve la foto) y mientras la capa de edad está abierta (html.pedir-edad). Sin botón de pausa
 * (Daniel, 27-oct: el video de la portada no se pausa). El logo nunca se redibuja.
 */
const raiz = document.documentElement;
const portada = document.querySelector('.portada');
const escena = portada?.querySelector('[data-escena]');
const logo = escena?.querySelector('[data-logo]');
const rm = matchMedia('(prefers-reduced-motion: reduce)');
const quieto = () => rm.matches;
const tope = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));

let aLaVista = false;
const oyentes = new Set();
const activo = () => aLaVista && !document.hidden && !quieto() && !raiz.classList.contains('pedir-edad');
const avisar = () => {
    portada.classList.toggle('fuera', !aLaVista);
    const si = activo();
    oyentes.forEach(f => f(si));
};

// ── 1. Video de la escena → canvas encima de la foto ──────────────────────────────────────────
// AV1 con su cadena de códec: así canPlayType lo descarta donde no hay AV1 (iPhone sin AV1 por
// hardware) y se usa el MP4 (H.264).
const AV1 = 'video/webm; codecs="av01.0.04M.08"';
function videoEscena() {
    const caja = escena.querySelector('[data-foto]');
    const { videoWebm, videoMp4 } = escena.dataset;
    const red = navigator.connection;
    if (!caja || !(videoWebm || videoMp4) || (red && (red.saveData || (red.effectiveType && red.effectiveType !== '4g')))) return;
    const src = videoWebm && document.createElement('video').canPlayType(AV1) ? videoWebm : videoMp4;
    if (!src) return;
    let v = null;
    let lienzo = null;
    let ctx = null;
    let cb = 0;
    let espera = 0;
    let ultimo = -1;
    let fallo = false;
    // 0: cargando (lienzo invisible) · 1: la foto se funde en el primer cuadro, con el video quieto ·
    // 2: andando. FUNDIDO = la transición de .escena-video en estilos.css.
    let fase = 0;
    const FUNDIDO = 1400;
    const rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    const pintar = () => {
        if (!v) return;
        if (lienzo.width !== v.videoWidth || lienzo.height !== v.videoHeight) {
            lienzo.width = v.videoWidth;
            lienzo.height = v.videoHeight;
        }
        ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
    };
    // Con requestVideoFrameCallback: un cuadro del video = un pintado (24/s, no uno por refresco).
    const cuadro = () => {
        cb = 0;
        if (!v || v.paused) return;
        pintar();
        cb = v.requestVideoFrameCallback(cuadro);
    };
    // Sin esa API (Safari < 15.4, Firefox < 132): ~30 veces por segundo, y solo si llegó un cuadro nuevo.
    const paso = () => {
        espera = 0;
        if (!v || v.paused) return;
        if (v.readyState >= 2 && v.currentTime !== ultimo) {
            ultimo = v.currentTime;
            pintar();
        }
        espera = setTimeout(paso, 33);
    };
    // ¿El lienzo quedó pintado? Chrome a veces deja en negro el primer drawImage del video (medido el
    // 27-oct: 1 de los 3 primeros arranques de prueba, recién abierto el navegador); con el lienzo quieto
    // ese negro oscurecería la escena todo el fundido y luego saltaría. Se
    // mira un cuadrito en el nacimiento del haz, arriba al centro, que en TODOS los cuadros del video
    // vale ≈ 249 (rojo): si da < 40, no se pintó. Se lee copiándolo a un lienzo de 1 px (nunca con
    // getImageData sobre el lienzo grande: Chrome lo pasaría a la CPU y cada cuadro costaría más).
    let mctx = null;
    const sePinto = () => {
        try {
            if (!mctx) {
                const m = document.createElement('canvas');
                m.width = m.height = 1;
                mctx = m.getContext('2d', { willReadFrequently: true });
            }
            mctx.drawImage(lienzo, (lienzo.width >> 1) - 8, Math.round(lienzo.height * 0.03), 16, 16, 0, 0, 1, 1);
            return mctx.getImageData(0, 0, 1, 1).data[0] > 40;
        } catch { return true; }
    };
    const otroCuadro = (f) => (rvfc ? v.requestVideoFrameCallback(f) : setTimeout(f, 40));
    // Primer cuadro que de verdad se muestra (ya se sabe que el navegador deja reproducir, y en iPhone
    // es play() lo que trae los datos): lo pinta, se detiene ahí y la foto se funde en él, quieta. Si
    // quedó negro, sigue andando (invisible) y prueba con el siguiente; tras ~1 s sin lograrlo, foto fija.
    let intentos = 0;
    const primerCuadro = () => {
        if (!v || fase) return;
        pintar();
        if (!sePinto()) { if (++intentos < 24) otroCuadro(primerCuadro); else rendirse(); return; }
        fase = 1;
        v.pause();
        lienzo.classList.add('listo');
        setTimeout(() => { fase = 2; if (v && activo()) reproducir(); }, FUNDIDO);
    };
    // Al terminar el fundido la escena empieza a moverse (si sigue a la vista y sin pausa).
    const seguir = () => {
        if (fase === 0) { otroCuadro(primerCuadro); return; }
        if (rvfc) cb ||= v.requestVideoFrameCallback(cuadro);
        else if (!espera) paso();
    };
    // Sin video (falló o no deja reproducir): queda la foto fija. Si el lienzo ya se veía, conserva su
    // último cuadro y se desvanece de vuelta a la foto (sin salto); si no, se quita sin más.
    const rendirse = () => {
        fallo = true;
        clearTimeout(espera);
        if (v) { v.removeAttribute('src'); v.load(); }
        v = null;
        const l = lienzo;
        if (l?.classList.contains('listo')) { l.classList.remove('listo'); setTimeout(() => l.remove(), FUNDIDO); }
        else l?.remove();
    };
    const crear = () => {
        lienzo = document.createElement('canvas');
        lienzo.className = 'escena-video';
        lienzo.setAttribute('aria-hidden', 'true');
        ctx = lienzo.getContext('2d', { alpha: false });
        if (!ctx) { fallo = true; return; }
        v = document.createElement('video');
        v.muted = v.defaultMuted = v.loop = v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.preload = 'auto';
        v.addEventListener('playing', seguir);
        v.addEventListener('error', rendirse, { once: true });
        v.src = src;
        caja.append(lienzo);
    };
    // Bloqueada la reproducción automática: foto fija. Otro rechazo (una pausa que cortó el play(),
    // p. ej. al salir de pantalla) no cambia nada.
    const reproducir = () => v.play().catch((e) => { if (e && e.name === 'NotAllowedError') rendirse(); });
    // Durante el fundido (fase 1) el video sigue quieto aunque vuelva a estar activo: lo arranca el fin
    // del fundido.
    oyentes.add((si) => {
        if (si && !v && !fallo) crear();
        if (!v) return;
        if (!si) v.pause();
        else if (fase !== 1) reproducir();
    });
}

// ── 2. El logo responde: reflejo que sigue al cursor o destello al tocar (sin inclinarlo) ─────────
function interaccionLogo() {
    const flota = logo.parentElement; // el contenedor que flota: se mide su caja, que no se mueve de lado
    const capaReflejo = logo.querySelector('.logo-reflejo');
    const reflejo = logo.querySelector('[data-reflejo]');
    const brillo = logo.querySelector('.logo-brillo i');
    const fino = matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!fino) {
        logo.addEventListener('pointerdown', (e) => {
            if (quieto()) return;
            const r = logo.getBoundingClientRect();
            reflejo.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
            capaReflejo.animate([{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' });
            brillo.animate([{ transform: 'translateX(-120%) skewX(-16deg)' }, { transform: 'translateX(240%) skewX(-16deg)' }], { duration: 850, easing: 'cubic-bezier(.22,1,.36,1)' });
        }, { passive: true });
        return;
    }

    // Ordenador: el reflejo sigue al cursor con un muelle suave. Se escucha la portada (nunca el
    // documento, 42 §4.4) y el reflejo solo se enciende cerca del logo: sobre el texto no hay nada.
    const meta = { mx: 0.5, my: 0.4 };
    const ya = { ...meta };
    let raf = 0;
    let antes = 0;
    let w = logo.offsetWidth;
    let h = logo.offsetHeight;
    const paso = (ahora) => {
        const dt = Math.min(0.05, (ahora - (antes || ahora)) / 1000);
        antes = ahora;
        const k = 1 - Math.exp(-dt * 7);
        let falta = false;
        for (const c in meta) {
            ya[c] += (meta[c] - ya[c]) * k;
            if (Math.abs(meta[c] - ya[c]) > 0.002) falta = true;
        }
        reflejo.style.transform = `translate(${(ya.mx * w).toFixed(1)}px, ${(ya.my * h).toFixed(1)}px)`;
        raf = falta ? requestAnimationFrame(paso) : 0;
        if (!falta) antes = 0;
    };
    const mover = (e) => {
        if (quieto() || e.pointerType === 'touch') return;
        const r = flota.getBoundingClientRect();
        w = logo.offsetWidth;
        h = logo.offsetHeight;
        const nx = (e.clientX - r.left) / r.width;
        const ny = (e.clientY - r.top) / r.height;
        const lejos = Math.hypot(Math.max(0, -nx, nx - 1), Math.max(0, -ny, ny - 1));
        meta.mx = tope(nx, -0.1, 1.1);
        meta.my = tope(ny, -0.1, 1.1);
        logo.classList.toggle('con-cursor', lejos < 0.12);
        raf ||= requestAnimationFrame(paso);
    };
    const soltar = () => logo.classList.remove('con-cursor');
    portada.addEventListener('pointermove', mover, { passive: true });
    portada.addEventListener('pointerleave', soltar);
    oyentes.add(() => {
        if (!quieto()) return;
        cancelAnimationFrame(raf);
        raf = 0;
        logo.classList.remove('con-cursor');
    });
}

if (escena && logo) {
    videoEscena();
    interaccionLogo();
    new IntersectionObserver(([e]) => { aLaVista = e.isIntersecting; avisar(); }).observe(escena);
    document.addEventListener('visibilitychange', avisar);
    rm.addEventListener?.('change', avisar);
    new MutationObserver(avisar).observe(raiz, { attributes: true, attributeFilter: ['class'] });
}
