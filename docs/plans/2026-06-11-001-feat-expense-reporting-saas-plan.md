---
title: "feat: Expense Reporting SaaS — v1"
date: 2026-06-11
type: feat
depth: standard
status: draft
---

# feat: Expense Reporting SaaS — v1

**Summary:** PWA multi-tenant SaaS para que empleados rindan gastos (almuerzo, hotel, transporte, etc.) y los admins/empleadores vean KPIs, filtren y exporten. v1 sin flujo de aprobación ni OCR.

**Stack:** Astro + Preact + `@vite-pwa/astro` → Firebase Hosting · Firestore · Auth · Storage · Cloud Functions

---

## Problem Frame

Empleados que viajan o tienen gastos operativos necesitan un canal simple para rendir comprobantes. Los empleadores necesitan visibilidad consolidada: cuánto deben reembolsar, a quién, por qué período.

**Fuera de v1:**
- Flujo de aprobación manager → empleado (v2, configurable)
- OCR / scan de comprobantes (v2/v3)
- Compresión de imágenes al subir (v2/v3)
- App nativa iOS/Android
- Integraciones contables (ERP, SAP)

---

## Requirements

| ID | Requirement |
|----|-------------|
| R1 | Empresa se registra self-service; recibe acceso admin |
| R2 | Admin envía invite links para que empleados se auto-registren |
| R3 | Empleado carga gasto: monto, moneda (dropdown ISO 4217), categoría, descripción, foto comprobante |
| R4 | Multi-moneda desde v1 — cada gasto guarda su moneda original |
| R5 | Admin ve dashboard con KPIs: total a pagar (todos), total a pagar por empleado |
| R6 | Admin filtra gastos: por período, empleado, categoría, estado |
| R7 | Admin exporta gastos filtrados a CSV |
| R8 | Multi-tenant: datos de cada empresa completamente aislados |
| R9 | PWA instalable en mobile + caching de assets |
| R10 | Estado simple de gasto: `pending` / `paid` (admin marca como pagado) |

---

## Key Technical Decisions

**KTD-1: Firestore path jerárquico bajo `orgs/{orgId}`**
Toda la data de un tenant vive bajo `orgs/{orgId}/...`. Las security rules scoped por `orgId` desde un custom claim en el JWT. Alternativa rechazada: colección flat con campo `orgId` — más difícil de securizar con rules y sin ventaja de performance a esta escala.

**KTD-2: Custom claims Firebase Auth para `orgId` + `role`**
Al crear/unirse a una org, una Cloud Function setea `{ orgId, role: 'admin'|'employee' }` como custom claims. Rules leen `request.auth.token.orgId` — sin round-trip a Firestore en cada operación. Trade-off: claims requieren refresh de token para propagarse (~1 min); aceptable para onboarding.

**KTD-3: `@vite-pwa/astro` para PWA**
Primer uso en este monorepo. Los proyectos existentes usan `vite-plugin-pwa` con React. La integración Astro es un wrapper oficial del mismo Workbox — misma configuración `manifest.json` + workbox, diferente plugin import. Patrón de manifest e iconos directamente portables desde `revive-hogar`.

**KTD-4: Firebase singleton lazy (Astro-safe)**
Astro ejecuta código en SSR y en cliente. `initializeApp()` en top-level de módulo rompe SSR. Patrón: lazy getters (`getFirestoreDb()`, `getAuth()`, etc.) con guard `typeof window !== 'undefined'` donde aplique. Patrón ya validado en `sg-cloud-workspace/astro-sg-cloud/src/lib/firebase.ts`.

**KTD-5: KPIs calculados en cliente con agregación Firestore**
Total a pagar = query `expenses where status == 'pending'`, sum en cliente. A escala v1 (< 10k expenses/org) es aceptable. Si escala: Cloud Function con contadores agregados. No se pre-optimiza.

**KTD-6: Monedas — almacenar código ISO 4217, mostrar con `Intl.NumberFormat`**
Cada gasto guarda `currency: "USD" | "CLP" | "EUR" | ...`. No hay conversión de tipo de cambio — cada gasto se muestra en su moneda original. Admin ve totales agrupados por moneda cuando hay mix.

---

## High-Level Technical Design

### Flujo principal

```
Empresa (self-service) → crea org en Firestore → Cloud Fn setea custom claim admin
Admin → genera invite token → URL /join?token=xxx
Empleado → abre link → crea cuenta → Cloud Fn valida token + setea claim employee
Empleado → carga gasto → form → Storage (foto) + Firestore (expense doc)
Admin → dashboard → Firestore query (orgs/{orgId}/expenses) → KPIs + tabla + export CSV
```

### Firestore schema

```
orgs/{orgId}
  name, ownerEmail, plan, createdAt, defaultCurrency

orgs/{orgId}/members/{uid}
  email, displayName, role: 'admin'|'employee', status: 'active'|'invited', createdAt

orgs/{orgId}/invites/{token}
  email?, createdAt, expiresAt, usedAt?, usedBy?

orgs/{orgId}/expenses/{expenseId}
  submittedBy: uid
  submitterName: string      # desnormalizado para queries rápidas
  amount: number
  currency: string           # ISO 4217
  category: ExpenseCategory  # enum
  description: string
  receiptStoragePath: string # path en Cloud Storage
  status: 'pending'|'paid'
  date: Timestamp            # fecha del gasto (no de creación)
  createdAt: Timestamp
  paidAt?: Timestamp
```

### Security rules — estructura clave

```
match /orgs/{orgId} {
  allow read: if request.auth.token.orgId == orgId;
  allow create: if request.auth != null;  // self-service registration

  match /expenses/{expenseId} {
    // empleado solo ve/crea los suyos; admin ve todos
    allow read: if request.auth.token.orgId == orgId
                && (request.auth.token.role == 'admin'
                    || resource.data.submittedBy == request.auth.uid);
    allow create: if request.auth.token.orgId == orgId;
    allow update: if request.auth.token.role == 'admin'
                  && request.auth.token.orgId == orgId;
  }

  match /invites/{token} {
    allow read: if request.auth != null;  // cualquiera autenticado puede leer para join
    allow write: if request.auth.token.role == 'admin'
                 && request.auth.token.orgId == orgId;
  }
}
```

### Cloud Storage paths

```
orgs/{orgId}/receipts/{expenseId}/{filename}
```
Storage rules: write solo si `request.auth.token.orgId == orgId`; read idem.

---

## Output Structure

```
expense-app/                        # nuevo proyecto (dentro de /cgl o standalone)
├── astro.config.mjs
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── .env.example
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── lib/
│   │   ├── firebase.ts             # lazy singleton getters
│   │   └── currencies.ts           # lista ISO 4217 para dropdown
│   ├── types/
│   │   └── models.ts               # interfaces Org, Member, Expense, Invite
│   ├── pages/
│   │   ├── index.astro             # landing / login redirect
│   │   ├── register.astro          # registro empresa
│   │   ├── login.astro
│   │   ├── join.astro              # empleado self-onboard via token
│   │   ├── dashboard/
│   │   │   ├── index.astro         # admin dashboard (KPIs + tabla)
│   │   │   └── expenses/
│   │   │       └── new.astro       # empleado — nuevo gasto
│   │   └── 404.astro
│   ├── components/
│   │   ├── auth/
│   │   ├── expenses/
│   │   │   ├── ExpenseForm.tsx     # Preact island
│   │   │   └── ExpenseList.tsx     # Preact island
│   │   └── dashboard/
│   │       ├── KpiCards.tsx        # Preact island
│   │       └── ExportButton.tsx    # Preact island
│   └── hooks/
│       ├── useAuth.ts
│       ├── useExpenses.ts
│       └── useOrgMembers.ts
└── functions/
    ├── src/
    │   ├── setOrgClaims.ts
    │   ├── processInvite.ts
    │   └── index.ts
    └── package.json
```

---

## Implementation Units

### U1. Project Scaffold + Firebase Config + PWA

**Goal:** Repo listo para desarrollar: Astro + Preact + vite-pwa/astro configurado, Firebase project wired (config, emulators, hosting), variables de entorno, CI básico.

**Requirements:** base para R8, R9

**Dependencies:** ninguna

**Files:**
- `expense-app/astro.config.mjs`
- `expense-app/src/lib/firebase.ts`
- `expense-app/firebase.json`
- `expense-app/.env.example`
- `expense-app/public/manifest.json`
- `expense-app/firestore.rules` (skeleton)
- `expense-app/storage.rules` (skeleton)

**Approach:**
- **Scaffold completo desde cero** — `xpns/` solo tiene `docs/` hoy; U1 crea todo (package.json, configs, Firebase wiring)
- Init Astro con output `static` (SPA con SPA rewrite en firebase.json — Firebase Hosting sirve solo archivos estáticos; output:hybrid requiere un SSR adapter + Cloud Function que no existe)
- `@vite-pwa/astro` con `registerType: 'autoUpdate'`, workbox globPatterns en `dist/**`
- Firebase config con patrón `PUBLIC_FIREBASE_*` + lazy getters (portar de `sg-cloud-workspace/astro-sg-cloud/src/lib/firebase.ts`)
- `firebase.json`: hosting `dist/`, SPA rewrite `** → /index.html`, emulators en 9099/8080/9199/5001
- Emulator gate: `PUBLIC_ENV=dev` activa `connectFirestoreEmulator` etc.
- Referencia de estructura: `solaris-innovations/` para firebase.json, `functions/package.json` (firebase-admin ^13, firebase-functions ^6), tsconfig

**Patterns to follow:**
- `sg-cloud-workspace/astro-sg-cloud/src/lib/firebase.ts` — Astro-safe lazy getters
- `revive-hogar/firebase.json` — emulator config completo
- `bin-tracker/public/` — PWA icons + manifest structure

**Test scenarios:**
- `pnpm dev` levanta sin errores, Firebase emulators conectados
- PWA manifest accesible en `/manifest.json` con `name`, `start_url`, `icons`
- Lighthouse PWA score >= 90 en build de producción
- `PUBLIC_ENV=prod` no conecta emulators

**Verification:** `pnpm build` sin errores, Lighthouse PWA check pasa, Firebase emulators responden en puertos esperados.

---

### U2. Multi-tenant Data Model + Types + Security Rules

**Goal:** Esquema Firestore completo, tipos TypeScript, rules de seguridad y indexes que soporten todo v1.

**Requirements:** R4, R8

**Dependencies:** U1

**Files:**
- `expense-app/src/types/models.ts`
- `expense-app/firestore.rules`
- `expense-app/storage.rules`
- `expense-app/firestore.indexes.json`

**Approach:**
- `models.ts`: interfaces `Org`, `OrgMember`, `Invite`, `Expense`; enum `ExpenseCategory` (Food, Lodging, Transport, Entertainment, Other); enum `ExpenseStatus`
- Rules: match `orgs/{orgId}` con `request.auth.token.orgId == orgId` (ver esquema en HTD)
- Index compuesto en expenses: `(orgId path, submittedBy ASC, date DESC)` y `(orgId path, status ASC, date DESC)`
- `Expense` tiene `submitterName` desnormalizado para evitar joins en dashboard query

**Technical design (directional):**
```ts
// Directional — no copiar literal
interface Expense {
  id?: string
  submittedBy: string        // uid
  submitterName: string
  amount: number
  currency: string           // 'CLP' | 'USD' | 'EUR' | ...
  category: ExpenseCategory
  description: string
  receiptStoragePath: string
  status: 'pending' | 'paid'
  date: Timestamp
  createdAt: Timestamp
  paidAt?: Timestamp
}
```

**Patterns to follow:**
- `revive-hogar/src/types/models.ts` — `id?: string` optional, `Omit<T,'id'>` en writes

**Test scenarios:**
- Rules: empleado A no puede leer expenses de empleado B (mismo org)
- Rules: empleado no puede leer expenses de otra org
- Rules: admin puede leer todos los expenses de su org
- Rules: solo admin puede marcar expense como `paid`
- Rules: invite token readable por cualquier user autenticado (para join flow)
- Storage rules: empleado solo puede subir a `orgs/{su-orgId}/receipts/...`
- TypeScript: `Omit<Expense, 'id' | 'createdAt'>` es el tipo de write sin error

**Verification:** `firebase emulators:exec` con test suite de rules pasa todos los casos.

---

### U3. Auth + Company Registration + Employee Self-Onboard

**Goal:** Empresa se registra (crea org + admin), admin genera invite links, empleados se unen via link y quedan con custom claims correctos.

**Requirements:** R1, R2, R8

**Dependencies:** U1, U2

**Files:**
- `expense-app/src/pages/register.astro`
- `expense-app/src/pages/login.astro`
- `expense-app/src/pages/join.astro`
- `expense-app/src/components/auth/RegisterForm.tsx`
- `expense-app/src/components/auth/LoginForm.tsx`
- `expense-app/src/components/auth/JoinForm.tsx`
- `expense-app/src/hooks/useAuth.ts`
- `expense-app/functions/src/setOrgClaims.ts`
- `expense-app/functions/src/processInvite.ts`

**Approach:**
- **Register:** formulario (nombre empresa, email, password) → Firebase Auth `createUserWithEmailAndPassword` → crear doc `orgs/{orgId}` + `orgs/{orgId}/members/{uid}` → trigger Cloud Fn `setOrgClaims` que llama `admin.auth().setCustomUserClaims(uid, { orgId, role: 'admin' })` → forzar refresh de token → redirect a dashboard
- **Invite link:** admin genera token (nanoid) → crea `orgs/{orgId}/invites/{token}` con `expiresAt = +7 días` → URL `https://app.com/join?token=xxx&org=orgId` copiable
- **Join flow:** `/join?token=xxx&org=orgId` → usuario crea cuenta → Cloud Fn `processInvite` valida token (no expirado, no usado) → setea claims `{ orgId, role: 'employee' }` → marca invite `usedAt`, `usedBy` → redirect a `/dashboard/expenses/new`
- Auth state: `useAuth()` hook con `onAuthStateChanged` + `getIdTokenResult()` para leer claims; persiste en `@preact/signals` global

**Patterns to follow:**
- `lego-app/lib/firebase/auth.ts` — funciones named async para auth operations
- `revive-hogar/src/firebase/config.ts` — emulator-aware setup

**Test scenarios:**
- Registro empresa: doc `orgs/{id}` creado con datos correctos
- Registro empresa: custom claim `role: 'admin'` seteado (verificable con `getIdTokenResult`)
- Invite link expirado (> 7 días): join rechazado con mensaje claro
- Invite link ya usado: join rechazado
- Join exitoso: claim `role: 'employee'` + `orgId` correcto seteados
- Join exitoso: `invites/{token}` marcado con `usedAt`
- Login con credenciales incorrectas: mensaje de error no expone si email existe
- Redirect guard: `/dashboard` sin auth → `/login`

**Verification:** flujo end-to-end manual en emulators: registrar empresa, generar invite, abrir link en incógnito, verificar claims en Firebase console emulator.

---

### U4. Expense Submission — Employee Flow

**Goal:** Empleado carga un gasto con todos sus datos + foto de comprobante y queda guardado en Firestore.

**Requirements:** R3, R4

**Dependencies:** U1, U2, U3

**Files:**
- `expense-app/src/pages/dashboard/expenses/new.astro`
- `expense-app/src/components/expenses/ExpenseForm.tsx` (incluye lista ISO 4217 y `Intl.NumberFormat` inline; extraer a `currencies.ts` solo si U5 también necesita el mismo formatting)
- `expense-app/src/hooks/useExpenses.ts`

**Approach:**
- Formulario Preact (`client:load`): fecha del gasto, monto (número), moneda (select con lista ISO 4217 filtrada a las ~20 más comunes + search), categoría (select con `ExpenseCategory`), descripción (textarea), foto (input file → preview inmediato)
- Upload foto: `uploadBytesResumable` a `orgs/{orgId}/receipts/{expenseId}/{filename}` → barra de progreso → al completar, guarda `receiptStoragePath` en el doc
- Submit: crea doc en `orgs/{orgId}/expenses/` con `addDoc` + `serverTimestamp()` para `createdAt`; `submitterName` desnormalizado del profile del user (evita join)
- Validación client-side: monto > 0, moneda seleccionada, categoría seleccionada, fecha no futura
- Estado optimista: form se limpia y muestra confirmación antes de que Firestore confirme

**Patterns to follow:**
- `revive-hogar/src/types/models.ts` — `Omit<T, 'id'>` en writes
- PWA: form funciona en mobile browser (touch-friendly inputs, foto desde cámara via `capture="environment"`)

**Test scenarios:**
- Submit con todos los campos válidos → doc creado en Firestore con campos correctos
- `submittedBy` es el uid del usuario autenticado (no manipulable desde cliente — rules validan)
- `submitterName` coincide con displayName del user
- Upload foto: `receiptStoragePath` en doc apunta a archivo real en Storage
- Monto 0 o negativo → error de validación, no envía
- Fecha futura → error de validación
- Submit sin foto → error (foto requerida en v1)
- Empleado de org A no puede crear expense con `orgId` de org B (verificado por rules)
- Form usable en mobile (iPhone Safari, Android Chrome): input `date`, `number`, `file` con `capture`

**Verification:** empleado en emulator puede enviar gasto completo; doc aparece en Firestore console; foto visible en Storage console.

---

### U5. Admin Dashboard — KPIs + Tabla + Export

**Goal:** Admin ve totales a pagar (global y por empleado), lista filtrable de gastos, puede marcar como pagados y exportar CSV.

**Requirements:** R5, R6, R7, R10

**Dependencies:** U1, U2, U3, U4

**Files:**
- `expense-app/src/pages/dashboard/index.astro`
- `expense-app/src/components/dashboard/KpiCards.tsx`
- `expense-app/src/components/dashboard/ExpenseTable.tsx`
- `expense-app/src/components/dashboard/ExportButton.tsx`
- `expense-app/src/hooks/useExpenses.ts` (ampliar)
- `expense-app/src/hooks/useOrgMembers.ts`

**Approach:**
- Query base: `collection(db, 'orgs', orgId, 'expenses')` con filtros reactivos via `@preact/signals`: dateRange, memberId, category, status
- KPI cards (calculados en cliente sobre query result):
  - `Total pendiente`: suma de `amount` por `currency` donde `status == 'pending'` — si hay mix de monedas, mostrar desglosado por moneda (e.g. "CLP 450.000 · USD 120")
  - `Por empleado`: agrupar `pending` expenses por `submittedBy`, sumar por moneda, listar top N con nombre
- Tabla: columnas — fecha, empleado, categoría, descripción, monto+moneda, estado, acciones
- Acción "Marcar pagado": `updateDoc` → `status: 'paid'`, `paidAt: serverTimestamp()`; solo visible para admin (rol en claims)
- Export CSV: generar en cliente con los datos filtrados actuales → `Blob` → descarga via `<a download>`; columnas: fecha, empleado, categoría, descripción, monto, moneda, estado
- Paginación: Firestore cursor-based (`startAfter`) si resultados > 100; en v1 cargar primero 100 ordenados por `date DESC`

**Technical design (directional):**
```
// KPI aggregation — directional
const pendingExpenses = expenses.filter(e => e.status === 'pending')
const totalByCurrency = groupBy(pendingExpenses, e => e.currency)
                          .map(([currency, items]) => ({
                            currency,
                            total: sum(items, e => e.amount)
                          }))

const byEmployee = groupBy(pendingExpenses, e => e.submittedBy)
                    .map(([uid, items]) => ({
                      name: items[0].submitterName,
                      totals: groupBy(items, e => e.currency)...
                    }))
```

**Patterns to follow:**
- KPI card style: referencia visual de `solaris-innovations` dashboard
- Firestore cursor pagination: patrón de `stockFlow-wms`

**Test scenarios:**
- Sin gastos pendientes: KPIs muestran cero, sin errores
- Mix de monedas: KPI muestra desglose por moneda, no suma incompatible
- Filtro por período: solo gastos en rango aparecen en tabla Y en KPIs
- Filtro por empleado: KPIs se actualizan con el filtro aplicado
- "Marcar pagado": doc en Firestore cambia a `status: 'paid'`, KPI se actualiza reactivamente
- Empleado (no admin) accede a `/dashboard` → redirigido o ve solo sus propios gastos (UI diferenciada)
- Export CSV con filtros aplicados: archivo descargado contiene exactamente los rows visibles
- Export CSV vacío (0 resultados): se descarga archivo con solo headers, sin error
- Admin de org A no ve gastos de org B (rules + claim `orgId`)

**Verification:** Admin en emulators con 3+ empleados y gastos en 2 monedas: KPIs correctos, filtros funcionan, export CSV abre en Excel/Sheets con datos correctos.

---

## Scope Boundaries

### In Scope (v1)
- PWA instalable (no nativa)
- Multi-tenant con aislamiento por `orgId`
- Self-service empresa + invite de empleados
- Carga de gastos con foto comprobante
- Multi-moneda (sin conversión de tipo de cambio)
- Dashboard admin con KPIs + filtros + export CSV
- Estado simple: `pending` / `paid`

### Deferred to Follow-Up Work
- Flujo de aprobación manager (v2) — configuración por empresa
- OCR / scan automático de comprobante (v2/v3)
- Compresión de imagen al subir (v2/v3)
- Notificaciones email (recordatorio, confirmación de pago)
- Conversión de tipo de cambio (tasas en tiempo real)
- Paginación avanzada / scroll infinito (post-v1 cuando haya volumen)
- Reportes gráficos (charts por categoría, trending)
- App nativa iOS/Android

### Outside Scope (no es este producto)
- Contabilidad / integración ERP
- Nómina / payroll
- Gestión de viáticos con presupuesto pre-aprobado

---

## Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | ¿Email/password como único método de auth, o también Google OAuth? | Carlos | Decide antes de U3 |
| 2 | ¿El invite link es para un email específico o cualquiera que tenga el link? | Carlos | Decide antes de U3 |
| 3 | ¿La foto de comprobante es obligatoria en v1? | Carlos | Asumido obligatoria; confirmar |
| 4 | ¿Nombre del proyecto/repo para la nueva app? | Carlos | Antes de U1 |
| 5 | ¿Qué monedas incluir en el dropdown? (top 20 globales vs. foco LATAM) | Carlos | Decide antes de U4 |

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Custom claims tardan ~1 min en propagarse — el usuario recién registrado no tiene claims inmediatamente | Alto | Medio | Forzar `getIdToken(true)` (refresh) después de que Cloud Fn confirme; mostrar spinner "activando cuenta" |
| `@vite-pwa/astro` es plugin relativamente nuevo — posibles bugs con Astro output `hybrid` | Medio | Medio | Pin de versión; fallback a `output: static` si SSR causa problemas con service worker |
| Firestore queries sin index compuesto lanzan error silencioso en dev | Alto | Bajo | Definir `firestore.indexes.json` upfront en U2; probar filtros multi-campo contra emulator |
| Upload de fotos grandes (5–10MB) en mobile con 3G lento | Medio | Alto | Progress bar + retry en U4; compresión diferida a v2 |
| KPI aggregation en cliente se vuelve lenta con > 500 expenses por org | Bajo | Medio | Aceptable en v1; agregar Cloud Fn aggregator en v2 si mide lento |

---

## Sources & Research

- Patrón Firebase lazy singleton (Astro-safe): `sg-cloud-workspace/astro-sg-cloud/src/lib/firebase.ts`
- Firebase config con emulators: `revive-hogar/src/firebase/config.ts`
- PWA manifest + VitePWA: `bin-tracker`, `qr-transfer`, `revive-hogar`
- Auth service layer: `lego-app/lib/firebase/auth.ts`
- Firestore typed models: `revive-hogar/src/types/models.ts`
- `firebase.json` completo: `revive-hogar/firebase.json`
