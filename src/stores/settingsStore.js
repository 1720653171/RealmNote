import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// 默认设置值
const DEFAULT_SETTINGS = {
  theme: 'light',
  editMode: 'split',
  windowBounds: { x: undefined, y: undefined, width: 1200, height: 800 },
  recentFolders: [],
  recentFiles: [],
  sidebarWidth: 260,
  fontSize: 14,
  autoSave: false,
  autoSaveDelay: 3000,
  showLineNumbers: true,
  wordWrap: true,
  tabSize: 2,
  maxRecentItems: 10
}

// 本地存储键名
const STORAGE_KEY = 'markdown-editor-settings'

/**
 * 设置状态管理 Store
 * 管理应用的所有用户偏好设置，支持持久化到 localStorage
 */
export const useSettingsStore = defineStore('settings', () => {
  // ============ State ============

  /** 主题模式 ('light' | 'dark') */
  const theme = ref(DEFAULT_SETTINGS.theme)

  /** 编辑模式偏好 ('edit' | 'preview' | 'split') */
  const editMode = ref(DEFAULT_SETTINGS.editMode)

  /** 窗口位置和大小 */
  const windowBounds = ref({ ...DEFAULT_SETTINGS.windowBounds })

  /** 最近打开的文件夹列表 */
  const recentFolders = ref([...DEFAULT_SETTINGS.recentFolders])

  /** 最近打开的文件列表 */
  const recentFiles = ref([...DEFAULT_SETTINGS.recentFiles])

  /** 侧边栏宽度 */
  const sidebarWidth = ref(DEFAULT_SETTINGS.sidebarWidth)

  /** 编辑器字体大小 */
  const fontSize = ref(DEFAULT_SETTINGS.fontSize)

  /** 自动保存开关 */
  const autoSave = ref(DEFAULT_SETTINGS.autoSave)

  /** 自动保存延迟（毫秒） */
  const autoSaveDelay = ref(DEFAULT_SETTINGS.autoSaveDelay)

  /** 是否显示行号 */
  const showLineNumbers = ref(DEFAULT_SETTINGS.showLineNumbers)

  /** 是否自动换行 */
  const wordWrap = ref(DEFAULT_SETTINGS.wordWrap)

  /** Tab 缩进大小 */
  const tabSize = ref(DEFAULT_SETTINGS.tabSize)

  /** 最近项目最大保留数量 */
  const maxRecentItems = ref(DEFAULT_SETTINGS.maxRecentItems)

  /** 设置是否已加载 */
  const loaded = ref(false)

  // ============ Actions ============

  /**
   * 从 localStorage 加载设置
   * 启动时调用，恢复用户上次的偏好
   */
  function loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // 逐项赋值，仅覆盖存在的键，保留默认值作为兜底
        if (parsed.theme !== undefined) theme.value = parsed.theme
        if (parsed.editMode !== undefined) editMode.value = parsed.editMode
        if (parsed.windowBounds !== undefined) {
          windowBounds.value = { ...DEFAULT_SETTINGS.windowBounds, ...parsed.windowBounds }
        }
        if (Array.isArray(parsed.recentFolders)) recentFolders.value = parsed.recentFolders
        if (Array.isArray(parsed.recentFiles)) recentFiles.value = parsed.recentFiles
        if (parsed.sidebarWidth !== undefined) sidebarWidth.value = parsed.sidebarWidth
        if (parsed.fontSize !== undefined) fontSize.value = parsed.fontSize
        if (parsed.autoSave !== undefined) autoSave.value = parsed.autoSave
        if (parsed.autoSaveDelay !== undefined) autoSaveDelay.value = parsed.autoSaveDelay
        if (parsed.showLineNumbers !== undefined) showLineNumbers.value = parsed.showLineNumbers
        if (parsed.wordWrap !== undefined) wordWrap.value = parsed.wordWrap
        if (parsed.tabSize !== undefined) tabSize.value = parsed.tabSize
        if (parsed.maxRecentItems !== undefined) maxRecentItems.value = parsed.maxRecentItems
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
    loaded.value = true
  }

  /**
   * 保存设置到 localStorage
   * 将当前所有设置序列化后持久化
   */
  function saveSettings() {
    try {
      const data = {
        theme: theme.value,
        editMode: editMode.value,
        windowBounds: windowBounds.value,
        recentFolders: recentFolders.value,
        recentFiles: recentFiles.value,
        sidebarWidth: sidebarWidth.value,
        fontSize: fontSize.value,
        autoSave: autoSave.value,
        autoSaveDelay: autoSaveDelay.value,
        showLineNumbers: showLineNumbers.value,
        wordWrap: wordWrap.value,
        tabSize: tabSize.value,
        maxRecentItems: maxRecentItems.value
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('保存设置失败:', error)
    }
  }

  /**
   * 更新主题模式
   * @param {string} newTheme - 新主题 ('light' | 'dark')
   */
  function updateTheme(newTheme) {
    if (newTheme === 'light' || newTheme === 'dark') {
      theme.value = newTheme
      saveSettings()
    }
  }

  /**
   * 切换主题（亮色 <-> 暗色）
   */
  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    saveSettings()
  }

  /**
   * 更新编辑模式偏好
   * @param {string} mode - 编辑模式 ('edit' | 'preview' | 'split')
   */
  function updateEditMode(mode) {
    if (['edit', 'preview', 'split'].includes(mode)) {
      editMode.value = mode
      saveSettings()
    }
  }

  /**
   * 更新窗口位置和大小
   * @param {Object} bounds - 窗口边界 { x, y, width, height }
   */
  function updateWindowBounds(bounds) {
    windowBounds.value = { ...windowBounds.value, ...bounds }
    saveSettings()
  }

  /**
   * 添加最近打开的文件夹
   * 如果已存在则移到最前面，超过上限则移除最旧的
   * @param {string} folderPath - 文件夹路径
   */
  function addRecentFolder(folderPath) {
    if (!folderPath) return
    // 移除已存在的相同路径
    const index = recentFolders.value.indexOf(folderPath)
    if (index !== -1) {
      recentFolders.value.splice(index, 1)
    }
    // 添加到最前面
    recentFolders.value.unshift(folderPath)
    // 超出上限则移除末尾
    if (recentFolders.value.length > maxRecentItems.value) {
      recentFolders.value.splice(maxRecentItems.value)
    }
    saveSettings()
  }

  /**
   * 添加最近打开的文件
   * 如果已存在则移到最前面，超过上限则移除最旧的
   * @param {string} filePath - 文件路径
   */
  function addRecentFile(filePath) {
    if (!filePath) return
    // 移除已存在的相同路径
    const index = recentFiles.value.indexOf(filePath)
    if (index !== -1) {
      recentFiles.value.splice(index, 1)
    }
    // 添加到最前面
    recentFiles.value.unshift(filePath)
    // 超出上限则移除末尾
    if (recentFiles.value.length > maxRecentItems.value) {
      recentFiles.value.splice(maxRecentItems.value)
    }
    saveSettings()
  }

  /**
   * 从最近文件夹列表中移除指定项
   * @param {string} folderPath - 要移除的文件夹路径
   */
  function removeRecentFolder(folderPath) {
    const index = recentFolders.value.indexOf(folderPath)
    if (index !== -1) {
      recentFolders.value.splice(index, 1)
      saveSettings()
    }
  }

  /**
   * 从最近文件列表中移除指定项
   * @param {string} filePath - 要移除的文件路径
   */
  function removeRecentFile(filePath) {
    const index = recentFiles.value.indexOf(filePath)
    if (index !== -1) {
      recentFiles.value.splice(index, 1)
      saveSettings()
    }
  }

  /**
   * 清空最近文件夹列表
   */
  function clearRecentFolders() {
    recentFolders.value = []
    saveSettings()
  }

  /**
   * 清空最近文件列表
   */
  function clearRecentFiles() {
    recentFiles.value = []
    saveSettings()
  }

  /**
   * 更新侧边栏宽度
   * @param {number} width - 新的侧边栏宽度（像素）
   */
  function updateSidebarWidth(width) {
    if (typeof width === 'number' && width > 0) {
      sidebarWidth.value = width
      saveSettings()
    }
  }

  /**
   * 更新编辑器字体大小
   * @param {number} size - 字体大小（像素）
   */
  function updateFontSize(size) {
    if (typeof size === 'number' && size >= 10 && size <= 32) {
      fontSize.value = size
      saveSettings()
    }
  }

  /**
   * 更新自动保存开关
   * @param {boolean} enabled - 是否启用自动保存
   */
  function updateAutoSave(enabled) {
    autoSave.value = !!enabled
    saveSettings()
  }

  /**
   * 更新自动保存延迟
   * @param {number} delay - 延迟时间（毫秒）
   */
  function updateAutoSaveDelay(delay) {
    if (typeof delay === 'number' && delay >= 1000 && delay <= 30000) {
      autoSaveDelay.value = delay
      saveSettings()
    }
  }

  /**
   * 更新行号显示开关
   * @param {boolean} visible - 是否显示行号
   */
  function updateShowLineNumbers(visible) {
    showLineNumbers.value = !!visible
    saveSettings()
  }

  /**
   * 更新自动换行开关
   * @param {boolean} enabled - 是否启用自动换行
   */
  function updateWordWrap(enabled) {
    wordWrap.value = !!enabled
    saveSettings()
  }

  /**
   * 更新 Tab 缩进大小
   * @param {number} size - 缩进空格数
   */
  function updateTabSize(size) {
    if (typeof size === 'number' && size >= 1 && size <= 8) {
      tabSize.value = size
      saveSettings()
    }
  }

  /**
   * 恢复所有设置为默认值
   */
  function resetToDefaults() {
    theme.value = DEFAULT_SETTINGS.theme
    editMode.value = DEFAULT_SETTINGS.editMode
    windowBounds.value = { ...DEFAULT_SETTINGS.windowBounds }
    recentFolders.value = [...DEFAULT_SETTINGS.recentFolders]
    recentFiles.value = [...DEFAULT_SETTINGS.recentFiles]
    sidebarWidth.value = DEFAULT_SETTINGS.sidebarWidth
    fontSize.value = DEFAULT_SETTINGS.fontSize
    autoSave.value = DEFAULT_SETTINGS.autoSave
    autoSaveDelay.value = DEFAULT_SETTINGS.autoSaveDelay
    showLineNumbers.value = DEFAULT_SETTINGS.showLineNumbers
    wordWrap.value = DEFAULT_SETTINGS.wordWrap
    tabSize.value = DEFAULT_SETTINGS.tabSize
    maxRecentItems.value = DEFAULT_SETTINGS.maxRecentItems
    saveSettings()
  }

  return {
    // State
    theme,
    editMode,
    windowBounds,
    recentFolders,
    recentFiles,
    sidebarWidth,
    fontSize,
    autoSave,
    autoSaveDelay,
    showLineNumbers,
    wordWrap,
    tabSize,
    maxRecentItems,
    loaded,
    // Actions
    loadSettings,
    saveSettings,
    updateTheme,
    toggleTheme,
    updateEditMode,
    updateWindowBounds,
    addRecentFolder,
    addRecentFile,
    removeRecentFolder,
    removeRecentFile,
    clearRecentFolders,
    clearRecentFiles,
    updateSidebarWidth,
    updateFontSize,
    updateAutoSave,
    updateAutoSaveDelay,
    updateShowLineNumbers,
    updateWordWrap,
    updateTabSize,
    resetToDefaults
  }
})
