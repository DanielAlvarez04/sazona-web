import "./globals.css";

import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { KeyboardShortcutsProvider } from "@/components/keyboard/keyboard-shortcuts-provider";
import { ThemeShortcut } from "@/components/keyboard/theme-shortcut";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeScript } from "@/components/theme-script";

import type { Metadata, Viewport } from "next";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Naranja Pimienta",
  description: "Sistema de punto de venta para cafetería",
  applicationName: "Naranja Pimienta",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "Naranja Pimienta",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#e2703a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        inter.variable
      )}
    >
      <head>
        <ThemeScript defaultTheme="system" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider defaultTheme="system" disableTransitionOnChange>
          <KeyboardShortcutsProvider>
            <ThemeShortcut />
            <TooltipProvider>
              {children}
              <Toaster position="bottom-right" />
            </TooltipProvider>
          </KeyboardShortcutsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
