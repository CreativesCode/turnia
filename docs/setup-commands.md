# Comandos para crear el proyecto Turnia

Este documento lista los comandos necesarios para crear el proyecto **Turnia** siguiendo todos los requisitos de `indications.md`.

---

## Requisitos cubiertos

| Requisito | Stack |
|-----------|--------|
| SPA web | Next.js (App Router, TypeScript) |
| Mobile (iOS/Android) | Capacitor |
| Auth | Supabase Auth |
| Base de datos | PostgreSQL (Supabase) |
| Permisos | RLS (Row Level Security) |
| Tiempo real | Supabase Realtime |
| Lógica privilegiada | Supabase Edge Functions (TypeScript) |
| Calendario | FullCalendar / componente de calendario |
| Push notifications | Capacitor + Supabase / FCM / APNs |

---

## 1) Crear el proyecto Next.js

Desde la raíz del repo (`turnia`):

```powershell
# Crear app Next.js con TypeScript, Tailwind, ESLint, App Router
# (ejecutar en la carpeta padre o inicializar en . según prefieras)
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Al preguntar:
- **Would you like to use Turbopack?** → `No` (o `Yes` según preferencia; para Capacitor suele ser más estable sin Turbopack en dev)
- **Would you like to customize the default import alias?** → mantén `@/*` o acepta el default

Si prefieres crear en subcarpeta `app` y luego mover, o ya tienes `.` con `docs/`, puedes hacer:

```powershell
cd c:\Local-Disc-D\Project\enterpreneurship\turnia
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

*(Si `create-next-app` no permite `.` con contenido, crea `turnia-app` y luego mueve todo a la raíz.)*

---

## 2) Dependencias de frontend

```powershell
# Cliente Supabase (auth, db, realtime, storage)
npm install @supabase/supabase-js @supabase/ssr

# Calendario (vistas mes/semana/día)
npm install @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/list @fullcalendar/interaction

# Capacitor (core + plugins para iOS/Android, push, storage)
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/push-notifications
npm install @capacitor/preferences
# Opcional: deep links
npm install @capacitor/app
```

---

## 3) Inicializar Capacitor

```powershell
# Añadir plataformas nativas (ejecutar después de tener un build)
npx cap init "Turnia" "com.turnia.app"
```

Después del primer `npm run build`:

```powershell
npm run build
npx cap add ios
npx cap add android
```

Configurar `capacitor.config.ts` para que `webDir` apunte a la salida de Next.js, por ejemplo:

```ts
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.turnia.app',
  appName: 'Turnia',
  webDir: 'out',           // si usas output: 'export' en next.config
  // O 'dist' si usas otro sistema. Para Next.js estándar suele ser .next o out.
  server: {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};
```

Para SPA/export estático con Next.js, en `next.config.*`:

```js
// next.config.js o next.config.mjs
const nextConfig = {
  output: 'export',
  // ...resto
};
```

Entonces `webDir` en Capacitor = `out`. Si no usas `output: 'export'`, en desarrollo puedes usar `server.url` apuntando a `http://localhost:3000`.

---

## 4) Supabase

### 4.1 Proyecto Supabase (consola)

1. [Supabase](https://supabase.com) → New project.
2. Anota: **Project URL**, **anon key**, **service_role key** (solo backend/Edge Functions).

### 4.2 Variables de entorno

Crear `.env.local` en la raíz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<TU_PROYECTO>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<TU_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

### 4.3 Cli de Supabase (opcional, recomendado para migraciones y Edge Functions)

```powershell
# Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# Login
supabase login

# Inicializar Supabase en el repo (crea carpeta supabase/)
supabase init

# Enlazar al proyecto (reemplaza <PROJECT_REF> con el id de tu proyecto)
supabase link --project-ref <PROJECT_REF>
```

### 4.4 Edge Functions (TypeScript)

Las Edge Functions van en `supabase/functions/`. Crear al menos:

- `approve-request` – aprobar/rechazar solicitudes, transacciones, notificaciones.
- `send-notification` – enviar push/email (o invocada desde `approve-request`).
- (Opcional) `export-schedule` – generación de CSV/Excel.

```powershell
# Crear funciones (ejemplo)
supabase functions new approve-request
supabase functions new send-notification
supabase functions new export-schedule
```

Implementar en TypeScript; usar `Deno` y el cliente de Supabase con `SUPABASE_SERVICE_ROLE_KEY` para operaciones privilegiadas.

---

## 5) Estructura de carpetas sugerida

```
turnia/
├── src/
│   ├── app/
│   │   ├── (auth)/           # login, recuperar contraseña
│   │   ├── (dashboard)/      # rutas con layout según rol
│   │   │   ├── admin/        # Org Admin, Superadmin
│   │   │   ├── manager/      # Team Manager
│   │   │   ├── staff/        # User: mis turnos, equipo, solicitudes
│   │   │   └── viewer/       # solo lectura
│   │   ├── api/               # Route Handlers si hace falta
│   │   └── layout.tsx
│   ├── components/
│   │   ├── calendar/
│   │   ├── shifts/
│   │   ├── requests/
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   └── rbac.ts           # helpers de roles/permisos
│   └── types/
├── supabase/
│   ├── migrations/           # DDL: orgs, teams, users, memberships, shifts, requests, audit_log
│   └── functions/
│       ├── approve-request/
│       ├── send-notification/
│       └── export-schedule/
├── docs/
├── capacitor.config.ts
├── next.config.ts
└── package.json
```

---

## 6) Migraciones SQL (resumen de entidades)

Las tablas deben reflejar: **Organization**, **Team**, **User** (auth.users + `profiles`), **Membership** (org/team, rol), **Shift**, **ShiftRequest**, **AvailabilityEvent**, **AuditLog**.

Ejemplo de creación de la primera migración:

```powershell
supabase migration new create_core_tables
```

Luego editar `supabase/migrations/YYYYMMDDHHMMSS_create_core_tables.sql` con:

- `organizations`, `teams`, `profiles`, `memberships` (org_id, team_id, role: superadmin|org_admin|team_manager|user|viewer).
- `shifts` (org, team, tipo día/noche/24h, asignado, estado draft/published).
- `shift_requests` (tipos: give_away, swap, take_open; estados; aprobación).
- `availability_events` (vacaciones, licencia, etc.).
- `audit_log` (actor, timestamp, entity, old/new, comment).
- **RLS** en todas las tablas, con políticas por `auth.uid()`, rol y `org_id`/`team_id` para aislamiento multi-tenant.

---

## 7) Scripts `package.json` recomendados

Añadir o ajustar en `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "export": "next build",
    "cap:sync": "npm run build && npx cap sync",
    "cap:ios": "npx cap open ios",
    "cap:android": "npx cap open android",
    "supabase:gen": "supabase gen types typescript --local > src/types/supabase.ts",
    "db:push": "supabase db push",
    "db:reset": "supabase db reset"
  }
}
```

Si usas `output: 'export'`, `build` ya generará `out/`; `cap:sync` debe usar `webDir: 'out'`.

---

## 8) Orden de ejecución recomendado

```powershell
# 1. Next.js
cd c:\Local-Disc-D\Project\enterpreneurship\turnia
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm

# 2. Dependencias
npm install @supabase/supabase-js @supabase/ssr
npm install @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/list @fullcalendar/interaction
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/push-notifications @capacitor/preferences @capacitor/app

# 3. Capacitor
npx cap init "Turnia" "com.turnia.app"

# 4. Supabase CLI y proyecto
npm install -g supabase
supabase login
supabase init
supabase link --project-ref <PROJECT_REF>

# 5. Edge Functions
supabase functions new approve-request
supabase functions new send-notification
supabase functions new export-schedule

# 6. Migraciones (después de escribir el SQL)
supabase migration new create_core_tables
# editar el archivo SQL, luego:
supabase db push

# 7. Build y plataformas móviles (cuando Next y Capacitor estén configurados)
# En next.config: output: 'export' y capacitor webDir: 'out'
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

---

## 9) Resumen de requisitos y dónde se implementa

| Indicación | Dónde |
|------------|--------|
| SPA + Capacitor | Next.js + `output: 'export'` + Capacitor |
| Supabase Auth | `@supabase/supabase-js`, `@supabase/ssr` |
| PostgreSQL + RLS | Supabase + políticas en migraciones |
| Realtime | Supabase Realtime en canales por org/team |
| Edge Functions (aprobar, notificar, exportar) | `supabase/functions/` |
| Calendario (mes/semana/día) | FullCalendar |
| Roles (Superadmin, Org Admin, Team Manager, User, Viewer) | `memberships.role` + RLS + helpers en `lib/rbac.ts` |
| Multi-tenant (Org/Team) | `org_id`, `team_id` en tablas + RLS |
| Audit log inmutable | Tabla `audit_log` + solo Edge Functions/triggers la escriben |
| Push + email | Capacitor Push + Edge Function + proveedor de email (Resend, etc.) |
| Export CSV | Edge Function `export-schedule` o Route Handler con `service_role` |

---

## 10) Notas

- **create-next-app en `.`**: si la carpeta tiene `docs/` u otros archivos, `create-next-app` puede fallar. En ese caso crea en `temp-app`, mueve `temp-app/*` a la raíz y borra `temp-app`, o usa `--no-install` y resuelve conflictos a mano.
- **Capacitor y Next.js**: con `output: 'export'`, la app es estática; para API routes dinámicas usarás Supabase (Edge Functions, Realtime, Auth). Ajusta `server.url` en `capacitor.config.ts` para desarrollo.
- **Push**: en Android (FCM) e iOS (APNs) hay que configurar credenciales y, si usas Supabase, el flujo de push (o un backend propio que envíe a FCM/APNs).

Si quieres, el siguiente paso puede ser: 1) un `create-next-app` concreto adaptado a tu carpeta actual, o 2) el SQL de la primera migración con RLS para orgs, teams, memberships, shifts y audit_log.
