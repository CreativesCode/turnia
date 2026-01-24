# Generación de Assets Nativos

Este documento explica cómo se generaron los íconos y splash screens para las aplicaciones nativas de iOS y Android.

## Archivos Fuente

Los assets se generan a partir de dos archivos fuente ubicados en `resources/`:

- `resources/icon.png` - El ícono de la aplicación (logo de Turnia)
- `resources/splash.png` - La imagen del splash screen (también usa el logo)

Ambos archivos son copias del logo principal (`public/logo.png`).

## Generación Automática

Los assets se generan automáticamente usando `@capacitor/assets`:

```bash
npx @capacitor/assets generate --iconBackgroundColor '#17a2b8' --iconBackgroundColorDark '#0d7a8a' --splashBackgroundColor '#ffffff' --splashBackgroundColorDark '#000000'
```

### Parámetros Utilizados

- **iconBackgroundColor**: `#17a2b8` - Color turquesa claro (coincide con los colores del proyecto)
- **iconBackgroundColorDark**: `#0d7a8a` - Color turquesa oscuro para modo oscuro
- **splashBackgroundColor**: `#ffffff` - Fondo blanco para splash screen
- **splashBackgroundColorDark**: `#000000` - Fondo negro para splash screen en modo oscuro

## Assets Generados

### Android (74 archivos)
- **Adaptive Icons**: Íconos adaptativos con foreground y background para todas las densidades (ldpi, mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- **Íconos Redondos**: Versiones redondas del ícono para dispositivos que lo soporten
- **Splash Screens**: Pantallas de carga para orientación portrait y landscape en todas las densidades
- **Modo Oscuro**: Versiones oscuras de todos los splash screens

Ubicación: `android/app/src/main/res/`

### iOS (7 archivos)
- **App Icon**: Ícono de la aplicación (1024x1024 @2x)
- **Splash Screens**: Pantallas de carga universales en 3 resoluciones (@1x, @2x, @3x)
- **Modo Oscuro**: Versiones oscuras de todos los splash screens

Ubicación: `ios/App/App/Assets.xcassets/`

### PWA (7 archivos)
- Íconos WebP en múltiples tamaños: 48, 72, 96, 128, 192, 256, 512px

Ubicación: `icons/`

## Regeneración de Assets

Si necesitas actualizar los assets (por ejemplo, después de cambiar el logo):

1. Actualiza los archivos fuente en `resources/`:
   ```bash
   cp public/logo.png resources/icon.png
   cp public/logo.png resources/splash.png
   ```

2. Regenera todos los assets:
   ```bash
   npx @capacitor/assets generate --iconBackgroundColor '#17a2b8' --iconBackgroundColorDark '#0d7a8a' --splashBackgroundColor '#ffffff' --splashBackgroundColorDark '#000000'
   ```

3. Sincroniza con las plataformas nativas:
   ```bash
   npm run cap:sync
   ```

## Personalización

Si deseas personalizar los colores de fondo:

- Modifica los valores de `--iconBackgroundColor` y `--splashBackgroundColor` en el comando
- Los colores deben estar en formato hexadecimal (#RRGGBB)
- Considera mantener el contraste adecuado para la visibilidad del logo

## Recomendaciones

- El ícono fuente debe ser PNG con fondo transparente
- Tamaño recomendado: 1024x1024px
- El logo debe ocupar aproximadamente el 70% del área para dejar margen
- Usa colores de marca consistentes con la identidad visual del proyecto
