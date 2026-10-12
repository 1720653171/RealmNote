<template>
  <v-app-bar density="comfortable" elevation="1">
    <!-- 文件菜单 -->
    <v-menu offset-y>
      <template v-slot:activator="{ props }">
        <v-btn variant="text" v-bind="props">
          <v-icon start>mdi-file-outline</v-icon>
          文件
        </v-btn>
      </template>
      <v-list density="compact">
        <v-list-item @click="onOpenFolder">
          <template v-slot:prepend>
            <v-icon>mdi-folder-open</v-icon>
          </template>
          <v-list-item-title>打开文件夹</v-list-item-title>
        </v-list-item>
        <v-list-item @click="onNewFile" :disabled="!fileStore.currentFolder">
          <template v-slot:prepend>
            <v-icon>mdi-file-plus</v-icon>
          </template>
          <v-list-item-title>新建文件</v-list-item-title>
        </v-list-item>
        <v-divider />
        <v-list-item @click="onSave" :disabled="!fileStore.activeFile">
          <template v-slot:prepend>
            <v-icon>mdi-content-save</v-icon>
          </template>
          <v-list-item-title>保存</v-list-item-title>
        </v-list-item>
        <v-list-item @click="onSaveAs" :disabled="!fileStore.activeFile">
          <template v-slot:prepend>
            <v-icon>mdi-content-save-edit</v-icon>
          </template>
          <v-list-item-title>另存为</v-list-item-title>
        </v-list-item>
        <v-divider />
        <v-list-item @click="onOpenSettings">
          <template v-slot:prepend>
            <v-icon>mdi-cog</v-icon>
          </template>
          <v-list-item-title>设置</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- 应用标题和当前文件夹名称 -->
    <v-toolbar-title class="ml-2">
      <span class="app-title">简域</span>
      <span v-if="fileStore.currentFolder" class="folder-name">
        <v-icon size="16" class="mx-1">mdi-chevron-right</v-icon>
        {{ folderDisplayName }}
      </span>
    </v-toolbar-title>

    <v-spacer />

    <!-- 快捷操作按钮 -->
    <v-tooltip text="刷新（从磁盘重新加载当前文件）" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
          icon
          variant="text"
          v-bind="props"
          :disabled="!fileStore.activeFile"
          @click="onReload"
        >
          <v-icon>mdi-refresh</v-icon>
        </v-btn>
      </template>
    </v-tooltip>

    <v-tooltip text="保存 (Ctrl+S)" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
          icon
          variant="text"
          v-bind="props"
          :disabled="!fileStore.activeFile"
          @click="onSave"
        >
          <v-icon>mdi-content-save</v-icon>
        </v-btn>
      </template>
    </v-tooltip>

    <!-- 快捷键设置按钮 -->
    <v-tooltip text="快捷键设置" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn icon variant="text" v-bind="props" @click="shortcutsDialogVisible = true">
          <v-icon>mdi-keyboard</v-icon>
        </v-btn>
      </template>
    </v-tooltip>

    <!-- 主题切换按钮 -->
    <v-tooltip :text="themeTooltip" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn icon variant="text" v-bind="props" @click="onToggleTheme">
          <v-icon>{{ themeIcon }}</v-icon>
        </v-btn>
      </template>
    </v-tooltip>

    <!-- 设置按钮 -->
    <v-tooltip text="设置" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn icon variant="text" v-bind="props" @click="onOpenSettings">
          <v-icon>mdi-cog</v-icon>
        </v-btn>
      </template>
    </v-tooltip>

    <!-- 设置对话框 -->
    <SettingsDialog v-model="settingsDialogVisible" />

    <!-- 快捷键设置对话框 -->
    <ShortcutDialog v-model="shortcutsDialogVisible" />
  </v-app-bar>
</template>

<script setup>
import { inject, ref, computed } from 'vue'
import SettingsDialog from './SettingsDialog.vue'
import ShortcutDialog from './ShortcutDialog.vue'

// ============ Inject ============

/** @type {import('@/stores/fileStore').ReturnType<typeof useFileStore>} */
const fileStore = inject('fileStore')

/** @type {import('@/stores/settingsStore').ReturnType<typeof useSettingsStore>} */
const settingsStore = inject('settingsStore')

// ============ Data ============

/** 设置对话框是否可见 */
const settingsDialogVisible = ref(false)

/** 快捷键设置对话框是否可见 */
const shortcutsDialogVisible = ref(false)

// ============ Computed ============

/** 当前文件夹显示名称 */
const folderDisplayName = computed(() => {
  const path = fileStore?.currentFolder || ''
  if (!path) return ''
  // 提取文件夹名称（最后一个路径分隔符后的部分）
  const separator = path.includes('\\') ? '\\' : '/'
  const parts = path.split(separator)
  return parts[parts.length - 1] || path
})

/** 当前主题图标 */
const themeIcon = computed(() => {
  return settingsStore?.theme === 'dark' ? 'mdi-moon-waning-crescent' : 'mdi-white-balance-sunny'
})

/** 主题切换提示文本 */
const themeTooltip = computed(() => {
  return settingsStore?.theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'
})

// ============ Methods ============

/**
 * 打开文件夹
 */
async function onOpenFolder() {
  if (fileStore) {
    const result = await fileStore.openFolder()
    if (result.success && settingsStore) {
      settingsStore.addRecentFolder(fileStore.currentFolder)
    }
  }
}

/**
 * 新建文件
 */
function onNewFile() {
  // TODO: 实现新建文件对话框
  console.log('新建文件')
}

/**
 * 保存当前文件
 */
async function onSave() {
  if (fileStore && fileStore.activeFile) {
    const result = await fileStore.saveFile()
    if (!result.success) {
      console.error('保存文件失败:', result.error)
      // TODO: 显示错误提示
    }
  }
}

/**
 * 另存为
 */
function onSaveAs() {
  // TODO: 实现另存为对话框
  console.log('另存为')
}

/**
 * 从磁盘重新加载当前文件
 */
async function onReload() {
  if (fileStore && fileStore.activeFile) {
    const result = await fileStore.reloadFile(fileStore.activeFilePath)
    if (!result.success) {
      console.error('刷新文件失败:', result.error)
    }
  }
}

/**
 * 切换主题
 */
function onToggleTheme() {
  if (settingsStore) {
    settingsStore.toggleTheme()
  }
}

/**
 * 打开设置对话框
 */
function onOpenSettings() {
  settingsDialogVisible.value = true
}
</script>

<style scoped>
.app-title {
  font-weight: 600;
  letter-spacing: 0.5px;
}

.folder-name {
  color: rgba(0, 0, 0, 0.6);
  font-weight: 400;
  font-size: 14px;
}

/* 暗色主题适配 */
:deep(.v-theme--dark) .folder-name {
  color: rgba(255, 255, 255, 0.6);
}
</style>
