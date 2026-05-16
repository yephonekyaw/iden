import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/lib/role-context";

export const metadata: Metadata = {
  title: "IDEN Dashboard",
  description: "Identity provider administration",
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
      <body>
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
