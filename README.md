# 简域 (RealmNote) — Markdown 即时渲染编辑器

一个基于 **Electron + Vue 3** 的桌面端 Markdown 编辑器，采用 **Vditor IR（即时渲染）模式**，编辑即渲染的 Typora 式体验，支持文件夹浏览、多标签管理、TOC 目录与丰富的 Markdown 元素。

## 一、目录结构

```
markdownHtml/
├── electron/                  # Electron 主进程代码
│   ├── main.js                # 主进程入口：窗口创建、菜单、IPC、文件系统操作
│   ├── preload.js             # 预加载脚本：contextBridge 暴露 electronAPI
│   └── utils/config.js        # 应用配置读写（窗口状态等）
│
├── src/                       # 渲染进程（Vue 3 应用）
│   ├── main.js                # Vue 应用入口
│   ├── App.vue                # 根组件：整体布局
│   ├── plugins/vuetify.js     # Vuetify 配置
│   ├── components/
│   │   ├── Sidebar.vue        # 侧边栏容器
│   │   ├── FileTree.vue       # 文件树（搜索/折叠/右键菜单）
│   │   ├── FileTreeNode.vue   # 文件树节点（拖拽/重命名/新建/删除）
│   │   ├── TabBar.vue         # 多标签页管理（最近文件记录）
│   │   ├── MainToolbar.vue    # 顶部工具栏
│   │   ├── Editor.vue         # 编辑器容器（编辑/预览/分屏切换）
│   │   ├── MarkdownEditor.vue # Vditor IR 即时渲染编辑器封装
│   │   ├── TocPanel.vue       # 文档目录（TOC）面板
│   │   └── SettingsDialog.vue # 设置对话框
│   ├── stores/
│   │   ├── fileStore.js       # 文件/文件夹状态管理（Pinia）
│   │   └── settingsStore.js   # 用户设置（持久化到 localStorage）
│   ├── utils/
│   │   ├── fileSystem.js      # 文件系统封装
│   │   ├── markdown.js        # markdown-it 渲染管线（插件扩展）
│   │   ├── editorConfig.js    # CodeMirror 配置
│   │   └── toc.js             # 目录提取
│   └── styles/markdown.css    # 预览样式
│
├── index.html                 # Vite HTML 入口
├── vite.config.js             # Vite 配置（@ 别名、Vuetify 自动导入）
├── package.json               # 依赖与构建脚本（含 electron-builder 配置）
├── assets/                    # 应用资源（图标）
├── dist/                      # Vite 构建产物（.gitignore）
├── dist_electron/             # electron-builder 打包产物（.gitignore）
└── node_modules/              # 依赖（.gitignore）
```

## 二、技术架构

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面外壳 | Electron 30 | 主进程负责窗口/菜单/文件系统 IPC，`contextIsolation: true` + `preload.js` 安全桥接 |
| 前端框架 | Vue 3.4（Composition API） | 渲染进程 UI |
| UI 组件库 | Vuetify 3.5 | Material Design 组件，自动按需导入 |
| 状态管理 | Pinia 2.1 | `fileStore`（文件状态）+ `settingsStore`（设置持久化） |
| 编辑器 | Vditor 3（IR 即时渲染，内置 Lute 引擎） | Markdown ↔ DOM 双向转换，输入即渲染，替代 CodeMirror + 分屏预览 |
| 构建工具 | Vite 5 + electron-builder | Web 构建 + Windows portable/NSIS 双产物打包 |

**通信架构**：渲染进程 → `preload.js`（contextBridge 暴露 `window.electronAPI`）→ IPC → 主进程 `main.js` → Node.js fs 完成文件读写/目录浏览/配置存储。

## 三、主要功能

- **文件夹浏览**：打开本地文件夹，树形文件树展示，支持折叠/展开、按名称搜索
- **文件操作**：新建/重命名/删除文件与文件夹，右键菜单操作，拖拽调整
- **多标签编辑**：同时打开多个 Markdown 文件，记录最近打开的文件/文件夹
- **即时渲染（IR）编辑**：基于 Vditor + Lute 引擎，编辑即渲染的 Typora 式体验
- **编辑器配置**：字号、自动保存（可配置延时）等设置项
- **主题切换**：亮色 / 暗色主题
- **预览缩放**：编辑区字号缩放调节（50%–200%，Ctrl+滚轮）
- **窗口状态记忆**：窗口位置大小、侧边栏宽度等偏好持久化（localStorage + 应用配置文件）
- **打包分发**：Windows portable 单文件 exe 与 NSIS 安装包双产物

## 四、开发与构建

```bash
npm install              # 安装依赖
npm run dev              # 仅启动 Vite 开发服务器（浏览器调试）
npm run electron:dev     # 启动 Electron 开发模式（热更新）
npm run build            # 构建前端产物
npm run electron:build   # 打包 Windows 双产物（输出至 dist_electron/）
```

### 应用图标

修改图标后重新生成（256×256 正方形 png + ico）：

```bash
npm i -D sharp png-to-ico
node scripts/make-icon.js <源png路径>    # 生成 assets/icon.png
npx png-to-ico assets/icon.png > assets/icon.ico
npm rm sharp png-to-ico
```
