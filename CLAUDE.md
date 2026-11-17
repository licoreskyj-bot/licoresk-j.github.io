# CLAUDE.md — licoresk-j.github.io · 🌉 PUENTE (este repo es el SITIO, no el cerebro)

## Tu cerebro NO está aquí

Este repo es **solo el sitio** (LICORES K&J, punto frío de cervezas y licores). Tu memoria vive en
`../brain-private/licoreskyj/`: `CLAUDE.md` (el router), `docs/05-ESTADO-GLOBAL.md`,
`docs/10-MEMORIA-CORTO-PLAZO.md` y el análisis de arranque `docs/40-PLAN-ARRANQUE.md`.

Los tres primeros entran **ENTEROS** por los imports de abajo (desde el 17-nov-2026). **Si no los ves en tu
contexto, falta el permiso de imports externos de esta carpeta: LÉELOS POR RUTA antes de tocar nada** —
router, `05`, `10`— y avísale a Daniel. El `40` se lee por ruta cuando toque.

@../brain-private/licoreskyj/CLAUDE.md
@../brain-private/licoreskyj/docs/05-ESTADO-GLOBAL.md
@../brain-private/licoreskyj/docs/10-MEMORIA-CORTO-PLAZO.md

Todavía NO hay hook de arranque (el kernel del brain-kit se instala cuando exista código: TODO-01 del
`10`). `.claude/settings.json` trae solo el freno de comandos peligrosos (`guard-destructivo` del kernel
de la bóveda) y su lista de prohibidos.

## Dónde va cada commit

- Cerebro (`docs/`, router, ADRs) → **en la bóveda** `../brain-private/`.
- Sitio (web, código, imágenes) → **aquí**, directo en `main`. Nunca los dos en el mismo commit.

## Reglas de oro DE ESTE SITIO

- **Autoría**: este repo commitea con el correo PROPIO de K&J (config LOCAL del repo), nunca con el
  global de la máquina (es el de ALTORRA Cars). Sin ese correo configurado, no hay primer commit.
- `git add` específico, jamás `-A`. **NUNCA** `--amend`, `--no-verify` ni push forzado. **JAMÁS**
  secretos (`.env`, llaves de Wompi/Addi, service accounts).
- Venta de alcohol: verificación de edad y advertencias legales obligatorias → `40-PLAN-ARRANQUE`.

*(Puente · plantilla `brain-kit/plantillas/CLAUDE.puente.md`.)*
