import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    // 将 Vditor 运行时按需加载的静态资源（i18n/Lute/图标/KaTeX/mermaid 等）
    // 随应用打包到 vditor/dist/，配合 MarkdownEditor 的 cdn: './vditor' 实现离线可用
    viteStaticCopy({
      targets: [
        { src: 'node_modules/vditor/dist', dest: 'vditor' }
      ]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
})
