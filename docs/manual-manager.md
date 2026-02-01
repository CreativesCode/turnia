# 🧑‍💼 Manual de usuario — Manager (Team Manager / Admin org)

Este manual describe cómo usar Turnia desde el rol **Manager** (`team_manager`). En Turnia, `org_admin` también hereda permisos de gestión operativa, por lo que muchos puntos aplican igualmente a **Admin org**.

> Si necesitas un manual de administración de organización (invitaciones, roles, etc.), mira: **[Manual Admin](./manual-admin.md)**.

---

## ✅ 1) Qué puede hacer un Manager

Según el RBAC del proyecto:

- **Gestionar turnos** (crear/editar/eliminar) en su organización.
- **Aprobar / rechazar solicitudes** de turnos (dar turno, swap, tomar turno abierto).
- **Ver disponibilidad del equipo** (solo lectura).

---

## 🔐 2) Acceso y navegación

- **Calendario (Manager)**: `/dashboard/manager`
- **Lista de turnos**: `/dashboard/manager/shifts`
- **Solicitudes**: `/dashboard/manager/requests`
- **Disponibilidad del equipo**: `/dashboard/manager/availability`

---

## 🗓️ 3) Calendario de turnos

Ruta: `/dashboard/manager`

### 3.1 Ver el calendario y filtrar

- Usa el panel de **filtros del calendario** para acotar qué turnos estás viendo (por ejemplo por tipo/estado, según el UI).
- Haz clic en un turno para abrir el **detalle**.

### 3.2 Crear un turno

- Pulsa **“Nuevo turno”** o haz clic sobre una fecha del calendario (si está habilitado).
- Completa el formulario (tipo de turno, fecha, asignación, etc.) y guarda.

> Requisito típico: la organización debe tener **Tipos de turno** definidos (los configura Admin en `/dashboard/admin/shift-types`).

### 3.3 Editar o eliminar un turno

- Abre el turno (detalle) y usa **Editar** (si tienes permiso).
- Al guardar o eliminar, el calendario se refresca.

### 3.4 Abrir un turno desde notificaciones (deep link)

El calendario soporta abrir un turno directo con:

- `/dashboard/manager?shift=<id>`

Esto se usa para navegación desde notificaciones in-app.

---

## 📋 4) Lista de turnos

Ruta: `/dashboard/manager/shifts`

Aquí tienes una vista orientada a operación:

- **Búsqueda / filtros** (según el componente `ShiftList`).
- **Abrir detalle** al hacer clic en un turno.
- **Editar** desde la lista (si está disponible).

### 4.1 Operaciones masivas (Bulk)

Si tienes permisos de gestión, aparece un panel de **operaciones masivas**:

- Selecciona varios turnos.
- Aplica acciones en lote (según el panel actual).

### 4.2 Copiar período

Botón **“Copiar período”**:

- Duplica un rango de turnos (útil para rotaciones semanales/mensuales).

### 4.3 Generar desde patrón

Botón **“Generar desde patrón”**:

- Crea turnos a partir de un patrón/plantilla (útil para calendarios recurrentes).

---

## 🔄 5) Solicitudes de turnos (aprobaciones)

Ruta: `/dashboard/manager/requests`

En esta bandeja puedes:

- Ver solicitudes creadas por usuarios (y/o managers).
- Abrir el detalle de una solicitud.
- **Aprobar** o **Rechazar** (según permisos).
- Usar **Actualizar** para refrescar el listado.

Tipos habituales:

- **Ceder / donar turno** (`give_away`)
- **Intercambiar turnos** (`swap`)
- **Tomar turno abierto** (`take_open`)

Referencia funcional (más “producto” que “manual”): **[Solicitudes de turnos](./solicitudes-turnos.md)**.

---

## 🧩 6) Disponibilidad del equipo (solo lectura)

Ruta: `/dashboard/manager/availability`

Esta vista muestra eventos como:

- Vacaciones
- Licencia
- Capacitación
- No disponible

Funciones:

- Filtrar por **usuario** y por **tipo de evento**.
- Clic en un evento → abre un **detalle**.

Nota:

- Los miembros editan su disponibilidad en el área de **Staff**; como Manager se visualiza en modo lectura.

---

## 🧯 7) Problemas comunes

- **No veo “Nuevo turno” / no puedo editar**
  - Tu rol debe incluir permisos de gestión (normalmente `team_manager` o `org_admin`).

- **No puedo aprobar solicitudes**
  - Revisa que tu rol permita aprobaciones (Manager/Team Manager).

- **No tengo organización asignada**
  - Debes pertenecer a una org mediante `memberships`. Contacta a un admin para que te invite.

---

Para volver al índice: **[docs/README](./README.md)**.

