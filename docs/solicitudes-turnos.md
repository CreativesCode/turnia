# Solicitudes de turnos: Ceder, intercambiar, pedir uno abierto

Este documento describe **cómo funcionan** los flujos de solicitudes (Módulo 4) y **qué está hecho** frente a lo pendiente.

---

## 1. Tipos de solicitud

Hay **tres** tipos en `shift_requests.request_type`:

| Tipo | Descripción breve | ¿Quién inicia? | ¿Qué se pide? |
|------|-------------------|----------------|---------------|
| **give_away** | Ceder / donar mi turno | Usuario que tiene el turno | Que me quiten el turno: dejarlo sin asignar o asignarlo a alguien que yo sugiera. |
| **swap** | Intercambiar turnos | Usuario que tiene un turno | Cambiar mi turno por el de otro compañero (y el compañero debe aceptar). |
| **take_open** | Pedir un turno abierto | Cualquier miembro de la org | Asignarme un turno que está **sin asignar**. |

---

## 2. Flujos paso a paso

### 2.1 Ceder / donar turno (`give_away`)

**Objetivo:** “No puedo hacer este turno: quiero cedero o dejarlo pendiente.”

1. **Usuario (staff)**  
   - Elige **su** turno (en calendario o en “Mis turnos”).  
   - Pulsa **“Solicitar cambio”** (o “Ceder turno” / “Pedir cobertura”).  
   - Elige la opción **“Ceder / donar turno”**.  
   - (Opcional) Sugiere un reemplazo concreto (`target_user_id`) o deja que el manager lo asigne.  
   - Escribe un comentario/razón.  
   - Envía → se crea `shift_request` con `request_type = 'give_away'`, `status = 'submitted'`.

2. **Manager**  
   - Ve la solicitud en la **bandeja de solicitudes**.  
   - Aprueba o rechaza.  
   - Si **aprueba**:  
     - Si se sugirió reemplazo y es válido → se asigna el turno a ese usuario.  
     - Si no → el turno queda **sin asignar** (abierto para “take open” o para que el manager asigne luego).

3. **Estados típicos:**  
   `submitted` → `approved` o `rejected`.  
   (En give_away no hay “aceptación de contraparte”, solo manager.)

---

### 2.2 Intercambiar turnos (`swap`)

**Objetivo:** “Quiero cambiar mi turno por el de otro compañero.”

1. **Usuario A (staff)**  
   - Elige **su** turno.  
   - Pulsa “Solicitar cambio” → **“Intercambiar turnos (swap)”**.  
   - Elige el **turno del otro** (`target_shift_id`) y/o al **usuario con quien** intercambiar (`target_user_id`).  
   - Comentario.  
   - Envía → `shift_request` con `request_type = 'swap'`, `status = 'submitted'`.

2. **Usuario B (el otro)**  
   - Recibe la petición (notificación / bandeja “Me piden swap”).  
   - Acepta o rechaza → si acepta: `status = 'accepted'`.

3. **Manager**  
   - Ve la solicitud (en `submitted` o en `accepted` si B ya aceptó).  
   - Aprueba o rechaza.  
   - Si **aprueba**: se **intercambian** las asignaciones de los dos turnos (`shift_id` y `target_shift_id`).

4. **Estados:**  
   `submitted` → `accepted` (por B) → `approved` o `rejected` (por manager).  
   O `submitted` → `rejected` (por B o por manager).

---

### 2.3 Pedir un turno abierto (`take_open`)

**Objetivo:** “Hay un turno sin asignar y yo me puedo hacer cargo.”

1. **Usuario (staff)**  
   - Ve en calendario o lista los turnos **sin asignar** (o una vista “Turnos abiertos”).  
   - Elige uno y pulsa “Quiero este turno” / “Solicitar asignación”.  
   - (Opcional) Comentario.  
   - Envía → `shift_request` con `request_type = 'take_open'`, `shift_id` = turno abierto, `status = 'submitted'`.

2. **Manager**  
   - En la bandeja, aprueba o rechaza.  
   - Si **aprueba**: se asigna `shift.assigned_user_id = requester_id`.

3. **Estados:**  
   `submitted` → `approved` o `rejected`.  
   (No hay aceptación de otro usuario.)

---

## 3. Estados de una solicitud

| Estado | Significado |
|--------|-------------|
| **draft** | Borrador; el usuario no ha enviado. |
| **submitted** | Enviada; pendiente de manager (y en swap, de que la contraparte acepte). |
| **accepted** | Solo **swap**: el otro usuario aceptó; falta que el manager apruebe. |
| **approved** | Manager aprobó; los cambios en `shifts` ya se aplicaron. |
| **rejected** | Rechazada por manager o (en swap) por la contraparte. |
| **cancelled** | El solicitante (o alguien con permiso) canceló la solicitud. |

---

## 4. Dónde se inicia “Solicitar cambio”

En el **modal de detalle de turno** (`ShiftDetailModal`), el botón **“Solicitar cambio”** (pendiente de implementar) debe llevar a elegir el tipo:

- Si el turno **está asignado al usuario actual** → puede:
  - **Ceder / donar** (`give_away`).
  - **Intercambiar** (`swap`) con otro turno/otro usuario.
- Si el turno **no está asignado** → puede:
  - **Pedir ese turno abierto** (`take_open`).

Otros puntos de entrada (a implementar):

- **“Mis solicitudes”** (`/dashboard/staff/my-requests`): lista de mis solicitudes y botón “Nueva” (elegir tipo y turno).
- **Vista “Turnos abiertos”**: para `take_open` sin abrir primero el detalle de un turno concreto.

---

## 5. Bandeja del manager

- **Página:** `/dashboard/manager/requests` (pendiente).
- **Componente:** `RequestsInbox` (ahora un placeholder).
- **Para cada solicitud:**  
  - Ver tipo, turno(s), usuarios, comentario, estado.  
  - **Aprobar** o **Rechazar** con comentario.  
- **Filtros (pendientes):** por tipo (`give_away`, `swap`, `take_open`) y por estado.

---

## 6. Resumen: “dejar pendiente” y “donar”

- **Donar / ceder:**  
  - Es un **give_away**: “me quito de este turno”.  
  - Si no se asigna a nadie en la aprobación → el turno queda **sin asignar** (“dejado pendiente” para que otro lo pida con take_open o el manager lo asigne luego).

- **Dejar pendiente (en el sentido de “solicitud en curso”):**  
  - Mientras la solicitud está en `submitted` o `accepted`, el turno **sigue asignado** al usuario actual (en give_away) o a quienes correspondan (en swap).  
  - Solo al **aprobar** el manager se aplican los cambios: desasignar, reasignar o intercambiar.

---

## 7. Qué hay implementado hoy

### Hecho (base de datos e infra)

- Tabla **`shift_requests`** con:  
  `org_id`, `request_type` (give_away, swap, take_open), `status`, `shift_id`, `requester_id`, `target_shift_id`, `target_user_id`, `approver_id`, `comment`.  
  (Sin `team_id`; solo org.)
- RLS: `shift_requests_select` por org; superadmin con INSERT/UPDATE/DELETE.
- Edge Function **`approve-request`** (esqueleto): actualiza `status` a `approved`/`rejected` y escribe en `audit_log`.  
  - **Pendiente:** validar permisos del aprobador, comprobar que el estado sea aprobable y **aplicar los cambios en `shifts`** según el tipo (give_away: desasignar o reasignar; swap: intercambiar; take_open: asignar al solicitante).

### Pendiente

- **Edge Function `reject-request`** (o ampliar approve-request con `action: 'reject'`).
- **Edge Function o RPC `create-request`** para crear `shift_request` (give_away, swap, take_open) con validaciones.
- **Políticas RLS** para INSERT (user/manager) y UPDATE (manager para approve/reject) en `shift_requests`.
- **UI Staff:**
  - `GiveAwayRequestForm`, `SwapRequestForm`, `TakeOpenShiftForm`.
  - Página `/dashboard/staff/my-requests` y cancelar solicitud en estado permitido.
- **UI en ShiftDetailModal:** botón **“Solicitar cambio”** que abra un selector de tipo (give_away / swap / take_open según el caso) y el formulario correspondiente.
- **UI Manager:**
  - `RequestsInbox` completo y `RequestDetailModal` (ver detalle, aprobar, rechazar).
  - Página `/dashboard/manager/requests`.
- **Swap:** `AcceptSwapButton` para la contraparte y notificación cuando se crea el swap.
- **Notificaciones** (Módulo 5): avisar a manager (nueva solicitud), a la contraparte (swap), a los involucrados (aprobación/rechazo).

---

## 8. Referencias

- **Roadmap:** `docs/project-roadmap.md` → Módulo 4 (Sistema de Solicitudes).
- **Producto:** `docs/indications.md` §5.3 (Request Flows), §5.4 (Approvals).
