import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Not the origin root: `/admin/*` there is the provider's API, and this app's
  // own admin screens have the same names. One origin can carry both only if
  // the app moves. Everything downstream -- the router basename, the redirect
  // URI, the built asset URLs -- derives from this one value.
  base: "/console/",
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
