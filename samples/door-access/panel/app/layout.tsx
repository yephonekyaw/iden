import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Door Panel · IDEN sample",
  description: "Who may open which door, decided from an access token.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Archivo 900 for the shouting, Space Grotesk for prose, JetBrains Mono
            for anything you would copy. Every stack falls back to a system face,
            so the sample still looks right on a laptop with no network. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
