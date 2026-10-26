import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: { host: "0.0.0.0" },
  preview: { host: "0.0.0.0" },
  build: { target: "es2022", sourcemap: true, assetsInlineLimit: 4096 }
});
