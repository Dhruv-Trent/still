import { defineConfig } from "vite";
import { resolve } from "node:path";
const root = resolve(process.cwd(), "tests/fixtures");
export default defineConfig({
  root,
  publicDir: resolve(root, "public"),
  server: {
    host: "127.0.0.1",
    port: 3001,
    strictPort: true,
    fs: { allow: [process.cwd()] },
  },
  define: { "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY": "undefined" },
  resolve: {
    alias: [
      { find: "@/lib/use-workspace", replacement: resolve(root, "state.ts") },
      { find: "@/lib/supabase", replacement: resolve(root, "supabase.ts") },
      { find: "next/link", replacement: resolve(root, "navigation.tsx") },
      { find: "next/navigation", replacement: resolve(root, "navigation.tsx") },
      { find: "@", replacement: process.cwd() },
    ],
  },
  esbuild: { jsx: "automatic" },
});
