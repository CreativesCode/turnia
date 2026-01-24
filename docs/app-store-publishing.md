# Publicación en App Stores

## 📱 Apple App Store (iOS)

### Requisitos Previos

1. **Apple Developer Account**:
   - Costo: $99 USD/año
   - Registro en: https://developer.apple.com

2. **Certificados y Perfiles**:
   - Development Certificate
   - Distribution Certificate
   - App Store Provisioning Profile

### Preparación de la App

#### 1. Configurar en Xcode

```bash
# Abrir proyecto
npm run cap:ios
```

En Xcode:

1. **General Tab**:
   - Display Name: `Turnia`
   - Bundle Identifier: `com.turnia.app`
   - Version: `1.0.0` (ej: 1.0.0)
   - Build: `1` (incrementar en cada subida)

2. **Signing & Capabilities**:
   - Team: Seleccionar tu cuenta de desarrollo
   - ☑️ Automatically manage signing
   - Provisioning Profile: (auto-generado)

3. **Build Settings**:
   - iOS Deployment Target: `13.0` o superior
   - Supported Destinations: iPhone, iPad

#### 2. Preparar Assets para la Store

Necesitarás crear:

- **App Preview (opcional)**: Video de 15-30 segundos
- **Screenshots** (requeridos):
  - iPhone 6.7": 1290 x 2796 px (3-10 capturas)
  - iPhone 6.5": 1242 x 2688 px
  - iPad Pro (12.9"): 2048 x 2732 px
  
**Tip**: Usa simuladores para capturar screenshots con calidad perfecta.

#### 3. Archivar y Subir

1. En Xcode:
   ```
   Product > Archive
   ```

2. En el Organizer (se abre automáticamente):
   - Seleccionar el archive
   - Click en "Distribute App"
   - Seleccionar "App Store Connect"
   - Seguir el asistente

3. Verificar en [App Store Connect](https://appstoreconnect.apple.com):
   - La build debería aparecer en "Activities" después de 10-30 minutos
   - Una vez procesada, asignarla a tu versión de app

#### 4. Completar Información en App Store Connect

1. **App Information**:
   - Name: Turnia - Gestión de Turnos Médicos
   - Subtitle: Sistema de turnos para hospitales
   - Category: Medical, Productivity
   - Content Rights

2. **Pricing and Availability**:
   - Price: Free (o el precio que elijas)
   - Availability: Países/regiones

3. **App Privacy**:
   - Privacy Policy URL
   - Data Types Collected (importante!)

4. **Version Information**:
   - Screenshots (subir las capturas)
   - Promotional Text
   - Description:
     ```
     Turnia es una aplicación profesional para la gestión de turnos
     y horarios en hospitales, clínicas y centros de salud.
     
     Características principales:
     • Gestión de turnos médicos
     • Calendario de guardias
     • Sistema de notificaciones
     • Gestión de solicitudes
     • Exportación de horarios
     • Roles y permisos (Admin, Manager, Staff, Viewer)
     
     Ideal para:
     - Hospitales
     - Clínicas
     - Centros de atención primaria
     - Servicios de emergencia
     ```
   - Keywords: turno, guardia, hospital, medico, horario, calendario
   - Support URL
   - Marketing URL (opcional)

5. **Build**:
   - Seleccionar la build que subiste

6. **Rating**:
   - Completar el cuestionario de contenido

7. **Submit for Review**

### Tiempos Estimados

- Primera revisión: 1-3 días
- Actualizaciones: 1-2 días
- Apelaciones: 1-2 días adicionales

---

## 🤖 Google Play Store (Android)

### Requisitos Previos

1. **Google Play Console Account**:
   - Costo único: $25 USD
   - Registro en: https://play.google.com/console

2. **Keystore para Firma**:
   - Necesitas generar un keystore para firmar tu app

### Preparación de la App

#### 1. Generar Keystore

```bash
# En el directorio del proyecto
cd android/app

# Generar keystore
keytool -genkey -v -keystore turnia-release.keystore -alias turnia -keyalg RSA -keysize 2048 -validity 10000
```

**Guardar información**:
- Password del keystore
- Password del alias
- Información del certificado

**⚠️ IMPORTANTE**: Guarda este archivo en un lugar seguro. Si lo pierdes, no podrás actualizar la app.

#### 2. Configurar Signing en Android Studio

1. Abrir proyecto:
   ```bash
   npm run cap:android
   ```

2. Crear archivo `android/key.properties`:
   ```properties
   storePassword=TU_PASSWORD_KEYSTORE
   keyPassword=TU_PASSWORD_ALIAS
   keyAlias=turnia
   storeFile=../app/turnia-release.keystore
   ```

3. Actualizar `android/app/build.gradle`:
   ```gradle
   android {
       ...
       signingConfigs {
           release {
               storeFile file(keystoreProperties['storeFile'])
               storePassword keystoreProperties['storePassword']
               keyAlias keystoreProperties['keyAlias']
               keyPassword keystoreProperties['keyPassword']
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled false
               ...
           }
       }
   }
   ```

#### 3. Generar APK/AAB para Producción

```bash
cd android
./gradlew bundleRelease  # Para AAB (recomendado)
# o
./gradlew assembleRelease  # Para APK
```

Archivos generados:
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

#### 4. Preparar Assets para la Store

Necesitarás:

- **Ícono de la App**: 512 x 512 px (ya generado en `android/app/src/main/res/mipmap-xxxhdpi/`)
- **Feature Graphic**: 1024 x 500 px (crear en diseño gráfico)
- **Screenshots** (requeridos):
  - Teléfono: 320-3840 px de ancho (min 2, max 8)
  - Tablet 7": opcional
  - Tablet 10": opcional

**Capturas recomendadas**:
```
1. Pantalla de login
2. Dashboard principal
3. Calendario de turnos
4. Lista de solicitudes
5. Vista de perfil
```

#### 5. Crear App en Play Console

1. Ir a [Play Console](https://play.google.com/console)
2. "Create app"
3. Completar información básica:
   - App name: Turnia
   - Default language: Spanish (Latinoamérica)
   - Type: App
   - Free/Paid: Free

#### 6. Completar Store Listing

1. **Product Details**:
   - App name: `Turnia - Gestión de Turnos`
   - Short description (80 chars):
     ```
     Gestión profesional de turnos médicos para hospitales y clínicas
     ```
   - Full description (4000 chars max):
     ```
     Turnia es la solución completa para la gestión de turnos y horarios
     en hospitales, clínicas y centros de salud.
     
     🏥 CARACTERÍSTICAS PRINCIPALES:
     
     • Gestión de Turnos
       - Asignación y visualización de turnos
       - Calendario interactivo
       - Filtros por personal y fechas
     
     • Solicitudes y Aprobaciones
       - Sistema de solicitudes de cambio
       - Flujo de aprobación
       - Notificaciones en tiempo real
     
     • Roles y Permisos
       - Admin: Control total del sistema
       - Manager: Gestión de personal
       - Staff: Gestión de turnos propios
       - Viewer: Visualización de información
     
     • Notificaciones
       - Alertas de cambios de turno
       - Recordatorios de guardia
       - Actualizaciones del sistema
     
     • Exportación
       - Exportar horarios a PDF/Excel
       - Compartir información fácilmente
     
     📱 IDEAL PARA:
     - Hospitales
     - Clínicas
     - Centros de atención primaria
     - Servicios de emergencia
     - Consultorios médicos
     
     🔒 SEGURIDAD:
     Toda la información está protegida con los más altos
     estándares de seguridad y privacidad.
     
     💡 SOPORTE:
     Nuestro equipo está disponible para ayudarte en todo momento.
     
     Descarga Turnia hoy y simplifica la gestión de turnos en tu
     institución de salud.
     ```

2. **Graphics**:
   - App icon: Usar el generado automáticamente
   - Feature graphic: Subir imagen de 1024x500px
   - Screenshots: Subir al menos 2 capturas por categoría

3. **Categorization**:
   - Category: Medical
   - Tags: healthcare, scheduling, medical, hospital

4. **Contact details**:
   - Email: tu@email.com
   - Phone: (opcional)
   - Website: https://turnia.app (si tienes)
   - Privacy policy: (REQUERIDO - URL a tu política)

#### 7. Content Rating

1. Completar cuestionario:
   - ¿Violencia? No
   - ¿Contenido sexual? No
   - ¿Lenguaje? No
   - ¿Drogas? No
   - ¿Apuestas? No
   - ¿Compras? Según tu modelo

2. Obtener rating (usualmente Everyone)

#### 8. Target Audience y Content

1. **Target age**: 18+ (profesionales de salud)
2. **Ads**: ¿Contiene anuncios? (probablemente no)
3. **Data safety**: IMPORTANTE - declarar qué datos recoges

#### 9. Subir APK/AAB

1. En "Release" > "Production":
   - "Create new release"
   - Upload el AAB
   - Completar release notes:
     ```
     Primera versión de Turnia
     
     Incluye:
     - Gestión de turnos médicos
     - Sistema de roles y permisos
     - Calendario interactivo
     - Notificaciones
     - Exportación de horarios
     ```

2. "Review release"
3. "Start rollout to Production"

### Tiempos Estimados

- Primera revisión: 2-7 días
- Actualizaciones: 1-3 días
- Puede ser más rápido si todo está correcto

---

## 📋 Checklist Pre-Publicación

### General
- [ ] Versión de producción probada exhaustivamente
- [ ] Todos los endpoints apuntan a producción (no localhost)
- [ ] API keys de producción configuradas
- [ ] Analytics configurado
- [ ] Crash reporting configurado (ej: Sentry)
- [ ] Deep links configurados (si aplica)

### iOS
- [ ] Certificados de producción configurados
- [ ] Build number incrementado
- [ ] Version number correcto (SemVer)
- [ ] Screenshots preparados (todos los tamaños)
- [ ] App Store description revisada
- [ ] Privacy Policy URL válida
- [ ] Support URL válida
- [ ] Edad mínima configurada
- [ ] Cuestionario de contenido completado

### Android
- [ ] Keystore seguro y respaldado
- [ ] AAB firmado correctamente
- [ ] Version code incrementado
- [ ] Version name correcto
- [ ] Screenshots preparados
- [ ] Feature graphic creado
- [ ] Store listing completado
- [ ] Content rating obtenido
- [ ] Data safety completado
- [ ] Privacy Policy URL válida

---

## 🔒 Políticas Importantes

### Privacy Policy (REQUERIDA)

Ambas stores requieren una URL pública con tu política de privacidad. Debe incluir:

1. Qué datos recoges (email, nombre, rol, etc.)
2. Cómo los usas
3. Con quién los compartes (Supabase, etc.)
4. Cómo los proteges
5. Derechos del usuario (GDPR/CCPA)
6. Contacto

**Generadores útiles**:
- https://www.privacypolicygenerator.info/
- https://app-privacy-policy-generator.firebaseapp.com/

### Terms of Service (Recomendado)

Define:
- Uso aceptable de la app
- Limitaciones de responsabilidad
- Propiedad intelectual
- Terminación de cuenta

---

## 🚀 Después de la Publicación

1. **Monitorear**:
   - Reviews y ratings
   - Crash reports
   - Analytics

2. **Responder a Reviews**:
   - Especialmente los negativos
   - Muestra que te importa el feedback

3. **Actualizaciones Regulares**:
   - Cada 2-4 semanas (bugs/features)
   - Mantén la app actualizada con nuevos OS

4. **Marketing**:
   - Redes sociales
   - Website
   - Email a clientes potenciales

---

## 📞 Soporte

### Apple
- https://developer.apple.com/support/

### Google
- https://support.google.com/googleplay/android-developer/

### Capacitor
- https://capacitorjs.com/docs
- https://forum.ionicframework.com/

**¡Buena suerte con tu lanzamiento! 🎉**
