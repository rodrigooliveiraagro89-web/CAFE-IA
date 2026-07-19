import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const legacyFiles = [
  "agryn.html",
  "cafe-real-ia.html",
  "clima.html",
  "landing.html",
  "termos.html",
  "privacidade.html",
  ".nojekyll",
];

export default defineConfig(() => {
  const root = process.cwd();

  return {
  base: "/CAFE-IA/",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "preserve-legacy-pages",
      apply: "build",
      async writeBundle() {
        await Promise.all(
          legacyFiles.map((file) => copyFile(resolve(root, file), resolve(root, "dist", file))),
        );
      },
    },
  ],
  build: {
    target: "es2022",
    cssCodeSplit: true,
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/tests/setup.ts",
    css: true,
  },
  };
});
