# Push Notifications (Módulo 5.1)

## Resumen

- **Tabla `push_tokens`**: almacena tokens FCM (Android) y APNs (iOS) por usuario.
- **Edge Function `register-push-token`**: el cliente (Capacitor) obtiene el token y lo envía aquí; se hace upsert por `token`.
- **Cliente**: `PushNotificationRegistration` en el layout del dashboard pide permisos, llama a `PushNotifications.register()` y envía el token a `register-push-token` (solo en iOS/Android nativos).
- **Edge Function `send-notification`**: dado `userId`, `title`, `body`, lee `push_tokens` y envía vía FCM a los dispositivos Android. Para iOS (APNs) hace falta configuración adicional.

## Android (FCM)

1. **Firebase**: crea un proyecto en [Firebase Console](https://console.firebase.google.com) y añade la app Android (package `com.turnia.app`). Descarga `google-services.json` y colócalo en `android/app/`. (El archivo está en `.gitignore`.)
2. **Manifest**: ya configurado en `android/app/src/main/AndroidManifest.xml`:
   - Permiso `POST_NOTIFICATIONS` (Android 13+).
   - `com.google.firebase.messaging.default_notification_channel_id` = `turnia_notifications` (string en `res/values/strings.xml`).
   - Opcional: `com.google.firebase.messaging.default_notification_icon` (icono en blanco sobre transparente) para mejor aspecto; si se omite, se usa el icono de la app.
3. **Service Account para enviar**:
   - En Firebase: Project Settings → Service accounts → Generate new private key. Obtendrás un JSON.
   - En Supabase: `supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON='...'` con el contenido del JSON (como string; si hay `\n` en `private_key`, déjalos o usa `\\n` según cómo lo inyectes).
   - Opcional: `FCM_PROJECT_ID` si en el JSON no usas `project_id`.
4. Redespliega la Edge Function `send-notification` tras definir el secreto.

## iOS (APNs)

1. **Capability**: en Xcode, habilita **Push Notifications** en el target (Signing & Capabilities → + Capability).
2. **AppDelegate**: ya está configurado en `ios/App/App/AppDelegate.swift` (`didRegisterForRemoteNotificationsWithDeviceToken`, `didFailToRegisterForRemoteNotificationsWithError`); reenvía el token a `@capacitor/push-notifications`.
3. **Envío (APNs)**: `send-notification` todavía **no** envía a dispositivos iOS. Para hacerlo hace falta:
   - Key o certificado en Apple Developer (Key en APNs o Certificado de Push).
   - En el backend, usar `node-apn` o el HTTP/2 APNs API con ese key/cert. Se puede añadir en una futura iteración.

## Invocar `send-notification`

Desde otra Edge Function (por ejemplo `approve-request`, `respond-to-swap`) o desde un servicio de confianza:

```ts
const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`;
await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: '...',
    type: 'request',
    title: 'Solicitud aprobada',
    body: 'Tu solicitud ha sido aprobada.',
    email: false,
  }),
});
```

Con `verify_jwt = false`, no hace falta Bearer de usuario; asegura que solo servicios de confianza (otras EFs, cron) invoquen la URL.

## Notas

- Las notificaciones **in-app** (`notifications`) se insertan directamente en `approve-request`, `respond-to-swap` y en el trigger `notify_on_shift_request_insert`. La función `send-notification` es solo para **push** (y en el futuro **email**).
- Para enviar también push en esos flujos, hay que añadir una llamada a `send-notification` tras insertar en `notifications`, pasando el mismo `userId`, `title` y `body`.
