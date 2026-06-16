# Design System — xpns

## Product Context
- **What this is:** SaaS de rendición de gastos para SMBs en Chile/LATAM, pre-launch, sin usuarios productivos.
- **Who it's for:** empleados (suman gastos con foto) + admins (aprueban, reembolsan, exportan).
- **Space/industry:** fintech / expense management — peers: Expensify, Spendesk, Pleo, Holded, Clara.
- **Project type:** web app + dashboard + PWA. UI en español (es-CL), moneda CLP.
- **Stack:** Astro 6 + Preact 10 + `@preact/signals`, Firebase (Auth, Firestore, Storage, 2 Cloud Functions), pnpm, TypeScript strict. Sin framework de CSS — lienzo en blanco.

## Mobile-first principle
- **Default viewport:** 360px (small Chilean phone). Desktop is the enhancement, not the baseline. CSS se escribe desde mobile hacia arriba con `@media (min-width)`.
- **Breakpoints (min-width):** sm 360 (base), md 640, lg 1024, xl 1280, 2xl 1440.
- **Primary use case:** empleado tomando foto del recibo (mobile). El admin flow es desktop-anchored pero tiene que funcionar en mobile con fallback a card list.
- **Default layout:** una columna. Sin sidebar. Sin grids multi-columna. Sin scroll horizontal. Sin hover-only.
- **Touch targets:** 44x44px mínimo (Apple HIG), 48x48dp alternativo (Material). Todos los elementos interactivos cumplen.
- **Body font size:** 16px mínimo en mobile — previene zoom de iOS al hacer focus en inputs.
- **Cámara primero:** `capture="environment"` abre cámara trasera directo. Sin pantalla intermedia de "elige foto de la galería".
- **Sticky bottom CTA:** la acción primaria siempre a la altura del pulgar en mobile (Guardar gasto, + Nuevo gasto).

## Touch & gesture
- **Tap:** 100ms color shift a `--surface-2`. Sin animación de scale. Sin cambio de sombra.
- **Swipe izquierda sobre expense row:** revela acciones "Marcar pagado" / "Rechazado". Threshold 80px para commit.
- **Pull-to-refresh:** en dashboard y feed de empleado.
- **Long-press:** context menu para row (raro; el swipe maneja la mayoría).
- **Pinch-zoom en recibos:** permitido (`touch-action: pinch-zoom` en el preview de imagen).
- **Sin doble-tap zoom** en botones o links (`touch-action: manipulation`).

## Mobile patterns
- **Admin dashboard en mobile:** card list, no tabla. Cada card = 1 gasto.
  - Top row: comercio (sans 16px medium) + monto (mono 18px, right).
  - Middle row: categoría + origen de pago (sans 13px muted).
  - Bottom row: fecha (mono 12px muted) + badge de estado.
  - 16px padding, 1px border-bottom `--border`, active state = `--surface-2`.
  - Sticky filter chip arriba: "Todos · A reembolsar · Tarjeta corporativa".
  - FAB `+` fijo bottom-right (56x56, `--accent`, safe area inset bottom).
- **ExpenseForm en mobile:** fullscreen sheet, scroll vertical, sin wizard.
  - Captura de foto como input primario. 70% del viewport. `capture="environment"`.
  - Campo monto es el más grande (mono 24px, autofocused, border `--accent` en focus).
  - Sticky bottom "Guardar gasto" (full width, 48px alto, 14px from safe-area bottom).
  - Descripción colapsada por default ("+ agregar descripción" expandible).
- **Filter sheet en mobile:** bottom sheet, 80% del viewport, drag handle, scrollable. Aplica al tap fuera o botón "Aplicar".
- **Header en mobile:** 48px alto (vs 56px desktop). Logo + overflow menu (3 puntos). Sin nav horizontal.
- **Sin sidebar en ningún breakpoint.** Header siempre top-anchored, full-width. Settings / Ayuda / Reports van al overflow menu en mobile, o quedan en el header nav en desktop.
- **Safe area:** `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)` para notch / home indicator. `viewport-fit=cover` en el meta viewport. `theme-color` meta tag.
- **Sin gráficos en mobile ni desktop.** Misma lista en ambos. Sin chart de torta, sin línea de tendencia. Si en el futuro el admin pide análisis, va a `/reports`, no al dashboard.

## Aesthetic Direction
- **Direction:** oficinesco contable, tinta sobre papel. Como la planilla diaria traducida a software.
- **Decoration level:** minimal. 1px borders, sin sombras excepto modales y toast, sin gradientes. Jerarquía = cambio de color de fondo (`--surface` → `--surface-2`).
- **Mood:** sobrio, rápido, denso pero legible. Un solo acento caliente contra una grilla de neutros. No wow, confianza.
- **Memorable thing:** "Capturar un gasto en segundos y cerrar el día con las cuentas en orden." Todo el sistema sirve esta promesa.
- **Reference sites visitados:** expensify.com, spendesk.com, pleo.io, holded.com, clara.com. Diferenciadores: Expensify usa custom serif + dark green + cream (más cercano en estética), Pleo usa Haas Grotesk + pure B/W (más cercano en restraint), Spendesk y Holded caen en el slop (purple gradient, Inter, dark mode default).

## Typography
- **Display/Hero:** Fraunces (variable, OFL, Google Fonts) — peso 600, `font-variation-settings: 'opsz' 144`. Sensación "documento firmado". Para el mes, KPI hero, page title.
- **Body/UI:** IBM Plex Sans (OFL, Google Fonts) — peso 400/500. Geométrica-humanista, ligeramente condensada, más carácter que Inter.
- **Data/Tabular:** IBM Plex Mono (OFL, Google Fonts) — peso 400/500. Con `font-variant-numeric: tabular-nums lining-nums` y `font-feature-settings: "tnum" 1, "lnum" 1, "ss01" 1` global. Para CLP, fechas, IDs de gasto.
- **Code/IDs:** JetBrains Mono (OFL, Google Fonts) — peso 400. Para invite tokens, doc IDs, hashes de storage. Color `--ink-muted`.
- **Loading:** Google Fonts CSS2 con `display=swap`. Preconnect a fonts.googleapis.com y fonts.gstatic.com.
- **Forbidden:** Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, Poppins, Space Grotesk, system-ui, -apple-system como primary.

### Scale
Mobile-first. Default = mobile. Desktop = `clamp(min, fluid, max)`.

| Token | Mobile | Desktop | Uso |
|---|---|---|---|
| display-1 | 40px | 80px (clamp 40px, 6vw, 80px) | Hero h1, página de marketing |
| display-2 | 36px | 56px (clamp 32px, 8vw, 56px) | KPI value (`$1.247.500`) |
| display-3 | 24px | 32px | Month label (`Junio 2026`) |
| h1 | 28px | 40px (clamp 28px, 3.5vw, 40px) | Section title |
| h2 | 22px | 28px | Subsection |
| body-lg | 17px | 18px | Lead paragraph, hero subtitle |
| body | 16px | 16px | Default body, input value (mínimo 16px mobile, no iOS zoom) |
| body-sm | 14px | 14px | Table cells, button text, nav |
| caption | 13px | 13px | KPI sub, table footer |
| micro | 12px | 12px | Uppercase labels, eyebrow, badges |
| nano | 11px | 11px | Table header, dense UI |

## Color
- **Approach:** restrained — 95% neutros, 5% acento. Estados como tintas, no como neón.

### Light mode (default)
```css
--bg:           #F4F1EA;  /* papel mate cálido */
--surface:      #FFFFFF;  /* tarjeta sobre el papel */
--surface-2:    #EBE7DE;  /* hover, fila alterna */
--ink:          #1A1A1A;  /* texto primario, casi negro */
--ink-muted:    #6B6B6B;  /* labels secundarios */
--ink-faint:    #A8A49A;  /* placeholders */
--border:       #D9D4C7;  /* línea de planilla */
--border-strong:#1A1A1A;  /* separador importante, totales */
--accent:       #C8341D;  /* rojo sello, único acento caliente */
--accent-soft:  #F5E4DF;  /* fondo de badge con accent */
--success:      #2F6B3D;  /* verde tinta */
--warning:      #B57A1A;  /* ocre quemado */
--error:        #C8341D;  /* mismo accent */
--info:         #2A4A6B;  /* azul tinta */
```

### Dark mode
```css
--bg:           #1A1A1A;
--surface:      #242424;
--surface-2:    #2E2E2E;
--ink:          #F4F1EA;
--ink-muted:    #A8A49A;
--ink-faint:    #6B6B6B;
--border:       #3A3A3A;
--border-strong:#F4F1EA;
--accent:       #E5553E;
--accent-soft:  #3A1A14;
--success:      #4A8B5A;
--warning:      #D08F2E;
--error:        #E5553E;
--info:         #4A6A8B;
```

### Reglas
- Bordes SIEMPRE 1px, color `--border`. `border-strong` solo para separadores de totales o header de tabla.
- `box-shadow` solo en modales y toast (lo que está "sobre" el papel): `0 8px 24px rgba(0,0,0,0.12)`. Nunca en tarjetas.
- `--accent` se reserva para: CTA primario (`btn-primary`), link activo, badge "A reembolsar", focus ring de input monto mobile.
- Estados semánticos: `--success` = "Aprobado"/"Pagado", `--warning` = "En revisión", `--error` = "Rechazado" o error de formulario, `--info` = tip.
- Sin gradientes. Sin `box-shadow` decorativos.
- **CLP sin decimales.** `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })`. Punto como separador de miles.

## Spacing
- **Base unit:** 4px.
- **Density:** cómodo-para-tabla (44px row height, 16px gutter interno).
- **Scale:**
  | Token | Value | Uso |
  |---|---|---|
  | 2xs | 2px | micro gaps |
  | xs | 4px | icon padding |
  | sm | 8px | tight stack |
  | md | 12px | table cell padding-y |
  | base | 16px | table cell padding-x, default stack |
  | lg | 24px | section padding, kpi gap |
  | xl | 32px | section margin, dashboard padding |
  | 2xl | 48px | dashboard kpi grid gap |
  | 3xl | 64px | section break |
  | 4xl | 80–96px | hero padding |

## Layout
- **Approach:** composition-first, not component-first. **Mobile-first** — write the mobile experience first, enhance for desktop with `@media (min-width)`.
- **Default (mobile, 360px+):** one column. Header 48px. Sticky filter chip at top. Card list. FAB fixed bottom-right (safe-area aware). Sticky bottom CTA en forms. Sin horizontal scroll.
- **Tablet (md, 640px+):** 2-column KPI strip. Card list más denso.
- **Desktop (lg, 1024px+):** 12-column grid. Header 56px. 2-column KPI strip con 48px gap. Tabla densa (12-15 rows visible en 900px alto). Sin sidebar.
- **Wide (xl, 1280px+):** max content width 1200px. Dashboard usa 100% del ancho disponible.
- **Header:** sticky top, full-width. Logo izquierda, nav centro, acciones + user derecha en desktop. Logo + overflow menu (3 puntos) en mobile.
- **KPI strip:** debajo del header, 1 columna en mobile, 2 columnas (1fr 1fr, 48px gap) en tablet+. Sin cards decorativas, sin chart.
- **Tabla vs card list:** misma data, distinta presentación. Mobile = card list. Tablet = card list más denso. Desktop = tabla (44px row, 12-15 filas en 900px).
  - Card list: 16px padding, 1px border-bottom, active state `--surface-2`. Sin zebra. Sin ellipsis ciego.
  - Tabla: header sticky, `border-bottom: 1px solid var(--border-strong)`, hover `--surface-2`. Sin zebra. Row de 44px.
- **Breakpoints (min-width queries):**
  - `@media (min-width: 640px)` — md
  - `@media (min-width: 1024px)` — lg
  - `@media (min-width: 1280px)` — xl
- **Touch targets:** 44x44px mínimo en TODOS los breakpoints. Los inputs de filtro en mobile usan este mínimo aunque visualmente sean más bajos.
- **Max content width:** 1200px desktop container. Dashboard usa 100% del ancho disponible.
- **Border radius:**
  | Token | Value | Uso |
  |---|---|---|
  | none | 0 | default — botones, badges, inputs, table, cards |
  | sm | 2px | inputs en mobile (touch target) |
  | full | 9999px | FAB, avatares |

## Motion
- **Approach:** minimal-funcional. El movimiento es señal, no decoración. Casi todo quieto.
- **Anima:**
  - Toast "Gasto guardado" — slide-in desde abajo 200ms ease-out, auto-dismiss 3s.
  - Botón `+` cuando hay foto cargada — pulse scale 1 → 1.04 → 1, 300ms.
  - Contador de KPI cuando carga el dashboard — count 0 → value, 700ms ease-out, sólo en mount.
- **No anima:** transiciones de página, hover de fila (cambio de color instantáneo), modales (fade 120ms, sin slide), dropdowns.
- **Easing:**
  - enter: `cubic-bezier(0.2, 0, 0, 1)` (decelerate).
  - exit: `cubic-bezier(0.4, 0, 1, 1)` (accelerate).
  - Nunca `ease-in-out` simétrico.
- **Duration:** micro 50-100ms, short 200-300ms, medium 400ms, long 700ms (sólo contador KPI).
- **`prefers-reduced-motion: reduce`** — corta a 0ms, mantiene sólo cambio de color.
- Sin parallax. Sin scroll-jacking. Sin `view-transitions` API.

## Componentes clave
- **Botones:** rectangulares, sin sombra. Primary = `--accent` sólido sobre blanco. Secondary = `--ink` sólido. Ghost = transparente, border transparente, hover `--surface-2`.
- **Badges de estado:** rectangulares, 1px border del color semántico, padding 3px 10px, font 12px medium. "A reembolsar" usa `--accent-soft` + border accent.
- **Inputs:** rectangulares, 1px border `--border`, focus = border `--ink` (desktop) o `--accent` (mobile monto). Sin border-radius.
- **Alerts:** 1px border del color semántico, padding 12px 16px, font 14px. Error usa `--accent-soft` de fondo.
- **Tabla:** 1px border bottom en cada row, header con `border-bottom: 1px solid var(--border-strong)`, uppercase 11px labels. Hover row = `--surface-2`. Sin sombras.

## Decisiones explícitas (lo que NO se hace)
1. **No sidebar en ningún breakpoint.** Header sticky top, full-width. Libera 100% del viewport para la tabla (desktop) y para el card list + preview de foto (mobile). Settings / Ayuda / Reports van al overflow menu en mobile, o quedan en el header nav en desktop.
2. **No dashboard de "resumen bonito"** (4 KPI cards + chart). El primer viewport ES la lista — card list en mobile, table en desktop. KPIs como una línea de display serif. Counter de 0 a valor (700ms) da el "punch" que un chart no da.
3. **Acento rojo `--accent` en vez de azul corporativo.** Holded=azul, Spendesk=púrpura, Clara=verde. Casi nadie usa rojo en fintech. Se siente "sello contable", no "fintech genérica". Funciona igual de bien en mobile y desktop.
4. **CLP sin símbolo `$` en la tabla.** En KPIs y en el campo monto mobile, sí. En tabla densa desktop, sólo el número (`$ 45.000` con espacio) para alinear columnas. En card list mobile, sí lleva el símbolo.
5. **Form de gasto en una pantalla, no wizard multi-step.** Mobile: scroll vertical con sticky bottom CTA. Desktop: misma forma sin sticky bottom. El `+` flotante en mobile dispara cámara nativa (`capture="environment"`). En desktop, el botón "Guardar gasto" está al final del form.
6. **Mobile-first CSS.** `@media (min-width)` desde 360px hacia arriba. Sin hover. Touch targets 44x44. Body mínimo 16px. Safe area insets. Sin doble-tap zoom en botones. Pinch-zoom permitido sólo en el preview de la foto.
7. **Sin gráficos en ninguna vista.** Mobile y desktop usan la misma lista. Sin chart de torta, sin línea de tendencia, sin "insights". Si en el futuro el admin pide análisis, va a una vista dedicada `/reports`, no al dashboard.
8. **Sin emojis en UI.** Sin menciones a IA/Claude en artefactos.

## Cómo implementar
- **CSS mobile-first:** variables en `:root` y `[data-theme="dark"]`. Un solo CSS file global (`src/styles/tokens.css`) importado en `index.astro`. Los componentes usan `var(--*)` directamente, no valores hardcoded. Escribir CSS base = mobile (360px+), enhance con `@media (min-width: 640px|1024px|1280px)`.
- **Viewport meta:** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` y `<meta name="theme-color" content="#F4F1EA">` (light) / `#1A1A1A` (dark).
- **Safe area:** en el root layout, `padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0` en el body. FAB y sticky CTAs respetan `env(safe-area-inset-bottom)`.
- **Touch targets:** usar `min-height: 44px; min-width: 44px` en todo `<button>`, `<a>`, `<select>`, `<input>`, y rows de la card list. Aunque visualmente el botón sea más chico, el área de tap es 44.
- **Touch action:** `touch-action: manipulation` en botones y links (sin double-tap zoom). `touch-action: pinch-zoom` en el preview de imagen de recibo.
- **Fuentes:** `<link>` en `index.astro` con `preconnect` a Google Fonts. Aplicar `font-family` por rol en CSS, no inline.
- **CLP formatter:** helper en `src/lib/format.ts` con `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })`. Para la tabla densa, format sin símbolo (`$ 45.000` con espacio) usando una variante.
- **Tema toggle:** atributo `data-theme` en `<html>`, persistido en `localStorage`. Default: light. Respetar `prefers-color-scheme` en la primera carga.
- **No usar:** Tailwind, CSS-in-JS, class framework, border-radius uniforme, sombras en tarjetas, gradientes, `:hover` para funcionalidad crítica (sólo para enhancement visual, no para mostrar/ocultar).

## Decisions Log
| Date | Decision | Rationale |
|---|---|---|
| 2026-06-14 | Initial design system | Creado por `/design-consultation`. Direction: oficinesco contable (Fraunces + IBM Plex + papel mate + acento rojo). Tres departures: no sidebar, tabla como front door, acento rojo. Notable change vs category baseline: Pleo usa custom sans + B/W restraint, Expensify usa custom serif + dark green + cream. xpns toma Pleo restraint + Expensify serif pero con paleta papel + tinta propia. |
