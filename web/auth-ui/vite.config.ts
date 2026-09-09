import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Served from a sub-path of the same origin as the provider, so the browser
  // sees one site and the session cookie stays first-party. Without this the
  // built index.html asks for /assets/*, which at that origin belongs to the
  // dashboard -- the login page loads and then renders nothing.
  base: "/auth/",
  server: { port: 4000, strictPort: true },
  preview: { port: 4000, strictPort: true },
});
