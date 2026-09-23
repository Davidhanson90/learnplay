import { defineConfig } from "vite";

export default defineConfig({
  base: "/learnplay/",
  server: {
    open: true
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
