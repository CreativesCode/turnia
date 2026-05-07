import { AppProviders } from "@/components/providers/AppProviders";
import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Turnia - Gestión de Turnos Médicos",
  description: "Sistema de gestión de turnos y horarios para entornos de salud",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Turnia",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#17a2b8",
};

const themeInitScript = `
(() => {
  try {
    const raw = localStorage.getItem('turnia-theme');
    const theme = (raw === 'light' || raw === 'dark' || raw === 'system') ? raw : 'system';
    const prefersDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const resolved = (theme === 'dark' || (theme === 'system' && prefersDark)) ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', resolved === 'dark');

    const accentRaw = localStorage.getItem('turnia-accent');
    const accent = (accentRaw === 'teal' || accentRaw === 'indigo' || accentRaw === 'emerald' || accentRaw === 'rose') ? accentRaw : 'teal';
    document.documentElement.dataset.accent = accent;
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} ${interTight.variable} antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
