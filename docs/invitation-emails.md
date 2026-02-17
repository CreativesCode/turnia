# Envío de invitaciones por correo

## Cómo funciona

1. **Siempre**: al crear una invitación se guarda en BD, se genera un token y un **enlace**. Ese enlace se muestra en la app para copiar y compartir.
2. **Si Resend está configurado**: además se envía un **correo** al email del invitado con ese enlace. La app indicará "Se ha enviado un correo con el enlace".
3. **Si Resend NO está configurado**: solo verás el enlace; la app indica "Copia y comparte el enlace (el envío por correo no está configurado)".

El invitado puede:
- Recibir el correo y hacer clic en "Aceptar invitación", o
- Recibir el enlace por otro medio (WhatsApp, Slack, etc.) y usarlo igual.

### Confirmación de correo (cuenta nueva)

Si el invitado **no tiene cuenta**, al rellenar el formulario y pulsar "Aceptar invitación" se le envía el **correo de confirmación de Supabase**. El enlace de ese correo está configurado para redirigir a **la misma página de invitación** (`/invite?token=...`), de modo que al hacer clic:
1. Se confirma el correo.
2. Se inicia sesión automáticamente.
3. Se muestra de nuevo la página de invitación con el botón "Aceptar invitación"; al pulsarlo se asigna a la organización.

**En producción**: en el dashboard de Supabase (Authentication → URL Configuration) añade a **Redirect URLs** la URL de tu app con la ruta `/invite`, por ejemplo `https://tudominio.com/invite` o un patrón como `https://tudominio.com/*`.

---

## Activar el envío por correo (Resend)

1. **Crear cuenta en Resend**: https://resend.com (plan gratuito: 3000 emails/mes).

2. **Obtener API Key**: en el dashboard, **API Keys** → **Create API Key**. Copia la key (empieza por `re_`).

3. **Configurar el secreto en Supabase**:
   ```powershell
   npx supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
   ```

4. **Redesplegar la función**:
   ```powershell
   npx supabase functions deploy invite-user --no-verify-jwt
   ```

### Origen del correo (remitente)

- **Por defecto** se usa `Turnia <onboarding@resend.dev>`. Resend permite usarlo para pruebas; los correos pueden llegar a spam.
- **Producción**: verifica tu dominio en Resend y define un remitente propio:
  ```powershell
  npx supabase secrets set RESEND_FROM="Turnia <invitaciones@tudominio.com>"
  ```

---

---

## Otros correos (cuando Resend está activo)

- **Confirmación**: cuando un invitado acepta, se envía un correo al **invitador** (`accept-invitation`).
- **Recordatorio**: la Edge Function `send-invitation-reminder` envía un correo a invitaciones **pendientes que expiran en las próximas 48 h**. Para usarla, programa un cron (1×/día) que llame:
  ```
  POST https://<PROJECT_REF>.supabase.co/functions/v1/send-invitation-reminder
  Header: X-Cron-Secret: <CRON_SECRET>   (opcional; si defines CRON_SECRET, debe coincidir)
  ```
  Ejemplo en Vercel: `vercel.json` con `crons: [{ "path": "/api/cron-reminders", "schedule": "0 9 * * *" }]` y un Route Handler que haga `fetch` a esta función con `X-Cron-Secret`.

---

## Resumen de secretos para invitaciones

| Secreto | Obligatorio | Descripción |
|--------|-------------|-------------|
| `SERVICE_ROLE_KEY` | Sí | Para que las funciones accedan a la BD |
| `APP_URL` | Sí | URL base de la app para los enlaces |
| `RESEND_API_KEY` | No | Si está definido: invitación, confirmación, recordatorio y reenvío por correo |
| `RESEND_FROM` | No | Remitente. Por defecto: `Turnia <onboarding@resend.dev>` |
| `CRON_SECRET` | No | Solo para `send-invitation-reminder`; si se define, el cron debe enviar `X-Cron-Secret` |
