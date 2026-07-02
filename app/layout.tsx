import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AppContextProvider } from "@/lib/AppContext";
import ClientAppLayout from "./ClientAppLayout";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "Folio — Catering Operations Platform",
  description: "Digitized management system for family-owned catering businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} ${instrumentSerif.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="error-logger" strategy="beforeInteractive">
          {`
            window.onerror = function(message, source, lineno, colno, error) {
              fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: message,
                  source: source,
                  lineno: lineno,
                  colno: colno,
                  error: error ? error.stack : null,
                  userAgent: navigator.userAgent
                })
              }).catch(function(e){});
              return false;
            };
            window.onunhandledrejection = function(event) {
              fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: 'Unhandled Promise Rejection: ' + (event.reason ? event.reason.message || event.reason : ''),
                  error: event.reason && event.reason.stack ? event.reason.stack : null,
                  userAgent: navigator.userAgent
                })
              }).catch(function(e){});
            };
          `}
        </Script>
        <AppContextProvider>
          <ClientAppLayout>{children}</ClientAppLayout>
        </AppContextProvider>
      </body>
    </html>
  );
}
