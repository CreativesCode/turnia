# 🧑‍💼 Manual de usuario — Admin (Org Admin / Superadmin)

Este manual explica cómo usar Turnia desde el rol **Admin de organización** (`org_admin`) y qué cosas cambian si eres **Superadmin** (`superadmin`).

> Si aún no tienes un admin creado: revisa primero **[Primer Administrador](./first-admin.md)**.

---

## ✅ 1) Qué puede hacer un Admin en Turnia

En Turnia los permisos vienen del rol en `memberships.role`:

- **Admin org (`org_admin`)**
  - Gestiona **su propia organización**.
  - Puede: administrar miembros/roles, invitaciones, tipos de turno, exports, reportes, auditoría y configuración de la org.
  - Nota: en la app, `org_admin` se considera también “manager” a efectos de permisos (puede gestionar turnos y aprobaciones).

- **Superadmin (`superadmin`)**
  - Puede operar **sobre todas las organizaciones**.
  - En varias pantallas aparece un **selector de organización**.

---

## 🔐 2) Acceso y navegación

- **Iniciar sesión**: `/login`
- **Panel principal**: `/dashboard`
- **Sección Admin**: `/dashboard/admin`

Desde `/dashboard/admin` tienes accesos directos a:

- **Organizaciones**: `/dashboard/admin/organizations`
- **Miembros**: `/dashboard/admin/members`
- **Invitar usuarios**: `/dashboard/admin/invite`
- **Tipos de turno**: `/dashboard/admin/shift-types`
- **Exportar horarios**: `/dashboard/admin/exports`
- **Reportes básicos**: `/dashboard/admin/reports`
- **Registro de auditoría**: `/dashboard/admin/audit`

> La página **Configuración de la organización** existe en `/dashboard/admin/settings` (puede estar enlazada desde otros puntos del UI).

---

## 🏢 3) Organizaciones

Ruta: `/dashboard/admin/organizations`

### 3.1 Superadmin: crear/editar/eliminar organizaciones

- Pulsa **“Crear organización”** para crear una nueva.
- Para editar, se abre un modo de edición por querystring (tipo `?edit=<uuid>`).

### 3.2 Admin org: configuración de tu organización

Como `org_admin` verás la configuración de **tu organización** (no una lista global).

Típicamente aquí ajustarás:

- **Nombre / slug** (si aplica)
- Opciones generales de la organización (según lo que exponga el formulario)

---

## 👥 4) Miembros y roles

Ruta: `/dashboard/admin/members`

Desde aquí puedes:

- **Ver el listado de miembros** de la organización.
- **Cambiar roles** (por ejemplo: `team_manager`, `user`, `viewer`).
- **Eliminar miembros** (si el UI lo permite y RLS lo autoriza).
- Ir rápidamente a **Invitar usuarios**.

### 4.1 Roles en la app (resumen)

- **Superadmin**: control global.
- **Admin org**: administración de una org.
- **Gestor (`team_manager`)**: gestión operativa (turnos, aprobaciones).
- **Usuario (`user`)**: staff estándar.
- **Solo lectura (`viewer`)**: acceso de lectura.

---

## ✉️ 5) Invitar usuarios

Ruta: `/dashboard/admin/invite`

En “Invitar usuarios” puedes:

- Crear invitaciones por **correo**.
- Compartir el **enlace** generado.
- Ver invitaciones emitidas en el listado.

Notas importantes:

- El enlace **expira en 7 días** (lo indica el propio UI).
- Si ves el mensaje “No tienes permisos…”, necesitas ser `org_admin` o `superadmin` (y tener una org seleccionada/aplicable).

Referencia técnica (opcional): **[Invitaciones por email](./invitation-emails.md)**.

---

## 🟦 6) Tipos de turno (Shift Types)

Ruta: `/dashboard/admin/shift-types`

Los tipos de turno son necesarios para crear turnos (por ejemplo: “Mañana”, “Noche”, “24h”).

Aquí defines:

- **Nombre**
- **Letra / badge**
- **Color**
- Otros campos que exponga el formulario/listado

Superadmin:

- Puede elegir la organización desde el **selector de organización** (si hay más de una).

---

## ⚙️ 7) Configuración de la organización

Ruta: `/dashboard/admin/settings`

En esta pantalla se configuran reglas operativas de la organización, por ejemplo:

- Reglas relacionadas con **aprobaciones**
- **Descanso mínimo** entre turnos (se usa en validaciones de conflictos al crear/editar turnos)

Superadmin:

- Tiene selector de organización.

---

## 📤 8) Exportar horarios

Ruta: `/dashboard/admin/exports`

Permite exportar información del calendario/turnos a formatos de archivo (según opciones del UI).

Recomendación:

- Define primero los **tipos de turno** y asegúrate de tener turnos creados en el rango que vas a exportar.

---

## 📊 9) Reportes básicos

Ruta: `/dashboard/admin/reports`

Dashboard con reportes agregados (según el UI actual), por ejemplo:

- Turnos por usuario
- Turnos nocturnos / fin de semana
- Turnos sin asignar
- Solicitudes por estado

---

## 🧾 10) Registro de auditoría (Audit Log)

Ruta: `/dashboard/admin/audit`

Aquí puedes auditar acciones relevantes del sistema, con filtros (según el UI actual), por ejemplo:

- Entidad
- Actor
- Acción
- Rango de fechas
- “Snapshot” antes/después

---

## 🧩 11) Flujos típicos de un Admin (checklist)

- **Arrancar una org desde cero**
  - Crear el primer usuario admin (si aplica) → ver `first-admin.md`
  - Crear/ajustar organización (superadmin) o configurar la org (org_admin)
  - Crear **tipos de turno**
  - Invitar miembros
  - Asignar roles (ej. gestores)

- **Operación semanal**
  - Revisar miembros/roles
  - Ajustar configuración (descanso mínimo, reglas)
  - Exportar y revisar reportes
  - Consultar auditoría si hay incidencias

---

## 🧯 12) Problemas comunes

- **No veo la sección Admin**
  - Tu usuario necesita un `membership` con rol `org_admin` o `superadmin`.

- **No puedo invitar usuarios**
  - Debes ser admin (o superadmin) y tener una organización aplicable.

- **No hay organizaciones (superadmin)**
  - Crea una desde `/dashboard/admin/organizations`.

---

Para volver al índice: **[docs/README](./README.md)**.

