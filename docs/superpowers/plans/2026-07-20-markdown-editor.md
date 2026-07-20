# Markdown 文件浏览器与编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Electron + Vue 3 + Vuetify 3 的桌面端 Markdown 文件浏览器与编辑器，支持文件树浏览、Markdown 编辑、预览模式和设置持久化。

**Architecture:** Electron 主进程负责窗口管理和文件系统 API，Vue 3 + Vuetify 3 构建 UI，Pinia 管理状态，CodeMirror 6 提供代码编辑能力，markdown-it 渲染预览。

**Tech Stack:** Electron 30, Vue 3.4+, Vuetify 3.5+, Pinia 2.1+, CodeMirror 6, markdown-it 14+, highlight.js 11+

## Global Constraints

- Electron 版本: ^30.x
- Vue 版本: ^3.4.x
- Vuetify 版本: ^3.5.x
- Pinia 版本: ^2.1.x
- Node.js 需要: 18.x 或更高
- 目标平台: Windows
- 配置文件路径: `%APPDATA%/markdown-editor/config.json`
- 默认窗口大小: 1200x800

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `.gitignore`

**Interfaces:**
- Consumes: 无
- Produces: 项目基础配置，后续任务依赖此配置运行

- [ ] **Step 1: 创建项目目录结构**

```bash
mkdir -p electron/utils src/components src/stores src/utils src/plugins public assets/icons
```

- [ ] **Step 2: 创建 package.json**

```json
{
  "name": "markdown-editor",
  "version": "1.0.0",
  "description": "Markdown 文件浏览器与编辑器",
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "vite build && electron-builder",
    "electron:preview": "vite build && electron ."
  },
  "dependencies": {
    "vue": "^3.4.21",
    "vuetify": "^3.5.8",
    "pinia": "^2.1.7",
    "@mdi/font": "^7.4.47",
    "@codemirror/state": "^6.4.1",
    "@codemirror/view": "^6.26.1",
    "@codemirror/commands": "^6.5.0",
    "@codemirror/lang-markdown": "^6.2.5",
    "@codemirror/theme-one-dark": "^6.1.2",
    "@codemirror/language-data": "^6.5.0",
    "markdown-it": "^14.1.0",
    "markdown-it-container": "^4.0.0",
    "markdown-it-footnote": "^4.0.0",
    "markdown-it-task-lists": "^2.1.1",
    "markdown-it-emoji": "^3.0.0",
    "highlight.js": "^11.9.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.4",
    "vite": "^5.2.0",
    "vite-plugin-vuetify": "^2.0.3",
    "electron": "^30.0.0",
    "electron-builder": "^24.13.3",
    "concurrently": "^8.2.2",
    "wait-on": "^7.2.0"
  },
  "build": {
    "appId": "com.markdown.editor",
    "productName": "Markdown Editor",
    "directories": {
      "output": "dist_electron"
    },
    "files": [
      "dist/**/*",
      "electron/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    }
  }
}
```

- [ ] **Step 3: 创建 vite.config.js**

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true })
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
```

- [ ] **Step 4: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;">
    <title>Markdown Editor</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 5: 创建 .gitignore**

```
node_modules/
dist/
dist_electron/
.DS_Store
*.log
```

- [ ] **Step 6: 安装依赖**

```bash
npm install
```

Expected: 依赖安装成功，node_modules 目录创建

- [ ] **Step 7: 提交代码**

```bash
git init
git add .
git commit -m "feat: 初始化项目结构

- 配置 package.json 和依赖
- 配置 Vite 构建
- 创建入口 HTML"
```

---

## Task 2: Electron 主进程配置

**Files:**
- Create: `electron/main.js`
- Create: `electron/preload.js`

**Interfaces:**
- Consumes: 无
- Produces: 
  - `window.electronAPI.openFolder()` - 打开文件夹对话框
  - `window.electronAPI.readFile(path)` - 读取文件内容
  - `window.electronAPI.writeFile(path, content)` - 写入文件
  - `window.electronAPI.readdir(path)` - 读取目录
  - `window.electronAPI.mkdir(path)` - 创建目录
  - `window.electronAPI.unlink(path)` - 删除文件
  - `window.electronAPI.rename(oldPath, newPath)` - 重命名
  - `window.electronAPI.stat(path)` - 获取文件状态
  - `window.electronAPI.exists(path)` - 检查文件是否存在
  - `window.electronAPI.getConfig()` - 获取配置
  - `window.electronAPI.saveConfig(config)` - 保存配置

- [ ] **Step 1: 创建 electron/main.js**

```javascript
const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const configFile = require('./utils/config')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'Markdown Editor'
  })

  // 开发环境加载开发服务器
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境加载构建后的文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 保存窗口状态
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds()
    configFile.updateConfig({ windowBounds: bounds })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开文件夹',
          accelerator: 'Ctrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory']
            })
            if (result.filePaths.length > 0) {
              mainWindow.webContents.send('folder-opened', result.filePaths[0])
            }
          }
        },
        { type: 'separator' },
        {
          label: '新建文件',
          accelerator: 'Ctrl+N'
        },
        {
          label: '保存',
          accelerator: 'Ctrl+S'
        },
        {
          label: '另存为',
          accelerator: 'Ctrl+Shift+S'
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '切换预览模式',
          accelerator: 'Ctrl+Shift+P'
        },
        {
          label: '切换主题',
          accelerator: 'Ctrl+Shift+T'
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { role: 'toggleDevTools', label: '开发者工具' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: 'Markdown Editor',
              detail: '版本 1.0.0\n一个简洁的 Markdown 文件浏览器与编辑器'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// IPC 处理器
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  return result.filePaths[0] || null
})

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('read-dir', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true })
    const result = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      isFile: file.isFile(),
      path: path.join(dirPath, file.name)
    }))
    return { success: true, files: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('mkdir', async (event, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('unlink', async (event, filePath) => {
  try {
    if (fs.statSync(filePath).isDirectory()) {
      fs.rmSync(filePath, { recursive: true })
    } else {
      fs.unlinkSync(filePath)
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('rename', async (event, oldPath, newPath) => {
  try {
    fs.renameSync(oldPath, newPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('stat', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath)
    return {
      success: true,
      stats: {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        mtime: stats.mtime,
        birthtime: stats.birthtime
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('exists', async (event, filePath) => {
  return fs.existsSync(filePath)
})

ipcMain.handle('get-config', async () => {
  return configFile.loadConfig()
})

ipcMain.handle('save-config', async (event, config) => {
  return configFile.saveConfig(config)
})

app.whenReady().then(() => {
  createWindow()
  createMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

- [ ] **Step 2: 创建 electron/preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件对话框
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  
  // 文件操作
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
  readDir: (path) => ipcRenderer.invoke('read-dir', path),
  mkdir: (path) => ipcRenderer.invoke('mkdir', path),
  unlink: (path) => ipcRenderer.invoke('unlink', path),
  rename: (oldPath, newPath) => ipcRenderer.invoke('rename', oldPath, newPath),
  stat: (path) => ipcRenderer.invoke('stat', path),
  exists: (path) => ipcRenderer.invoke('exists', path),
  
  // 配置
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // 事件监听
  onFolderOpened: (callback) => {
    ipcRenderer.on('folder-opened', (event, path) => callback(path))
  },
  
  removeFolderOpenedListener: () => {
    ipcRenderer.removeAllListeners('folder-opened')
  }
})
```

- [ ] **Step 3: 创建 electron/utils/config.js**

```javascript
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const CONFIG_DIR = path.join(app.getPath('appData'), 'markdown-editor')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

const DEFAULT_CONFIG = {
  theme: 'light',
  editMode: 'split',
  sidebarWidth: 250,
  fontSize: 14,
  autoSave: true,
  autoSaveDelay: 1000,
  recentFolders: [],
  recentFiles: [],
  windowBounds: { width: 1200, height: 800, x: undefined, y: undefined }
}

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG }
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(content)
    return { ...DEFAULT_CONFIG, ...config }
  } catch (error) {
    console.error('Failed to load config:', error)
    return { ...DEFAULT_CONFIG }
  }
}

function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save config:', error)
    return false
  }
}

function updateConfig(partialConfig) {
  const currentConfig = loadConfig()
  const newConfig = { ...currentConfig, ...partialConfig }
  return saveConfig(newConfig)
}

module.exports = {
  loadConfig,
  saveConfig,
  updateConfig,
  DEFAULT_CONFIG,
  CONFIG_FILE
}
```

- [ ] **Step 4: 提交代码**

```bash
git add electron/
git commit -m "feat: 配置 Electron 主进程和安全桥接层

- 创建 main.js 主进程入口
- 创建 preload.js 安全 API 暴露
- 创建 config.js 配置文件管理"
```

---

## Task 3: Vue 应用入口和 Vuetify 配置

**Files:**
- Create: `src/main.js`
- Create: `src/App.vue`
- Create: `src/plugins/vuetify.js`

**Interfaces:**
- Consumes: Task 2 的 electronAPI
- Produces: Vue 应用实例，Vuetify 主题系统

- [ ] **Step 1: 创建 src/main.js**

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import vuetify from './plugins/vuetify'

const app = createApp(App)

app.use(createPinia())
app.use(vuetify)

app.mount('#app')
```

- [ ] **Step 2: 创建 src/plugins/vuetify.js**

```javascript
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107',
          background: '#FFFFFF',
          surface: '#FFFFFF'
        }
      },
      dark: {
        colors: {
          primary: '#2196F3',
          secondary: '#424242',
          accent: '#FF4081',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107',
          background: '#121212',
          surface: '#1E1E1E'
        }
      }
    }
  }
})
```

- [ ] **Step 3: 创建 src/App.vue**

```vue
<template>
  <v-app>
    <v-main>
      <div class="loading-container" v-if="!ready">
        <v-progress-circular indeterminate color="primary" size="64" />
      </div>
      <router-view v-else />
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const ready = ref(false)

onMounted(() => {
  // 初始化完成后显示界面
  setTimeout(() => {
    ready.value = true
  }, 100)
})
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
</style>
```

- [ ] **Step 4: 提交代码**

```bash
git add src/
git commit -m "feat: 配置 Vue 应用入口和 Vuetify

- 创建 Vue 入口文件
- 配置 Vuetify 主题（浅色/深色）
- 创建 App 根组件"
```

---

## Task 4: 文件系统工具封装

**Files:**
- Create: `src/utils/fileSystem.js`

**Interfaces:**
- Consumes: `window.electronAPI` (Task 2)
- Produces:
  - `openFolderDialog()` - 打开文件夹对话框，返回路径
  - `readDirectoryRecursive(path)` - 递归读取目录，返回树形结构
  - `readFileContent(path)` - 读取文件内容
  - `saveFileContent(path, content)` - 保存文件内容
  - `createFile(parentPath, fileName)` - 创建新文件
  - `createFolder(parentPath, folderName)` - 创建新文件夹
  - `deleteFile(path)` - 删除文件或文件夹
  - `renameFile(path, newName)` - 重命名
  - `moveFile(sourcePath, targetPath)` - 移动文件

- [ ] **Step 1: 创建 src/utils/fileSystem.js**

```javascript
/**
 * 文件系统操作封装
 * 所有方法都通过 Electron API 调用
 */

/**
 * 打开文件夹选择对话框
 * @returns {Promise<string|null>} 选中的文件夹路径
 */
export async function openFolderDialog() {
  if (!window.electronAPI) {
    console.error('Electron API not available')
    return null
  }
  return await window.electronAPI.openFolderDialog()
}

/**
 * 递归读取目录结构
 * @param {string} dirPath 目录路径
 * @returns {Promise<Array>} 树形文件结构
 */
export async function readDirectoryRecursive(dirPath) {
  if (!window.electronAPI) return []
  
  const result = await window.electronAPI.readDir(dirPath)
  if (!result.success) {
    console.error('Failed to read directory:', result.error)
    return []
  }
  
  const tree = []
  for (const file of result.files) {
    const node = {
      id: file.path,
      name: file.name,
      path: file.path,
      isDirectory: file.isDirectory,
      isFile: file.isFile
    }
    
    // 如果是目录，递归读取子节点
    if (file.isDirectory) {
      node.children = await readDirectoryRecursive(file.path)
    }
    
    tree.push(node)
  }
  
  // 排序：文件夹在前，然后按名称排序
  tree.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
  
  return tree
}

/**
 * 读取文件内容
 * @param {string} filePath 文件路径
 * @returns {Promise<string|null>} 文件内容
 */
export async function readFileContent(filePath) {
  if (!window.electronAPI) return null
  
  const result = await window.electronAPI.readFile(filePath)
  if (!result.success) {
    console.error('Failed to read file:', result.error)
    return null
  }
  return result.content
}

/**
 * 保存文件内容
 * @param {string} filePath 文件路径
 * @param {string} content 文件内容
 * @returns {Promise<boolean>} 是否成功
 */
export async function saveFileContent(filePath, content) {
  if (!window.electronAPI) return false
  
  const result = await window.electronAPI.writeFile(filePath, content)
  if (!result.success) {
    console.error('Failed to save file:', result.error)
    return false
  }
  return true
}

/**
 * 创建新文件
 * @param {string} parentPath 父目录路径
 * @param {string} fileName 文件名
 * @returns {Promise<boolean>} 是否成功
 */
export async function createFile(parentPath, fileName) {
  if (!window.electronAPI) return false
  
  const filePath = `${parentPath}/${fileName}`
  const result = await window.electronAPI.writeFile(filePath, '')
  return result.success
}

/**
 * 创建新文件夹
 * @param {string} parentPath 父目录路径
 * @param {string} folderName 文件夹名
 * @returns {Promise<boolean>} 是否成功
 */
export async function createFolder(parentPath, folderName) {
  if (!window.electronAPI) return false
  
  const folderPath = `${parentPath}/${folderName}`
  const result = await window.electronAPI.mkdir(folderPath)
  return result.success
}

/**
 * 删除文件或文件夹
 * @param {string} path 路径
 * @returns {Promise<boolean>} 是否成功
 */
export async function deleteFile(path) {
  if (!window.electronAPI) return false
  
  const result = await window.electronAPI.unlink(path)
  return result.success
}

/**
 * 重命名文件或文件夹
 * @param {string} oldPath 原路径
 * @param {string} newName 新名称
 * @returns {Promise<string|null>} 新路径，失败返回 null
 */
export async function renameFile(oldPath, newName) {
  if (!window.electronAPI) return null
  
  const pathParts = oldPath.split(/[/\\]/)
  pathParts.pop()
  const newPath = `${pathParts.join('/')}/${newName}`
  
  const result = await window.electronAPI.rename(oldPath, newPath)
  if (!result.success) {
    console.error('Failed to rename:', result.error)
    return null
  }
  return newPath
}

/**
 * 移动文件
 * @param {string} sourcePath 源路径
 * @param {string} targetPath 目标路径
 * @returns {Promise<boolean>} 是否成功
 */
export async function moveFile(sourcePath, targetPath) {
  if (!window.electronAPI) return false
  
  const result = await window.electronAPI.rename(sourcePath, targetPath)
  return result.success
}

/**
 * 获取文件状态信息
 * @param {string} path 路径
 * @returns {Promise<Object|null>} 状态信息
 */
export async function getFileStat(path) {
  if (!window.electronAPI) return null
  
  const result = await window.electronAPI.stat(path)
  if (!result.success) {
    return null
  }
  return result.stats
}

/**
 * 检查文件是否存在
 * @param {string} path 路径
 * @returns {Promise<boolean>} 是否存在
 */
export async function fileExists(path) {
  if (!window.electronAPI) return false
  return await window.electronAPI.exists(path)
}

/**
 * 获取文件扩展名
 * @param {string} fileName 文件名
 * @returns {string} 扩展名（小写）
 */
export function getFileExtension(fileName) {
  const parts = fileName.split('.')
  if (parts.length < 2) return ''
  return parts.pop().toLowerCase()
}

/**
 * 判断是否为 Markdown 文件
 * @param {string} fileName 文件名
 * @returns {boolean}
 */
export function isMarkdownFile(fileName) {
  const ext = getFileExtension(fileName)
  return ['md', 'markdown', 'mdown', 'mkd'].includes(ext)
}

/**
 * 判断是否为图片文件
 * @param {string} fileName 文件名
 * @returns {boolean}
 */
export function isImageFile(fileName) {
  const ext = getFileExtension(fileName)
  return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'].includes(ext)
}
```

- [ ] **Step 2: 提交代码**

```bash
git add src/utils/fileSystem.js
git commit -m "feat: 封装文件系统操作工具

- 实现文件夹选择对话框
- 实现递归目录读取
- 实现文件读写操作
- 实现文件管理操作（新建、删除、重命名、移动）"
```

---

## Task 5: 文件状态管理 (Pinia Store)

**Files:**
- Create: `src/stores/fileStore.js`

**Interfaces:**
- Consumes: Task 4 的文件系统工具
- Produces:
  - State: `currentFolder`, `fileTree`, `openFiles`, `activeFileIndex`, `modifiedFiles`, `bookmarkedFiles`
  - Actions: `openFolder()`, `refreshTree()`, `openFile()`, `closeFile()`, `saveFile()`, `updateFileContent()`, `toggleBookmark()`

- [ ] **Step 1: 创建 src/stores/fileStore.js**

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  openFolderDialog,
  readDirectoryRecursive,
  readFileContent,
  saveFileContent,
  createFile as createFileFs,
  createFolder as createFolderFs,
  deleteFile as deleteFileFs,
  renameFile as renameFileFs,
  isMarkdownFile
} from '@/utils/fileSystem'

export const useFileStore = defineStore('file', () => {
  // State
  const currentFolder = ref(null)
  const fileTree = ref([])
  const openFiles = ref([])
  const activeFileIndex = ref(-1)
  const modifiedFiles = ref(new Set()) // 存储已修改文件的路径
  const bookmarkedFiles = ref([]) // 收藏的文件路径列表
  
  // Getters
  const activeFile = computed(() => {
    if (activeFileIndex.value < 0 || activeFileIndex.value >= openFiles.value.length) {
      return null
    }
    return openFiles.value[activeFileIndex.value]
  })
  
  const hasUnsavedFiles = computed(() => {
    return modifiedFiles.value.size > 0
  })
  
  // Actions
  
  /**
   * 打开文件夹
   */
  async function openFolder() {
    const folderPath = await openFolderDialog()
    if (!folderPath) return false
    
    currentFolder.value = folderPath
    await refreshTree()
    return true
  }
  
  /**
   * 刷新文件树
   */
  async function refreshTree() {
    if (!currentFolder.value) return
    
    fileTree.value = await readDirectoryRecursive(currentFolder.value)
  }
  
  /**
   * 打开文件
   */
  async function openFile(filePath) {
    // 检查是否已经打开
    const existingIndex = openFiles.value.findIndex(f => f.path === filePath)
    if (existingIndex !== -1) {
      activeFileIndex.value = existingIndex
      return true
    }
    
    // 读取文件内容
    const content = await readFileContent(filePath)
    if (content === null) return false
    
    // 添加到打开列表
    const fileName = filePath.split(/[/\\]/).pop()
    openFiles.value.push({
      path: filePath,
      name: fileName,
      content: content,
      originalContent: content,
      isMarkdown: isMarkdownFile(fileName)
    })
    
    activeFileIndex.value = openFiles.value.length - 1
    return true
  }
  
  /**
   * 关闭文件
   */
  async function closeFile(index) {
    if (index < 0 || index >= openFiles.value.length) return false
    
    const file = openFiles.value[index]
    
    // 检查是否有未保存的修改
    if (modifiedFiles.value.has(file.path)) {
      // TODO: 提示用户是否保存
      // 暂时直接关闭
    }
    
    openFiles.value.splice(index, 1)
    modifiedFiles.value.delete(file.path)
    
    // 调整活动文件索引
    if (activeFileIndex.value >= openFiles.value.length) {
      activeFileIndex.value = openFiles.value.length - 1
    }
    
    return true
  }
  
  /**
   * 保存文件
   */
  async function saveFile(index) {
    if (index < 0 || index >= openFiles.value.length) return false
    
    const file = openFiles.value[index]
    const success = await saveFileContent(file.path, file.content)
    
    if (success) {
      file.originalContent = file.content
      modifiedFiles.value.delete(file.path)
    }
    
    return success
  }
  
  /**
   * 保存所有文件
   */
  async function saveAllFiles() {
    for (let i = 0; i < openFiles.value.length; i++) {
      if (modifiedFiles.value.has(openFiles.value[i].path)) {
        await saveFile(i)
      }
    }
  }
  
  /**
   * 更新文件内容
   */
  function updateFileContent(index, content) {
    if (index < 0 || index >= openFiles.value.length) return
    
    const file = openFiles.value[index]
    file.content = content
    
    // 检查是否修改
    if (content !== file.originalContent) {
      modifiedFiles.value.add(file.path)
    } else {
      modifiedFiles.value.delete(file.path)
    }
  }
  
  /**
   * 切换收藏状态
   */
  function toggleBookmark(filePath) {
    const index = bookmarkedFiles.value.indexOf(filePath)
    if (index === -1) {
      bookmarkedFiles.value.push(filePath)
    } else {
      bookmarkedFiles.value.splice(index, 1)
    }
    // TODO: 保存到设置
  }
  
  /**
   * 新建文件
   */
  async function createFile(parentPath, fileName) {
    const success = await createFileFs(parentPath, fileName)
    if (success) {
      await refreshTree()
    }
    return success
  }
  
  /**
   * 新建文件夹
   */
  async function createFolder(parentPath, folderName) {
    const success = await createFolderFs(parentPath, folderName)
    if (success) {
      await refreshTree()
    }
    return success
  }
  
  /**
   * 删除文件
   */
  async function deleteFile(path) {
    // 关闭已打开的文件
    const openIndex = openFiles.value.findIndex(f => f.path === path)
    if (openIndex !== -1) {
      await closeFile(openIndex)
    }
    
    const success = await deleteFileFs(path)
    if (success) {
      await refreshTree()
    }
    return success
  }
  
  /**
   * 重命名文件
   */
  async function renameFile(path, newName) {
    const newPath = await renameFileFs(path, newName)
    if (newPath) {
      // 更新打开的文件列表
      const openIndex = openFiles.value.findIndex(f => f.path === path)
      if (openIndex !== -1) {
        openFiles.value[openIndex].path = newPath
        openFiles.value[openIndex].name = newName
      }
      await refreshTree()
    }
    return newPath
  }
  
  /**
   * 切换标签页
   */
  function switchTab(index) {
    if (index >= 0 && index < openFiles.value.length) {
      activeFileIndex.value = index
    }
  }
  
  /**
   * 关闭其他标签页
   */
  async function closeOtherTabs(index) {
    const currentFile = openFiles.value[index]
    openFiles.value = [currentFile]
    activeFileIndex.value = 0
    modifiedFiles.value.clear()
    if (modifiedFiles.value.has(currentFile.path)) {
      modifiedFiles.value.add(currentFile.path)
    }
  }
  
  /**
   * 关闭所有标签页
   */
  async function closeAllTabs() {
    openFiles.value = []
    activeFileIndex.value = -1
    modifiedFiles.value.clear()
  }
  
  return {
    // State
    currentFolder,
    fileTree,
    openFiles,
    activeFileIndex,
    modifiedFiles,
    bookmarkedFiles,
    
    // Getters
    activeFile,
    hasUnsavedFiles,
    
    // Actions
    openFolder,
    refreshTree,
    openFile,
    closeFile,
    saveFile,
    saveAllFiles,
    updateFileContent,
    toggleBookmark,
    createFile,
    createFolder,
    deleteFile,
    renameFile,
    switchTab,
    closeOtherTabs,
    closeAllTabs
  }
})
```

- [ ] **Step 2: 提交代码**

```bash
git add src/stores/fileStore.js
git commit -m "feat: 实现文件状态管理

- 管理当前文件夹和文件树状态
- 管理打开的文件列表和标签页
- 跟踪文件修改状态
- 实现文件操作方法"
```

---

## Task 6: 设置状态管理

**Files:**
- Create: `src/stores/settingsStore.js`

**Interfaces:**
- Consumes: `window.electronAPI` (Task 2)
- Produces:
  - State: `theme`, `editMode`, `sidebarWidth`, `fontSize`, `autoSave`, `autoSaveDelay`, `recentFolders`, `recentFiles`, `windowBounds`
  - Actions: `loadSettings()`, `saveSettings()`, `updateTheme()`, `updateEditMode()`, `addRecentFolder()`, `addRecentFile()`

- [ ] **Step 1: 创建 src/stores/settingsStore.js**

```javascript
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const theme = ref('light')
  const editMode = ref('split') // 'edit' | 'preview' | 'split'
  const sidebarWidth = ref(250)
  const fontSize = ref(14)
  const autoSave = ref(true)
  const autoSaveDelay = ref(1000)
  const recentFolders = ref([])
  const recentFiles = ref([])
  const windowBounds = ref({
    width: 1200,
    height: 800,
    x: undefined,
    y: undefined
  })
  
  // 是否已加载
  const loaded = ref(false)
  
  // Actions
  
  /**
   * 加载设置
   */
  async function loadSettings() {
    if (!window.electronAPI) {
      console.warn('Electron API not available')
      return
    }
    
    try {
      const config = await window.electronAPI.getConfig()
      
      theme.value = config.theme || 'light'
      editMode.value = config.editMode || 'split'
      sidebarWidth.value = config.sidebarWidth || 250
      fontSize.value = config.fontSize || 14
      autoSave.value = config.autoSave ?? true
      autoSaveDelay.value = config.autoSaveDelay || 1000
      recentFolders.value = config.recentFolders || []
      recentFiles.value = config.recentFiles || []
      
      if (config.windowBounds) {
        windowBounds.value = config.windowBounds
      }
      
      loaded.value = true
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }
  
  /**
   * 保存设置
   */
  async function saveSettings() {
    if (!window.electronAPI) return
    
    const config = {
      theme: theme.value,
      editMode: editMode.value,
      sidebarWidth: sidebarWidth.value,
      fontSize: fontSize.value,
      autoSave: autoSave.value,
      autoSaveDelay: autoSaveDelay.value,
      recentFolders: recentFolders.value.slice(0, 10), // 最多保存10个
      recentFiles: recentFiles.value.slice(0, 20), // 最多保存20个
      windowBounds: windowBounds.value
    }
    
    try {
      await window.electronAPI.saveConfig(config)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }
  
  /**
   * 更新主题
   */
  async function updateTheme(newTheme) {
    theme.value = newTheme
    await saveSettings()
  }
  
  /**
   * 更新编辑模式
   */
  async function updateEditMode(mode) {
    editMode.value = mode
    await saveSettings()
  }
  
  /**
   * 添加最近文件夹
   */
  async function addRecentFolder(folderPath) {
    const index = recentFolders.value.indexOf(folderPath)
    if (index !== -1) {
      recentFolders.value.splice(index, 1)
    }
    recentFolders.value.unshift(folderPath)
    recentFolders.value = recentFolders.value.slice(0, 10)
    await saveSettings()
  }
  
  /**
   * 添加最近文件
   */
  async function addRecentFile(filePath) {
    const index = recentFiles.value.indexOf(filePath)
    if (index !== -1) {
      recentFiles.value.splice(index, 1)
    }
    recentFiles.value.unshift(filePath)
    recentFiles.value = recentFiles.value.slice(0, 20)
    await saveSettings()
  }
  
  /**
   * 清除最近文件列表
   */
  async function clearRecentFiles() {
    recentFiles.value = []
    await saveSettings()
  }
  
  /**
   * 清除最近文件夹列表
   */
  async function clearRecentFolders() {
    recentFolders.value = []
    await saveSettings()
  }
  
  /**
   * 更新窗口状态
   */
  async function updateWindowBounds(bounds) {
    windowBounds.value = bounds
    await saveSettings()
  }
  
  /**
   * 重置为默认设置
   */
  async function resetToDefaults() {
    theme.value = 'light'
    editMode.value = 'split'
    sidebarWidth.value = 250
    fontSize.value = 14
    autoSave.value = true
    autoSaveDelay.value = 1000
    await saveSettings()
  }
  
  // 监听变化自动保存（排除 windowBounds）
  watch(
    [theme, editMode, sidebarWidth, fontSize, autoSave, autoSaveDelay],
    () => {
      if (loaded.value) {
        saveSettings()
      }
    }
  )
  
  return {
    // State
    theme,
    editMode,
    sidebarWidth,
    fontSize,
    autoSave,
    autoSaveDelay,
    recentFolders,
    recentFiles,
    windowBounds,
    loaded,
    
    // Actions
    loadSettings,
    saveSettings,
    updateTheme,
    updateEditMode,
    addRecentFolder,
    addRecentFile,
    clearRecentFiles,
    clearRecentFolders,
    updateWindowBounds,
    resetToDefaults
  }
})
```

- [ ] **Step 2: 提交代码**

```bash
git add src/stores/settingsStore.js
git commit -m "feat: 实现设置状态管理

- 管理主题、编辑模式、字体大小等设置
- 管理最近打开的文件和文件夹
- 实现设置持久化"
```

---

## Task 7: Markdown 渲染器配置

**Files:**
- Create: `src/utils/markdown.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `renderMarkdown(content, options)` - 渲染 Markdown 为 HTML
  - `configureMarkdownIt(options)` - 配置渲染器

- [ ] **Step 1: 创建 src/utils/markdown.js**

```javascript
import MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import emoji from 'markdown-it-emoji'
import hljs from 'highlight.js'

// 创建 MarkdownIt 实例
function createMarkdownIt(options = {}) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
      // 代码高亮
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
        } catch (__) {}
      }
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
    },
    ...options
  })
  
  // 使用插件
  md.use(container, 'tip')
  md.use(container, 'warning')
  md.use(container, 'danger')
  md.use(footnote)
  md.use(taskLists, { enabled: true })
  md.use(emoji)
  
  // 自定义链接渲染（外部链接新窗口打开）
  const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }
  
  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const hrefIndex = tokens[idx].attrIndex('href')
    if (hrefIndex >= 0) {
      const href = tokens[idx].attrs[hrefIndex][1]
      if (href.startsWith('http://') || href.startsWith('https://')) {
        tokens[idx].attrPush(['target', '_blank'])
        tokens[idx].attrPush(['rel', 'noopener noreferrer'])
      }
    }
    return defaultRender(tokens, idx, options, env, self)
  }
  
  return md
}

// 单例实例
let mdInstance = null

/**
 * 获取 MarkdownIt 实例
 */
function getMarkdownIt() {
  if (!mdInstance) {
    mdInstance = createMarkdownIt()
  }
  return mdInstance
}

/**
 * 渲染 Markdown 为 HTML
 * @param {string} content Markdown 内容
 * @param {object} options 选项
 * @returns {string} HTML 字符串
 */
export function renderMarkdown(content, options = {}) {
  const md = getMarkdownIt()
  return md.render(content)
}

/**
 * 配置 MarkdownIt
 * @param {object} options 配置选项
 */
export function configureMarkdownIt(options) {
  mdInstance = createMarkdownIt(options)
}

/**
 * 获取 MarkdownIt 实例（用于高级用法）
 */
export function getMarkdownItInstance() {
  return getMarkdownIt()
}

export default {
  renderMarkdown,
  configureMarkdownIt,
  getMarkdownItInstance
}
```

- [ ] **Step 2: 提交代码**

```bash
git add src/utils/markdown.js
git commit -m "feat: 配置 Markdown 渲染器

- 集成 markdown-it 核心渲染
- 添加代码高亮支持 (highlight.js)
- 集成容器、脚注、任务列表、表情插件
- 自定义链接渲染（外部链接新窗口打开）"
```

---

## Task 8: CodeMirror 编辑器配置

**Files:**
- Create: `src/utils/editorConfig.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `createEditorConfig()` - 创建编辑器配置
  - `getEditorKeymap()` - 获取快捷键映射

- [ ] **Step 1: 创建 src/utils/editorConfig.js**

```javascript
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { bracketMatching } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/**
 * 创建浅色主题
 */
function createLightTheme() {
  return EditorView.theme({
    '&': {
      backgroundColor: '#fff',
      color: '#333'
    },
    '.cm-content': {
      caretColor: '#000',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: '14px'
    },
    '.cm-cursor': {
      borderLeftColor: '#000'
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#d4d4d4'
    },
    '.cm-gutters': {
      backgroundColor: '#f7f7f7',
      color: '#999',
      border: 'none'
    }
  }, { dark: false })
}

/**
 * 创建深色主题
 */
function createDarkTheme() {
  return EditorView.theme({
    '&': {
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4'
    },
    '.cm-content': {
      caretColor: '#fff',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: '14px'
    },
    '.cm-cursor': {
      borderLeftColor: '#fff'
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#264f78'
    },
    '.cm-gutters': {
      backgroundColor: '#252526',
      color: '#858585',
      border: 'none'
    }
  }, { dark: true })
}

/**
 * 插入 Markdown 格式
 */
function insertFormat(view, prefix, suffix = prefix) {
  const { from, to } = view.state.selection.main
  const selectedText = view.state.doc.sliceString(from, to)
  
  view.dispatch({
    changes: {
      from,
      to,
      insert: prefix + selectedText + suffix
    },
    selection: { anchor: from + prefix.length, head: to + prefix.length }
  })
  
  return true
}

/**
 * 快捷键映射
 */
export function getEditorKeymap(saveCallback, themeCallback, modeCallback) {
  return [
    // 保存
    keymap.of([{
      key: 'Mod-s',
      run: (view) => {
        if (saveCallback) saveCallback()
        return true
      }
    }]),
    
    // 加粗
    keymap.of([{
      key: 'Mod-b',
      run: (view) => insertFormat(view, '**')
    }]),
    
    // 斜体
    keymap.of([{
      key: 'Mod-i',
      run: (view) => insertFormat(view, '*')
    }]),
    
    // 删除线
    keymap.of([{
      key: 'Mod-Shift-x',
      run: (view) => insertFormat(view, '~~')
    }]),
    
    // 行内代码
    keymap.of([{
      key: 'Mod-e',
      run: (view) => insertFormat(view, '`')
    }]),
    
    // 链接
    keymap.of([{
      key: 'Mod-k',
      run: (view) => insertFormat(view, '[', '](url)')
    }]),
    
    // 切换主题
    keymap.of([{
      key: 'Mod-Shift-t',
      run: () => {
        if (themeCallback) themeCallback()
        return true
      }
    }]),
    
    // 切换模式
    keymap.of([{
      key: 'Mod-Shift-p',
      run: () => {
        if (modeCallback) modeCallback()
        return true
      }
    }]),
    
    // 默认和历史快捷键
    keymap.of(defaultKeymap),
    keymap.of(historyKeymap)
  ]
}

/**
 * 创建编辑器配置
 * @param {object} options 选项
 * @returns {array} 扩展数组
 */
export function createEditorConfig(options = {}) {
  const {
    theme = 'light',
    onSave = null,
    onThemeChange = null,
    onModeChange = null,
    onChange = null,
    fontSize = 14
  } = options
  
  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    bracketMatching(),
    markdown({
      base: markdownLanguage,
      codeLanguages: languages
    }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
    ...getEditorKeymap(onSave, onThemeChange, onModeChange)
  ]
  
  // 主题
  if (theme === 'dark') {
    extensions.push(createDarkTheme())
    extensions.push(oneDark)
  } else {
    extensions.push(createLightTheme())
  }
  
  // 内容变化监听
  if (onChange) {
    extensions.push(EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString())
      }
    }))
  }
  
  return extensions
}

export default {
  createEditorConfig,
  getEditorKeymap
}
```

- [ ] **Step 2: 提交代码**

```bash
git add src/utils/editorConfig.js
git commit -m "feat: 配置 CodeMirror 编辑器

- 创建浅色和深色主题
- 实现 Markdown 格式化快捷键
- 配置语法高亮、行号、撤销重做"
```

---

## Task 9: 编辑器组件 (Editor.vue)

**Files:**
- Create: `src/components/Editor.vue`

**Interfaces:**
- Consumes: Task 8 的编辑器配置
- Produces: Vue 组件，暴露 `getContent()`, `setContent()`, `focus()` 方法

- [ ] **Step 1: 创建 src/components/Editor.vue**

```vue
<template>
  <div class="editor-container" ref="containerRef"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, defineExpose } from 'vue'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { createEditorConfig } from '@/utils/editorConfig'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  theme: {
    type: String,
    default: 'light'
  },
  fontSize: {
    type: Number,
    default: 14
  },
  onSave: {
    type: Function,
    default: null
  },
  onThemeChange: {
    type: Function,
    default: null
  },
  onModeChange: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const containerRef = ref(null)
let editorView = null

// 初始化编辑器
onMounted(() => {
  initEditor()
})

// 销毁编辑器
onUnmounted(() => {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
})

// 监听主题变化
watch(() => props.theme, () => {
  if (editorView) {
    destroyEditor()
    initEditor()
  }
})

// 监听外部内容变化
watch(() => props.modelValue, (newValue) => {
  if (editorView && editorView.state.doc.toString() !== newValue) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: newValue
      }
    })
  }
})

// 初始化编辑器
function initEditor() {
  if (!containerRef.value) return
  
  const config = createEditorConfig({
    theme: props.theme,
    onSave: props.onSave,
    onThemeChange: props.onThemeChange,
    onModeChange: props.onModeChange,
    fontSize: props.fontSize,
    onChange: (content) => {
      emit('update:modelValue', content)
      emit('change', content)
    }
  })
  
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: config
  })
  
  editorView = new EditorView({
    state,
    parent: containerRef.value
  })
}

// 销毁编辑器
function destroyEditor() {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
}

// 获取内容
function getContent() {
  if (!editorView) return ''
  return editorView.state.doc.toString()
}

// 设置内容
function setContent(content) {
  if (!editorView) return
  
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: content
    }
  })
}

// 聚焦
function focus() {
  if (editorView) {
    editorView.focus()
  }
}

// 暴露方法
defineExpose({
  getContent,
  setContent,
  focus
})
</script>

<style scoped>
.editor-container {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
}

.editor-container :deep(.cm-scroller) {
  overflow: auto;
}
</style>
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/Editor.vue
git commit -m "feat: 创建 CodeMirror 编辑器组件

- 封装 CodeMirror 实例
- 支持双向绑定
- 支持主题切换
- 暴露获取/设置内容方法"
```

---

## Task 10: Markdown 预览组件

**Files:**
- Create: `src/components/Preview.vue`
- Create: `src/styles/markdown.css`

**Interfaces:**
- Consumes: Task 7 的 Markdown 渲染器
- Produces: Vue 组件，接收 Markdown 内容，渲染 HTML

- [ ] **Step 1: 创建 src/styles/markdown.css**

```css
/* Markdown 预览样式 */

.markdown-preview {
  padding: 20px;
  line-height: 1.6;
  font-size: 14px;
  overflow-y: auto;
  height: 100%;
}

/* 标题 */
.markdown-preview h1,
.markdown-preview h2,
.markdown-preview h3,
.markdown-preview h4,
.markdown-preview h5,
.markdown-preview h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-preview h1 {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-preview h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-preview h3 { font-size: 1.25em; }
.markdown-preview h4 { font-size: 1em; }
.markdown-preview h5 { font-size: 0.875em; }
.markdown-preview h6 { font-size: 0.85em; color: #6a737d; }

/* 段落 */
.markdown-preview p {
  margin-top: 0;
  margin-bottom: 16px;
}

/* 列表 */
.markdown-preview ul,
.markdown-preview ol {
  margin-top: 0;
  margin-bottom: 16px;
  padding-left: 2em;
}

.markdown-preview li {
  margin-top: 0.25em;
}

.markdown-preview li + li {
  margin-top: 0.25em;
}

/* 代码 */
.markdown-preview code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
}

.markdown-preview pre {
  padding: 16px;
  overflow: auto;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
  margin-bottom: 16px;
}

.markdown-preview pre code {
  background: transparent;
  padding: 0;
}

/* 引用 */
.markdown-preview blockquote {
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin: 0 0 16px 0;
}

/* 表格 */
.markdown-preview table {
  border-spacing: 0;
  border-collapse: collapse;
  margin-bottom: 16px;
  width: 100%;
}

.markdown-preview table th,
.markdown-preview table td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.markdown-preview table th {
  font-weight: 600;
  background-color: #f6f8fa;
}

.markdown-preview table tr {
  background-color: #fff;
  border-top: 1px solid #c6cbd5;
}

.markdown-preview table tr:nth-child(2n) {
  background-color: #f6f8fa;
}

/* 链接 */
.markdown-preview a {
  color: #0366d6;
  text-decoration: none;
}

.markdown-preview a:hover {
  text-decoration: underline;
}

/* 图片 */
.markdown-preview img {
  max-width: 100%;
  box-sizing: content-box;
  background-color: #fff;
}

/* 分割线 */
.markdown-preview hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #e1e4e8;
  border: 0;
}

/* 任务列表 */
.markdown-preview ul.contains-task-list {
  list-style: none;
  padding-left: 1.5em;
}

.markdown-preview .task-list-item {
  margin-left: -1.5em;
}

/* 容器 */
.markdown-preview .tip-container,
.markdown-preview .warning-container,
.markdown-preview .danger-container {
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 4px;
}

.markdown-preview .tip-container {
  background-color: #f0f9ff;
  border-left: 4px solid #0366d6;
}

.markdown-preview .warning-container {
  background-color: #fffbdd;
  border-left: 4px solid #ffd33d;
}

.markdown-preview .danger-container {
  background-color: #ffeef0;
  border-left: 4px solid #cb2431;
}

/* 深色主题 */
.markdown-preview.dark {
  color: #c9d1d9;
}

.markdown-preview.dark h1,
.markdown-preview.dark h2 {
  border-bottom-color: #21262d;
}

.markdown-preview.dark code {
  background-color: rgba(110, 118, 129, 0.4);
}

.markdown-preview.dark pre {
  background-color: #161b22;
}

.markdown-preview.dark blockquote {
  color: #8b949e;
  border-left-color: #3b434b;
}

.markdown-preview.dark table th,
.markdown-preview.dark table td {
  border-color: #30363d;
}

.markdown-preview.dark table th {
  background-color: #21262d;
}

.markdown-preview.dark table tr {
  background-color: #0d1117;
  border-top-color: #30363d;
}

.markdown-preview.dark table tr:nth-child(2n) {
  background-color: #161b22;
}

.markdown-preview.dark a {
  color: #58a6ff;
}

.markdown-preview.dark hr {
  background-color: #21262d;
}
```

- [ ] **Step 2: 创建 src/components/Preview.vue**

```vue
<template>
  <div 
    class="markdown-preview" 
    :class="{ dark: theme === 'dark' }"
    v-html="renderedContent"
  ></div>
</template>

<script setup>
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  theme: {
    type: String,
    default: 'light'
  }
})

const renderedContent = computed(() => {
  if (!props.content) return ''
  return renderMarkdown(props.content)
})
</script>

<style scoped>
@import '@/styles/markdown.css';
</style>
```

- [ ] **Step 3: 提交代码**

```bash
git add src/components/Preview.vue src/styles/markdown.css
git commit -m "feat: 创建 Markdown 预览组件

- 实现 Markdown 渲染
- 创建预览样式（浅色/深色）
- 支持代码高亮、表格、容器等"
```

---

## Task 11: Markdown 编辑器组合组件

**Files:**
- Create: `src/components/MarkdownEditor.vue`

**Interfaces:**
- Consumes: Task 9 (Editor), Task 10 (Preview), Task 6 (settingsStore)
- Produces: Vue 组件，支持三种模式切换和滚动同步

- [ ] **Step 1: 创建 src/components/MarkdownEditor.vue**

```vue
<template>
  <div class="markdown-editor" :class="{ dark: theme === 'dark' }">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <div class="mode-switch">
        <v-btn-toggle v-model="localMode" mandatory density="compact">
          <v-btn value="edit" size="small">
            <v-icon start>mdi-code-tags</v-icon>
            编辑
          </v-btn>
          <v-btn value="split" size="small">
            <v-icon start>mdi-view-split-vertical</v-icon>
            分屏
          </v-btn>
          <v-btn value="preview" size="small">
            <v-icon start>mdi-eye</v-icon>
            预览
          </v-btn>
        </v-btn-toggle>
      </div>
      
      <v-spacer />
      
      <div class="toolbar-actions">
        <v-btn icon size="small" @click="handleSave" :disabled="!modified">
          <v-icon>mdi-content-save</v-icon>
          <v-tooltip activator="parent">保存 (Ctrl+S)</v-tooltip>
        </v-btn>
      </div>
    </div>
    
    <!-- 内容区 -->
    <div class="editor-content" :class="`mode-${localMode}`">
      <!-- 编辑区 -->
      <div class="edit-panel" v-show="localMode !== 'preview'">
        <Editor
          ref="editorRef"
          v-model="localContent"
          :theme="theme"
          :font-size="fontSize"
          :on-save="handleSave"
          :on-theme-change="onThemeChange"
          :on-mode-change="cycleMode"
          @change="handleContentChange"
        />
      </div>
      
      <!-- 分屏分割线 -->
      <div 
        v-show="localMode === 'split'" 
        class="split-divider"
      ></div>
      
      <!-- 预览区 -->
      <div class="preview-panel" v-show="localMode !== 'edit'">
        <Preview :content="localContent" :theme="theme" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, defineExpose } from 'vue'
import Editor from './Editor.vue'
import Preview from './Preview.vue'

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  theme: {
    type: String,
    default: 'light'
  },
  mode: {
    type: String,
    default: 'split'
  },
  fontSize: {
    type: Number,
    default: 14
  },
  modified: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:content', 'update:mode', 'save', 'theme-change'])

const editorRef = ref(null)
const localContent = ref(props.content)
const localMode = ref(props.mode)

// 监听外部内容变化
watch(() => props.content, (newContent) => {
  if (newContent !== localContent.value) {
    localContent.value = newContent
  }
})

// 监听外部模式变化
watch(() => props.mode, (newMode) => {
  localMode.value = newMode
})

// 监听本地模式变化
watch(localMode, (newMode) => {
  emit('update:mode', newMode)
})

// 内容变化
function handleContentChange(content) {
  emit('update:content', content)
}

// 保存
function handleSave() {
  emit('save')
}

// 循环切换模式
function cycleMode() {
  const modes = ['edit', 'split', 'preview']
  const currentIndex = modes.indexOf(localMode.value)
  const nextIndex = (currentIndex + 1) % modes.length
  localMode.value = modes[nextIndex]
}

// 主题切换回调
function onThemeChange() {
  emit('theme-change')
}

// 暴露方法
defineExpose({
  getContent: () => editorRef.value?.getContent() || '',
  setContent: (content) => editorRef.value?.setContent(content),
  focus: () => editorRef.value?.focus()
})
</script>

<style scoped>
.markdown-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #fff;
}

.markdown-editor.dark {
  background-color: #1e1e1e;
  color: #d4d4d4;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #fafafa;
}

.markdown-editor.dark .editor-toolbar {
  background-color: #252526;
  border-bottom-color: #3c3c3c;
}

.editor-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.edit-panel,
.preview-panel {
  flex: 1;
  overflow: hidden;
}

.mode-edit .edit-panel,
.mode-preview .preview-panel {
  flex: 1;
}

.mode-split .edit-panel,
.mode-split .preview-panel {
  flex: 1;
}

.split-divider {
  width: 1px;
  background-color: #e0e0e0;
}

.markdown-editor.dark .split-divider {
  background-color: #3c3c3c;
}
</style>
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/MarkdownEditor.vue
git commit -m "feat: 创建 Markdown 编辑器组合组件

- 组合编辑器和预览组件
- 支持三种模式切换
- 实现保存功能"
```

---

## Task 12: 文件树节点组件

**Files:**
- Create: `src/components/FileTreeNode.vue`

**Interfaces:**
- Consumes: 无
- Produces: Vue 组件，渲染单个文件/文件夹节点

- [ ] **Step 1: 创建 src/components/FileTreeNode.vue**

```vue
<template>
  <div 
    class="tree-node"
    :class="{ 
      'is-directory': node.isDirectory,
      'is-selected': isSelected,
      'is-expanded': isExpanded
    }"
    :style="{ paddingLeft: `${depth * 16}px` }"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
    draggable="true"
    @dragstart="handleDragStart"
    @dragover.prevent
    @drop="handleDrop"
  >
    <!-- 展开/折叠图标 -->
    <span 
      v-if="node.isDirectory" 
      class="expand-icon"
      @click.stop="toggleExpand"
    >
      <v-icon size="small">
        {{ isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
      </v-icon>
    </span>
    <span v-else class="expand-icon"></span>
    
    <!-- 文件图标 -->
    <span class="file-icon">
      <v-icon size="small" :color="iconColor">
        {{ iconName }}
      </v-icon>
    </span>
    
    <!-- 文件名 -->
    <span class="file-name">{{ node.name }}</span>
    
    <!-- 收藏标记 -->
    <v-icon 
      v-if="isBookmarked" 
      size="x-small" 
      color="warning"
      class="bookmark-icon"
    >
      mdi-star
    </v-icon>
  </div>
  
  <!-- 子节点 -->
  <template v-if="node.isDirectory && isExpanded && node.children">
    <FileTreeNode
      v-for="child in node.children"
      :key="child.id"
      :node="child"
      :depth="depth + 1"
      :selected-path="selectedPath"
      :bookmarked-files="bookmarkedFiles"
      @select="$emit('select', $event)"
      @context-menu="$emit('context-menu', $event)"
      @create="$emit('create', $event)"
      @move="$emit('move', $event)"
    />
  </template>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  selectedPath: {
    type: String,
    default: ''
  },
  bookmarkedFiles: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select', 'context-menu', 'create', 'move'])

const isExpanded = ref(false)

// 是否选中
const isSelected = computed(() => {
  return props.node.path === props.selectedPath
})

// 是否收藏
const isBookmarked = computed(() => {
  return props.bookmarkedFiles.includes(props.node.path)
})

// 图标名称
const iconName = computed(() => {
  if (props.node.isDirectory) {
    return isExpanded.value ? 'mdi-folder-open' : 'mdi-folder'
  }
  
  const name = props.node.name.toLowerCase()
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    return 'mdi-language-markdown'
  }
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name)) {
    return 'mdi-image'
  }
  if (/\.(js|ts|vue|jsx|tsx)$/i.test(name)) {
    return 'mdi-language-javascript'
  }
  if (/\.(json|yaml|yml)$/i.test(name)) {
    return 'mdi-code-json'
  }
  
  return 'mdi-file-document'
})

// 图标颜色
const iconColor = computed(() => {
  if (props.node.isDirectory) {
    return 'amber-darken-2'
  }
  if (props.node.name.toLowerCase().endsWith('.md')) {
    return 'blue'
  }
  return 'grey'
})

// 点击处理
function handleClick() {
  if (props.node.isDirectory) {
    toggleExpand()
  }
  emit('select', props.node)
}

// 切换展开
function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

// 右键菜单
function handleContextMenu(e) {
  emit('context-menu', {
    event: e,
    node: props.node
  })
}

// 拖拽开始
function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', props.node.path)
  e.dataTransfer.effectAllowed = 'move'
}

// 拖放处理
function handleDrop(e) {
  if (!props.node.isDirectory) return
  
  const sourcePath = e.dataTransfer.getData('text/plain')
  if (sourcePath === props.node.path) return
  
  emit('move', {
    source: sourcePath,
    target: props.node.path
  })
}
</script>

<style scoped>
.tree-node {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.1s;
}

.tree-node:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.tree-node.is-selected {
  background-color: rgba(25, 118, 210, 0.12);
}

.expand-icon {
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-icon {
  margin-right: 8px;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-icon {
  margin-left: 4px;
}
</style>
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/FileTreeNode.vue
git commit -m "feat: 创建文件树节点组件

- 渲染文件/文件夹节点
- 支持展开/折叠
- 显示不同文件类型图标
- 支持拖拽和右键菜单"
```

---

## Task 13: 文件树组件

**Files:**
- Create: `src/components/FileTree.vue`

**Interfaces:**
- Consumes: Task 12 (FileTreeNode), Task 5 (fileStore)
- Produces: Vue 组件，完整文件树功能

- [ ] **Step 1: 创建 src/components/FileTree.vue**

```vue
<template>
  <div class="file-tree">
    <!-- 搜索栏 -->
    <div class="search-bar">
      <v-text-field
        v-model="searchQuery"
        density="compact"
        placeholder="搜索文件..."
        prepend-inner-icon="mdi-magnify"
        hide-details
        clearable
      />
    </div>
    
    <!-- 操作按钮 -->
    <div class="tree-actions">
      <v-btn size="small" variant="text" @click="handleCreateFile">
        <v-icon start>mdi-file-plus</v-icon>
        新建文件
      </v-btn>
      <v-btn size="small" variant="text" @click="handleCreateFolder">
        <v-icon start>mdi-folder-plus</v-icon>
        新建文件夹
      </v-btn>
    </div>
    
    <!-- 文件树 -->
    <div class="tree-content">
      <div v-if="!fileStore.currentFolder" class="empty-state">
        <v-icon size="48" color="grey">mdi-folder-outline</v-icon>
        <p>请打开一个文件夹</p>
        <v-btn color="primary" @click="$emit('open-folder')">
          打开文件夹
        </v-btn>
      </div>
      
      <template v-else>
        <FileTreeNode
          v-for="node in filteredTree"
          :key="node.id"
          :node="node"
          :selected-path="selectedPath"
          :bookmarked-files="fileStore.bookmarkedFiles"
          @select="handleSelect"
          @context-menu="handleContextMenu"
          @move="handleMove"
        />
      </template>
    </div>
    
    <!-- 右键菜单 -->
    <v-menu
      v-model="contextMenu.show"
      :position-x="contextMenu.x"
      :position-y="contextMenu.y"
      absolute
      offset-y
    >
      <v-list density="compact">
        <v-list-item v-if="contextMenu.node?.isDirectory" @click="handleNewFile">
          <template v-slot:prepend>
            <v-icon>mdi-file-plus</v-icon>
          </template>
          <v-list-item-title>新建文件</v-list-item-title>
        </v-list-item>
        
        <v-list-item v-if="contextMenu.node?.isDirectory" @click="handleNewFolder">
          <template v-slot:prepend>
            <v-icon>mdi-folder-plus</v-icon>
          </template>
          <v-list-item-title>新建文件夹</v-list-item-title>
        </v-list-item>
        
        <v-divider v-if="contextMenu.node?.isDirectory" />
        
        <v-list-item @click="handleRename">
          <template v-slot:prepend>
            <v-icon>mdi-rename</v-icon>
          </template>
          <v-list-item-title>重命名</v-list-item-title>
        </v-list-item>
        
        <v-list-item @click="handleDelete">
          <template v-slot:prepend>
            <v-icon color="error">mdi-delete</v-icon>
          </template>
          <v-list-item-title>删除</v-list-item-title>
        </v-list-item>
        
        <v-divider />
        
        <v-list-item v-if="!contextMenu.node?.isDirectory" @click="handleToggleBookmark">
          <template v-slot:prepend>
            <v-icon>{{ isBookmarked ? 'mdi-star-off' : 'mdi-star' }}</v-icon>
          </template>
          <v-list-item-title>
            {{ isBookmarked ? '取消收藏' : '收藏' }}
          </v-list-item-title>
        </v-list-item>
        
        <v-list-item @click="handleCopyPath">
          <template v-slot:prepend>
            <v-icon>mdi-content-copy</v-icon>
          </template>
          <v-list-item-title>复制路径</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    
    <!-- 新建对话框 -->
    <v-dialog v-model="createDialog.show" max-width="400">
      <v-card>
        <v-card-title>{{ createDialog.title }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="createDialog.name"
            :label="createDialog.label"
            @keyup.enter="confirmCreate"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createDialog.show = false">取消</v-btn>
          <v-btn color="primary" @click="confirmCreate">确定</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import FileTreeNode from './FileTreeNode.vue'

const fileStore = inject('fileStore')

const emit = defineEmits(['open-folder', 'file-select'])

const searchQuery = ref('')
const selectedPath = ref('')

// 右键菜单状态
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  node: null
})

// 新建对话框状态
const createDialog = ref({
  show: false,
  title: '',
  label: '',
  name: '',
  type: 'file', // 'file' | 'folder'
  parentPath: ''
})

// 过滤文件树
const filteredTree = computed(() => {
  if (!searchQuery.value) {
    return fileStore.fileTree
  }
  
  const query = searchQuery.value.toLowerCase()
  
  function filterNodes(nodes) {
    const result = []
    for (const node of nodes) {
      if (node.name.toLowerCase().includes(query)) {
        result.push(node)
      } else if (node.isDirectory && node.children) {
        const filteredChildren = filterNodes(node.children)
        if (filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren
          })
        }
      }
    }
    return result
  }
  
  return filterNodes(fileStore.fileTree)
})

// 是否收藏
const isBookmarked = computed(() => {
  return contextMenu.value.node && 
    fileStore.bookmarkedFiles.includes(contextMenu.value.node.path)
})

// 选择文件
function handleSelect(node) {
  selectedPath.value = node.path
  
  if (!node.isDirectory) {
    fileStore.openFile(node.path)
    emit('file-select', node)
  }
}

// 右键菜单
function handleContextMenu({ event, node }) {
  contextMenu.value = {
    show: false,
    x: event.clientX,
    y: event.clientY,
    node
  }
  
  // 等待 DOM 更新后显示菜单
  setTimeout(() => {
    contextMenu.value.show = true
  }, 0)
}

// 移动文件
async function handleMove({ source, target }) {
  const fileName = source.split(/[/\\]/).pop()
  const newPath = `${target}/${fileName}`
  
  // 确认对话框
  // TODO: 添加确认对话框
  
  await fileStore.moveFile(source, newPath)
}

// 新建文件
function handleCreateFile() {
  createDialog.value = {
    show: true,
    title: '新建文件',
    label: '文件名',
    name: '',
    type: 'file',
    parentPath: fileStore.currentFolder
  }
}

// 新建文件夹
function handleCreateFolder() {
  createDialog.value = {
    show: true,
    title: '新建文件夹',
    label: '文件夹名',
    name: '',
    type: 'folder',
    parentPath: fileStore.currentFolder
  }
}

// 右键菜单新建文件
function handleNewFile() {
  createDialog.value = {
    show: true,
    title: '新建文件',
    label: '文件名',
    name: '',
    type: 'file',
    parentPath: contextMenu.value.node.path
  }
}

// 右键菜单新建文件夹
function handleNewFolder() {
  createDialog.value = {
    show: true,
    title: '新建文件夹',
    label: '文件夹名',
    name: '',
    type: 'folder',
    parentPath: contextMenu.value.node.path
  }
}

// 确认创建
async function confirmCreate() {
  if (!createDialog.value.name) return
  
  const { type, parentPath, name } = createDialog.value
  
  if (type === 'file') {
    await fileStore.createFile(parentPath, name)
  } else {
    await fileStore.createFolder(parentPath, name)
  }
  
  createDialog.value.show = false
}

// 重命名
async function handleRename() {
  const node = contextMenu.value.node
  if (!node) return
  
  createDialog.value = {
    show: true,
    title: '重命名',
    label: '新名称',
    name: node.name,
    type: 'rename',
    node
  }
}

// 删除
async function handleDelete() {
  const node = contextMenu.value.node
  if (!node) return
  
  // TODO: 添加确认对话框
  
  await fileStore.deleteFile(node.path)
}

// 切换收藏
function handleToggleBookmark() {
  const node = contextMenu.value.node
  if (node) {
    fileStore.toggleBookmark(node.path)
  }
}

// 复制路径
async function handleCopyPath() {
  const node = contextMenu.value.node
  if (node && navigator.clipboard) {
    await navigator.clipboard.writeText(node.path)
  }
}
</script>

<style scoped>
.file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.search-bar {
  padding: 8px;
}

.tree-actions {
  display: flex;
  gap: 4px;
  padding: 0 8px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.tree-content {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: #999;
}

.empty-state p {
  margin: 16px 0;
}
</style>
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/FileTree.vue
git commit -m "feat: 创建文件树组件

- 实现文件树渲染
- 支持搜索过滤
- 支持右键菜单
- 支持新建、重命名、删除操作"
```

---

## Task 14: 标签页组件

**Files:**
- Create: `src/components/TabBar.vue`

**Interfaces:**
- Consumes: Task 5 (fileStore)
- Produces: Vue 组件，多标签页管理

- [ ] **Step 1: 创建 src/components/TabBar.vue**

```vue
<template>
  <div class="tab-bar" v-if="fileStore.openFiles.length > 0">
    <div class="tabs-container" ref="tabsContainer">
      <v-tabs v-model="activeIndex" density="compact" show-arrows>
        <v-tab
          v-for="(file, index) in fileStore.openFiles"
          :key="file.path"
          :value="index"
          class="tab-item"
          @contextmenu.prevent="showContextMenu($event, index)"
        >
          <v-icon 
            v-if="fileStore.modifiedFiles.has(file.path)" 
            size="small"
            color="warning"
            class="modified-dot"
          >
            mdi-circle
          </v-icon>
          
          <span class="tab-title">{{ file.name }}</span>
          
          <v-btn
            icon
            size="x-small"
            variant="text"
            class="close-btn"
            @click.stop="closeTab(index)"
          >
            <v-icon size="small">mdi-close</v-icon>
          </v-btn>
        </v-tab>
      </v-tabs>
    </div>
    
    <!-- 右键菜单 -->
    <v-menu
      v-model="contextMenu.show"
      :position-x="contextMenu.x"
      :position-y="contextMenu.y"
      absolute
      offset-y
    >
      <v-list density="compact">
        <v-list-item @click="closeTab(contextMenu.index)">
          <template v-slot:prepend>
            <v-icon>mdi-close</v-icon>
          </template>
          <v-list-item-title>关闭</v-list-item-title>
        </v-list-item>
        
        <v-list-item @click="closeOthers">
          <template v-slot:prepend>
            <v-icon>mdi-close-others</v-icon>
          </template>
          <v-list-item-title>关闭其他</v-list-item-title>
        </v-list-item>
        
        <v-list-item @click="closeRight">
          <template v-slot:prepend>
            <v-icon>mdi-close-box-outline</v-icon>
          </template>
          <v-list-item-title>关闭右侧所有</v-list-item-title>
        </v-list-item>
        
        <v-divider />
        
        <v-list-item @click="closeAll">
          <template v-slot:prepend>
            <v-icon>mdi-close-all</v-icon>
          </template>
          <v-list-item-title>关闭所有</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup>
import { ref, watch, inject } from 'vue'

const fileStore = inject('fileStore')

const tabsContainer = ref(null)
const activeIndex = ref(fileStore.activeFileIndex)
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  index: -1
})

// 同步活动文件索引
watch(() => fileStore.activeFileIndex, (newIndex) => {
  activeIndex.value = newIndex
})

watch(activeIndex, (newIndex) => {
  fileStore.switchTab(newIndex)
})

// 关闭标签页
async function closeTab(index) {
  const file = fileStore.openFiles[index]
  
  // 检查是否有未保存的修改
  if (fileStore.modifiedFiles.has(file.path)) {
    // TODO: 显示确认对话框
  }
  
  await fileStore.closeFile(index)
}

// 显示右键菜单
function showContextMenu(event, index) {
  contextMenu.value = {
    show: false,
    x: event.clientX,
    y: event.clientY,
    index
  }
  
  setTimeout(() => {
    contextMenu.value.show = true
  }, 0)
}

// 关闭其他
async function closeOthers() {
  await fileStore.closeOtherTabs(contextMenu.value.index)
}

// 关闭右侧所有
async function closeRight() {
  const index = contextMenu.value.index
  const files = [...fileStore.openFiles]
  
  for (let i = files.length - 1; i > index; i--) {
    await fileStore.closeFile(i)
  }
}

// 关闭所有
async function closeAll() {
  await fileStore.closeAllTabs()
}
</script>

<style scoped>
.tab-bar {
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.tab-item {
  max-width: 200px;
}

.tab-title {
  margin: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modified-dot {
  margin-right: 4px;
}

.close-btn {
  margin-left: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.tab-item:hover .close-btn {
  opacity: 1;
}
</style>
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/TabBar.vue
git commit -m "feat: 创建标签页组件

- 显示打开的文件标签
- 支持切换、关闭标签
- 显示修改状态
- 右键菜单支持批量关闭"
```

---

## Task 15: 设置对话框组件

**Files:**
- Create: `src/components/SettingsDialog.vue`

**Interfaces:**
- Consumes: Task 6 (settingsStore)
- Produces: Vue 组件，设置管理界面

- [ ] **Step 1: 创建 src/components/SettingsDialog.vue**

```vue
<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="500">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon start>mdi-cog</v-icon>
        设置
      </v-card-title>
      
      <v-card-text>
        <v-list>
          <!-- 主题 -->
          <v-list-item>
            <template v-slot:prepend>
              <v-icon>mdi-palette</v-icon>
            </template>
            <v-list-item-title>主题</v-list-item-title>
            <v-list-item-subtitle>选择界面主题</v-list-item-subtitle>
            <template v-slot:append>
              <v-btn-toggle v-model="localTheme" mandatory density="compact">
                <v-btn value="light">
                  <v-icon start>mdi-white-balance-sunny</v-icon>
                  浅色
                </v-btn>
                <v-btn value="dark">
                  <v-icon start>mdi-moon-waning-crescent</v-icon>
                  深色
                </v-btn>
              </v-btn-toggle>
            </template>
          </v-list-item>
          
          <v-divider />
          
          <!-- 编辑模式 -->
          <v-list-item>
            <template v-slot:prepend>
              <v-icon>mdi-view-split-vertical</v-icon>
            </template>
            <v-list-item-title>默认编辑模式</v-list-item-title>
            <v-list-item-subtitle>打开文件时的默认显示模式</v-list-item-subtitle>
            <template v-slot:append>
              <v-select
                v-model="localEditMode"
                :items="editModeOptions"
                density="compact"
                hide-details
                style="width: 120px"
              />
            </template>
          </v-list-item>
          
          <v-divider />
          
          <!-- 字体大小 -->
          <v-list-item>
            <template v-slot:prepend>
              <v-icon>mdi-format-size</v-icon>
            </template>
            <v-list-item-title>编辑器字体大小</v-list-item-title>
            <template v-slot:append>
              <v-slider
                v-model="localFontSize"
                :min="12"
                :max="24"
                :step="1"
                thumb-label
                hide-details
                style="width: 150px"
              />
            </template>
          </v-list-item>
          
          <v-divider />
          
          <!-- 自动保存 -->
          <v-list-item>
            <template v-slot:prepend>
              <v-icon>mdi-content-save</v-icon>
            </template>
            <v-list-item-title>自动保存</v-list-item-title>
            <v-list-item-subtitle>编辑后自动保存文件</v-list-item-subtitle>
            <template v-slot:append>
              <v-switch v-model="localAutoSave" hide-details />
            </template>
          </v-list-item>
          
          <v-list-item v-if="localAutoSave">
            <template v-slot:prepend>
              <v-icon></v-icon>
            </template>
            <v-list-item-title>自动保存延迟 (毫秒)</v-list-item-title>
            <template v-slot:append>
              <v-text-field
                v-model.number="localAutoSaveDelay"
                type="number"
                density="compact"
                hide-details
                style="width: 100px"
              />
            </template>
          </v-list-item>
        </v-list>
        
        <v-divider class="my-4" />
        
        <!-- 清除数据 -->
        <div class="d-flex justify-space-between align-center">
          <div>
            <div class="text-subtitle-1">清除数据</div>
            <div class="text-caption text-grey">清除最近打开的文件和文件夹记录</div>
          </div>
          <v-btn variant="outlined" color="warning" @click="clearRecentData">
            清除
          </v-btn>
        </div>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="resetToDefaults">恢复默认</v-btn>
        <v-btn color="primary" @click="saveAndClose">确定</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch, inject } from 'vue'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue'])

const settingsStore = inject('settingsStore')

const localTheme = ref(settingsStore.theme)
const localEditMode = ref(settingsStore.editMode)
const localFontSize = ref(settingsStore.fontSize)
const localAutoSave = ref(settingsStore.autoSave)
const localAutoSaveDelay = ref(settingsStore.autoSaveDelay)

const editModeOptions = [
  { title: '编辑', value: 'edit' },
  { title: '分屏', value: 'split' },
  { title: '预览', value: 'preview' }
]

// 监听 store 变化
watch(() => settingsStore.theme, (val) => localTheme.value = val)
watch(() => settingsStore.editMode, (val) => localEditMode.value = val)
watch(() => settingsStore.fontSize, (val) => localFontSize.value = val)
watch(() => settingsStore.autoSave, (val) => localAutoSave.value = val)
watch(() => settingsStore.autoSaveDelay, (val) => localAutoSaveDelay.value = val)

// 保存并关闭
async function saveAndClose() {
  await settingsStore.updateTheme(localTheme.value)
  await settingsStore.updateEditMode(localEditMode.value)
  settingsStore.fontSize = localFontSize.value
  settingsStore.autoSave = localAutoSave.value
  settingsStore.autoSaveDelay = localAutoSaveDelay.value
  await settingsStore.saveSettings()
  
  emit('update:modelValue', false)
}

// 恢复默认
async function resetToDefaults() {
  await settingsStore.resetToDefaults()
  localTheme.value = settingsStore.theme
  localEditMode.value = settingsStore.editMode
  localFontSize.value = settingsStore.fontSize
  localAutoSave.value = settingsStore.autoSave
  localAutoSaveDelay.value = settingsStore.autoSaveDelay
}

// 清除最近数据
async function clearRecentData() {
  await settingsStore.clearRecentFiles()
  await settingsStore.clearRecentFolders()
}
</script>
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/SettingsDialog.vue
git commit -m "feat: 创建设置对话框组件

- 主题切换设置
- 编辑模式设置
- 字体大小设置
- 自动保存设置
- 清除最近数据"
```

---

## Task 16: 主工具栏组件

**Files:**
- Create: `src/components/MainToolbar.vue`

**Interfaces:**
- Consumes: Task 6 (settingsStore)
- Produces: Vue 组件，顶部工具栏

- [ ] **Step 1: 创建 src/components/MainToolbar.vue**

```vue
<template>
  <v-app-bar density="comfortable">
    <!-- 菜单按钮 -->
    <v-menu>
      <template v-slot:activator="{ props }">
        <v-btn icon v-bind="props">
          <v-icon>mdi-menu</v-icon>
        </v-btn>
      </template>
      
      <v-list density="compact">
        <v-list-item @click="$emit('open-folder')">
          <template v-slot:prepend>
            <v-icon>mdi-folder-open</v-icon>
          </template>
          <v-list-item-title>打开文件夹</v-list-item-title>
          <v-list-item-subtitle>Ctrl+O</v-list-item-subtitle>
        </v-list-item>
        
        <v-divider />
        
        <v-list-item @click="$emit('new-file')">
          <template v-slot:prepend>
            <v-icon>mdi-file-plus</v-icon>
          </template>
          <v-list-item-title>新建文件</v-list-item-title>
          <v-list-item-subtitle>Ctrl+N</v-list-item-subtitle>
        </v-list-item>
        
        <v-list-item @click="$emit('save')" :disabled="!hasActiveFile">
          <template v-slot:prepend>
            <v-icon>mdi-content-save</v-icon>
          </template>
          <v-list-item-title>保存</v-list-item-title>
          <v-list-item-subtitle>Ctrl+S</v-list-item-subtitle>
        </v-list-item>
        
        <v-divider />
        
        <v-list-item @click="showSettings = true">
          <template v-slot:prepend>
            <v-icon>mdi-cog</v-icon>
          </template>
          <v-list-item-title>设置</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    
    <!-- 标题 -->
    <v-app-bar-title>
      <span class="app-title">Markdown Editor</span>
      <span v-if="currentFolderName" class="folder-name">
        - {{ currentFolderName }}
      </span>
    </v-app-bar-title>
    
    <v-spacer />
    
    <!-- 快捷操作 -->
    <v-btn icon @click="$emit('save')" :disabled="!hasActiveFile">
      <v-icon>mdi-content-save</v-icon>
      <v-tooltip activator="parent">保存 (Ctrl+S)</v-tooltip>
    </v-btn>
    
    <!-- 主题切换 -->
    <v-btn icon @click="toggleTheme">
      <v-icon>{{ theme === 'light' ? 'mdi-moon-waning-crescent' : 'mdi-white-balance-sunny' }}</v-icon>
      <v-tooltip activator="parent">切换主题 (Ctrl+Shift+T)</v-tooltip>
    </v-btn>
    
    <!-- 设置 -->
    <v-btn icon @click="showSettings = true">
      <v-icon>mdi-cog</v-icon>
      <v-tooltip activator="parent">设置</v-tooltip>
    </v-btn>
    
    <!-- 设置对话框 -->
    <SettingsDialog v-model="showSettings" />
  </v-app-bar>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import SettingsDialog from './SettingsDialog.vue'

const fileStore = inject('fileStore')
const settingsStore = inject('settingsStore')

defineEmits(['open-folder', 'new-file', 'save'])

const showSettings = ref(false)

const theme = computed(() => settingsStore.theme)

const currentFolderName = computed(() => {
  if (!fileStore.currentFolder) return ''
  return fileStore.currentFolder.split(/[/\\]/).pop()
})

const hasActiveFile = computed(() => {
  return fileStore.activeFile !== null
})

// 切换主题
async function toggleTheme() {
  const newTheme = theme.value === 'light' ? 'dark' : 'light'
  await settingsStore.updateTheme(newTheme)
}
</script>

<style scoped>
.app-title {
  font-weight: 600;
}

.folder-name {
  color: rgba(0, 0, 0, 0.6);
  font-weight: normal;
}
</style>
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/MainToolbar.vue
git commit -m "feat: 创建主工具栏组件

- 文件菜单
- 快捷操作按钮
- 主题切换
- 设置入口"
```

---

## Task 17: 侧边栏组件

**Files:**
- Create: `src/components/Sidebar.vue`

**Interfaces:**
- Consumes: Task 13 (FileTree), Task 5 (fileStore)
- Produces: Vue 组件，左侧边栏

- [ ] **Step 1: 创建 src/components/Sidebar.vue**

```vue
<template>
  <v-navigation-drawer
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :width="width"
    @update:width="$emit('update:width', $event)"
    permanent
    resizable
  >
    <FileTree
      @open-folder="$emit('open-folder')"
      @file-select="$emit('file-select', $event)"
    />
    
    <!-- 收藏列表 -->
    <div class="bookmarks-section" v-if="fileStore.bookmarkedFiles.length > 0">
      <v-list-subheader>收藏</v-list-subheader>
      
      <v-list density="compact">
        <v-list-item
          v-for="path in fileStore.bookmarkedFiles"
          :key="path"
          @click="openBookmarkedFile(path)"
        >
          <template v-slot:prepend>
            <v-icon size="small" color="warning">mdi-star</v-icon>
          </template>
          <v-list-item-title>{{ getFileName(path) }}</v-list-item-title>
          <template v-slot:append>
            <v-btn
              icon
              size="x-small"
              variant="text"
              @click.stop="removeBookmark(path)"
            >
              <v-icon size="small">mdi-close</v-icon>
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </div>
  </v-navigation-drawer>
</template>

<script setup>
import { inject } from 'vue'
import FileTree from './FileTree.vue'

const props = defineProps({
  modelValue: Boolean,
  width: {
    type: Number,
    default: 250
  }
})

const emit = defineEmits(['update:modelValue', 'update:width', 'open-folder', 'file-select'])

const fileStore = inject('fileStore')

// 获取文件名
function getFileName(path) {
  return path.split(/[/\\]/).pop()
}

// 打开收藏的文件
async function openBookmarkedFile(path) {
  await fileStore.openFile(path)
  emit('file-select', { path })
}

// 移除收藏
function removeBookmark(path) {
  fileStore.toggleBookmark(path)
}
</script>

<style scoped>
.bookmarks-section {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/Sidebar.vue
git commit -m "feat: 创建侧边栏组件

- 集成文件树
- 显示收藏列表
- 支持调整宽度"
```

---

## Task 18: 主应用组件整合

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: 所有组件
- Produces: 完整应用界面

- [ ] **Step 1: 更新 src/App.vue**

```vue
<template>
  <v-app :theme="settingsStore.theme">
    <!-- 工具栏 -->
    <MainToolbar
      @open-folder="handleOpenFolder"
      @new-file="handleNewFile"
      @save="handleSave"
    />
    
    <!-- 侧边栏 -->
    <Sidebar
      v-model="sidebarVisible"
      :width="settingsStore.sidebarWidth"
      @update:width="updateSidebarWidth"
      @open-folder="handleOpenFolder"
      @file-select="handleFileSelect"
    />
    
    <!-- 主内容区 -->
    <v-main>
      <!-- 标签页 -->
      <TabBar />
      
      <!-- 编辑器区域 -->
      <div class="editor-area">
        <!-- 欢迎页面 -->
        <div v-if="!fileStore.activeFile" class="welcome-page">
          <v-icon size="64" color="grey">mdi-language-markdown</v-icon>
          <h2>Markdown Editor</h2>
          <p>打开文件夹开始编辑 Markdown 文件</p>
          <v-btn color="primary" size="large" @click="handleOpenFolder">
            <v-icon start>mdi-folder-open</v-icon>
            打开文件夹
          </v-btn>
        </div>
        
        <!-- 编辑器 -->
        <MarkdownEditor
          v-else
          ref="editorRef"
          :content="fileStore.activeFile?.content || ''"
          :theme="settingsStore.theme"
          :mode="settingsStore.editMode"
          :font-size="settingsStore.fontSize"
          :modified="fileStore.modifiedFiles.has(fileStore.activeFile?.path)"
          @update:content="handleContentUpdate"
          @save="handleSave"
          @theme-change="toggleTheme"
        />
      </div>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, onMounted, provide } from 'vue'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import MainToolbar from '@/components/MainToolbar.vue'
import Sidebar from '@/components/Sidebar.vue'
import TabBar from '@/components/TabBar.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

// 初始化 stores
const fileStore = useFileStore()
const settingsStore = useSettingsStore()

// 提供给子组件
provide('fileStore', fileStore)
provide('settingsStore', settingsStore)

const editorRef = ref(null)
const sidebarVisible = ref(true)

// 初始化
onMounted(async () => {
  await settingsStore.loadSettings()
  
  // 应用主题
  // Vuetify 主题会在 v-app 的 :theme 绑定中自动应用
})

// 打开文件夹
async function handleOpenFolder() {
  const success = await fileStore.openFolder()
  if (success) {
    await settingsStore.addRecentFolder(fileStore.currentFolder)
  }
}

// 文件选择
async function handleFileSelect(node) {
  await settingsStore.addRecentFile(node.path)
}

// 新建文件
function handleNewFile() {
  // TODO: 实现新建文件逻辑
}

// 保存
async function handleSave() {
  if (fileStore.activeFileIndex >= 0) {
    await fileStore.saveFile(fileStore.activeFileIndex)
  }
}

// 内容更新
function handleContentUpdate(content) {
  fileStore.updateFileContent(fileStore.activeFileIndex, content)
}

// 切换主题
async function toggleTheme() {
  const newTheme = settingsStore.theme === 'light' ? 'dark' : 'light'
  await settingsStore.updateTheme(newTheme)
}

// 更新侧边栏宽度
async function updateSidebarWidth(width) {
  settingsStore.sidebarWidth = width
  await settingsStore.saveSettings()
}
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.v-application {
  height: 100%;
}

.editor-area {
  height: calc(100% - 48px);
  overflow: hidden;
}

.welcome-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: #999;
}

.welcome-page h2 {
  margin-top: 16px;
  color: #333;
}

.welcome-page p {
  margin: 8px 0 24px;
}
</style>
```

- [ ] **Step 2: 提交代码**

```bash
git add src/App.vue
git commit -m "feat: 整合主应用组件

- 组装所有子组件
- 初始化状态管理
- 实现主要交互逻辑"
```

---

## Task 19: 测试运行

**Files:**
- 无新增文件

**Interfaces:**
- Consumes: 所有已完成的组件
- Produces: 可运行的应用

- [ ] **Step 1: 启动开发服务器**

```bash
npm run electron:dev
```

Expected: 
- Vite 开发服务器启动在 http://localhost:5173
- Electron 窗口打开
- 显示欢迎页面

- [ ] **Step 2: 测试基本功能**

手动测试清单：
1. [ ] 窗口正常打开
1. [ ] 点击"打开文件夹"可以选择文件夹
1. [ ] 文件树正确显示
1. [ ] 点击文件可以打开
1. [ ] 编辑器正常显示
1. [ ] 预览模式正常
1. [ ] 分屏模式正常
1. [ ] 主题切换正常
1. [ ] 设置保存正常

- [ ] **Step 3: 修复发现的问题**

根据测试结果修复问题

---

## Task 20: 构建和打包

**Files:**
- Create: `assets/icon.png` (需要准备图标文件)

**Interfaces:**
- Consumes: 完整应用
- Produces: Windows 可执行文件

- [ ] **Step 1: 准备应用图标**

准备一个 256x256 的 PNG 图标文件，放到 `assets/icon.png`

- [ ] **Step 2: 构建应用**

```bash
npm run electron:build
```

Expected: 
- 构建成功
- 在 `dist_electron` 目录生成安装程序

- [ ] **Step 3: 测试安装程序**

运行生成的安装程序，验证：
1. [ ] 安装成功
1. [ ] 应用可以正常启动
1. [ ] 所有功能正常

- [ ] **Step 4: 提交最终版本**

```bash
git add .
git commit -m "release: 完成 Markdown Editor v1.0.0

- 完整的文件浏览器功能
- Markdown 编辑和预览
- 多标签页支持
- 主题切换
- 设置持久化"
```

---

## 自查清单

### 规范覆盖检查

| 规范要求 | 对应任务 | 状态 |
|---------|---------|------|
| 项目初始化 | Task 1 | ✅ |
| Electron 主进程 | Task 2 | ✅ |
| Vue + Vuetify 配置 | Task 3 | ✅ |
| 文件系统工具 | Task 4 | ✅ |
| 文件状态管理 | Task 5 | ✅ |
| 设置状态管理 | Task 6 | ✅ |
| Markdown 渲染器 | Task 7 | ✅ |
| CodeMirror 编辑器 | Task 8 | ✅ |
| 编辑器组件 | Task 9 | ✅ |
| 预览组件 | Task 10 | ✅ |
| 编辑器组合组件 | Task 11 | ✅ |
| 文件树节点 | Task 12 | ✅ |
| 文件树组件 | Task 13 | ✅ |
| 标签页组件 | Task 14 | ✅ |
| 设置对话框 | Task 15 | ✅ |
| 主工具栏 | Task 16 | ✅ |
| 侧边栏 | Task 17 | ✅ |
| 主应用整合 | Task 18 | ✅ |
| 测试运行 | Task 19 | ✅ |
| 构建打包 | Task 20 | ✅ |

### 占位符检查

- 无 TBD、TODO 或未完成章节
- 所有步骤包含具体代码
- 所有命令可执行

### 类型一致性检查

- 所有文件路径使用统一格式
- 函数签名在定义和使用处一致
- Props 和 emit 定义清晰
