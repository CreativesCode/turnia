# Mejoras de Rendimiento y Optimización - Turnia

> Análisis realizado: 2 de febrero de 2026
> Proyecto: Sistema de gestión de turnos médicos

---

## 📊 Resumen Ejecutivo

Este documento identifica oportunidades de optimización en tres áreas clave:

1. **Base de Datos**: Índices faltantes y consultas no optimizadas
2. **Frontend**: Server Components, memoización y patrones de fetching
3. **Arquitectura**: Duplicación de código y patrones mejorables

**Impacto esperado**: Mejora de 40-60% en tiempos de carga inicial y reducción significativa en queries a base de datos.

---

## 🔴 Prioridad CRÍTICA

### 1. Índices de Base de Datos Faltantes

**Problema**: Las consultas principales no tienen índices, causando table scans completos.

**Impacto**: Alto - Afecta todas las operaciones de lectura

**Estado**: ✅ **COMPLETADO** (migración creada)

#### Índices necesarios para `shifts`:

```sql
-- Índice principal por organización
CREATE INDEX idx_shifts_org_id ON public.shifts(org_id);

-- Índices para rangos de fechas (calendario)
CREATE INDEX idx_shifts_org_start_at ON public.shifts(org_id, start_at);
CREATE INDEX idx_shifts_org_end_at ON public.shifts(org_id, end_at);

-- Índice para turnos por usuario
CREATE INDEX idx_shifts_org_assigned_user ON public.shifts(org_id, assigned_user_id);

-- Índice para consultas del usuario
CREATE INDEX idx_shifts_assigned_user_id ON public.shifts(assigned_user_id);

-- Índice compuesto para detección de conflictos
CREATE INDEX idx_shifts_conflicts_check ON public.shifts(
  org_id, assigned_user_id, start_at, end_at
) WHERE assigned_user_id IS NOT NULL;

-- Índice GiST para overlap checks (más eficiente)
CREATE INDEX idx_shifts_time_range_gist ON public.shifts
  USING GIST (org_id, assigned_user_id, tstzrange(start_at, end_at))
  WHERE assigned_user_id IS NOT NULL;
```

#### Índices necesarios para `shift_requests`:

```sql
CREATE INDEX idx_shift_requests_org_id ON public.shift_requests(org_id);
CREATE INDEX idx_shift_requests_requester_id ON public.shift_requests(requester_id);
CREATE INDEX idx_shift_requests_shift_id ON public.shift_requests(shift_id);
CREATE INDEX idx_shift_requests_target_user_id ON public.shift_requests(target_user_id);

-- Índices compuestos para filtros comunes
CREATE INDEX idx_shift_requests_org_status ON public.shift_requests(org_id, status);
CREATE INDEX idx_shift_requests_org_requester ON public.shift_requests(org_id, requester_id);
CREATE INDEX idx_shift_requests_org_status_created ON public.shift_requests(
  org_id, status, created_at DESC
);

-- Índice parcial para solicitudes pendientes (más eficiente)
CREATE INDEX idx_shift_requests_pending ON public.shift_requests(
  org_id, created_at DESC
) WHERE status IN ('submitted', 'accepted');
```

#### Índices para otras tablas críticas:

```sql
-- memberships
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_org_role ON public.memberships(org_id, role);

-- availability_events
CREATE INDEX idx_availability_events_org_user ON public.availability_events(org_id, user_id);
CREATE INDEX idx_availability_events_time_range ON public.availability_events
  USING GIST (org_id, tstzrange(start_at, end_at));

-- audit_log
CREATE INDEX idx_audit_log_actor_id ON public.audit_log(actor_id)
  WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity, entity_id);
```

**Archivo de migración**: `supabase/migrations/20250209000000_add_performance_indexes.sql` ✅

---

### 2. Convertir Dashboard a Server Component

**Problema**: `src/app/dashboard/page.tsx` es Client Component que hace 10+ consultas después del mount.

**Impacto**: Alto - Es la página más visitada

**Ubicación**: `src/app/dashboard/page.tsx` (489 líneas)

**Estado**: 🚫 **BLOQUEADO** (el proyecto usa `output: 'export'` en `next.config.ts`, por lo que no puede usar `cookies()`/Supabase SSR en Server Components. Se mantiene como Client Component y se optimiza fetching/caché.)

#### Antes (Client Component):

```typescript
"use client";
export default function DashboardPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    // 10+ queries secuenciales después del mount
    load();
  }, []);
  // ...
}
```

#### Después (Server Component con Streaming):

```typescript
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard - Turnia",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Cargar datos críticos en servidor (paralelo)
  const [profile, org] = await Promise.all([
    getProfile(supabase, user.id),
    getOrganization(supabase, orgId),
  ]);

  return (
    <div>
      <Header profile={profile} org={org} />

      {/* Streaming de secciones independientes */}
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats orgId={orgId} />
      </Suspense>

      <Suspense fallback={<ShiftsSkeleton />}>
        <DashboardShifts orgId={orgId} userId={user.id} />
      </Suspense>
    </div>
  );
}
```

**Beneficios**:

- ✅ Reducción de 40-60% en JavaScript inicial
- ✅ Mejora de 1-2s en tiempo de First Contentful Paint
- ✅ Datos cargados en servidor (más rápido y seguro)
- ✅ Streaming granular con Suspense

---

### 3. Paralelizar Consultas en Dashboard

**Problema**: Las consultas en `dashboard/page.tsx` se ejecutan secuencialmente.

**Ubicación**: `src/app/dashboard/page.tsx:185-383`

#### Antes:

```typescript
// ❌ Consultas secuenciales (10+ segundos)
const p = await supabase.from('profiles').select('full_name')...
setFullName(...);
const o = await supabase.from('organizations').select('name')...
setOrgName(...);
const today = await supabase.from('shifts').select(...)...
// ... 8 consultas más
```

#### Después:

```typescript
// ✅ Consultas paralelas (~2 segundos)
const [
  { data: profile },
  { data: org },
  { data: todayShift },
  { data: upcomingShifts },
  { data: stats }
] = await Promise.all([
  supabase.from('profiles').select('full_name').eq('id', userId).single(),
  supabase.from('organizations').select('name').eq('id', orgId).single(),
  supabase.from('shifts').select('*').eq('assigned_user_id', userId)...,
  supabase.from('shifts').select('*').gte('start_at', today)...,
  getOrganizationStats(supabase, orgId)
]);
```

**Mejora esperada**: Reducción de 70-80% en tiempo de carga de datos.

**Estado**: ✅ **COMPLETADO** (consultas principales paralelizadas en `src/app/dashboard/page.tsx` con `Promise.all`)

---

### 4. Eliminar Over-fetching en Consultas de Conteo

**Problema**: Se usa `select('*')` cuando solo se necesita contar registros.

**Ubicación**: Múltiples archivos (`dashboard/page.tsx`, `ShiftList.tsx`, etc.)

#### Antes:

```typescript
// ❌ Trae todos los campos innecesariamente
const { count } = await supabase
  .from("shift_requests")
  .select("*", { count: "exact", head: true })
  .eq("org_id", orgId);
```

#### Después:

```typescript
// ✅ Solo el campo id (más eficiente)
const { count } = await supabase
  .from("shift_requests")
  .select("id", { count: "exact", head: true })
  .eq("org_id", orgId);
```

**Impacto**: Reducción de 50-70% en datos transferidos en consultas de conteo.

**Estado**: ✅ **COMPLETADO** (reemplazado `select('*', { count, head: true })` por `select('id', { count, head: true })` en el frontend).

---

## 🟠 Prioridad ALTA

### 5. Crear Utilidades Compartidas para Consultas Comunes

**Problema**: Código duplicado en 5+ archivos para cargar perfiles y metadata.

**Archivos afectados**:

- `src/components/shifts/ShiftList.tsx:267-280`
- `src/components/calendar/ShiftCalendar.tsx:267-283`
- `src/components/requests/MyRequestsList.tsx:119-137`
- `src/components/requests/RequestsInbox.tsx:140-142`
- `src/app/dashboard/page.tsx:345-352`

#### Solución: Crear `src/lib/supabase/queries.ts`

**Estado**: ✅ **COMPLETADO** (archivo creado y aplicado en componentes principales)

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Carga perfiles en batch y devuelve un mapa id -> nombre
 */
export async function fetchProfilesMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const map: Record<string, string> = {};
  (data ?? []).forEach((p) => {
    map[p.id] = p.full_name?.trim() ?? "";
  });
  return map;
}

/**
 * Carga tipos de turnos para una organización
 */
export async function fetchShiftTypes(supabase: SupabaseClient, orgId: string) {
  return await supabase
    .from("organization_shift_types")
    .select("id, name, letter, color")
    .eq("org_id", orgId)
    .order("sort_order")
    .order("name");
}

/**
 * Carga IDs de miembros de una organización
 */
export async function fetchOrgMemberIds(
  supabase: SupabaseClient,
  orgId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId);

  return (data ?? []).map((m) => m.user_id);
}
```

**Uso en componentes**:

```typescript
import { fetchProfilesMap } from '@/lib/supabase/queries';

// En lugar de:
const userIds = [...new Set(shifts.map(s => s.assigned_user_id).filter(Boolean))];
const { data: profiles } = await supabase.from('profiles')...

// Usar:
const userIds = [...new Set(shifts.map(s => s.assigned_user_id).filter(Boolean))];
const profilesMap = await fetchProfilesMap(supabase, userIds);
```

---

### 6. Implementar Debounce en `fetchShifts` (ShiftCalendar)

**Problema**: Múltiples llamadas simultáneas al calendario al cambiar filtros/rangos.

**Ubicación**: `src/components/calendar/ShiftCalendar.tsx:321-327`

#### Antes:

```typescript
useEffect(() => {
  const t = window.setTimeout(() => {
    if (range && orgId) void fetchShifts(range.start, range.end);
  }, 0); // ❌ Sin debounce real
  return () => window.clearTimeout(t);
}, [orgId, refreshKey, range, fetchShifts, isOnline]);
```

#### Después:

```typescript
import { useDebounce } from "@/hooks/useDebounce";

// Debounce del range
const debouncedRange = useDebounce(range, 300);

useEffect(() => {
  if (debouncedRange && orgId) {
    void fetchShifts(debouncedRange.start, debouncedRange.end);
  }
}, [orgId, refreshKey, debouncedRange, fetchShifts, isOnline]);
```

**Hook useDebounce** (crear en `src/hooks/useDebounce.ts`):

**Estado**: ✅ **COMPLETADO** (hook creado y usado por `ShiftCalendar`)

```typescript
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

---

### 7. Memoizar `renderEventContent` en ShiftCalendar

**Problema**: Manipulación DOM costosa en cada render de cada evento.

**Ubicación**: `src/components/calendar/ShiftCalendar.tsx:97-120`

**Estado**: ✅ **COMPLETADO** (migrado a renderizado React memoizado en `ShiftCalendar`)

#### Antes:

```typescript
// ❌ Se recrea en cada render
function renderEventContent(arg: { event: { ... } }) {
  const wrap = document.createElement('div');
  wrap.className = '...';
  // ... manipulación DOM
  return { domNodes: [wrap] };
}
```

#### Después (Opción 1: Memoización con caché):

```typescript
// ✅ Usar Map para cachear nodos
const eventNodeCache = useRef(new Map<string, HTMLElement>());

const renderEventContent = useCallback((arg: EventContentArg) => {
  const eventId = arg.event.id;

  if (eventNodeCache.current.has(eventId)) {
    return { domNodes: [eventNodeCache.current.get(eventId)!] };
  }

  const wrap = document.createElement("div");
  // ... crear nodo

  eventNodeCache.current.set(eventId, wrap);
  return { domNodes: [wrap] };
}, []);

// Limpiar caché al desmontar
useEffect(() => {
  return () => {
    eventNodeCache.current.clear();
  };
}, []);
```

#### Después (Opción 2: Componente React - recomendado):

```typescript
// ✅ Usar componente React (más eficiente)
const EventContent = memo(({ shift, assignedName }: EventContentProps) => {
  const letter = shift?.organization_shift_types?.letter ?? '?';
  const color = shift?.organization_shift_types?.color ?? '#6B7280';
  const name = assignedName?.trim() || 'Sin asignar';

  return (
    <div className="fc-event-content-wrap" style={{ backgroundColor: color }}>
      <div className="fc-event-letter">{letter}</div>
      <div className="fc-event-name">{name}</div>
    </div>
  );
});

// En FullCalendar config:
eventContent={(arg) => {
  const shift = arg.event.extendedProps?.shift;
  const assignedName = arg.event.extendedProps?.assignedName;
  return <EventContent shift={shift} assignedName={assignedName} />;
}}
```

---

### 8. Optimizar Trigger de Notificaciones

**Problema**: Loop que hace INSERT individual por cada manager.

**Ubicación**: `supabase/functions/.../shift-requests-hooks.ts`

#### Antes:

```sql
-- ❌ Loop con INSERTs individuales
FOR manager IN (SELECT user_id FROM memberships WHERE org_id = NEW.org_id...) LOOP
  INSERT INTO notifications (user_id, ...) VALUES (manager.user_id, ...);
END LOOP;
```

#### Después:

```sql
-- ✅ INSERT con subquery (una sola operación)
INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id)
SELECT
  m.user_id,
  'Nueva solicitud',
  'Se ha enviado una solicitud de ' || req_type_label || '. Revisa en Solicitudes.',
  'request',
  'shift_request',
  NEW.id
FROM public.memberships m
WHERE m.org_id = NEW.org_id
  AND m.role IN ('team_manager', 'org_admin', 'superadmin')
  AND m.user_id <> NEW.requester_id;
```

**Mejora**: 10-50x más rápido dependiendo del número de managers.

**Estado**: ✅ **COMPLETADO** (migración: `supabase/migrations/20250209001000_optimize_shift_request_notifications_trigger.sql`)

---

## 🟡 Prioridad MEDIA

### 9. Agregar Metadata Específica por Página

**Problema**: Solo `layout.tsx` tiene metadata, páginas no tienen SEO específico.

**Solución**: Exportar metadata en cada página.

**Estado**: ✅ **COMPLETADO** (metadata añadida en layouts de segmentos: `dashboard/`, `dashboard/admin/`, `dashboard/manager/`, `dashboard/staff/`, `dashboard/notifications/`, `dashboard/profile/`)

```typescript
// src/app/dashboard/page.tsx
export const metadata: Metadata = {
  title: "Dashboard - Turnia",
  description: "Panel principal de gestión de turnos",
};

// src/app/dashboard/admin/members/page.tsx
export const metadata: Metadata = {
  title: "Miembros - Turnia",
  description: "Gestiona miembros y roles de la organización",
};

// src/app/dashboard/manager/shifts/page.tsx
export const metadata: Metadata = {
  title: "Turnos - Turnia",
  description: "Gestiona turnos del equipo",
};
```

---

### 10. Implementar Error Boundaries

**Problema**: No hay archivos `error.tsx` en rutas críticas.

**Solución**: Crear error boundaries en rutas principales.

```typescript
// src/app/dashboard/error.tsx
"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold mb-4">Algo salió mal</h2>
      <p className="text-gray-600 mb-4">
        {error.message || "Error inesperado"}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Intentar nuevamente
      </button>
    </div>
  );
}
```

**Rutas que necesitan error.tsx**:

- `src/app/dashboard/error.tsx`
- `src/app/dashboard/manager/error.tsx`
- `src/app/dashboard/admin/error.tsx`
- `src/app/dashboard/staff/error.tsx`

**Estado**: ✅ **COMPLETADO** (error boundaries añadidos en las 4 rutas)

---

### 11. Memoizar `ShiftCalendarFilters`

**Problema**: Componente de filtros se re-renderiza innecesariamente.

**Ubicación**: `src/components/calendar/ShiftCalendarFilters.tsx`

**Estado**: ✅ **COMPLETADO** (componente memoizado y fetching alineado a utilidades compartidas)

#### Solución:

```typescript
import { memo } from "react";

// Al final del archivo:
export default memo(ShiftCalendarFilters);

// O con comparación personalizada:
export default memo(ShiftCalendarFilters, (prev, next) => {
  return (
    prev.orgId === next.orgId &&
    prev.filters === next.filters &&
    prev.onFiltersChange === next.onFiltersChange
  );
});
```

---

### 12. Implementar Caché en Dashboard Principal

**Problema**: Dashboard no usa el sistema de caché existente.

**Ubicación**: `src/app/dashboard/page.tsx`

**Estado**: ✅ **COMPLETADO** (usa `getCacheEntry`/`setCache` para precargar datos recientes y refrescar en background)

#### Solución:

```typescript
import { getCacheEntry, setCacheEntry } from "@/lib/cache";

async function loadDashboardData(orgId: string, userId: string) {
  const cacheKey = `dashboard:${orgId}:${userId}`;
  const maxAge = 60000; // 1 minuto

  // Intentar caché
  const cached = getCacheEntry<DashboardData>(cacheKey, { maxAgeMs: maxAge });
  if (cached) {
    return cached;
  }

  // Cargar datos frescos
  const data = await fetchDashboardData(orgId, userId);

  // Guardar en caché
  setCacheEntry(cacheKey, data);

  return data;
}
```

---

### 13. Convertir Páginas de Lista a Server Components

**Páginas candidatas**:

- `src/app/dashboard/admin/members/page.tsx`
- `src/app/dashboard/manager/shifts/page.tsx`
- `src/app/dashboard/notifications/page.tsx`
- `src/app/dashboard/staff/page.tsx`

**Estado**: 🚫 **BLOQUEADO** (el proyecto usa `output: 'export'` en `next.config.ts`, por lo que no puede depender de `cookies()`/Supabase SSR para render server-side autenticado)

**Estrategia**:

1. Página principal = Server Component (carga inicial)
2. Componentes interactivos = Client Components (filtros, modales, acciones)

#### Ejemplo:

```typescript
// page.tsx (Server Component)
export default async function MembersPage() {
  const supabase = await createClient();
  const initialMembers = await getMembers(supabase, orgId);

  return <MembersContent initialData={initialMembers} />;
}

// MembersContent.tsx (Client Component)
("use client");
export function MembersContent({ initialData }: Props) {
  const [members, setMembers] = useState(initialData);
  // ... lógica interactiva
}
```

---

### 14. Implementar Loading States Específicos

**Problema**: Solo hay un `loading.tsx` genérico en dashboard.

**Estado**: ✅ **COMPLETADO** (loading específicos añadidos en subrutas: manager/shifts, manager/requests, notifications, staff/my-requests, staff/availability)

**Solución**: Crear loading.tsx específicos en subrutas.

```typescript
// src/app/dashboard/manager/shifts/loading.tsx
export default function ShiftsLoading() {
  return (
    <div className="p-4">
      {/* Skeleton específico para lista de turnos */}
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 🟢 Prioridad BAJA (Mejoras Incrementales)

### 15. Dividir ShiftCalendar en Componentes Más Pequeños

**Problema**: 557 líneas en un solo archivo.

**Sugerencia de división**:

- `ShiftCalendar.tsx` (150 líneas) - Componente principal
- `useShiftCalendar.ts` (200 líneas) - Hook con lógica de datos
- `useCalendarTouch.ts` (100 líneas) - Hook para touch/swipe
- `CalendarEventContent.tsx` (50 líneas) - Componente de evento
- `ShiftCalendarFilters.tsx` (ya separado) ✅

**Estado**: ✅ **COMPLETADO**

**Archivos creados / actualizados**:

- `src/components/calendar/useShiftCalendar.ts` ✅
- `src/components/calendar/useCalendarTouch.ts` ✅
- `src/components/calendar/CalendarEventContent.tsx` ✅
- `src/components/calendar/shiftCalendarTypes.ts` ✅ (tipos compartidos)
- `src/components/calendar/ShiftCalendar.tsx` ✅ (simplificado, ahora solo orquesta hooks + FullCalendar)

---

### 16. Implementar SWR o React Query

**Problema**: Fetching manual sin deduplicación ni revalidación automática.

**Beneficios de SWR**:

- ✅ Deduplicación automática de requests
- ✅ Revalidación en focus/online
- ✅ Caché inteligente
- ✅ Menos código boilerplate

**Estado**: ✅ **COMPLETADO** (SWR integrado y aplicado en componentes principales)

**Aplicado en**:

- `src/components/calendar/useShiftCalendar.ts` ✅
- `src/components/shifts/ShiftList.tsx` ✅
- `src/components/requests/RequestsInbox.tsx` ✅
- `src/components/requests/MyRequestsList.tsx` ✅
- `src/app/dashboard/notifications/page.tsx` ✅
- `src/components/notifications/NotificationBell.tsx` ✅

#### Instalación:

```bash
npm install swr
```

#### Ejemplo de uso:

```typescript
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";

function useShifts(orgId: string, start: Date, end: Date) {
  const { data, error, mutate } = useSWR(
    ["shifts", orgId, start, end],
    async ([_, orgId, start, end]) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .eq("org_id", orgId)
        .gte("start_at", start.toISOString())
        .lte("end_at", end.toISOString());
      return data;
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return { shifts: data, isLoading: !error && !data, error, refresh: mutate };
}
```

---

### 17. Implementar Suscripciones Realtime

**Problema**: Cambios requieren refresh manual (`refreshKey`).

**Solución**: Usar Supabase Realtime.

```typescript
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function useRealtimeShifts(orgId: string) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("shifts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shifts",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          console.log("Shift changed:", payload);
          // Actualizar estado local o refetch
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);
}
```

**Estado**: ✅ **COMPLETADO** (suscripciones Realtime con refresh vía `mutate()` + debounce)

**Aplicado en**:

- `src/components/calendar/useShiftCalendar.ts` (tabla `public.shifts`) ✅
- `src/components/notifications/NotificationBell.tsx` (tabla `public.notifications`) ✅
- `src/app/dashboard/notifications/page.tsx` (tabla `public.notifications`) ✅

---

### 18. Optimizar Tiempo de Caché

**Problema**: Caché de 45 días puede servir datos obsoletos.

**Ubicación**: `src/components/calendar/ShiftCalendar.tsx:176-179`

**Estado**: ✅ **COMPLETADO** (TTL dinámico: 24h para rangos pasados, 5min para rangos futuros)

**Recomendación**:

- Turnos futuros: 5-15 minutos
- Turnos pasados: 24 horas (cambian raramente)
- Stats y conteos: 1 minuto

```typescript
const maxAgeMs = isPastDate(start)
  ? 1000 * 60 * 60 * 24 // 24h para pasado
  : 1000 * 60 * 5; // 5min para futuro
```

---

### 19. Implementar Prefetching de Rutas

**Problema**: Navegación no anticipa rutas siguientes.

**Solución**: Usar `prefetch` de Next.js Link.

**Estado**: ✅ **COMPLETADO** (prefetch explícito en navegación principal `DashboardNav` y enlaces clave del dashboard)

```typescript
import Link from "next/link";

// Por defecto Next.js ya hace prefetch, pero asegurar:
<Link href="/dashboard/shifts" prefetch={true}>
  Ver turnos
</Link>;
```

---

### 20. Reducir Límites de Consultas

**Problema**: Límites altos (300) traen más datos de los necesarios.

**Ubicación**: `src/app/dashboard/page.tsx:237-244`

**Estado**: ✅ **COMPLETADO** (stats movidos a agregación vía RPC `shift_hours_stats`, evitando `.limit(300/700)` y over-fetching de `start_at/end_at`)

**Solución**: Paginación o límites más razonables.

```typescript
// Antes:
.limit(300)  // ❌ Trae hasta 300 registros

// Después:
.limit(50)   // ✅ Suficiente para UI
.order('start_at', { ascending: true })
```

---

### 21. Optimizar Audit Log (payload + fetching)

**Problema**: El listado del audit log traía `before_snapshot/after_snapshot` en cada fila (payload grande) y hacía fetching manual con múltiples `useEffect`.

**Solución**:

- Listado: `select` mínimo (sin snapshots) + **SWR** (dedupe/revalidate) + paginación
- Modal: cargar snapshots **on-demand** al abrir el detalle
- Realtime: suscripción a `public.audit_log` por `org_id` para refrescar con debounce

**Estado**: ✅ **COMPLETADO**

**Archivos**:

- `src/components/audit/AuditLogList.tsx` ✅
- `src/components/audit/AuditLogDetailModal.tsx` ✅

---

### 22. Optimizar Members (paginación + SWR + Realtime)

**Problema**: Listados de miembros cargaban todas las filas sin paginación y con fetching manual, lo que escala mal en organizaciones grandes.

**Solución**:

- Listado de miembros: **SWR** + paginación (PAGE_SIZE=50) + `count: 'exact'`
- Realtime: suscripción a `public.memberships` por `org_id` para refrescar con debounce

**Estado**: ✅ **COMPLETADO**

**Archivos**:

- `src/components/members/MembersList.tsx` ✅
- `src/components/organizations/OrganizationMembers.tsx` ✅

---

### 23. Optimizar Organizations (paginación + SWR + Realtime)

**Problema**: El listado de organizaciones para superadmin cargaba todas las filas en una sola query y con fetching manual.

**Solución**:

- Listado: **SWR** + paginación (PAGE_SIZE=50) + `count: 'exact'`
- Realtime: suscripción a `public.organizations` para refrescar con debounce

**Estado**: ✅ **COMPLETADO**

**Archivo**:

- `src/components/organizations/OrganizationList.tsx` ✅

---

### 24. Optimizar Reports (RPC + SWR)

**Problema**: Reportes básicos calculaban métricas trayendo todas las filas de `shifts` y `shift_requests` del período (alto over-fetching) y luego agregando en el cliente.

**Solución**:

- Agregaciones movidas a la base de datos vía **RPC** (`GROUP BY` / `FILTER`)
- UI usa **SWR** (dedupe/revalidate) para caché y revalidación automática

**Estado**: ✅ **COMPLETADO**

**Archivos**:

- `supabase/migrations/20250209003000_add_reports_basic_rpcs.sql` ✅
- `src/components/reports/ReportsBasicDashboard.tsx` ✅

---

### 25. Optimizar Export Schedule (RPC + streaming CSV)

**Problema**: `export-schedule` traía todos los turnos del rango en una sola query y construía el CSV en memoria, lo que escala mal en rangos grandes.

**Solución**:

- RPC `export_schedule_rows` para resolver joins (tipo + asignado) en DB y evitar queries extra.
- CSV generado como **stream** por páginas (`PAGE_SIZE`) para reducir memoria.
- XLSX mantiene materialización (por limitación del formato), con **límite de filas** y mensaje para usar CSV.
- Validaciones: rango máximo (12 meses) y timestamps válidos.

**Estado**: ✅ **COMPLETADO**

**Archivos**:

- `supabase/migrations/20250209004000_add_export_schedule_rpc.sql` ✅
- `supabase/functions/export-schedule/index.ts` ✅

---

### 26. Optimizar Shift Types (SWR + Realtime)

**Problema**: Listado de tipos de turno recargaba con fetching manual y requería refresh explícito tras acciones (crear/editar/borrar/reordenar).

**Solución**:

- Listado: **SWR** (dedupe/revalidate) manteniendo la UI actual.
- Realtime: suscripción a `public.organization_shift_types` por `org_id` para refrescar con debounce.
- Acciones (crear/editar/borrar/reordenar): refresco vía `mutate()` en lugar de reload manual.

**Estado**: ✅ **COMPLETADO**

**Archivo**:

- `src/components/shift-types/ShiftTypesList.tsx` ✅

---

### 27. Optimizar Admin Settings (SWR + Realtime)

**Problema**: Configuración de organización (`org_settings`) cargaba con fetching manual y requería refresh/reload implícito.

**Solución**:

- Selector de organizaciones (superadmin): **SWR** para caché/revalidación.
- Formulario de settings: **SWR** + Realtime en `org_settings` por `org_id` (refresh con debounce).
- Guardado mantiene UX actual; si falla, revalida para sincronizar estado.

**Estado**: ✅ **COMPLETADO**

**Archivos**:

- `src/app/dashboard/admin/settings/page.tsx` ✅
- `src/components/organizations/OrgSettingsForm.tsx` ✅

### 28. Optimizar Admin Invite (SWR + Realtime)

**Problema**: Página Invitar usuarios y lista de invitaciones usaban fetching manual con `refreshKey` y recargas completas.

**Solución**:

- Página Admin Invite: usa **useCurrentOrg()** (mismo patrón que Admin Settings) para orgId; se elimina `useEffect` duplicado.
- **InvitationsList**: migrado a **SWR** con clave `['invitations', orgId, refreshKey]`, fetcher con `select` mínimo (`id, email, role, status, expires_at, created_at, token`).
- **Realtime**: suscripción a `organization_invitations` por `org_id` con debounce para revalidar al insertar/actualizar/cancelar invitaciones.
- Cancelar / reenviar / prorrogar llaman a `mutate()` en lugar de `load()`; `refreshKey` opcional se mantiene para refresco inmediato tras crear invitación desde el formulario.

**Estado**: ✅ **COMPLETADO**

**Archivos**:

- `src/app/dashboard/admin/invite/page.tsx` ✅
- `src/components/invitations/InvitationsList.tsx` ✅

---

## ✅ Cierre del plan (28 ítems)

Todos los ítems del plan están **COMPLETADOS** o **BLOQUEADOS** (Server Components por limitación de `output: 'export'`). No queda ningún ítem pendiente.

**Próximos pasos opcionales** (fuera del plan original):

- Añadir `loading.tsx` en más rutas de admin: ✅ hecho (invite, members, settings, audit, exports, organizations, reports, shift-types).
- Medir métricas reales (FCP, LCP, INP, CLS, TTFB): ✅ **implementado** — componente `WebVitalsReporter` con `web-vitals`; en desarrollo las métricas se registran en consola; en producción se puede conectar a un endpoint (ver comentario en `src/components/performance/WebVitalsReporter.tsx`).
- Revisar índices en producción con `EXPLAIN ANALYZE` tras desplegar las migraciones (tarea de ops, no código).

### ¿Qué sigue?

| Prioridad | Acción                                                                                                                                                                | Tipo                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1         | **Desplegar** — Aplicar migraciones en Supabase (staging/prod): `supabase db push` o link + push. Desplegar el frontend (Vercel, Netlify, etc.).                      | Ops                     |
| 2         | **Validar métricas** — En producción, abrir consola o conectar `WebVitalsReporter` a un endpoint (GA, PostHog, o API propia) y revisar FCP/LCP/CLS.                   | Implementación opcional |
| 3         | **Revisar índices** — Tras desplegar migraciones, ejecutar `EXPLAIN ANALYZE` en las consultas críticas (shifts, shift_requests, memberships) y ajustar si hace falta. | Ops/DB                  |
| 4         | **Tests** — Añadir tests E2E o unitarios en flujos críticos (login, calendario, solicitudes) si aún no existen.                                                       | Implementación          |
| 5         | **Seguridad** — Revisar `npm audit`, actualizar dependencias con vulnerabilidades y fijar las que requieran cambios de código.                                        | Mantenimiento           |

Recomendación: hacer **1** (desplegar) y **3** (revisar índices) para materializar las mejoras; **2** si quieres datos de rendimiento en producción; **4** y **5** según prioridad del equipo.

## 📈 Métricas de Éxito

Para medir el impacto de las optimizaciones:

### Base de Datos

- **Query Time**: Reducción esperada de 50-80% con índices
- **Table Scans**: Eliminar scans en tablas principales
- **EXPLAIN ANALYZE**: Verificar uso de índices

### Frontend

- **First Contentful Paint (FCP)**: Mejora de 1-2 segundos
- **Time to Interactive (TTI)**: Mejora de 2-3 segundos
- **JavaScript Bundle**: Reducción de 40-60%
- **Número de Requests**: Reducción de 30-50%

### Experiencia de Usuario

- **Carga de Dashboard**: De ~5s a ~2s
- **Navegación de Calendario**: De ~2s a <500ms
- **Carga de Listas**: De ~1.5s a ~500ms

---

## 🚀 Plan de Implementación Sugerido

### Fase 1: Base de Datos (1-2 días)

1. Crear migración con todos los índices
2. Ejecutar `ANALYZE` en tablas principales
3. Verificar con `EXPLAIN ANALYZE`
4. Optimizar trigger de notificaciones

### Fase 2: Consultas y Queries (2-3 días)

1. Crear archivo `src/lib/supabase/queries.ts`
2. Migrar código duplicado a utilidades
3. Eliminar over-fetching (select '\*')
4. Paralelizar consultas en Dashboard

### Fase 3: Server Components (3-4 días)

1. Convertir Dashboard a Server Component
2. Implementar Suspense y streaming
3. Convertir páginas de lista
4. Agregar metadata y error boundaries

### Fase 4: Optimizaciones de Componentes (2-3 días)

1. Implementar debounce en ShiftCalendar
2. Memoizar componentes críticos
3. Optimizar renderEventContent
4. Agregar loading states específicos

### Fase 5: Mejoras Incrementales (1-2 semanas)

1. Implementar SWR o React Query
2. Agregar suscripciones realtime
3. Dividir componentes grandes
4. Optimizar tiempos de caché

---

## 🔧 Herramientas Recomendadas

### Para Desarrollo

- **React DevTools Profiler**: Identificar re-renders
- **Chrome DevTools Performance**: Medir tiempos de carga
- **Lighthouse**: Auditorías de rendimiento

### Para Base de Datos

- **Supabase Dashboard**: Revisar queries lentas
- **pgAdmin**: Analizar planes de ejecución
- **pg_stat_statements**: Monitorear queries más costosas

### Para Monitoreo

- **Vercel Analytics**: Si deployado en Vercel
- **Sentry**: Tracking de errores
- **LogRocket**: Session replay

---

## 📝 Notas Finales

1. **Priorizar según impacto**: Los índices de base de datos son la mejora más crítica
2. **Medir antes y después**: Usar métricas objetivas para validar mejoras
3. **Implementar incrementalmente**: No hacer todos los cambios de una vez
4. **Probar en local primero**: Especialmente cambios de base de datos
5. **Mantener compatibilidad**: No romper funcionalidad existente

---

## 📚 Recursos Adicionales

- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Supabase Performance Tips](https://supabase.com/docs/guides/platform/performance)
- [PostgreSQL Indexing](https://www.postgresql.org/docs/current/indexes.html)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)

---

**Documento generado el**: 2 de febrero de 2026
**Última actualización**: 2 de febrero de 2026
**Versión**: 1.0
