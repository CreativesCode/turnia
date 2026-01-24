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
      { event: 'UPDATE', schema: 'public', table: 'shifts', filter: `team_id=eq.${teamId}` },
      handleUpdate
    )
    .subscribe();
  
  return () => { supabase.removeChannel(channel); };
}, [teamId]);

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
- ✅ Tabla `teams` (servicios/departamentos por org)
- ✅ Tabla `profiles` (extensión de auth.users)
- ✅ Tabla `memberships` (roles por org/team)
- ✅ Tabla `shifts` (turnos con tipos: day/night/24h/custom)
- ✅ Tabla `shift_requests` (solicitudes: give_away, swap, take_open)
- ✅ Tabla `availability_events` (vacaciones, bajas, etc.)
- ✅ Tabla `audit_log` (trazabilidad inmutable)
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
- ✅ Memberships con scope de org y team

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
- ✅ `ShiftList.tsx` (estructura básica)
- ✅ `RequestsInbox.tsx` (estructura básica)
- ✅ `AuthGuard.tsx` (protección de rutas)

#### 7. **Edge Functions (Estructura Preparada)**
- ✅ `approve-request` (esqueleto)
- ✅ `send-notification` (esqueleto)
- ✅ `export-schedule` (esqueleto)

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

---

## 🚀 MÓDULOS Y FUNCIONALIDADES PENDIENTES

### ✅ **Módulo 1: Sistema de Invitaciones a Organizaciones** — CONCLUIDO

**Objetivo**: Permitir que usuarios sean invitados a una organización con un rol específico y se registren directamente en esa organización.

##### **Tareas realizadas:**

1. **Base de datos**
   - [x] Tabla `organization_invitations` (id, org_id, team_id, email, role, token, invited_by, status, expires_at, metadata, created_at, accepted_at)
   - [x] Políticas RLS para `organization_invitations`
   - [x] Índices en `token` y `email`

2. **API/Edge Functions**
   - [x] **Edge Function: `invite-user`** — Valida org_admin/superadmin, crea invitación, token, expiración 7 días. Enlace para copiar/pegar. (Email vía Resend opcional cuando haya dominio; ver `docs/invitation-emails.md`.)
   - [x] **Edge Function: `validate-invitation`** — Verifica token, estado y expiración; devuelve org, rol, team, email.
   - [x] **Edge Function: `accept-invitation`** — Crea membership, marca `accepted`, `accepted_at`, audit_log.

3. **Frontend - Invitar Usuarios**
   - [x] Página `/dashboard/admin/invite` con formulario (email, rol, team opcional, mensaje opcional)
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

### 📊 **Módulo 2: Gestión de Organizaciones y Teams**

#### **2.1 Crear y Gestionar Organizaciones**
- [ ] Página `/dashboard/admin/organizations`
  - [ ] Listar organizaciones (para superadmin)
  - [ ] Ver detalles de la org actual (para org_admin)
  - [ ] Editar nombre, slug, configuraciones
  - [ ] Eliminar organización (con confirmación)

- [ ] Component `OrganizationSettings.tsx`
- [ ] Component `OrganizationList.tsx` (solo superadmin)

#### **2.2 Crear y Gestionar Teams**
- [ ] Página `/dashboard/admin/teams`
  - [ ] Listar teams de la org
  - [ ] Crear nuevo team (nombre, slug)
  - [ ] Editar team
  - [ ] Eliminar team (con validación de turnos activos)
  - [ ] Ver miembros del team

- [ ] Component `TeamsList.tsx`
- [ ] Component `CreateTeamForm.tsx`
- [ ] Component `EditTeamForm.tsx`

#### **2.3 Gestión de Miembros**
- [ ] Página `/dashboard/admin/members`
  - [ ] Listar todos los miembros de la org
  - [ ] Ver memberships por usuario
  - [ ] Cambiar rol de un usuario
  - [ ] Asignar/desasignar usuario a teams
  - [ ] Eliminar usuario de la org

- [ ] Component `MembersList.tsx`
- [ ] Component `EditMembershipForm.tsx`
- [ ] Component `MemberDetails.tsx`

- [ ] API/RPC functions:
  - [ ] `change_user_role(user_id, org_id, new_role)`
  - [ ] `assign_to_team(user_id, team_id, role)`
  - [ ] `remove_from_org(user_id, org_id)`

---

### 📅 **Módulo 3: Calendario y Gestión de Turnos**

#### **3.1 Visualización de Calendario**
- [ ] Implementar FullCalendar en `ShiftCalendar.tsx`
  - [ ] Vista mensual (daygrid)
  - [ ] Vista semanal (timegrid)
  - [ ] Vista diaria (timegrid)
  - [ ] Vista lista (list)
  - [ ] Cambio entre vistas

- [ ] Cargar turnos desde Supabase
  - [ ] Filtrar por team
  - [ ] Filtrar por tipo de turno
  - [ ] Filtrar por usuario
  - [ ] Filtrar por estado (draft/published)

- [ ] Colorear turnos según tipo:
  - [ ] Day (amarillo)
  - [ ] Night (azul)
  - [ ] 24h (morado)
  - [ ] Custom (gris)

- [ ] Mostrar info al hacer click en turno:
  - [ ] Horario
  - [ ] Usuario asignado
  - [ ] Team
  - [ ] Tipo
  - [ ] Ubicación
  - [ ] Acciones (editar, eliminar, solicitar cambio)

#### **3.2 Crear y Editar Turnos (Manager/Admin)**
- [ ] Component `CreateShiftModal.tsx`
  - [ ] Formulario:
    - [ ] Seleccionar team
    - [ ] Fecha y hora inicio
    - [ ] Fecha y hora fin
    - [ ] Tipo de turno
    - [ ] Asignar usuario (opcional)
    - [ ] Ubicación (opcional)
    - [ ] Estado (draft/published)

- [ ] Component `EditShiftModal.tsx`
  - [ ] Editar campos del turno
  - [ ] Validar conflictos (overlaps)
  - [ ] Validar disponibilidad del usuario

- [ ] Validaciones:
  - [ ] No permitir overlap del mismo usuario
  - [ ] Verificar disponibilidad (availability_events)
  - [ ] Regla de descanso mínimo (configurable)

- [ ] API:
  - [ ] Edge Function `create-shift`
  - [ ] Edge Function `update-shift`
  - [ ] Edge Function `delete-shift`
  - [ ] RPC `check_shift_conflicts(user_id, start_at, end_at)`

#### **3.3 Operaciones en Lote**
- [ ] Generar turnos desde plantilla:
  - [ ] Definir plantillas (ej: "Urgencias Mes Estándar")
  - [ ] Aplicar plantilla a rango de fechas
  - [ ] Asignación automática o manual

- [ ] Copiar semana/mes:
  - [ ] Seleccionar período origen
  - [ ] Aplicar a período destino
  - [ ] Opción de copiar asignaciones o dejar sin asignar

- [ ] Bulk assign/unassign:
  - [ ] Seleccionar múltiples turnos
  - [ ] Asignar a usuario
  - [ ] Des-asignar

- [ ] Component `BulkOperationsPanel.tsx`
- [ ] Component `ShiftTemplateForm.tsx`

#### **3.4 Lista de Turnos con Filtros**
- [ ] Implementar `ShiftList.tsx` completo
  - [ ] Tabla con columnas: fecha, horario, tipo, usuario, team, estado
  - [ ] Filtros:
    - [ ] Por team (dropdown)
    - [ ] Por tipo (checkbox: day, night, 24h, custom)
    - [ ] Por usuario (autocomplete)
    - [ ] Por rango de fechas (date picker)
    - [ ] Por estado (draft/published)
  - [ ] Paginación
  - [ ] Ordenar por columnas
  - [ ] Acciones rápidas (editar, eliminar)

---

### 🔄 **Módulo 4: Sistema de Solicitudes (Requests)**

#### **4.1 Crear Solicitudes (Staff)**
- [ ] **Give Away / Coverage Request**
  - [ ] Component `GiveAwayRequestForm.tsx`
  - [ ] Usuario selecciona su turno
  - [ ] Agrega comentario/razón
  - [ ] Opción de sugerir reemplazo (opcional)
  - [ ] Envía solicitud

- [ ] **Swap Request**
  - [ ] Component `SwapRequestForm.tsx`
  - [ ] Usuario selecciona su turno
  - [ ] Selecciona turno objetivo (de otro usuario)
  - [ ] Selecciona usuario con quien hacer swap
  - [ ] Agrega comentario
  - [ ] Envía solicitud (estado: submitted)
  - [ ] Notificar al otro usuario

- [ ] **Take Open Shift**
  - [ ] Component `TakeOpenShiftForm.tsx`
  - [ ] Usuario ve turnos sin asignar (open)
  - [ ] Solicita tomar un turno abierto
  - [ ] Manager aprueba

- [ ] Página `/dashboard/staff/my-requests`
  - [ ] Listar solicitudes del usuario
  - [ ] Estados: draft, submitted, accepted, approved, rejected, cancelled
  - [ ] Cancelar solicitud (si está pending)

#### **4.2 Bandeja de Solicitudes (Manager)**
- [ ] Implementar `RequestsInbox.tsx` completo
  - [ ] Listar solicitudes pendientes del team
  - [ ] Filtrar por tipo (give_away, swap, take_open)
  - [ ] Filtrar por estado
  - [ ] Ordenar por fecha

- [ ] Component `RequestDetailModal.tsx`
  - [ ] Ver detalles de la solicitud
  - [ ] Ver turnos involucrados
  - [ ] Ver usuarios involucrados
  - [ ] Botón aprobar
  - [ ] Botón rechazar
  - [ ] Campo para comentario del manager

- [ ] Página `/dashboard/manager/requests`

#### **4.3 Flujo de Aprobación**
- [ ] Edge Function `approve-request` (completar)
  - [ ] Validar permisos del aprobador
  - [ ] Validar estado de la solicitud
  - [ ] Aplicar cambios en turnos:
    - Give away: reasignar o dejar sin asignar
    - Swap: intercambiar asignaciones
    - Take open: asignar turno al solicitante
  - [ ] Actualizar estado a `approved`
  - [ ] Registrar en audit_log
  - [ ] Enviar notificaciones

- [ ] Edge Function `reject-request`
  - [ ] Validar permisos
  - [ ] Actualizar estado a `rejected`
  - [ ] Registrar razón del rechazo
  - [ ] Registrar en audit_log
  - [ ] Notificar al solicitante

#### **4.4 Workflow de Swap (con aceptación de contraparte)**
- [ ] Flujo de estados:
  1. User A crea swap → `submitted`
  2. User B acepta → `accepted`
  3. Manager aprueba → `approved` (se aplica el swap)
  4. O Manager rechaza → `rejected`

- [ ] Component `AcceptSwapButton.tsx` (para User B)
- [ ] Notificación a User B cuando se crea la solicitud
- [ ] Notificación a ambos cuando se aprueba/rechaza

---

### 📢 **Módulo 5: Notificaciones**

#### **5.1 Push Notifications (Capacitor)**
- [ ] Configurar Capacitor Push Notifications
  - [ ] Setup iOS (APNs)
  - [ ] Setup Android (FCM)
  - [ ] Registrar device token en Supabase

- [ ] Tabla `push_tokens`:
  ```sql
  - id (uuid)
  - user_id (uuid, ref auth.users)
  - platform (text: ios, android, web)
  - token (text)
  - created_at (timestamptz)
  - last_used_at (timestamptz)
  ```

- [ ] Edge Function `send-notification` (completar)
  - [ ] Enviar push a dispositivos del usuario
  - [ ] Fallback a email si falla
  - [ ] Registrar intentos de envío

#### **5.2 Eventos de Notificación**
- [ ] Request submitted → Notificar a manager
- [ ] Request accepted (swap) → Notificar a requester y manager
- [ ] Request approved → Notificar a todos los involucrados
- [ ] Request rejected → Notificar al requester
- [ ] Shift assigned → Notificar al usuario asignado
- [ ] Shift changed → Notificar al usuario afectado
- [ ] Schedule published → Notificar al team

#### **5.3 Email Notifications (Fallback)**
- [ ] Configurar email templates en Supabase
- [ ] Template para cada evento
- [ ] Opción para usuario de activar/desactivar emails

#### **5.4 In-App Notifications**
- [ ] Tabla `notifications`:
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

- [ ] Component `NotificationBell.tsx` (icono con badge)
- [ ] Component `NotificationsList.tsx`
- [ ] Marcar como leída
- [ ] Link a la entidad relacionada

---

### 📊 **Módulo 6: Disponibilidad y Eventos**

#### **6.1 Registrar Disponibilidad (Staff)**
- [ ] Página `/dashboard/staff/availability`
  - [ ] Calendario de disponibilidad
  - [ ] Agregar eventos:
    - Vacaciones
    - Licencia médica
    - Capacitación
    - No disponible (sin especificar)
  - [ ] Editar/eliminar eventos

- [ ] Component `AvailabilityCalendar.tsx`
- [ ] Component `AddAvailabilityEventForm.tsx`

#### **6.2 Ver Disponibilidad del Team (Manager)**
- [ ] Página `/dashboard/manager/availability`
  - [ ] Ver disponibilidad de todos los miembros
  - [ ] Filtrar por usuario
  - [ ] Filtrar por tipo de evento
  - [ ] Vista calendario

- [ ] Bloquear asignación de turnos si hay conflicto con availability

---

### 📈 **Módulo 7: Reportes y Exports**

#### **7.1 Exportar Horarios**
- [ ] Edge Function `export-schedule` (completar)
  - [ ] Generar CSV con turnos del período
  - [ ] Generar Excel con formato
  - [ ] Generar PDF (opcional, fase 2)

- [ ] Página `/dashboard/admin/exports`
  - [ ] Seleccionar team
  - [ ] Seleccionar rango de fechas
  - [ ] Seleccionar formato (CSV, Excel)
  - [ ] Botón descargar

- [ ] Component `ExportScheduleForm.tsx`

#### **7.2 Reportes Básicos**
- [ ] Página `/dashboard/admin/reports`
  - [ ] Reporte: Turnos por usuario (count por tipo)
  - [ ] Reporte: Distribución de noches/fines de semana
  - [ ] Reporte: Turnos sin asignar
  - [ ] Reporte: Solicitudes por estado
  - [ ] Gráficos (Chart.js o Recharts)

- [ ] Component `ReportsBasicDashboard.tsx`

---

### 🔍 **Módulo 8: Audit Log y Trazabilidad**

#### **8.1 Visualizar Audit Log**
- [ ] Página `/dashboard/admin/audit`
  - [ ] Listar eventos del audit log
  - [ ] Filtros:
    - Por entidad (shift, shift_request, membership, etc.)
    - Por actor (usuario que realizó la acción)
    - Por acción (create, update, delete, approve, etc.)
    - Por rango de fechas
  - [ ] Ver detalles de cada evento:
    - Snapshot antes
    - Snapshot después
    - Diff visual

- [ ] Component `AuditLogList.tsx`
- [ ] Component `AuditLogDetailModal.tsx`

#### **8.2 Triggers Automáticos**
- [ ] Trigger para registrar cambios en `shifts`
- [ ] Trigger para registrar cambios en `shift_requests`
- [ ] Trigger para registrar cambios en `memberships`
- [ ] Función `log_audit_event(entity, entity_id, action, before, after, comment)`

---

### 🔒 **Módulo 9: Seguridad y Permisos Avanzados**

#### **9.1 Refinar Políticas RLS**
- [ ] Política para INSERT en shifts (solo manager/admin)
- [ ] Política para UPDATE en shifts (solo manager/admin)
- [ ] Política para DELETE en shifts (solo admin)
- [ ] Política para INSERT en shift_requests (user, manager)
- [ ] Política para UPDATE en shift_requests (manager para approve/reject)
- [ ] Política para INSERT/UPDATE/DELETE en memberships (solo org_admin)
- [ ] Política para INSERT/UPDATE en availability_events (propio usuario)

#### **9.2 Validaciones en Edge Functions**
- [ ] Validar permisos antes de cada operación privilegiada
- [ ] Rate limiting (prevenir abuse)
- [ ] Logging de intentos fallidos

#### **9.3 Configuraciones de Org**
- [ ] Tabla `org_settings`:
  ```sql
  - org_id (uuid, pk, ref organizations)
  - allow_self_assign_open_shifts (boolean)
  - require_approval_for_swaps (boolean)
  - require_approval_for_give_aways (boolean)
  - min_rest_hours (integer) - descanso mínimo entre turnos
  - settings_json (jsonb) - configuraciones adicionales
  ```

- [ ] Página `/dashboard/admin/settings`
  - [ ] Editar configuraciones de la org
  - [ ] Configurar tipos de turno personalizados
  - [ ] Configurar reglas de descanso

- [ ] Component `OrgSettingsForm.tsx`

---

### 📱 **Módulo 10: Optimización para Mobile**

#### **10.1 UI/UX Mobile**
- [ ] Adaptar calendario para pantallas pequeñas
  - [ ] Vista compacta
  - [ ] Gestos de swipe
  - [ ] Bottom sheet para detalles

- [ ] Navbar móvil (bottom navigation)
- [ ] Optimizar formularios para touch
- [ ] Mejorar accesibilidad

#### **10.2 Funcionalidades Móviles**
- [ ] Quick actions (shortcuts)
  - [ ] Ver mis próximos turnos
  - [ ] Solicitar cambio rápido
  - [ ] Ver quién está de turno ahora

- [ ] Widget de "On-call Now" (quién está de guardia)
- [ ] Deep links para notificaciones

#### **10.3 Offline Support (Fase 2)**
- [ ] Cache de turnos próximos
- [ ] Sincronización al reconectar
- [ ] Indicador de estado offline

---

### 🧪 **Módulo 11: Testing y QA**

#### **11.1 Tests Unitarios**
- [ ] Tests para funciones de permisos (`rbac.ts`)
- [ ] Tests para validaciones de turnos
- [ ] Tests para helpers y utilidades

#### **11.2 Tests de Integración**
- [ ] Tests para Edge Functions
- [ ] Tests para flujo de invitaciones
- [ ] Tests para flujo de solicitudes
- [ ] Tests para aprobaciones

#### **11.3 Tests E2E**
- [ ] Test: Crear organización y primer admin
- [ ] Test: Invitar usuario y aceptar invitación
- [ ] Test: Crear turnos y asignar
- [ ] Test: Solicitar swap y aprobar
- [ ] Test: Exportar horario

---

### 🎨 **Módulo 12: UI/UX Polish**

#### **12.1 Diseño Consistente**
- [ ] Sistema de diseño completo (components library)
- [ ] Buttons con estados (hover, active, disabled)
- [ ] Inputs consistentes
- [ ] Modales y dialogs
- [ ] Toasts y feedback visual
- [ ] Loading states y skeletons

#### **12.2 Animaciones y Transiciones**
- [ ] Transiciones suaves entre vistas
- [ ] Animaciones de carga
- [ ] Feedback visual en acciones (success, error)

#### **12.3 Dark Mode**
- [ ] Toggle de dark mode
- [ ] Persistir preferencia
- [ ] Colores consistentes en dark mode

#### **12.4 Accesibilidad**
- [ ] ARIA labels
- [ ] Navegación por teclado
- [ ] Contraste suficiente
- [ ] Screen reader support

---

### 🚀 **Módulo 13: Deploy y DevOps**

#### **13.1 CI/CD**
- [ ] GitHub Actions para:
  - [ ] Linting
  - [ ] Type checking
  - [ ] Tests
  - [ ] Build

#### **13.2 Environments**
- [ ] Development (local)
- [ ] Staging (Vercel/Supabase staging)
- [ ] Production (Vercel/Supabase prod)

#### **13.3 Monitoreo**
- [ ] Error tracking (Sentry o similar)
- [ ] Analytics (usage, performance)
- [ ] Logs centralizados

#### **13.4 Backups**
- [ ] Backup automático de base de datos
- [ ] Plan de disaster recovery

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
3. Gestión básica de Organizations y Teams
4. Crear y asignar turnos (formulario básico)
5. Calendario básico (lectura)

### **FASE 2: Requests Workflow (2 semanas)**
6. Sistema de solicitudes (give away, swap, take open)
7. Bandeja de aprobaciones para manager
8. Notificaciones básicas (email)

### **FASE 3: Calendar & Views (1-2 semanas)**
9. Implementar FullCalendar completo
10. Lista de turnos con filtros
11. Validaciones de conflictos

### **FASE 4: Notifications & Mobile (1-2 semanas)**
12. Push notifications (Capacitor)
13. Optimización UI mobile
14. In-app notifications

### **FASE 5: Reports & Admin Features (1 semana)**
15. Exports (CSV, Excel)
16. Reportes básicos
17. Audit log viewer

### **FASE 6: Polish & Testing (1 semana)**
18. UI/UX improvements
19. Testing completo
20. Bug fixes

### **FASE 7: Deploy & Launch (1 semana)**
21. Deploy a producción
22. Documentación final
23. Marketing materials

---

## 📊 MÉTRICAS DE PROGRESO

### Estado General del Proyecto
- **Total de módulos**: 14
- **Módulos completados**: 1.5 (infraestructura base + Sistema de Invitaciones)
- **Progreso estimado**: ~12-15%

### Tareas por Estado
- ✅ **Completadas**: ~50 tareas
- 🔄 **En progreso**: 0 tareas
- ⏳ **Pendientes**: ~225 tareas

---

## 🎯 SIGUIENTE PASO INMEDIATO

**Módulo 2: Gestión de Organizaciones y Teams**

1. Página `/dashboard/admin/organizations` — listar y editar organizaciones
2. Página `/dashboard/admin/teams` — CRUD de teams
3. Página `/dashboard/admin/members` — listar miembros, cambiar roles, asignar a teams
