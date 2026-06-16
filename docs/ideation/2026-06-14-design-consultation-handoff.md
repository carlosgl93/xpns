---
description: Handoff para que el próximo agente corra /design-consultation sobre xpns con contexto completo
metadata:
  type: handoff
  date: 2026-06-14
  branch: feat/data-model-security-rules
  head: 98b894f
  status: ready
---

# Handoff — `/design-consultation` para xpns

Branch listo para merge (smoke pasó, indexes deployed a `qr-transfers`). El próximo agente corre `/design-consultation` desde acá.

## Producto

- **xpns:** SaaS de rendición de gastos para SMBs (Chile, expansión LATAM)
- **Usuarios:** empleados (suman gastos con foto) + admins (aprueban, reembolsan, exportan)
- **Categoría:** fintech / expense management — peers para research: Expensify, Spendesk, Pleo, Holded, Clara
- **Etapa:** pre-launch, sin usuarios productivos
- **Idioma:** español (es-CL, currency CLP)

## Stack (no obvio, importante)

- **Astro 6** (no Next/Remix) + **Preact 10** (no React) + `@preact/signals`
- Vite PWA habilitado
- Firebase: Auth, Firestore, Storage, Cloud Functions (2 fns: `processInvite`, `setOrgClaims`)
- TypeScript strict, pnpm only
- **Sin framework de CSS** — `grep` por tailwind / css modules / styled-components / className → 0 hits

## Estado del diseño: lienzo en blanco

- No existe `DESIGN.md` ni `design-system.md`
- No existe `src/styles/`, no hay CSS global, `index.astro` es todavía el template default de Astro (`<h1>Astro</h1>`)
- Componentes son HTML semántico puro (`<section>`, `<div>`, `<h2>`, `<ul>`, `<strong>`) con defaults del browser
- **No hay que migrar nada. Oportunidad de definir sistema desde cero.**

## Superficies existentes (lo que el diseño debe vestir)

- **Auth:** `LoginForm`, `RegisterForm`, `JoinForm` (untracked `DashboardHeader`)
- **Dashboard admin:** `AdminDashboard`, `KpiCards`, `ExpenseTable`, `ExportButton`, `InviteForm`
- **Expenses:** `ExpenseForm` (con upload de foto — flujo mobile crítico)
- **Pages:** `/`, `/login`, `/register`, `/join`, `/dashboard`, `/dashboard/expenses/new`

## Feature recién mergeada que el diseño debe acomodar

Diff `feat/data-model-security-rules` (e7c2718..98b894f, 21 commits, P0 verified, smoke passed):

- **`paymentSource` enum** (efectivo / tarjeta personal / tarjeta corporativa / transferencia / otro) — el dato nuevo
- **KPI split:** "A reembolsar" (tarjeta personal + efectivo) vs "Saldo tarjeta corporativa usado" (tarjeta corporativa). Dos secciones en `KpiCards` con semánticas distintas
- **Columna "Origen de pago"** en `ExpenseTable` + filtro dropdown en la filter bar
- **CSV** export incluye `origen_pago`
- **`InviteForm` admin:** genera link, copia al clipboard, confirma con `Copiado`
- **`DashboardHeader`** (untracked, user in-flight)

## Restricciones del usuario (de CLAUDE.md, no negociables)

- Idioma UI: **español**
- **Sin emojis** en UI
- **Sin menciones a IA / Claude / modelos / Anthropic** en ningún artefacto
- Caveman mode (caveman mode = estilo de chat, no UI)
- `pnpm` only, no npm/yarn
- Branch naming: sin prefijo `carlosgl93/`

## Restricciones técnicas

- `Intl.NumberFormat('es-CL', { style: 'currency' })` ya en uso — mantener locale es-CL
- Currency **CLP** (sin decimales en producción; el formatter actual puede no respetarlo — vale chequear en `KpiCards` / `ExpenseForm`)
- PWA: `manifest.webmanifest` ya en `/dashboard/` — el branding aplica también ahí
- a11y: el código usa `aria-label`, `aria-live` en algunos lugares — preservar
- **Mobile-first:** el flujo crítico del empleado es tomar foto del recibo. El diseño tiene que facilitar eso (input file, preview, upload feedback)
- Preact signals para estado (no React hooks)

## Input que el usuario DEBE dar (Phase 1 del skill)

> **"What's the one thing you want someone to remember after they see this product for the first time?"**

El skill abre con esta pregunta. Forma de respuesta: feeling, visual, claim, o posture. Sin esa respuesta la propuesta va a ser genérica. Sugerí al usuario que la piense **antes** de invocar el skill. Ejemplos para mostrar:

- Feeling: "software serio para trabajo serio"
- Visual: "el azul casi negro"
- Claim: "más rápido que cualquier otro"
- Posture: "para builders, no managers"

## Decisiones que el skill va a preguntar

- Research de competidores sí/no
- Outside voices (Codex + subagent en paralelo) sí/no
- AI mockups (Path A, requiere `~/.claude/skills/gstack/design/dist/design`) o HTML preview (Path B) — el preamble del skill chequea

## Tensiones de diseño para explorar

1. **Empleado vs admin** — dos UX muy distintas en un mismo producto. Empleado: mobile-first, "saco la foto y listo". Admin: desktop, denso, "veo todo, filtro, exporto". ¿Una estética con dos adaptaciones, o dos sub-sistemas?
2. **Fintech seria vs friendly** — Chile es mercado conservador. Restrained con un accent, o más expresivo. CLP tiene números grandes ($8.500) → typography debe tabular-nums bien
3. **Pre-launch** — libertad máxima, sin usuarios que decepcionar, pero sin caer en AI slop
4. **Mobile-first** — el flujo crítico es la foto. No enterrar el upload detrás de 3 clicks

## Anti-slop (reforzar en la propuesta)

- No Inter / Roboto / system-ui como font principal
- No gradientes púrpura como accent
- No 3-column feature grid con iconos en círculos
- No border-radius uniforme "burbuja"
- No emojis en UI (doble restricción)
- No "Built for X / Designed for Y" copy

## Archivos clave que el skill va a querer leer

| Archivo | Por qué |
|---|---|
| `src/components/dashboard/KpiCards.tsx` | 2 secciones con semánticas distintas (reembolsable vs corporativa) |
| `src/components/dashboard/ExpenseTable.tsx` | Tabla densa con columna agregada (`Origen de pago`) |
| `src/components/dashboard/InviteForm.tsx` | Form con estados (idle / loading / success / error) |
| `src/components/dashboard/AdminDashboard.tsx` | Composición gated por `isAdmin` |
| `src/components/expenses/ExpenseForm.tsx` | Flujo de upload — mobile crítico |
| `src/lib/paymentSources.ts` | Enum + labels en español, single source of truth |
| `src/lib/dashboardUtils.ts` | `groupByReimbursableByEmployee`, `groupByCorporateByEmployee`, `generateCsv` |
| `src/types/models.ts` | Modelo `Expense` con `paymentSource`, `status`, etc. |
| `docs/plans/2026-06-13-001-feat-expense-payment-source-plan.md` | R1-R8 de la feature recién mergeada |
| `docs/solutions/security-issues/expense-employee-update-receipt-storage-path-2026-06-13.md` | Contexto de la regla P0 que motivó esta rama |

## Comandos

```bash
# Branch ya pusheado a origin, listo para merge
git checkout feat/data-model-security-rules

# Dev local
pnpm dev   # astro dev (puerto variable)

# Tests frontend
pnpm test --run

# Tests Cloud Functions
cd functions && pnpm exec vitest run --run

# Emuladores Firebase
pnpm exec firebase emulators:start --project xpns-dev
```

## Memoria persistida (ya en `~/.claude/projects/-Users-consultor-cgl-xpns/memory/`)

- Firebase project ID: `qr-transfers` (no está en repo ni en `.firebaserc`)
- Vitest split: `pnpm test` = frontend, `cd functions && pnpm exec vitest run --run` = cloud fns
- Estado de diseño: lienzo en blanco (sin framework de CSS, sin design system)
