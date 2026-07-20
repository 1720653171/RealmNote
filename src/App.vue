<template>
  <v-app :theme="settingsStore.theme">
    <!-- 顶部工具栏 -->
    <MainToolbar />

    <!-- 主内容区域 -->
    <v-main class="main-content">
      <div class="layout-container">
        <!-- 左侧侧边栏 -->
        <Sidebar
          v-model="sidebarVisible"
          :width="settingsStore.sidebarWidth"
          @update:width="onSidebarResize"
          @file-select="onFileSelect"
        />

        <!-- 右侧主区域 -->
        <div class="main-area">
          <!-- 标签页栏 -->
          <TabBar />

          <!-- 编辑器区域 -->
          <div class="editor-area">
            <!-- 有打开的文件时显示编辑器 -->
            <MarkdownEditor
              v-if="fileStore.activeFile"
              ref="editorRef"
              :content="fileStore.activeFileContent"
              :theme="settingsStore.theme"
              :mode="settingsStore.editMode"
              :font-size="settingsStore.fontSize"
              :modified="fileStore.isActiveFileModified"
              @update:content="onContentUpdate"
              @update:mode="onModeChange"
              @save="onSave"
              @theme-change="onThemeChange"
            />

            <!-- 无打开文件时显示欢迎页面 -->
            <div v-else class="welcome-page">
              <div class="welcome-content">
                <div class="welcome-icon">
                  <v-icon size="80" color="primary">mdi-language-markdown</v-icon>
                </div>
                <h1 class="welcome-title">Markdown Editor</h1>
                <p class="welcome-subtitle">一个简洁优雅的 Markdown 编辑器</p>

                <!-- 快捷操作 -->
                <div class="quick-actions">
                  <v-btn
                    color="primary"
                    size="large"
                    variant="elevated"
                    prepend-icon="mdi-folder-open"
                    @click="onOpenFolder"
                  >
                    打开文件夹
                  </v-btn>

                  <v-btn
                    v-if="settingsStore.recentFolders.length > 0"
                    size="large"
                    variant="outlined"
                    prepend-icon="mdi-history"
                    class="ml-4"
                  >
                    最近打开
                    <v-menu activator="parent" location="bottom start">
                      <v-list density="compact">
                        <v-list-item
                          v-for="folder in settingsStore.recentFolders.slice(0, 5)"
                          :key="folder"
                          @click="onOpenRecentFolder(folder)"
                        >
                          <template #prepend>
                            <v-icon>mdi-folder</v-icon>
                          </template>
                          <v-list-item-title>{{ getFolderName(folder) }}</v-list-item-title>
                          <v-list-item-subtitle class="text-truncate" style="max-width: 300px;">
                            {{ folder }}
                          </v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                  </v-btn>
                </div>

                <!-- 功能特性 -->
                <div class="features">
                  <div class="feature-item">
                    <v-icon color="primary">mdi-file-document-edit</v-icon>
                    <span>实时预览</span>
                  </div>
                  <div class="feature-item">
                    <v-icon color="primary">mdi-palette</v-icon>
                    <span>深色/浅色主题</span>
                  </div>
                  <div class="feature-item">
                    <v-icon color="primary">mdi-view-split-vertical</v-icon>
                    <span>多种编辑模式</span>
                  </div>
                  <div class="feature-item">
                    <v-icon color="primary">mdi-star</v-icon>
                    <span>文件收藏</span>
                  </div>
                </div>

                <!-- 快捷键提示 -->
                <div class="shortcuts-hint">
                  <p class="hint-title">快捷键</p>
                  <div class="shortcuts-list">
                    <div class="shortcut-item">
                      <kbd>Ctrl</kbd> + <kbd>O</kbd>
                      <span>打开文件夹</span>
                    </div>
                    <div class="shortcut-item">
                      <kbd>Ctrl</kbd> + <kbd>S</kbd>
                      <span>保存文件</span>
                    </div>
                    <div class="shortcut-item">
                      <kbd>Ctrl</kbd> + <kbd>B</kbd>
                      <span>切换侧边栏</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, provide, onMounted, onUnmounted, nextTick } from 'vue'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import MainToolbar from '@/components/MainToolbar.vue'
import Sidebar from '@/components/Sidebar.vue'
import TabBar from '@/components/TabBar.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

// ============================================================
// Stores 初始化与提供
// ============================================================

/** 文件状态管理 */
const fileStore = useFileStore()

/** 设置状态管理 */
const settingsStore = useSettingsStore()

// 将 stores 提供给子组件使用
provide('fileStore', fileStore)
provide('settingsStore', settingsStore)

// ============================================================
// Refs
// ============================================================

/** MarkdownEditor 组件引用 */
const editorRef = ref(null)

/** 侧边栏是否可见 */
const sidebarVisible = ref(true)

/** 自动保存定时器 ID */
let autoSaveTimer = null

// ============================================================
// 生命周期
// ============================================================

onMounted(() => {
  // 加载用户设置
  settingsStore.loadSettings()

  // 应用主题到 Vuetify
  applyTheme(settingsStore.theme)

  // 注册全局快捷键
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  // 清理事件监听
  window.removeEventListener('keydown', handleGlobalKeydown)

  // 清理自动保存定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
})

// ============================================================
// 方法
// ============================================================

/**
 * 处理文件选择事件
 * @param {Object} fileInfo - 文件信息 { path, name, type }
 */
async function onFileSelect(fileInfo) {
  if (!fileInfo || !fileInfo.path) return

  const result = await fileStore.openFile(fileInfo.path)
  if (result.success) {
    // 添加到最近文件列表
    settingsStore.addRecentFile(fileInfo.path)

    // 聚焦编辑器
    nextTick(() => {
      editorRef.value?.focus()
    })
  } else {
    console.error('打开文件失败:', result.error)
  }
}

/**
 * 处理内容更新事件
 * @param {string} newContent - 新的文件内容
 */
function onContentUpdate(newContent) {
  if (!fileStore.activeFile) return

  fileStore.updateFileContent(fileStore.activeFilePath, newContent)

  // 触发自动保存（如果启用）
  if (settingsStore.autoSave) {
    scheduleAutoSave()
  }
}

/**
 * 处理保存事件
 */
async function onSave() {
  if (!fileStore.activeFile) return

  const result = await fileStore.saveFile()
  if (result.success) {
    // 可选：显示保存成功提示
    console.log('文件已保存:', fileStore.activeFilePath)
  } else {
    console.error('保存失败:', result.error)
  }
}

/**
 * 处理编辑模式变更
 * @param {string} mode - 新的编辑模式
 */
function onModeChange(mode) {
  settingsStore.updateEditMode(mode)
}

/**
 * 处理主题变更
 * @param {string} theme - 新的主题
 */
function onThemeChange(theme) {
  settingsStore.updateTheme(theme)
  applyTheme(theme)
}

/**
 * 应用主题到 Vuetify
 * @param {string} theme - 主题名称 ('light' | 'dark')
 */
function applyTheme(theme) {
  // Vuetify 通过 v-app 的 :theme 属性自动处理
  // 这里可以添加额外的主题相关逻辑
  document.documentElement.setAttribute('data-theme', theme)
}

/**
 * 处理侧边栏宽度调整
 * @param {number} width - 新的宽度
 */
function onSidebarResize(width) {
  settingsStore.updateSidebarWidth(width)
}

/**
 * 打开文件夹
 */
async function onOpenFolder() {
  const result = await fileStore.openFolder()
  if (result.success) {
    settingsStore.addRecentFolder(fileStore.currentFolder)
  }
}

/**
 * 打开最近的文件夹
 * @param {string} folderPath - 文件夹路径
 */
async function onOpenRecentFolder(folderPath) {
  // 直接设置文件夹路径并刷新文件树
  fileStore.currentFolder = folderPath
  await fileStore.refreshTree()
}

/**
 * 从路径中提取文件夹名称
 * @param {string} path - 完整路径
 * @returns {string} 文件夹名称
 */
function getFolderName(path) {
  if (!path) return ''
  const separator = path.includes('\\') ? '\\' : '/'
  const parts = path.split(separator)
  return parts[parts.length - 1] || path
}

/**
 * 安排自动保存
 */
function scheduleAutoSave() {
  // 清除之前的定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }

  // 设置新的定时器
  autoSaveTimer = setTimeout(() => {
    if (fileStore.isActiveFileModified) {
      onSave()
    }
    autoSaveTimer = null
  }, settingsStore.autoSaveDelay)
}

/**
 * 全局快捷键处理
 * @param {KeyboardEvent} event
 */
function handleGlobalKeydown(event) {
  // Ctrl + O: 打开文件夹
  if (event.ctrlKey && event.key === 'o') {
    event.preventDefault()
    onOpenFolder()
    return
  }

  // Ctrl + S: 保存
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault()
    onSave()
    return
  }

  // Ctrl + B: 切换侧边栏
  if (event.ctrlKey && event.key === 'b') {
    event.preventDefault()
    sidebarVisible.value = !sidebarVisible.value
    return
  }
}
</script>

<style>
/* 全局样式 */
html,
body,
#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

/* 主内容区域 */
.main-content {
  height: 100%;
  overflow: hidden;
}

/* 布局容器 */
.layout-container {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* 主区域 */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* 编辑器区域 */
.editor-area {
  flex: 1;
  overflow: hidden;
  background-color: rgb(var(--v-theme-background));
}

/* ============================================================ */
/* 欢迎页面样式 */
/* ============================================================ */

.welcome-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  background-color: rgb(var(--v-theme-background));
}

.welcome-content {
  text-align: center;
  max-width: 600px;
}

.welcome-icon {
  margin-bottom: 24px;
  opacity: 0.8;
}

.welcome-title {
  font-size: 32px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-background));
  margin: 0 0 8px 0;
}

.welcome-subtitle {
  font-size: 16px;
  color: rgba(var(--v-theme-on-background), 0.6);
  margin: 0 0 32px 0;
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  justify-content: center;
  margin-bottom: 40px;
}

/* 功能特性 */
.features {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 40px;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(var(--v-theme-on-background), 0.7);
}

.feature-item .v-icon {
  font-size: 28px;
}

.feature-item span {
  font-size: 14px;
}

/* 快捷键提示 */
.shortcuts-hint {
  padding: 16px;
  background-color: rgba(var(--v-theme-on-background), 0.05);
  border-radius: 8px;
}

.hint-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-background), 0.7);
  margin: 0 0 12px 0;
}

.shortcuts-list {
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-background), 0.6);
}

.shortcut-item kbd {
  display: inline-block;
  padding: 2px 6px;
  font-size: 12px;
  font-family: monospace;
  background-color: rgba(var(--v-theme-on-background), 0.1);
  border-radius: 4px;
  border: 1px solid rgba(var(--v-theme-on-background), 0.15);
}

.shortcut-item span {
  margin-left: 8px;
}

/* ============================================================ */
/* 响应式适配 */
/* ============================================================ */

@media (max-width: 768px) {
  .features {
    gap: 16px;
  }

  .feature-item span {
    font-size: 12px;
  }

  .shortcuts-list {
    gap: 16px;
  }

  .quick-actions {
    flex-direction: column;
    align-items: center;
  }

  .quick-actions .ml-4 {
    margin-left: 0 !important;
    margin-top: 12px;
  }
}
</style>
