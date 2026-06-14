import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Awenia",
  description: "AI personal local pentru Gabi",
  applicationName: "Awenia",
  authors: [{ name: "Gabi" }],
  creator: "Gabi",
  publisher: "Awenia",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            'Arial, Helvetica, sans-serif',
          background: "#f9fafb",
          color: "#111827",
        }}
      >
        {children}
      </body>
    </html>
  );
}