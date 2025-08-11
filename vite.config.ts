import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts",
        onstart(options) {
          if (process.env.VSCODE_DEBUG) {
            console.log("[startup] Electron App");
          } else {
            options.startup();
          }
        },
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron", "sqlite3", "ffmpeg-static"],
            },
          },
        },
      },
      {
        entry: "electron/preload.ts",
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            sourcemap: "inline",
            minify: false,
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  base: mode === "development" ? "/" : "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      external: ['ffmpeg-static']
    }
  },
}));
