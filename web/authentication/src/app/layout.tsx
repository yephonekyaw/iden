import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDEN — Sign in",
  description: "Authenticate to continue",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
