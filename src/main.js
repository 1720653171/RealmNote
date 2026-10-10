import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import { createBrowserAPI } from './utils/browserAPI'

// 浏览器验证模式：非 Electron 环境下注入 File System Access API 适配器，
// 使 npm run dev + Chrome/Edge 即可全功能验证，无需打包
if (!window.electronAPI) {
  window.electronAPI = createBrowserAPI()
  console.info(
    '%c[简域] 浏览器验证模式已启用',
    'color:#1976d2;font-weight:bold',
    '\n文件操作基于 File System Access API，请通过"文件 → 打开文件夹"选择目录。' +
    '\n提示：完整桌面功能（窗口记忆、原生菜单等）请使用 npm run electron:dev'
  )
}

const app = createApp(App)

app.use(createPinia())
app.use(vuetify)

app.mount('#app')
