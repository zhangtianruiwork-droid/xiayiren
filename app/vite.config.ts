import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const deepseekApiKey = env.DEEPSEEK_API_KEY

  return {
    base: './',
    plugins: [inspectAttr(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        '/deepseek-api': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          headers: deepseekApiKey ? { Authorization: `Bearer ${deepseekApiKey}` } : {},
          rewrite: (path) => path.replace(/^\/deepseek-api/, ''),
        },
      },
    },
  }
})
