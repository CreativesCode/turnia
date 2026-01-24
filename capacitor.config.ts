import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.turnia.app',
  appName: 'Turnia',
  webDir: 'out',           // si usas output: 'export' en next.config
  // O 'dist' si usas otro sistema. Para Next.js estándar suele ser .next o out.
  server: {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
