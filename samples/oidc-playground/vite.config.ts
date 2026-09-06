import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 5100 is fixed rather than incidental: it is the port in the redirect URI you
// register on the client, and a redirect URI is matched exactly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5100, strictPort: true },
  preview: { port: 5100, strictPort: true },
});
