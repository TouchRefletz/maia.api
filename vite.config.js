import react from "@vitejs/plugin-react"; // <--- Nova importação
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()], // <--- Ativa o React

  // Configuração básica existente
  build: {
    target: "esnext",
  },
  envPrefix: ["VITE_", "FIREBASE_", "IMGBB_", "GOOGLE_", "PINECONE_"],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
});
