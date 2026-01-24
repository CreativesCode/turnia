# Guía de Prueba - Assets Nativos

## 🧪 Cómo Probar los Assets Generados

### Preparación Inicial

```bash
# 1. Construir la aplicación web
npm run build

# 2. Sincronizar con plataformas nativas
npm run cap:sync
```

## 📱 Probar en iOS

### Simulador iOS (Mac únicamente)

1. Abrir el proyecto en Xcode:
   ```bash
   npm run cap:ios
   ```

2. En Xcode:
   - Seleccionar un simulador (ej: iPhone 15 Pro)
   - Presionar el botón ▶️ Play o `Cmd+R`
   - Observar el splash screen y el ícono en la pantalla de inicio

3. **Qué verificar**:
   - ✅ El ícono de Turnia aparece en el simulador
   - ✅ El splash screen se muestra al iniciar (logo en fondo blanco)
   - ✅ La aplicación carga correctamente después del splash

### Dispositivo iOS Físico

1. Conectar iPhone/iPad por USB
2. En Xcode:
   - Seleccionar tu dispositivo físico en el selector
   - Configurar Team en "Signing & Capabilities"
   - Ejecutar la app (`Cmd+R`)

3. **Qué verificar**:
   - ✅ Instalación exitosa
   - ✅ Ícono visible en la pantalla de inicio
   - ✅ Splash screen se muestra correctamente
   - ✅ Modo claro y oscuro funcionan (cambiar en ajustes del dispositivo)

## 🤖 Probar en Android

### Emulador Android

1. Abrir el proyecto en Android Studio:
   ```bash
   npm run cap:android
   ```

2. En Android Studio:
   - Iniciar AVD Manager (Android Virtual Device)
   - Crear/iniciar un emulador (ej: Pixel 5)
   - Presionar ▶️ Run o `Shift+F10`

3. **Qué verificar**:
   - ✅ Ícono adaptativo se muestra correctamente
   - ✅ Splash screen aparece al iniciar
   - ✅ Transición suave del splash a la app
   - ✅ Ícono redondo en dispositivos que lo soporten

### Dispositivo Android Físico

1. Habilitar modo desarrollador en el dispositivo:
   - Ajustes > Acerca del teléfono
   - Tocar "Número de compilación" 7 veces
   - Activar "Depuración USB"

2. Conectar por USB y en Android Studio:
   - Seleccionar tu dispositivo físico
   - Ejecutar la app

3. **Qué verificar**:
   - ✅ Instalación exitosa
   - ✅ Ícono se adapta a la forma del launcher del dispositivo
   - ✅ Splash screen en diferentes orientaciones (portrait/landscape)
   - ✅ Modo claro y oscuro funcionan

## 🌐 Probar PWA (Navegador)

### En el Navegador

1. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Abrir `http://localhost:3000` en Chrome/Edge

3. **Qué verificar**:
   - ✅ El logo aparece como favicon
   - ✅ El manifest.json está accesible en `/manifest.json`
   - ✅ Los íconos PWA están disponibles en `/icons/`

### Instalar como PWA

1. En Chrome/Edge:
   - Click en el ícono de instalación en la barra de direcciones
   - O menú > "Instalar Turnia"

2. **Qué verificar**:
   - ✅ La app se instala como aplicación standalone
   - ✅ El ícono aparece en el escritorio/menú de apps
   - ✅ Abre en ventana independiente sin barra de navegador
   - ✅ Theme color (#17a2b8) se aplica correctamente

## 🔍 Verificar Calidad de Assets

### iOS - Verificar en Xcode

1. En Xcode, navegar a:
   ```
   ios/App/App/Assets.xcassets/
   ```

2. Seleccionar `AppIcon` y `Splash`:
   - Verificar que no haya advertencias amarillas
   - Confirmar que todas las resoluciones están presentes

### Android - Verificar en Android Studio

1. En Android Studio, navegar a:
   ```
   android/app/src/main/res/
   ```

2. Revisar carpetas `mipmap-*` y `drawable-*`:
   - Abrir algunos PNG para verificar calidad
   - Confirmar que los archivos no están corruptos

## 🎨 Probar Modo Oscuro

### iOS
1. En el dispositivo/simulador:
   - Ajustes > Pantalla y brillo > Oscuro
2. Reiniciar la app
3. Verificar splash screen oscuro

### Android
1. En el dispositivo/emulador:
   - Ajustes > Pantalla > Tema oscuro
2. Reiniciar la app
3. Verificar splash screen oscuro

## 📊 Checklist de Pruebas

### Ícono de la App
- [ ] iOS: Ícono visible en Home Screen
- [ ] iOS: Ícono en App Library
- [ ] iOS: Ícono en búsqueda Spotlight
- [ ] Android: Ícono adaptativo funcionando
- [ ] Android: Ícono redondo en launchers compatibles
- [ ] Android: Ícono en cajón de aplicaciones
- [ ] PWA: Ícono en escritorio/menú de apps

### Splash Screen
- [ ] iOS: Splash screen modo claro
- [ ] iOS: Splash screen modo oscuro
- [ ] iOS: Transición suave a la app
- [ ] Android: Splash screen portrait
- [ ] Android: Splash screen landscape
- [ ] Android: Splash screen modo oscuro
- [ ] Android: Duración correcta (~2 segundos)

### Calidad Visual
- [ ] Logo nítido y centrado
- [ ] Colores correctos (turquesa #17a2b8)
- [ ] Sin pixelado en ninguna resolución
- [ ] Sin bordes o artefactos visuales

## 🐛 Problemas Comunes

### El ícono no aparece
**Solución**:
```bash
npm run cap:assets
npm run build
npm run cap:sync
# Luego reconstruir en Xcode/Android Studio
```

### El splash screen no se muestra
**Verificar**:
1. Plugin instalado: `@capacitor/splash-screen`
2. Configuración en `capacitor.config.ts`
3. Assets sincronizados correctamente

### Calidad del ícono baja
**Solución**:
1. Verificar que `resources/icon.png` sea al menos 1024x1024px
2. Usar imagen PNG con fondo transparente
3. Regenerar con `npm run cap:assets`

## 📝 Reportar Resultados

Al probar, documenta:
- ✅ Plataforma (iOS/Android/PWA)
- ✅ Versión del OS
- ✅ Dispositivo/Emulador usado
- ✅ Capturas de pantalla del ícono y splash
- ✅ Cualquier problema encontrado

## 🚀 Siguiente Paso

Una vez verificado todo:
1. Hacer commit de los cambios
2. Configurar perfiles de provisioning (iOS)
3. Configurar signing key (Android)
4. Preparar para publicación en stores
