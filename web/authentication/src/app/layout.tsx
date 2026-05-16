import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDEN — Sign in",
  description: "Authenticate to continue",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('iden-theme')==='light')document.documentElement.classList.add('light')}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
