import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(desktopRoot, "..");

export default defineConfig({
  root: desktopRoot,
  plugins: [react()],
  resolve: {
    alias: [
      { find: "next/navigation", replacement: path.resolve(desktopRoot, "src/next-navigation.ts") },
      { find: "@", replacement: repositoryRoot },
    ],
  },
  build: {
    outDir: path.resolve(repositoryRoot, "desktop-dist"),
    emptyOutDir: true,
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
});
