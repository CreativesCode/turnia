import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Turnia - Gestión de Turnos Médicos",
  description: "Sistema de gestión de turnos y horarios para entornos de salud",
  manifest: "/manifest.json",
  themeColor: "#17a2b8",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Turnia",
  },
};

const themeInitScript = `
(() => {
  try {
    const raw = localStorage.getItem('turnia-theme');
    const theme = (raw === 'light' || raw === 'dark' || raw === 'system') ? raw : 'system';
    const prefersDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const resolved = (theme === 'dark' || (theme === 'system' && prefersDark)) ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', resolved === 'dark');
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
