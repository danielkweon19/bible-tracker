import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const buildId = Date.now().toString(36);

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId)
  },
  plugins: [react(), appVersionPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/analytics"],
          react: ["react", "react-dom"],
          icons: ["lucide-react"]
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/testSetup.ts"
  }
});

function appVersionPlugin(): Plugin {
  return {
    name: "app-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId })
      });
    }
  };
}
