# 👤 Manual de usuario — Staff

Este manual explica cómo usar Turnia como **Staff** (`user` o `viewer`): ver tus turnos, solicitar cambios (dar de baja / swap / tomar turno abierto) y gestionar tu disponibilidad.

---

## 🔐 1) Acceso y navegación

- **Panel Staff**: `/dashboard/staff`
- **Mis solicitudes**: `/dashboard/staff/my-requests`
- **Mi disponibilidad**: `/dashboard/staff/availability`

> Si además tienes rol de manager/admin, puede que veas enlaces adicionales (por ejemplo “Ver calendario”).

---

## 🧭 2) Panel Staff (inicio)

Ruta: `/dashboard/staff`

En esta pantalla verás:

- Accesos directos a:
  - **Mis solicitudes**
  - **Mi disponibilidad**
  - **Ver calendario** (si está disponible para tu rol)
- Widgets:
  - **Mis próximos turnos (14 días)**: lista de próximos turnos y acceso al detalle.
  - **On-call now**: quién está de turno ahora.

### 2.1 Abrir el detalle de un turno

- Haz clic en un turno desde “Mis próximos turnos” o desde “On-call now”.
- Se abre el **Detalle del turno** (modal).

---

## 🕒 3) Detalle del turno: qué puedes hacer

En el modal “Detalle del turno” puedes ver:

- Tipo de turno (nombre, letra, color y horario del tipo)
- Fechas y horas (rango)
- Asignado (tú / otra persona / sin asignar)
- Ubicación (si aplica)
- Estado (Publicado / Borrador)

### 3.1 Solicitar cambios (según el caso)

Si el turno es tuyo, aparecen acciones:

- **Dar de baja**: solicitar dejar de realizar ese turno.
- **Intercambiar**: solicitar un swap con otro turno.

Si el turno está **sin asignar**, aparece:

- **Tomar turno**: pedir que te asignen ese turno abierto.

> Todas estas acciones crean una **solicitud** que luego se aprueba/rechaza (y en swap puede requerir aceptación de la contraparte).

Referencia de producto (más detalle de flujos): **[Solicitudes de turnos](./solicitudes-turnos.md)**.

---

## 🔄 4) Mis solicitudes

Ruta: `/dashboard/staff/my-requests`

Aquí puedes:

- Ver el listado de **tus solicitudes** (estado, tipo, etc.).
- **Cancelar** solicitudes que aún están pendientes (según el estado permitido en el UI).
- Ver y resolver **swaps pendientes para ti** (si eres la contraparte):
  - **Aceptar**
  - **Rechazar**
- Usar el botón **Actualizar** para refrescar.

Estados típicos:

- `draft`, `submitted`, `accepted`, `approved`, `rejected`, `cancelled`

---

## 🗓️ 5) Mi disponibilidad

Ruta: `/dashboard/staff/availability`

Esta pantalla sirve para registrar tu disponibilidad (visible para managers):

- Vacaciones
- Licencia médica
- Capacitación
- No disponible

### 5.1 Crear un evento de disponibilidad

- Pulsa **Agregar** o haz clic en un día del calendario.
- Completa el tipo, fechas y detalles (según el formulario).

### 5.2 Editar o eliminar un evento

- Haz clic en un evento existente.
- Se abre el modal para **editar** o **eliminar**.

### 5.3 Actualizar la vista

- Pulsa **Actualizar** para refrescar el calendario.

---

## 🧯 6) Problemas comunes

- **No veo mis turnos**
  - Confirma que perteneces a una organización y que tienes turnos asignados en el rango mostrado.

- **No aparecen botones para solicitar cambios**
  - Solo aparecen si:
    - El turno es tuyo (para dar de baja / intercambiar), o
    - El turno está sin asignar (para tomar turno), y
    - Tu rol tiene permiso de crear solicitudes.

- **No puedo aceptar/rechazar un swap**
  - Solo puedes responder si eres la contraparte del swap y está pendiente de tu acción.

---

Para volver al índice: **[docs/README](./README.md)**.

