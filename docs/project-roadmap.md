# Turnia - Roadmap Completo del Proyecto

**Fecha de revisión**: 24 de enero de 2026

---

## ⚠️ PRINCIPIOS TÉCNICOS FUNDAMENTALES - LECTURA OBLIGATORIA

> **CRÍTICO**: Estos principios deben aplicarse en CADA línea de código. No son opcionales.

### 🎯 **Arquitectura: SPA + Capacitor**

Este proyecto es una **Single Page Application (SPA)** que se empaqueta para móvil con **Capacitor**. Esto significa:

#### **1. SPA First**
- ✅ **Navegación del lado del cliente**: usar `useRouter`, `Link` de Next.js
- ✅ **Evitar full page reloads**: toda navegación debe ser instantánea
- ✅ **Estado persistente**: mantener estado en cliente (React Context, Zustand, o estado global)
- ✅ **Prefetch**: pre-cargar rutas y datos anticipadamente
- ❌ **NO usar Server Actions directamente**: abstraer en API calls
- ❌ **NO usar SSR/SSG**: todo debe renderizar en cliente
- ❌ **NO hacer redirects de servidor**: usar redirects del cliente

#### **2. Performance Crítico**
- ⚡ **First Load < 2 segundos**: bundle optimizado y code splitting
- ⚡ **Interacciones < 100ms**: respuesta inmediata en UI
- ⚡ **Datos en cache**: estrategia agresiva de caching
- ⚡ **Lazy loading**: componentes y rutas bajo demanda
- ⚡ **Optimistic UI**: actualizar UI antes de confirmar con servidor
- ⚡ **Debounce & Throttle**: en búsquedas y filtros
- ⚡ **Virtual scrolling**: para listas largas (turnos, solicitudes)

#### **3. Capacitor Mobile Ready**
- 📱 **Touch optimized**: botones mín 44x44px, gestos nativos
- 📱 **Offline first**: funcionalidades básicas sin conexión
- 📱 **Native APIs**: usar plugins de Capacitor (Push, Storage, etc.)
- 📱 **No web-only features**: todo debe funcionar en iOS y Android
- 📱 **Deep linking**: URLs que funcionen en app nativa
- 📱 **Splash screen rápida**: < 1 segundo de splash
- 📱 **Bundle size**: mantener bundle total < 2MB comprimido

#### **4. Reglas de Desarrollo**

##### **Componentes**
```tsx
// ✅ CORRECTO: Client component optimizado
'use client';
import { memo, useCallback, useMemo } from 'react';

const ShiftCard = memo(({ shift, onClick }: Props) => {
  const formattedDate = useMemo(() => formatDate(shift.date), [shift.date]);
  const handleClick = useCallback(() => onClick(shift.id), [shift.id, onClick]);
  
  return <div onClick={handleClick}>{formattedDate}</div>;
});

// ❌ INCORRECTO: Re-renders innecesarios
const ShiftCard = ({ shift, onClick }: Props) => {
  return <div onClick={() => onClick(shift.id)}>{formatDate(shift.date)}</div>;
};
```

##### **Fetching de Datos**
```tsx
// ✅ CORRECTO: Cache + Optimistic Updates
const { data, mutate } = useSWR('/api/shifts', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 2000,
});

const updateShift = async (id, updates) => {
  // Optimistic update
  mutate({ ...data, shifts: data.shifts.map(s => s.id === id ? {...s, ...updates} : s) }, false);
  // Real update
  await api.updateShift(id, updates);
  mutate();
};

// ❌ INCORRECTO: Fetch directo sin cache
const [shifts, setShifts] = useState([]);
useEffect(() => {
  fetch('/api/shifts').then(r => r.json()).then(setShifts);
}, []);
```

##### **Imágenes y Assets**
```tsx
// ✅ CORRECTO: Next.js Image optimizado
import Image from 'next/image';
<Image src="/logo.png" width={200} height={50} alt="Logo" priority />

// ❌ INCORRECTO: Tag <img> directo
<img src="/logo.png" />
```

##### **Bundle Size**
```tsx
// ✅ CORRECTO: Dynamic import
const FullCalendar = dynamic(() => import('@fullcalendar/react'), { ssr: false });

// ❌ INCORRECTO: Import todo de una vez
import FullCalendar from '@fullcalendar/react';
```

#### **5. Supabase Best Practices**

##### **RLS First**
- ✅ **Toda la seguridad en RLS**: nunca confiar solo en frontend
- ✅ **Políticas granulares**: por operación (SELECT, INSERT, UPDATE, DELETE)
- ✅ **Usar auth.uid()**: en todas las políticas que involucren usuarios
- ❌ **NO bypassear RLS**: ni siquiera en "casos especiales"

##### **Realtime con Cuidado**
```tsx
// ✅ CORRECTO: Suscripción específica y limpia
useEffect(() => {
  const channel = supabase
    .channel('shifts')
    .on('postgres_changes', 
      { event: 'UPDATE', schema: 'public', table: 'shifts', filter: `org_id=eq.${orgId}` },
      handleUpdate
    )
    .subscribe();
  
  return () => { supabase.removeChannel(channel); };
}, [orgId]);

// ❌ INCORRECTO: Suscripción a toda la tabla sin cleanup
supabase.from('shifts').on('UPDATE', handleUpdate).subscribe();
```

##### **Edge Functions**
- ✅ **Solo para operaciones privilegiadas**: aprobaciones, notificaciones, transacciones
- ✅ **Validar permisos siempre**: aunque el RLS lo haga
- ✅ **Timeout razonable**: < 5 segundos
- ✅ **Idempotentes**: se pueden ejecutar múltiples veces sin problema
- ❌ **NO para queries simples**: usar Supabase client directo

#### **6. UX No Negociables**

##### **Loading States**
```tsx
// ✅ CORRECTO: Loading con skeleton
{loading ? <ShiftCardSkeleton /> : <ShiftCard shift={shift} />}

// ❌ INCORRECTO: Spinner genérico
{loading ? <Spinner /> : <ShiftCard shift={shift} />}
```

##### **Error Handling**
```tsx
// ✅ CORRECTO: Error específico con retry
{error && (
  <ErrorMessage 
    message="No se pudieron cargar los turnos" 
    onRetry={refetch}
    technical={error.message}
  />
)}

// ❌ INCORRECTO: Error silencioso o alert()
{error && console.error(error)}
```

##### **Feedback Inmediato**
- ✅ **Toast para acciones**: "Turno asignado", "Solicitud enviada"
- ✅ **Animaciones de estado**: check animado, progreso
- ✅ **Disable durante proceso**: botones con loading state
- ❌ **NO esperar respuesta sin feedback**: usuario debe ver que algo pasa

#### **7. Checklist por Tarea**

Antes de considerar una tarea completa, verificar:

- [ ] ¿Funciona sin internet? (o muestra error claro)
- [ ] ¿Carga rápido? (< 2s si es página, < 100ms si es interacción)
- [ ] ¿Está optimizado para mobile? (probado en 375px width)
- [ ] ¿Tiene loading states?
- [ ] ¿Tiene error handling?
- [ ] ¿Usa optimistic updates donde aplica?
- [ ] ¿Las imágenes están optimizadas?
- [ ] ¿Los componentes están memoizados si son pesados?
- [ ] ¿Las queries tienen cache?
- [ ] ¿Las suscripciones se limpian?
- [ ] ¿Los permisos se validan en RLS + Edge Function?
- [ ] ¿Es accesible? (keyboard, screen reader, contraste)

#### **8. Herramientas de Monitoreo**

Durante desarrollo, SIEMPRE tener abierto:
- 🔍 **React DevTools**: detectar re-renders innecesarios
- 🔍 **Network tab**: verificar requests duplicados
- 🔍 **Lighthouse**: score > 90 en Performance
- 🔍 **Bundle Analyzer**: mantener chunks pequeños

#### **9. Librerías Aprobadas**

✅ **Usar**:
- `@supabase/supabase-js` - Database client
- `@capacitor/*` - Native capabilities
- `@fullcalendar/react` - Calendar
- `swr` o `react-query` - Data fetching con cache
- `zustand` - Estado global (si necesario)
- `date-fns` - Manipulación de fechas (más ligero que moment)
- `zod` - Validación de schemas
- `react-hook-form` - Formularios optimizados

❌ **Evitar**:
- `lodash` completo (usar `lodash-es` con imports específicos)
- `moment.js` (muy pesado, usar date-fns)
- Librerías de UI pesadas (Material-UI completo, Ant Design)
- Cualquier librería > 100KB sin justificación clara

#### **10. Git Workflow**

```bash
# Branches por feature
git checkout -b feat/invitation-system
git checkout -b fix/calendar-render
git checkout -b perf/shift-list-virtualization

# Commits descriptivos
git commit -m "feat(invitations): add invitation table and RLS policies"
git commit -m "perf(calendar): implement virtual scrolling for month view"
git commit -m "fix(requests): prevent duplicate request submissions"

# PR con checklist
- [ ] Probado en mobile (iOS y Android)
- [ ] Performance verificado (Lighthouse > 90)
- [ ] Tests pasando
- [ ] Sin console.logs/debuggers
```

---

## 📚 Referencias Rápidas

- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Capacitor Best Practices](https://capacitorjs.com/docs/basics/progressive-web-app)
- [Supabase Performance](https://supabase.com/docs/guides/platform/performance)
- [React Performance](https://react.dev/learn/render-and-commit)

---

## 📋 ESTADO ACTUAL DEL PROYECTO

### ✅ Lo que YA tenemos implementado

#### 1. **Infraestructura Base**
- ✅ Proyecto Next.js 16 configurado
- ✅ Integración con Supabase (Auth + Database)
- ✅ Configuración de Capacitor para apps móviles (iOS/Android)
- ✅ Tailwind CSS configurado
- ✅ TypeScript setup completo

#### 2. **Base de Datos (Schema Completo)**
- ✅ Tabla `organizations` (tenants multi-org)
- ✅ Tabla `profiles` (extensión de auth.users)
- ✅ Tabla `memberships` (roles por org)
- ✅ Tabla `shifts` (turnos con tipos: day/night/24h/custom)
- ✅ Tabla `shift_requests` (solicitudes: give_away, swap, take_open)
- ✅ Tabla `availability_events` (vacaciones, bajas, etc.)
- ✅ Tabla `audit_log` (trazabilidad inmutable)
- ✅ Tabla `notifications` (in-app: user_id, title, message, type, entity_type, entity_id, read_at)
- ✅ Row Level Security (RLS) habilitado en todas las tablas
- ✅ Políticas RLS básicas (basadas en membership de org)
- ✅ Trigger automático para crear perfil al registrarse

#### 3. **Autenticación**
- ✅ Página de Login (`/login`)
- ✅ Página de Signup (`/signup`)
- ✅ LoginForm component funcional
- ✅ SignupForm component funcional
- ✅ Cliente Supabase configurado (browser y server)
- ✅ Middleware para proteger rutas

#### 4. **Sistema de Roles (RBAC)**
- ✅ 5 roles definidos: `superadmin`, `org_admin`, `team_manager`, `user`, `viewer`
- ✅ Helper functions para permisos (`canManageOrg`, `canManageShifts`, etc.)
- ✅ Memberships con scope de org

#### 5. **Estructura de Rutas**
- ✅ Landing page (`/`)
- ✅ Auth routes (`/login`, `/signup`)
- ✅ Dashboard base (`/dashboard`)
- ✅ Dashboard por rol:
  - `/dashboard/admin` (placeholder)
  - `/dashboard/manager` (placeholder)
  - `/dashboard/staff` (placeholder)
  - `/dashboard/viewer` (placeholder)

#### 6. **Componentes Base (Placeholders)**
- ✅ `ShiftCalendar.tsx` (estructura preparada para FullCalendar)
- ✅ `ShiftList.tsx` (completo: tabla, filtros, paginación, ordenación, acciones; página `/dashboard/manager/shifts`)
- ✅ `RequestsInbox.tsx` (bandeja manager completa: lista, filtros, RequestDetailModal)
- ✅ `AuthGuard.tsx` (protección de rutas)

#### 7. **Edge Functions (Estructura Preparada)**
- ✅ `approve-request` (completa: aprobar/rechazar, aplicar cambios en turnos, audit_log; reject integrado con action=reject)
- ✅ `create-request` (take_open/give_away; auto-aprueba según org_settings: allow_self_assign_open_shifts, require_approval_for_give_aways)
- ✅ `send-notification` (esqueleto)
- ✅ `export-schedule` (completa: CSV, Excel; auth; perfiles, ubicación; /dashboard/admin/exports)

#### 8. **Documentación**
- ✅ `indications.md` - Especificación completa del producto
- ✅ `first-admin.md` - Guía para crear primer admin
- ✅ `setup-commands.md` - Comandos de setup
- ✅ `colors.md` - Paleta de colores
- ✅ `.env.example` - Variables de entorno

#### 9. **Sistema de Invitaciones** (Módulo 1 — concluido)
- ✅ Tabla `organization_invitations` y RLS
- ✅ Edge Functions: `invite-user`, `validate-invitation`, `accept-invitation`
- ✅ Página `/dashboard/admin/invite` con `InviteUserForm` e `InvitationsList`
- ✅ Página `/invite?token=...` con `AcceptInvitationForm` (registro, login, aceptar)
- ✅ Copiar enlace, cancelar invitación
- ✅ `invitation-emails.md` — Email con Resend (opcional, requiere dominio)

#### 10. **Gestión de Organizaciones (Módulo 2.1 — concluido)**
- ✅ Página `/dashboard/admin/organizations` (lista para superadmin, configuración para org_admin)
- ✅ Crear organización (superadmin; modal con nombre y slug)
- ✅ Editar nombre/slug y eliminar (modal de confirmación)
- ✅ `OrganizationSettings`, `OrganizationList`, `CreateOrganizationModal`

#### 11. **Tipos de turno por organización (Módulo 2.3 — concluido)**
- ✅ Tabla `organization_shift_types` (name, letter, color, sort_order, start_time, end_time) y RLS
- ✅ Tabla `shifts` con `shift_type_id` (FK a `organization_shift_types`)
- ✅ Página `/dashboard/admin/shift-types` con `ShiftTypesList` y `ShiftTypeFormModal`
- ✅ Crear, editar y eliminar tipos (letra, color, horario; checkbox “Turno 24h”; color Auto desde nombre)
- ✅ `formatShiftTypeSchedule`, `generateColorFromName`, `isColorLight` en `utils.ts`
- ✅ Badge circular (color + letra en negrita; texto blanco/negro según luminancia)
- ✅ Edge Function `export-schedule`: join con `organization_shift_types`, exporta name/letter

#### 12. **Calendario y turnos (Módulo 3.1 y 3.2 — parcial)**
- [x] FullCalendar en `ShiftCalendar.tsx`: vistas mes, semana, día, lista
- [x] Carga de turnos desde Supabase (join `organization_shift_types`), colorear por tipo
- [x] Visualización: barra con color del tipo, círculo blanco con letra + nombre de usuario; orden por hora (`eventOrder="start"`)
- [x] `ShiftDetailModal`: detalle al clic (horario, asignado, tipo, ubicación, estado); editar, eliminar; **solicitar cambio** (dar de baja, intercambiar, tomar turno) si `canCreateRequests`
- [x] `CreateShiftModal`: solo fecha, tipo, asignar, ubicación, estado; horas desde el tipo
- [x] `EditShiftModal`: mismo esquema que crear (solo fecha)
- [x] Edge Functions `create-shift`, `update-shift`, `delete-shift` (con `--no-verify-jwt`; cliente con `refreshSession`)
- [x] Filtros en calendario: `ShiftCalendarFilters` (por tipo de turno, usuario, estado draft/published)
- [x] Validaciones: overlap, disponibilidad (`availability_events`), descanso mínimo; RPC `check_shift_conflicts`; integradas en Create/EditShiftModal y en Edge Functions create-shift/update-shift

#### 13. **Lista de turnos (Módulo 3.4 — concluido)**
- [x] `ShiftList.tsx`: tabla (fecha, horario, tipo, usuario, estado), filtros (tipo, usuario, rango fechas, estado), paginación, ordenar por fecha, acciones Editar/Eliminar, clic en fila → `ShiftDetailModal`
- [x] Página `/dashboard/manager/shifts`; enlaces en layout y en Calendario

#### 14. **Crear solicitudes desde ShiftDetailModal (Módulo 4.1 — parcial)**
- [x] `GiveAwayRequestModal`, `TakeOpenRequestModal`, `SwapRequestModal` (comentario opcional; evita duplicados pending)
- [x] RLS `shift_requests_insert_member` y `user_can_create_requests(org_id)` (migración `20250130000000_shift_requests_insert_members.sql`)
- [x] `useScheduleOrg`: `userId`, `canCreateRequests`, `canApproveRequests`

#### 15. **Página Mis solicitudes (Módulo 4.1)**
- [x] Página `/dashboard/staff/my-requests` con `MyRequestsList`
- [x] Listar solicitudes del usuario; estados: draft, submitted, accepted, approved, rejected, cancelled
- [x] Cancelar solicitud si está en draft/submitted/accepted (RLS `shift_requests_update_requester_cancel`)

#### 16. **Bandeja de solicitudes y flujo de aprobación (Módulos 4.2, 4.3)**
- [x] `RequestsInbox.tsx` completo: listar solicitudes de la org, filtrar por tipo y estado, ordenar por fecha
- [x] `RequestDetailModal.tsx`: detalle, turnos/usuarios involucrados, aprobar, rechazar, comentario del manager
- [x] Página `/dashboard/manager/requests`
- [x] Edge Function `approve-request`: validar permisos (team_manager, org_admin, superadmin), validar estado (submitted/accepted), aplicar en turnos (give_away→sin asignar, take_open→asignar a requester, swap→intercambiar), actualizar estado, `audit_log`
- [x] Rechazo integrado en `approve-request` con `action: 'reject'` (razón en audit_log)

#### 17. **Workflow de Swap con aceptación de contraparte (Módulo 4.4 — concluido)**
- [x] Flujo: User A crea swap → `submitted`; User B acepta → `accepted` o rechaza → `cancelled`; Manager aprueba → `approved`
- [x] Component `AcceptSwapButton.tsx` (Aceptar/Rechazar para User B)
- [x] Component `PendingSwapsForYou.tsx` en `/dashboard/staff/my-requests`
- [x] Edge Function `respond-to-swap` (accept/decline; audit_log)
- [x] Deploy con `--no-verify-jwt`; `supabase/config.toml` con `[functions.respond-to-swap] verify_jwt = false`

#### 18. **Notificaciones in-app (Módulo 5.4 — concluido)**
- [x] Tabla `notifications`, RLS, trigger al insertar shift_request (swap→User B; submitted→managers)
- [x] `approve-request` y `respond-to-swap`: insertar notificaciones (aprobado/rechazado; swap aceptado/rechazado por contraparte)
- [x] `NotificationBell.tsx` (campana con badge, desplegable), `NotificationsList.tsx`, página `/dashboard/notifications`
- [x] Marcar como leída, enlace a entidad (`?request=id` en manager/requests); `RequestsInbox` abre modal con `?request=`

#### 19. **Exportar horarios (Módulo 7.1 — concluido)** ✅
- [x] Edge Function `export-schedule`: auth (team_manager, org_admin, superadmin), CSV (BOM UTF-8, escapado, asignado vía profiles, ubicación), Excel (.xlsx vía esm.sh/xlsx)
- [x] Página `/dashboard/admin/exports`, `ExportScheduleForm` (rango fechas, formato CSV/Excel, descargar)

#### 20. **Visualizar Audit Log (Módulo 8.1 — concluido)** ✅
- [x] Página `/dashboard/admin/audit` (org_admin, superadmin; superadmin elige org)
- [x] `AuditLogList`: filtros entidad, actor, acción, rango fechas; tabla; paginación 50
- [x] `AuditLogDetailModal`: snapshot antes/después, comentario, enlace a solicitud
- [x] Índice `audit_log_org_created_idx` (org_id, created_at desc)

---

## 🚀 MÓDULOS Y FUNCIONALIDADES PENDIENTES

### ✅ **Módulo 1: Sistema de Invitaciones a Organizaciones** — CONCLUIDO

**Objetivo**: Permitir que usuarios sean invitados a una organización con un rol específico y se registren directamente en esa organización.

##### **Tareas realizadas:**

1. **Base de datos**
   - [x] Tabla `organization_invitations` (id, org_id, email, role, token, invited_by, status, expires_at, metadata, created_at, accepted_at)
   - [x] Políticas RLS para `organization_invitations`
   - [x] Índices en `token` y `email`

2. **API/Edge Functions**
   - [x] **Edge Function: `invite-user`** — Valida org_admin/superadmin, crea invitación, token, expiración 7 días. Enlace para copiar/pegar. (Email vía Resend opcional cuando haya dominio; ver `docs/invitation-emails.md`.)
   - [x] **Edge Function: `validate-invitation`** — Verifica token, estado y expiración; devuelve org, rol, email.
   - [x] **Edge Function: `accept-invitation`** — Crea membership, marca `accepted`, `accepted_at`, audit_log.

3. **Frontend - Invitar Usuarios**
   - [x] Página `/dashboard/admin/invite` con formulario (email, rol, mensaje opcional)
   - [x] Lista de invitaciones (pendientes, aceptadas, expiradas, canceladas)
   - [x] `InviteUserForm.tsx` — Crear invitación y copiar enlace
   - [x] `InvitationsList.tsx` — Listar, copiar enlace, cancelar

4. **Frontend - Aceptar Invitación**
   - [x] Página `/invite?token=...` (pública)
   - [x] `AcceptInvitationForm.tsx` — Registro (nombre, contraseña, email readonly), login, aceptar. Redirección a dashboard.

5. **Email (opcional, desactivado por defecto)**
   - [x] Template de invitación en código (Resend). Requiere dominio verificado; ver `docs/invitation-emails.md`.
   - [x] Template de confirmación (usuario aceptó) — `accept-invitation` envía al invitador.
   - [x] Template de recordatorio (por expirar) — Edge Function `send-invitation-reminder`; llamar por cron (véase `docs/invitation-emails.md`).

6. **Gestión de Invitaciones**
   - [x] Lista con estados: Pendientes, Aceptadas, Expiradas, Canceladas
   - [x] Acción: copiar enlace
   - [x] Acción: cancelar invitación
   - [x] Filtros por estado, rol y fecha (expira en 7 días / ya expiradas)
   - [x] Acción: reenviar invitación — Edge Function `resend-invitation` (nuevo token y opcional email)
   - [x] Acción: prorrogar +7 días (cambiar fecha de expiración)

---

### 📊 **Módulo 2: Gestión de Organizaciones**

> **Nota**: Se prescindió del modelo Team; memberships, shifts y shift_requests son solo org-scoped.

#### **2.1 Crear y Gestionar Organizaciones** — CONCLUIDO
- [x] Página `/dashboard/admin/organizations`
  - [x] Listar organizaciones (para superadmin)
  - [x] Ver detalles de la org actual (para org_admin)
  - [x] Editar nombre, slug, configuraciones
  - [x] Eliminar organización (con confirmación y modal)
  - [x] Crear organización (superadmin; modal con nombre y slug)

- [x] Component `OrganizationSettings.tsx`
- [x] Component `OrganizationList.tsx` (solo superadmin)
- [x] Component `CreateOrganizationModal.tsx`

#### **2.2 Gestión de Miembros** — CONCLUIDO
- [x] Página `/dashboard/admin/members`
  - [x] Listar todos los miembros de la org
  - [x] Ver memberships por usuario (detalle en modal)
  - [x] Cambiar rol de un usuario
  - [x] Eliminar usuario de la org

- [x] Component `MembersList.tsx`
- [x] Component `EditMembershipForm.tsx`
- [x] Component `MemberDetails.tsx`

- [x] API/RPC functions:
  - [x] `change_user_role(p_org_id, p_user_id, p_new_role)` — RPC en migración `20250126100000_members_management.sql`
  - [x] `remove_from_org(p_org_id, p_user_id)` — RPC en la misma migración

#### **2.3 Tipos de turno por organización** — CONCLUIDO

Cada organización define sus propios **tipos de turno** (las categorías en las que se asignan los turnos de usuarios: ej. Mañana, Noche, 24h, Guardia). Estos tipos son prerequisito para crear turnos.

- [x] **Base de datos** (migraciones `20250127000000_organization_shift_types.sql`, `20250128000000_organization_shift_types_schedule.sql`)
  - [x] Tabla `organization_shift_types`: `id`, `org_id`, `name`, `letter`, `color`, `sort_order`, `start_time`, `end_time`, `created_at`, `updated_at`
  - [x] Restricción `unique(org_id, letter)`: la letra es única por organización
  - [x] `letter`: 1–5 caracteres (identificación corta: "D", "N", "H", "24", etc.)
  - [x] `color`: hex (ej. `#FBBF24`). Siempre obligatorio; la app puede generarlo si el usuario no elige
  - [x] `start_time`, `end_time` (TIME, opcionales): horario del tipo; `end_time` puede ser 24:00; si `end < start` cruza medianoche
  - [x] Tabla `shifts`: reemplazo de `shift_type` (enum day/night/24h/custom) por `shift_type_id` (FK a `organization_shift_types`)
  - [x] RLS: SELECT para miembros de la org; INSERT/UPDATE/DELETE para org_admin y team_manager (y superadmin)
  - [x] Backfill: organizaciones con turnos existentes reciben 4 tipos por defecto (Día/D, Noche/N, 24h/H, Personalizado/C) con colores y horarios; se migran los `shifts` al nuevo esquema

- [x] **Página y componentes**
  - [x] Página `/dashboard/admin/shift-types`
  - [x] `ShiftTypesList`: listar tipos (badge circular con color + letra en negrita; texto blanco/negro según `isColorLight`; nombre, horario formateado, acciones)
  - [x] `ShiftTypeFormModal`: crear/editar — nombre, letra (validar único en la org), color (input + `type="color"` + botón “Auto”), horario (opcional; checkbox “Turno 24h”; inicio/fin; si fin < inicio, cruza medianoche)
  - [x] Editar y eliminar tipo (eliminar falla con mensaje si hay turnos que lo usan)
  - [ ] Reordenar (opcional, vía `sort_order`)

- [x] **Color y contraste**
  - [x] `generateColorFromName(name)` en `utils.ts` (hash → HSL → hex). Botón “Auto” en el formulario.
  - [x] `isColorLight(hex)`: luminancia para elegir texto blanco o negro en el badge. Badge circular con letra en **bold**.
  - [ ] Iterar `hue + 37` si el hex ya existe en la org para garantizar distinción (opcional).

- [x] **Integración (parcial)**
  - [x] `CreateShiftModal` / `EditShiftModal`: selector de tipo de turno desde `organization_shift_types` (Módulo 3).
  - [x] Calendario y listas: colorear por `organization_shift_types.color` y mostrar `letter` o `name` (Módulo 3).
  - [x] `export-schedule`: join con `organization_shift_types`; exporta `shift_type` (name) y `type_letter`.

**Nota**: Los turnos concretos (registros en `shifts`) se crean y asignan en el **Módulo 3** (Calendario y Gestión de Turnos). Los **tipos de turno** definidos aquí son las “plantillas” o categorías que cada organización debe tener creadas antes de poder generar turnos.

---

### 📅 **Módulo 3: Calendario y Gestión de Turnos**

#### **3.1 Visualización de Calendario**
- [x] Implementar FullCalendar en `ShiftCalendar.tsx`
  - [x] Vista mensual (daygrid)
  - [x] Vista semanal (timegrid)
  - [x] Vista diaria (timegrid)
  - [x] Vista lista (list)
  - [x] Cambio entre vistas

- [x] Cargar turnos desde Supabase (join con `organization_shift_types`)
  - [x] Filtrar por tipo de turno (tipos de la org)
  - [x] Filtrar por usuario
  - [x] Filtrar por estado (draft/published)

- [x] Colorear turnos según `organization_shift_types.color` (cada org define sus tipos y colores)
  - [x] Mostrar `letter` o `name` del tipo en la vista: barra con color del tipo, círculo blanco con letra en color + nombre del usuario; `eventOrder="start"` para ordenar por hora en el día.

- [x] Mostrar info al hacer click en turno (`ShiftDetailModal`):
  - [x] Horario
  - [x] Usuario asignado
  - [x] Tipo
  - [x] Ubicación
  - [x] Acciones (editar, eliminar, solicitar cambio: dar de baja, intercambiar, tomar turno)

#### **3.2 Crear y Editar Turnos (Manager/Admin)**
- [x] Component `CreateShiftModal.tsx`
  - [x] Formulario:
    - [x] Fecha (solo fecha; inicio/fin se calculan desde `organization_shift_types.start_time`/`end_time`)
    - [x] Tipo de turno (selector desde `organization_shift_types` de la org; la org debe tener al menos un tipo — ver Módulo 2.3)
    - [x] Asignar usuario (opcional)
    - [x] Ubicación (opcional)
    - [x] Estado (draft/published)

- [x] Component `EditShiftModal.tsx`
  - [x] Editar campos del turno (igual que crear: solo fecha, tipo, asignar, ubicación, estado; horas desde el tipo)
  - [x] Validar conflictos (overlaps, disponibilidad, descanso) vía RPC antes de guardar
  - [x] Validar disponibilidad del usuario (availability_events)

- [x] Validaciones:
  - [x] No permitir overlap del mismo usuario
  - [x] Verificar disponibilidad (availability_events)
  - [x] Regla de descanso mínimo (RPC con p_min_rest_hours; 0 hasta org_settings)

- [x] API:
  - [x] Edge Function `create-shift` (desplegada con `--no-verify-jwt`; cliente usa `refreshSession` antes de invocar; valida con RPC)
  - [x] Edge Function `update-shift` (idem; valida con RPC)
  - [x] Edge Function `delete-shift` (idem)
  - [x] RPC `check_shift_conflicts` (overlap, availability_events, min_rest_hours); migración `20250129000000_check_shift_conflicts.sql`

#### **3.3 Operaciones en Lote** — CONCLUIDO
- [x] Generar turnos desde plantilla:
  - [x] Patrón semanal (día, tipo, asignación opcional) en `ShiftTemplateForm`
  - [x] Aplicar patrón a rango de fechas (EF `generate-shifts-from-pattern`)
  - [x] Opción «usar asignaciones del patrón» o dejar sin asignar

- [x] Copiar semana/mes:
  - [x] Período origen (inicio/fin) y período destino (inicio)
  - [x] EF `copy-shifts`: desplazamiento en días, crea turnos en destino
  - [x] Opción de copiar asignaciones o dejar sin asignar
  - [x] `CopyShiftsModal`

- [x] Bulk assign/unassign:
  - [x] Checkboxes en `ShiftList` (selección por fila y «todos en página»)
  - [x] `BulkOperationsPanel`: asignar a usuario, desasignar, cancelar selección
  - [x] EF `bulk-update-shifts` (validación de conflictos al asignar)

- [x] Component `BulkOperationsPanel.tsx`
- [x] Component `ShiftTemplateForm.tsx`
- [x] Component `CopyShiftsModal.tsx`

#### **3.4 Lista de Turnos con Filtros**
- [x] Implementar `ShiftList.tsx` completo
  - [x] Tabla con columnas: fecha, horario, tipo (nombre o letra desde `organization_shift_types`), usuario, estado
  - [x] Filtros:
    - [x] Por tipo (checkboxes según tipos de la org)
    - [x] Por usuario (select; autocomplete opcional para más adelante)
    - [x] Por rango de fechas (date picker)
    - [x] Por estado (draft/published)
  - [x] Paginación
  - [x] Ordenar por columnas (fecha, asc/desc)
  - [x] Acciones rápidas (editar, eliminar); clic en fila abre `ShiftDetailModal`

---

### 🔄 **Módulo 4: Sistema de Solicitudes (Requests)**

#### **4.1 Crear Solicitudes (Staff)** — CONCLUIDO (opcional: sugerir reemplazo en Give Away)
- [x] **Acción «solicitar cambio» desde `ShiftDetailModal`** (dar de baja, intercambiar, tomar turno). RLS `shift_requests_insert_member` (migración `20250130000000`).

- [x] **Give Away / Coverage Request**
  - [x] Component `GiveAwayRequestModal.tsx` (abierto desde ShiftDetailModal)
  - [x] Usuario selecciona su turno (contexto del modal)
  - [x] Agrega comentario/razón
  - [x] Opción de sugerir reemplazo (opcional): selector en `GiveAwayRequestModal`, columna `suggested_replacement_user_id` en `shift_requests`, `create-request` acepta y valida; `RequestDetailModal` muestra la sugerencia en give_away
  - [x] Envía solicitud (INSERT directo; evita duplicados pending)

- [x] **Swap Request**
  - [x] Component `SwapRequestModal.tsx` (abierto desde ShiftDetailModal)
  - [x] Usuario selecciona su turno (contexto del modal)
  - [x] Selecciona turno objetivo (de otro usuario; ±4 sem)
  - [x] target_user_id = asignado del turno objetivo
  - [x] Agrega comentario
  - [x] Envía solicitud (estado: submitted)
  - [x] Notificar al otro usuario (Módulo 5)

- [x] **Take Open Shift**
  - [x] Component `TakeOpenRequestModal.tsx` (abierto desde ShiftDetailModal)
  - [x] Usuario ve turnos sin asignar (clic en turno abierto)
  - [x] Solicita tomar un turno abierto
  - [x] Manager aprueba (4.3 `approve-request`)

- [x] Página `/dashboard/staff/my-requests`
  - [x] Listar solicitudes del usuario
  - [x] Estados: draft, submitted, accepted, approved, rejected, cancelled
  - [x] Cancelar solicitud (si está pending: draft/submitted/accepted)

#### **4.2 Bandeja de Solicitudes (Manager)** — CONCLUIDO
- [x] Implementar `RequestsInbox.tsx` completo
  - [x] Listar solicitudes de la org (filtro por pendientes, aprobadas, etc.)
  - [x] Filtrar por tipo (give_away, swap, take_open)
  - [x] Filtrar por estado
  - [x] Ordenar por fecha

- [x] Component `RequestDetailModal.tsx`
  - [x] Ver detalles de la solicitud
  - [x] Ver turnos involucrados
  - [x] Ver usuarios involucrados
  - [x] Botón aprobar
  - [x] Botón rechazar
  - [x] Campo para comentario del manager

- [x] Página `/dashboard/manager/requests`

#### **4.3 Flujo de Aprobación** — CONCLUIDO
- [x] Edge Function `approve-request` (completa)
  - [x] Validar permisos del aprobador (team_manager, org_admin, superadmin)
  - [x] Validar estado de la solicitud (submitted, accepted)
  - [x] Aplicar cambios en turnos:
    - Give away: dejar sin asignar
    - Swap: intercambiar asignaciones
    - Take open: asignar turno al solicitante
  - [x] Actualizar estado a `approved`
  - [x] Registrar en audit_log
  - [x] Enviar notificaciones (Módulo 5)

- [x] Rechazo (integrado en `approve-request` con `action: 'reject'`)
  - [x] Validar permisos
  - [x] Actualizar estado a `rejected`
  - [x] Registrar razón del rechazo (comment en audit_log)
  - [x] Registrar en audit_log
  - [x] Notificar al solicitante (Módulo 5)

#### **4.4 Workflow de Swap (con aceptación de contraparte)** — CONCLUIDO
- [x] Flujo de estados:
  1. User A crea swap → `submitted`
  2. User B acepta → `accepted` (o rechaza → `cancelled`)
  3. Manager aprueba → `approved` (se aplica el swap)
  4. O Manager rechaza → `rejected`

- [x] Component `AcceptSwapButton.tsx` (para User B; Aceptar/Rechazar)
- [x] Component `PendingSwapsForYou.tsx` en `/dashboard/staff/my-requests`
- [x] Edge Function `respond-to-swap` (accept/decline; audit_log; si require_approval_for_swaps=false, auto-aplica swap al aceptar)
- [x] Deploy con `--no-verify-jwt`; `supabase/config.toml` con `[functions.respond-to-swap] verify_jwt = false`
- [x] Notificación a User B cuando se crea la solicitud (Módulo 5)
- [x] Notificación a ambos cuando se aprueba/rechaza (Módulo 5)

---

### 📢 **Módulo 5: Notificaciones**

#### **5.1 Push Notifications (Capacitor)** — ESTRUCTURA COMPLETA
- [x] Configurar Capacitor Push Notifications
  - [x] Cliente: `PushNotificationRegistration` (permisos, `register()`, envío de token a `register-push-token`); solo iOS/Android nativos
  - [ ] Setup iOS (APNs): AppDelegate + capability; ver `docs/push-notifications.md`
  - [ ] Setup Android (FCM): `google-services.json`, canal, icono; ver `docs/push-notifications.md`

- [x] Tabla `push_tokens` (migración `20250204000000_push_tokens.sql`):
  - id (uuid), user_id (uuid, ref auth.users), platform (ios|android|web), token (text, unique), created_at, last_used_at
  - RLS: SELECT propio; INSERT/UPDATE vía Edge Function `register-push-token` (service_role)

- [x] Edge Function `register-push-token`: auth JWT; body `{ token, platform }`; upsert en `push_tokens` por `token`

- [x] Edge Function `send-notification` (completar)
  - [x] Enviar push a dispositivos del usuario: lee `push_tokens` por `userId`; FCM (Android) si `FIREBASE_SERVICE_ACCOUNT_JSON`; APNs (iOS) pendiente
  - [ ] Fallback a email si falla (Resend/SendGrid)
  - [ ] Registrar intentos de envío (opcional)

#### **5.2 Eventos de Notificación** — CONCLUIDO
- [x] Request submitted → Notificar a manager
- [x] Request accepted (swap) → Notificar a requester (y manager: opcional)
- [x] Request approved → Notificar a todos los involucrados
- [x] Request rejected → Notificar al requester
- [x] Shift assigned → Notificar al usuario asignado (create-shift, update-shift, bulk-update-shifts)
- [x] Shift changed → Notificar al usuario afectado (update-shift: modificado, desasignado)
- [x] Schedule published → Notificar al asignado cuando draft→published (update-shift)

#### **5.3 Email Notifications (Fallback)**
- [ ] Configurar email templates en Supabase
- [ ] Template para cada evento
- [ ] Opción para usuario de activar/desactivar emails

#### **5.4 In-App Notifications** — CONCLUIDO
- [x] Tabla `notifications`:
  ```sql
  - id (uuid)
  - user_id (uuid, ref auth.users)
  - title (text)
  - message (text)
  - type (text: request, shift, system)
  - entity_type (text: shift_request, shift, etc.)
  - entity_id (uuid)
  - read_at (timestamptz, nullable)
  - created_at (timestamptz)
  ```

- [x] Component `NotificationBell.tsx` (icono con badge)
- [x] Component `NotificationsList.tsx`
- [x] Marcar como leída
- [x] Link a la entidad relacionada

---

### 📊 **Módulo 6: Disponibilidad y Eventos**

#### **6.1 Registrar Disponibilidad (Staff)** — CONCLUIDO
- [x] Página `/dashboard/staff/availability`
  - [x] Calendario de disponibilidad (FullCalendar: mes, lista; clic en día para agregar, clic en evento para editar)
  - [x] Agregar eventos:
    - Vacaciones
    - Licencia médica
    - Capacitación
    - No disponible (sin especificar)
  - [x] Editar/eliminar eventos (modal con Eliminar; confirmación de eliminación con `ConfirmModal`, no `confirm()` nativo)

- [x] Component `AvailabilityCalendar.tsx`
- [x] Component `AvailabilityEventModal.tsx` (crear/editar/eliminar; eliminar con `ConfirmModal`)
- [x] RLS: `availability_insert_member`, `availability_update_member`, `availability_delete_member` (migración `20250205000000_availability_events_member_rls.sql`)

#### **6.2 Ver Disponibilidad (Manager)** — CONCLUIDO
- [x] Página `/dashboard/manager/availability`
  - [x] Ver disponibilidad de todos los miembros
  - [x] Filtrar por usuario
  - [x] Filtrar por tipo de evento
  - [x] Vista calendario

- [x] Bloquear asignación de turnos si hay conflicto con availability (RPC `check_shift_conflicts` y Create/EditShiftModal)

---

### 📈 **Módulo 7: Reportes y Exports**

#### ✅ **7.1 Exportar Horarios** — CONCLUIDO
- [x] Edge Function `export-schedule` (completar)
  - [x] Generar CSV con turnos del período (nombre asignado, ubicación; BOM UTF-8; escapado)
  - [x] Generar Excel con formato (.xlsx vía esm.sh/xlsx)
  - [ ] Generar PDF (opcional, fase 2; fuera de scope)

- [x] Página `/dashboard/admin/exports`
  - [x] Seleccionar rango de fechas
  - [x] Seleccionar formato (CSV, Excel)
  - [x] Botón descargar

- [x] Component `ExportScheduleForm.tsx`

#### **7.2 Reportes Básicos** — CONCLUIDO
- [x] Página `/dashboard/admin/reports`
  - [x] Reporte: Turnos por usuario (count por tipo)
  - [x] Reporte: Distribución de noches/fines de semana
  - [x] Reporte: Turnos sin asignar
  - [x] Reporte: Solicitudes por estado
  - [x] Gráficos (Recharts: barras, torta)

- [x] Component `ReportsBasicDashboard.tsx`

---

### 🔍 **Módulo 8: Audit Log y Trazabilidad**

#### **8.1 Visualizar Audit Log** — CONCLUIDO
- [x] Página `/dashboard/admin/audit`
  - [x] Listar eventos del audit log
  - [x] Filtros:
    - Por entidad (shift_request, membership, organization_invitation)
    - Por actor (usuario que realizó la acción)
    - Por acción (request_approved, request_rejected, swap_accepted/declined, update, delete, accept)
    - Por rango de fechas
  - [x] Ver detalles de cada evento (modal):
    - Snapshot antes
    - Snapshot después
    - Comentario; enlace a solicitud cuando entity=shift_request

- [x] Component `AuditLogList.tsx`
- [x] Component `AuditLogDetailModal.tsx`
- [x] Índice `audit_log_org_created_idx` (org_id, created_at desc) en migración `20250202000000_audit_log_index.sql`

#### **8.2 Triggers Automáticos** — CONCLUIDO
- [x] Trigger para registrar cambios en `shifts`
- [x] Trigger para registrar cambios en `shift_requests`
- [x] Trigger para registrar cambios en `memberships`
- [x] Función `log_audit_event(org_id, entity, entity_id, action, before, after, comment)` (actor_id vía auth.uid())

---

### 🔒 **Módulo 9: Seguridad y Permisos Avanzados**

#### **9.1 Refinar Políticas RLS** — CONCLUIDO
- [x] Política para INSERT en shifts (solo manager/admin) — `shifts_insert_manager`, helper `user_can_manage_shifts(oid)` (migración `20250207000000_refine_rls_policies.sql`)
- [x] Política para UPDATE en shifts (solo manager/admin) — `shifts_update_manager`
- [x] Política para DELETE en shifts (solo admin) — `shifts_delete_admin` (org_admin o superadmin; team_manager no puede eliminar)
- [x] Política para INSERT en shift_requests (user, manager) — `shift_requests_insert_member` (20250130000000)
- [x] Política para UPDATE en shift_requests (manager para approve/reject) — `shift_requests_update_manager_approve_reject`; target swap: `shift_requests_update_target_swap_respond` (20250207000000)
- [x] Política para INSERT/UPDATE/DELETE en memberships (solo org_admin) — `memberships_insert_org_admin`, `_update_org_admin`, `_delete_org_admin` (org_admin en su org; no puede asignar rol superadmin)
- [x] Política para INSERT/UPDATE/DELETE en availability_events (propio usuario) — `availability_insert_member`, `_update_member`, `_delete_member` (20250205000000)

#### **9.2 Validaciones en Edge Functions** — CONCLUIDO
- [x] Validar permisos antes de cada operación privilegiada (helpers en `_shared/auth.ts`: checkCanManageShifts, checkCanApproveRequests, checkCanManageOrg, checkCanDeleteShifts; usados en EFs privilegiadas)
- [x] Rate limiting (prevenir abuse): `checkRateLimit()` en `_shared/auth.ts`, invocado en EFs; por ahora no-op `{ allowed: true }`; se puede conectar a tabla/RPC después
- [x] Logging de intentos fallidos: `logFailedAttempt()` — console.error + insert en `audit_log` (entity=failed_auth); se llama en respuestas 401/403 (y 429) de las EFs

#### **9.3 Configuraciones de Org** — CONCLUIDO
- [x] Tabla `org_settings` (migración `20250206000000_org_settings.sql`):
  - org_id (pk, ref organizations), allow_self_assign_open_shifts, require_approval_for_swaps, require_approval_for_give_aways, min_rest_hours, settings_json, created_at, updated_at
  - RLS: SELECT miembros; INSERT/UPDATE org_admin y superadmin

- [x] Página `/dashboard/admin/settings`
  - [x] Editar configuraciones de la org (org_admin: su org; superadmin: selector de org)
  - [x] Configurar reglas de descanso (min_rest_hours usado en check_shift_conflicts y en create/update/bulk/copy/generate-shifts)

- [x] Component `OrgSettingsForm.tsx`
  - [x] allow_self_assign_open_shifts, require_approval_for_swaps, require_approval_for_give_aways, min_rest_hours
  - [x] Uso en flujos: allow_self_assign_open_shifts → take_open auto-aprobado (EF create-request); require_approval_for_give_aways → give_away auto-aprobado (create-request); require_approval_for_swaps → al aceptar contraparte, swap auto-aplicado (respond-to-swap)

---

### 📱 **Módulo 10: Optimización para Mobile**

#### **10.1 UI/UX Mobile** — PARCIAL
- [x] Adaptar calendario para pantallas pequeñas
  - [x] Vista compacta (toolbar reducida en móvil: Mes + Lista; dayMaxEvents 2)
  - [x] Bottom sheet para detalles (`ShiftDetailModal`: en móvil anclado abajo, asa, max-h 85vh, safe-area)
  - [x] Gestos de swipe (móvil): swipe horizontal izquierda/derecha → período siguiente/anterior (wrapper touch + `calendarApi.next()/prev()`)

- [x] Navbar móvil (bottom navigation)
  - [x] `DashboardNav`: en móvil barra superior compacta (Turnia, NotificationBell, menú) + bottom nav fija (Inicio, Solicitudes, Disponibilidad, Notificaciones, Más)
  - [x] Sheet «Más»: Lista de turnos (manager), Admin (org_admin), Cerrar sesión; `pb-[env(safe-area-inset-bottom)]`
  - [x] Enlaces según rol (useScheduleOrg): Inicio→/manager o /staff, Solicitudes, Disponibilidad

- [x] Optimizar formularios para touch
  - [x] Botones y controles interactivos: `min-h-[44px]` / `min-w-[44px]` (ShiftCalendarFilters, ShiftList, ManagerAvailabilityFilters)

- [ ] Mejorar accesibilidad (ARIA, teclado, contraste; base con aria-labels en nav y modales).
  - Parcial: hint SR + button hints en calendario.
  - Parcial: menú «Más» (`DashboardNav`) con `Escape`, ARIA (`aria-controls`/`aria-labelledby`), foco al abrir/cerrar y focus-trap simple (Tab no escapa detrás del overlay) + botón “Cerrar menú”.
  - Parcial: `NotificationBell` (popover) con `Escape`, foco al abrir/cerrar y `aria-controls`/`aria-haspopup`.

#### **10.2 Funcionalidades Móviles**
- [x] Quick actions (shortcuts)
  - [x] Ver mis próximos turnos
  - [x] Solicitar cambio rápido
  - [x] Ver quién está de turno ahora
  - Implementado en `/dashboard/staff` y `/dashboard/manager` con widgets y accesos rápidos.

- [x] Widget de "On-call Now" (quién está de guardia)
  - `OnCallNowWidget` con fallback offline (cache local).
- [x] Deep links para notificaciones
  - `entity_type=shift_request` → requests; `entity_type=shift` → `/dashboard/manager?shift=<id>` (campana + página).

#### **10.3 Offline Support (Fase 2)**
- [x] Cache de turnos próximos
- [x] Sincronización al reconectar
- [x] Indicador de estado offline
  - Implementado con fallback a cache en `ShiftCalendar`/`ShiftList` + estado online/offline global.
  - Archivos: `src/hooks/useOnlineStatus.ts`, `src/lib/cache.ts`, `src/components/offline/OfflinePill.tsx`,
    `src/components/calendar/ShiftCalendar.tsx`, `src/components/shifts/ShiftList.tsx`, `src/components/dashboard/DashboardNav.tsx`

---

### 🎨 **Módulo 12: UI/UX Polish**

#### **12.1 Diseño Consistente**
- [ ] Sistema de diseño completo (components library)
- [x] Buttons con estados (hover, focus, disabled, loading)
  - `src/components/ui/Button.tsx`, `src/components/ui/LinkButton.tsx`
- [x] Inputs consistentes
  - `src/components/ui/Input.tsx`, `src/components/ui/Select.tsx`, `src/components/ui/Textarea.tsx`
- [ ] Modales y dialogs
  - *(Opcional)* extraer un `Modal` base para reducir duplicación (overlay/panel/escape).
- [x] Toasts y feedback visual
  - `src/components/ui/toast/ToastProvider.tsx` (montado globalmente vía `src/components/providers/AppProviders.tsx` + `src/app/layout.tsx`)
- [x] Loading states y skeletons
  - `src/components/ui/Skeleton.tsx`, `src/components/ui/Spinner.tsx`
  - Aplicado en páginas y widgets: `src/app/dashboard/{manager,staff}/page.tsx`, `src/components/notifications/NotificationBell.tsx`,
    `src/components/mobile/{MyUpcomingShiftsWidget,OnCallNowWidget}.tsx`

#### **12.2 Animaciones y Transiciones**
- [ ] Transiciones suaves entre vistas
- [ ] Animaciones de carga
- [x] Feedback visual en acciones (success, error)
  - Toasts en flujos clave: `CreateShiftModal`, `EditShiftModal`, `ShiftDetailModal`, `MyRequestsList`, `RequestsInbox`, `RequestDetailModal`

#### **12.3 Dark Mode**
- [x] Toggle de dark mode
- [x] Persistir preferencia
- [x] Colores consistentes en dark mode

#### **12.4 Accesibilidad**
- [ ] ARIA labels
- [ ] Navegación por teclado
- [ ] Contraste suficiente
- [ ] Screen reader support

---

### 📚 **Módulo 14: Documentación**

#### **14.1 Documentación Técnica**
- [ ] Arquitectura del sistema
- [ ] Diagrama de base de datos
- [ ] API documentation
- [ ] Guía de deployment

#### **14.2 Documentación de Usuario**
- [ ] Manual de usuario para Admin
- [ ] Manual de usuario para Manager
- [ ] Manual de usuario para Staff
- [ ] FAQs

#### **14.3 Videos Tutoriales**
- [ ] Cómo crear una organización
- [ ] Cómo invitar usuarios
- [ ] Cómo crear y asignar turnos
- [ ] Cómo solicitar cambios

---

## 🎯 ROADMAP SUGERIDO (Orden de Implementación)

### **FASE 1: MVP Core (2-3 semanas)**
1. ✅ Base de datos y auth (COMPLETADO)
2. ✅ **Sistema de Invitaciones** (COMPLETADO)
3. ✅ Gestión básica de Organizations (COMPLETADO)
4. ✅ **Tipos de turno por organización** (2.3: UI, letra, color, horario, badge circular) — CONCLUIDO
5. ✅ Crear y asignar turnos (CreateShiftModal, EditShiftModal, Edge Functions create/update/delete-shift; solo fecha, horas desde el tipo)
6. ✅ Calendario básico (lectura): FullCalendar, colorear por tipo, círculo+usuario, orden por hora

### **FASE 2: Requests Workflow (2 semanas)**
6. ✅ Sistema de solicitudes (give away, swap, take open) — COMPLETADO (my-requests, cancelar)
7. ✅ Bandeja de aprobaciones para manager — COMPLETADO (RequestsInbox, RequestDetailModal, approve-request)
8. ✅ Workflow de swap con aceptación de contraparte (4.4) — COMPLETADO (AcceptSwapButton, PendingSwapsForYou, respond-to-swap)
9. ✅ Notificaciones in-app (5.4) — COMPLETADO (tabla notifications, trigger, NotificationBell, NotificationsList, approve-request/respond-to-swap)

### **FASE 3: Calendar & Views (1-2 semanas)**
10. ✅ Implementar FullCalendar completo — COMPLETADO
11. ✅ Lista de turnos con filtros — COMPLETADO (3.4)
12. ✅ Validaciones de conflictos — COMPLETADO (RPC check_shift_conflicts)

### **FASE 4: Notifications & Mobile (1-2 semanas)**
13. Push notifications (Capacitor)
14. Optimización UI mobile
15. ✅ In-app notifications (5.4) — COMPLETADO

### **FASE 5: Reports & Admin Features (1 semana)**
16. ✅ Exports (CSV, Excel) — COMPLETADO (export-schedule, /dashboard/admin/exports, ExportScheduleForm)
17. ✅ Reportes básicos — COMPLETADO (ReportsBasicDashboard, /dashboard/admin/reports; turnos por usuario, nocturnos/fin de semana, sin asignar, solicitudes por estado; Recharts)
18. ✅ Audit log viewer — COMPLETADO (8.1: /dashboard/admin/audit, AuditLogList, AuditLogDetailModal; filtros entidad, actor, acción, fechas; snapshot antes/después)

### **FASE 6: Polish & Testing (1 semana)**
19. UI/UX improvements
20. Testing completo
21. Bug fixes

### **FASE 7: Deploy & Launch (1 semana)**
22. Deploy a producción
23. Documentación final
24. Marketing materials

---

## 📊 MÉTRICAS DE PROGRESO

### Estado General del Proyecto
- **Total de módulos**: 14
- **Módulos completados**: Invitaciones (M1), 2.1 Organizaciones, 2.2 Miembros, 2.3 Tipos de turno, **3.3 Operaciones en lote**, **3.4 Lista de turnos**, 4.1 Crear solicitudes, 4.2 Bandeja manager, 4.3 Flujo de aprobación, **4.4 Workflow de Swap**, **5.4 In-App Notifications**, **7.1 Exportar horarios**, **7.2 Reportes básicos**, **8.1 Visualizar Audit Log**, **8.2 Triggers automáticos**, **9.1 Refinar RLS** (+ infraestructura base)
- **Módulos en curso**: —
- **Progreso estimado**: ~47–49%

### Tareas por Estado
- ✅ **Completadas**: ~155 tareas (véase listado abajo)
- 🔄 **En progreso**: —
- ⏳ **Pendientes**: ~120 tareas (5.1 push, 5.3 email, disponibilidad, reportes, etc.)

### 📋 Tareas completadas (listado)

#### Infraestructura y base
- [x] Next.js 16, Supabase (Auth + DB), Capacitor, Tailwind, TypeScript
- [x] Tablas: organizations, profiles, memberships, shifts, shift_requests, availability_events, audit_log; RLS; trigger perfil
- [x] Login, Signup, Middleware, AuthGuard
- [x] RBAC: 5 roles, helpers canManageOrg, canManageShifts, canCreateRequests, canApproveRequests
- [x] Rutas: /, /login, /signup, /dashboard, /dashboard/admin, /manager, /staff, /viewer

#### Módulo 1 — Invitaciones
- [x] Tabla organization_invitations, RLS, índices
- [x] Edge Functions: invite-user, validate-invitation, accept-invitation, resend-invitation, send-invitation-reminder
- [x] /dashboard/admin/invite (InviteUserForm, InvitationsList: copiar, cancelar, reenviar, prorrogar)
- [x] /invite?token=... (AcceptInvitationForm: registro/login, aceptar)
- [x] Emails (Resend): invitación, confirmación, recordatorio (opcional)

#### Módulo 2.1 — Organizaciones
- [x] /dashboard/admin/organizations: OrganizationList (superadmin), OrganizationSettings (org_admin)
- [x] Crear, editar (nombre, slug), eliminar (CreateOrganizationModal, confirmación)

#### Módulo 2.2 — Miembros
- [x] /dashboard/admin/members: MembersList, EditMembershipForm, MemberDetails
- [x] Cambiar rol (change_user_role), eliminar de org (remove_from_org)

#### Módulo 2.3 — Tipos de turno
- [x] organization_shift_types (name, letter, color, sort_order, start_time, end_time), RLS, backfill
- [x] shifts con shift_type_id (FK)
- [x] /dashboard/admin/shift-types: ShiftTypesList, ShiftTypeFormModal (crear, editar, eliminar; Auto color; Turno 24h)
- [x] formatShiftTypeSchedule, generateColorFromName, isColorLight; badge circular
- [x] export-schedule: join con tipos

#### Módulo 3.1 — Calendario
- [x] ShiftCalendar (FullCalendar): mes, semana, día, lista; esLocale
- [x] Carga turnos + organization_shift_types; colorear por tipo; círculo con letra + usuario; eventOrder=start
- [x] ShiftCalendarFilters: tipo (checkboxes), usuario, estado
- [x] ShiftDetailModal: detalle, editar, eliminar, solicitar cambio (dar de baja, intercambiar, tomar turno)

#### Módulo 3.2 — Crear/Editar turnos
- [x] CreateShiftModal, EditShiftModal: fecha, tipo, asignar, ubicación, estado; horas desde tipo
- [x] Edge Functions: create-shift, update-shift, delete-shift (--no-verify-jwt; refreshSession)
- [x] RPC check_shift_conflicts (overlap, availability_events, min_rest_hours); validación en modales y EFs

#### Módulo 3.3 — Operaciones en lote
- [x] ShiftList: checkboxes de selección, «seleccionar todos en página»; BulkOperationsPanel (asignar, desasignar, cancelar)
- [x] Edge Function bulk-update-shifts (validación conflictos al asignar)
- [x] CopyShiftsModal + Edge Function copy-shifts (período origen → destino, opción asignaciones)
- [x] ShiftTemplateForm + Edge Function generate-shifts-from-pattern (patrón por día de la semana, rango fechas, usar asignaciones)
- [x] Botones en /dashboard/manager/shifts: Copiar período, Generar desde patrón

#### Módulo 3.4 — Lista de turnos
- [x] ShiftList: tabla (fecha, horario, tipo, usuario, estado), filtros (tipo, usuario, rango fechas, estado)
- [x] Paginación, ordenar por fecha (asc/desc), acciones Editar/Eliminar; clic fila → ShiftDetailModal
- [x] /dashboard/manager/shifts; enlace en layout y en Calendario

#### Módulo 4.1 — Crear solicitudes
- [x] GiveAwayRequestModal, TakeOpenRequestModal (vía EF create-request; auto-aprueba según org_settings), SwapRequestModal (comentario; evita duplicados pending)
- [x] Edge Function create-request (take_open, give_away; auto-aprueba si allow_self_assign_open_shifts / !require_approval_for_give_aways)
- [x] RLS shift_requests_insert_member, user_can_create_requests
- [x] /dashboard/staff/my-requests (MyRequestsList: estados, cancelar si draft/submitted/accepted)
- [x] useScheduleOrg: canCreateRequests, canApproveRequests

#### Módulo 4.2 — Bandeja manager
- [x] RequestsInbox: listar, filtrar tipo/estado, ordenar
- [x] RequestDetailModal: detalle, aprobar, rechazar, comentario
- [x] /dashboard/manager/requests

#### Módulo 4.3 — Flujo de aprobación
- [x] Edge Function approve-request: permisos, estados submitted/accepted; give_away→sin asignar, take_open→asignar, swap→intercambiar; approved; audit_log
- [x] Rechazo (action=reject): rejected, comentario en audit_log

#### Módulo 4.4 — Workflow Swap
- [x] Flujo: submitted → User B acepta (accepted) o rechaza (cancelled) → Manager aprueba (approved) o rechaza (rejected); si require_approval_for_swaps=false, swap se aplica al aceptar
- [x] AcceptSwapButton, PendingSwapsForYou en /dashboard/staff/my-requests
- [x] Edge Function respond-to-swap (accept/decline; audit_log; auto-aplica swap si require_approval_for_swaps=false); verify_jwt=false

#### Módulo 5.4 — In-App Notifications
- [x] Tabla notifications, RLS, trigger notify_on_shift_request_insert (swap→target; submitted→managers)
- [x] approve-request y respond-to-swap: insertar notificaciones (aprobado/rechazado; swap aceptado/rechazado)
- [x] NotificationBell (badge, desplegable), NotificationsList, /dashboard/notifications
- [x] Marcar como leída, link a entidad (?request=id en manager/requests)

#### Módulo 7.1 — Exportar horarios ✅
- [x] Edge Function export-schedule: auth, CSV (asignado, ubicación, BOM, escapado), Excel (esm.sh/xlsx)
- [x] /dashboard/admin/exports, ExportScheduleForm (rango fechas, CSV/Excel, descargar)

#### Módulo 7.2 — Reportes básicos ✅
- [x] /dashboard/admin/reports: rango de fechas, selector de org (superadmin)
- [x] ReportsBasicDashboard: turnos por usuario (tabla por tipo), distribución nocturnos/fines de semana (barra), turnos sin asignar (card + enlace a lista), solicitudes por estado (torta + tabla)
- [x] Recharts: BarChart, PieChart, Tooltip, Cell

#### Módulo 8.1 — Visualizar Audit Log ✅
- [x] /dashboard/admin/audit: selector de org (superadmin), AuditLogList
- [x] Filtros: entidad (shift_request, membership, organization_invitation), actor (miembros org), acción, rango fechas
- [x] Tabla: fecha, entidad, acción, actor, comentario; clic fila → AuditLogDetailModal
- [x] AuditLogDetailModal: snapshot antes/después (JSON), comentario, enlace a solicitud si entity=shift_request
- [x] Paginación 50 por página; índice audit_log_org_created_idx

#### Módulo 8.2 — Triggers automáticos ✅
- [x] Función `log_audit_event(org_id, entity, entity_id, action, before, after, comment)`; `audit_trigger_fn` (TG_TABLE_NAME → shift, shift_request, membership; TG_OP → insert, update, delete)
- [x] Triggers `audit_shifts`, `audit_shift_requests`, `audit_memberships` (AFTER INSERT OR UPDATE OR DELETE)
- [x] AuditLogList: etiquetas `shift` (Turno), `insert` (Creación); AuditLogDetailModal: enlace «Ver turno» cuando entity=shift

#### Módulo 9.1 — Refinar Políticas RLS ✅
- [x] Helper `user_can_manage_shifts(oid)` (team_manager, org_admin, superadmin en esa org)
- [x] Shifts: `shifts_insert_manager`, `shifts_update_manager` (manager o admin); `shifts_delete_admin` (solo org_admin o superadmin)
- [x] Shift_requests: `shift_requests_update_manager_approve_reject` (approve/reject); `shift_requests_update_target_swap_respond` (target aceptar/rechazar swap)
- [x] Memberships: `memberships_insert_org_admin`, `_update_org_admin`, `_delete_org_admin` (org_admin en su org; no puede asignar superadmin)
- [x] Availability_events: ya en 20250205000000 (insert/update/delete propio usuario)
- [x] Migración `20250207000000_refine_rls_policies.sql`

#### Módulo 10.1 — UI/UX Mobile (parcial) ✅
- [x] Hook `useIsMobile(breakpoint)`
- [x] `ShiftDetailModal`: bottom sheet en móvil (anclado abajo, asa, max-h 85vh, safe-area)
- [x] `ShiftCalendar`: toolbar Mes+Lista y dayMaxEvents 2 en móvil
- [x] `DashboardNav`: top compacto + bottom nav (Inicio, Solicitudes, Disponibilidad, Notificaciones, Más); sheet «Más» (Lista turnos, Admin, Cerrar sesión); `pb-24` en main móvil
- [x] Controles táctiles min 44px: ShiftCalendarFilters, ShiftList, ManagerAvailabilityFilters

---

## 🎯 SIGUIENTE PASO INMEDIATO

**Módulo 3 (Calendario y turnos)** — Hecho: FullCalendar, `ShiftDetailModal` (editar, eliminar, **solicitar cambio**), Create/EditShiftModal, Edge Functions create/update/delete-shift, filtros, validaciones (RPC `check_shift_conflicts`).

**Módulo 4.1 (Crear solicitudes)** — Hecho: acción «solicitar cambio» desde `ShiftDetailModal`; `GiveAwayRequestModal`, `TakeOpenRequestModal`, `SwapRequestModal`; RLS para INSERT; página `/dashboard/staff/my-requests` (listar, cancelar si pending).

**Módulo 4.2 y 4.3 (Bandeja y aprobación)** — Hecho: `RequestsInbox`, `RequestDetailModal`, página `/dashboard/manager/requests`; Edge Function `approve-request` (aprobar/rechazar, aplicar cambios en turnos, audit_log).

**Módulo 4.4 (Workflow de Swap)** — Hecho: `AcceptSwapButton`, `PendingSwapsForYou`, Edge Function `respond-to-swap`; flujo submitted → accepted/cancelled (User B) → approved (manager o auto si require_approval_for_swaps=false). Deploy con `--no-verify-jwt`.

**Módulo 5.4 (In-App Notifications)** — Hecho: tabla `notifications`, trigger al crear solicitud (swap→User B, todas→managers), `NotificationBell`, `NotificationsList`, `/dashboard/notifications`; notificaciones en `approve-request` y `respond-to-swap`; marcar como leída, enlace a entidad.

**Módulo 7.1 (Exportar horarios)** — Hecho: Edge Function `export-schedule` (auth, CSV, Excel; asignado, ubicación); `/dashboard/admin/exports`, `ExportScheduleForm`.

**Módulo 7.2 (Reportes básicos)** — Hecho: `/dashboard/admin/reports`, `ReportsBasicDashboard` (rango fechas; turnos por usuario/tipo, distribución nocturnos y fines de semana, turnos sin asignar, solicitudes por estado; Recharts).

**Módulo 8.1 (Visualizar Audit Log)** — Hecho: `/dashboard/admin/audit`, `AuditLogList` (filtros: entidad, actor, acción, rango fechas; paginación), `AuditLogDetailModal` (snapshot antes/después, comentario, enlace a solicitud); índice `audit_log_org_created_idx`.

**Módulo 5.1 (Push Notifications)** — Estructura lista; invocación desde approve/respond hecha:
- [x] Tabla `push_tokens`, RLS; Edge Function `register-push-token` (auth, upsert por token)
- [x] Cliente: `PushNotificationRegistration` + `PushNotificationRegistrationLoader` en layout dashboard; Capacitor `register()` y envío a `register-push-token` en iOS/Android
- [x] `send-notification`: lee `push_tokens`, envía vía FCM (Android) si `FIREBASE_SERVICE_ACCOUNT_JSON`; APNs (iOS) pendiente; `docs/push-notifications.md`
- [x] Invocar `send-notification` desde approve-request y respond-to-swap (push al aprobar/rechazar y al aceptar/rechazar swap)
- [x] AppDelegate (iOS): `didRegisterForRemoteNotificationsWithDeviceToken` / `didFailToRegisterForRemoteNotificationsWithError`; Android: `POST_NOTIFICATIONS`, canal `turnia_notifications` (manifest + `MainActivity`), `docs/push-notifications.md` actualizado; `google-services.json` en `.gitignore`
- [ ] Usuario: FCM (`google-services.json` en `android/app/`, `FIREBASE_SERVICE_ACCOUNT_JSON` en Supabase), APNs (key/cert en backend para envío iOS)

**Pendiente:**
1. ~~Opción «sugerir reemplazo» en Give Away (4.1, opcional)~~ — Hecho.

**Módulo 8.2 (Triggers automáticos)** — Hecho: función `log_audit_event`, `audit_trigger_fn`; triggers en `shifts`, `shift_requests`, `memberships`; etiquetas en AuditLog (shift, insert) y enlace «Ver turno» en el modal.

**Módulo 9.1 (Refinar Políticas RLS)** — Hecho: migración `20250207000000_refine_rls_policies.sql`. Helper `user_can_manage_shifts(oid)`. Shifts: INSERT/UPDATE manager o admin; DELETE solo org_admin o superadmin. Shift_requests: UPDATE manager (approve/reject), UPDATE target (swap accept/decline). Memberships: INSERT/UPDATE/DELETE org_admin en su org (sin asignar superadmin). Availability_events ya estaba (20250205000000).

**Módulo 9.2 (Validaciones en Edge Functions)** — Hecho: `_shared/auth.ts` con getAuthUser, checkCanManageShifts, checkCanApproveRequests, checkCanManageOrg, checkCanDeleteShifts, logFailedAttempt, checkRateLimit. EFs privilegiadas: 401/403/429 con logFailedAttempt; checkRateLimit (no-op); delete-shift usa checkCanDeleteShifts (solo org_admin/superadmin). Opción «sugerir reemplazo» en Give Away: `suggested_replacement_user_id` en shift_requests, GiveAwayRequestModal, create-request, RequestDetailModal.

**Módulo 10.1 (UI/UX Mobile — parcial)** — Hecho: `useIsMobile`; `ShiftDetailModal` como bottom sheet en móvil (asa, max-h 85vh, safe-area); `ShiftCalendar` toolbar reducida (Mes + Lista) y dayMaxEvents 2 en móvil; `DashboardNav` con bottom navigation (Inicio, Solicitudes, Disponibilidad, Notificaciones, Más), sheet «Más» (Lista turnos, Admin, Cerrar sesión), enlaces por rol; `main` con `pb-24` en móvil; controles táctiles min 44px (ShiftCalendarFilters, ShiftList, ManagerAvailabilityFilters). Pendiente: gestos swipe en calendario, accesibilidad ampliada.

*Opcional: reordenar tipos (`sort_order`), iterar color si ya existe en la org; notificaciones email (5.3), push (5.1).*
