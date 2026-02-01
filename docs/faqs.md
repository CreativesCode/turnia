# ❓ FAQs — Turnia

Preguntas frecuentes sobre el uso de Turnia (Admin, Manager y Staff).

Si buscas guías paso a paso:

- **Admin**: [Manual Admin](./manual-admin.md)
- **Manager**: [Manual Manager](./manual-manager.md)
- **Staff**: [Manual Staff](./manual-staff.md)

---

## 🔐 Acceso, organizaciones y roles

### ¿Por qué no veo “Admin” o “Manager” en el dashboard?

Porque tu usuario no tiene el rol necesario en `memberships`.

- Para ver **Admin**: necesitas `org_admin` o `superadmin`.
- Para ver **Manager**: normalmente `team_manager` (o `org_admin`, que hereda permisos operativos).

Solución:

- Pide a un admin que te invite y/o te cambie el rol en tu organización.

### “No tienes una organización asignada”

Significa que no tienes un `membership` activo en ninguna organización.

Solución:

- Acepta una invitación, o pide a un admin que te agregue a una organización.

### ¿Qué diferencia hay entre `org_admin` y `superadmin`?

- **org_admin**: administra **su organización**.
- **superadmin**: puede operar **todas** las organizaciones (en varias pantallas aparece selector de org).

---

## 🟦 Tipos de turno y creación de turnos

### No puedo crear turnos, ¿qué falta?

Lo más común:

- No tienes permisos (no eres `team_manager`/`org_admin`).
- No existen **Tipos de turno** en la organización.

Solución:

- Un admin debe crear tipos en `/dashboard/admin/shift-types`.

### ¿Qué es “Publicado” vs “Borrador” en un turno?

- **Publicado**: visible/activo como turno operativo.
- **Borrador**: turno en preparación (según políticas/UX, puede no mostrarse a todos).

---

## 🔄 Solicitudes de turnos (dar de baja, swap, tomar turno abierto)

### ¿Qué tipos de solicitudes existen?

En general:

- **Dar de baja / ceder turno** (`give_away`)
- **Intercambiar turnos** (`swap`)
- **Tomar turno abierto** (`take_open`)

Guía completa: [Solicitudes de turnos](./solicitudes-turnos.md)

### ¿Cómo solicito “dar de baja” o “swap”?

1. Abre el **detalle del turno** (por ejemplo desde Staff → “Mis próximos turnos”).
2. Si el turno está asignado a ti, verás botones como **Dar de baja** e **Intercambiar**.

### ¿Cómo “tomo” un turno abierto?

1. Abre el **detalle** de un turno que esté **sin asignar**.
2. Pulsa **Tomar turno**.

### ¿Quién aprueba una solicitud?

- Un **Manager** (o Admin con permisos operativos) revisa y **aprueba/rechaza** en `/dashboard/manager/requests`.
- En **swap**, además puede existir un paso de **aceptación** por la contraparte (dependiendo del estado del flujo).

### ¿Puedo cancelar una solicitud?

Sí, si aún está en estado pendiente (según el UI). Ve a:

- Staff → **Mis solicitudes**: `/dashboard/staff/my-requests`

---

## 🧑‍🤝‍🧑 Disponibilidad

### ¿Para qué sirve “Mi disponibilidad”?

Para registrar eventos como:

- Vacaciones
- Licencia médica
- Capacitación
- No disponible

Ruta Staff: `/dashboard/staff/availability`

### ¿Quién puede ver mi disponibilidad?

El **Manager** puede verla en modo lectura en:

- `/dashboard/manager/availability`

---

## 🔔 Notificaciones

### ¿Dónde veo mis notificaciones?

En la campana de notificaciones (UI in-app).

### ¿Puedo abrir un turno desde una notificación?

Sí, hay deep links que pueden llevar al detalle del turno. Por ejemplo:

- `/dashboard/manager?shift=<id>`

---

## 📱 Móvil y offline

### ¿La app funciona offline?

Hay soporte parcial (cache + sincronización al reconectar) en vistas clave. Si estás offline:

- Puede mostrarse información cacheada.
- Algunas acciones pueden requerir reconexión.

---

## 📤 Exportes, reportes y auditoría

### ¿Dónde exporto horarios?

Admin → **Exportar horarios**:

- `/dashboard/admin/exports`

### ¿Dónde veo reportes?

Admin → **Reportes básicos**:

- `/dashboard/admin/reports`

### ¿Dónde veo el registro de auditoría?

Admin → **Registro de auditoría**:

- `/dashboard/admin/audit`

---

## 🧯 Errores comunes / troubleshooting

### “Sesión expirada” o errores tipo “Invalid JWT”

Suele ocurrir cuando el token expiró.

Solución rápida:

- **Recarga la página** e inicia sesión de nuevo.

### “No tengo permisos…”

Depende de la pantalla:

- Admin: requiere `org_admin`/`superadmin`
- Manager: requiere permisos de gestión (`team_manager`/`org_admin`)

Solución:

- Pide a un admin que ajuste tu rol o te agregue a la organización correcta.

---

Para volver al índice: **[docs/README](./README.md)**.

