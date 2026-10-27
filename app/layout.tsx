import "./globals.css";

import { Geist, Geist_Mono, Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

import type { Metadata, Viewport } from "next";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <head>
        <link href="/tailwind.css" rel="stylesheet" />
      </head>
      <TooltipProvider>
        <body className="min-h-full flex flex-col">
          {children}
          <Toaster position="bottom-right" />
        </body>
      </TooltipProvider>
    </html>
  );
}
