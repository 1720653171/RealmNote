import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  openFolderDialog,
  readDirectoryRecursive,
  readFileContent,
  saveFileContent,
  createFile as fsCreateFile,
  createFolder as fsCreateFolder,
  deleteFile as fsDeleteFile,
  renameFile as fsRenameFile,
  getFileName,
  getFileType
} from '@/utils/fileSystem'

/**
 * 文件状态管理 Store
 * 管理文件树、打开的文件标签页、书签等文件相关状态
 */
export const useFileStore = defineStore('file', () => {
  // ============ State ============

  /** 当前打开的文件夹路径 */
  const currentFolder = ref('')

  /** 文件树数据（根节点） */
  const fileTree = ref(null)

  /** 已打开的文件列表，每项包含 { path, name, content, type, originalContent } */
  const openFiles = ref([])

  /** 当前激活的文件索引（对应 openFiles 数组下标），-1 表示无激活文件 */
  const activeFileIndex = ref(-1)

  /** 已修改但未保存的文件路径集合 */
  const modifiedFiles = ref(new Set())

  /** 已收藏/书签的文件路径集合 */
  const bookmarkedFiles = ref(new Set())

  /** 文件树是否正在加载 */
  const loading = ref(false)

  // ============ Getters ============

  /** 当前激活的文件对象 */
  const activeFile = computed(() => {
    const index = activeFileIndex.value
    if (index >= 0 && index < openFiles.value.length) {
      return openFiles.value[index]
    }
    return null
  })

  /** 当前激活的文件路径 */
  const activeFilePath = computed(() => {
    return activeFile.value?.path || ''
  })

  /** 当前激活的文件内容 */
  const activeFileContent = computed(() => {
    return activeFile.value?.content || ''
  })

  /** 当前激活的文件是否已修改 */
  const isActiveFileModified = computed(() => {
    return activeFile.value ? modifiedFiles.value.has(activeFile.value.path) : false
  })

  /** 是否有已修改未保存的文件 */
  const hasModifiedFiles = computed(() => {
    return modifiedFiles.value.size > 0
  })

  /** 已修改文件的路径列表 */
  const modifiedFilePaths = computed(() => {
    return Array.from(modifiedFiles.value)
  })

  /** 已打开文件的路径列表 */
  const openFilePaths = computed(() => {
    return openFiles.value.map(f => f.path)
  })

  // ============ Actions ============

  /**
   * 打开文件夹选择对话框并加载文件树
   * 成功后更新 currentFolder 和 fileTree
   */
  async function openFolder() {
    const result = await openFolderDialog()
    if (!result.success) {
      console.error('[fileStore] 打开文件夹失败:', result.error)
      return { success: false, error: result.error }
    }

    const folderPath = result.data
    if (!folderPath) {
      // 用户取消了选择
      return { success: false, error: '用户取消选择' }
    }

    currentFolder.value = folderPath
    return await refreshTree()
  }

  /**
   * 刷新当前文件夹的文件树
   * 重新读取目录结构并更新 fileTree
   */
  async function refreshTree() {
    if (!currentFolder.value) {
      return { success: false, error: '未打开任何文件夹' }
    }

    loading.value = true
    try {
      const result = await readDirectoryRecursive(currentFolder.value)
      if (result.success) {
        fileTree.value = result.data
        return { success: true }
      } else {
        console.error('[fileStore] 刷新文件树失败:', result.error)
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('[fileStore] 刷新文件树异常:', error)
      return { success: false, error: error.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * 打开指定路径的文件
   * 读取文件内容并添加到 openFiles 列表中，同时激活该标签
   * @param {string} filePath - 文件路径
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function openFile(filePath) {
    if (!filePath) {
      return { success: false, error: '文件路径不能为空' }
    }

    // 检查文件是否已经打开
    const existingIndex = openFiles.value.findIndex(f => f.path === filePath)
    if (existingIndex !== -1) {
      // 已打开，直接切换到该标签
      activeFileIndex.value = existingIndex
      return { success: true }
    }

    // 读取文件内容
    const result = await readFileContent(filePath)
    if (!result.success) {
      console.error('[fileStore] 打开文件失败:', result.error)
      return { success: false, error: result.error }
    }

    const content = result.data
    const fileName = getFileName(filePath)
    const fileType = getFileType(filePath)

    // 添加到打开文件列表
    const fileItem = {
      path: filePath,
      name: fileName,
      content: content,
      type: fileType,
      originalContent: content
    }
    openFiles.value.push(fileItem)

    // 激活新打开的文件标签
    activeFileIndex.value = openFiles.value.length - 1

    return { success: true }
  }

  /**
   * 关闭指定索引的文件标签
   * @param {number} index - 文件在 openFiles 中的索引
   * @returns {{success: boolean, unsaved?: boolean, error?: string}}
   */
  function closeFile(index) {
    if (index < 0 || index >= openFiles.value.length) {
      return { success: false, error: '无效的文件索引' }
    }

    const file = openFiles.value[index]

    // 检查文件是否已修改未保存
    if (modifiedFiles.value.has(file.path)) {
      return { success: false, unsaved: true, error: '文件已修改未保存' }
    }

    // 从列表中移除
    openFiles.value.splice(index, 1)

    // 调整激活文件索引
    if (openFiles.value.length === 0) {
      activeFileIndex.value = -1
    } else if (activeFileIndex.value >= openFiles.value.length) {
      // 当前激活的标签被关闭且是最后一个，切换到前一个
      activeFileIndex.value = openFiles.value.length - 1
    } else if (activeFileIndex.value > index) {
      // 关闭的标签在激活标签之前，索引需要减一
      activeFileIndex.value--
    }
    // 如果关闭的标签在激活标签之后，activeFileIndex 不变

    return { success: true }
  }

  /**
   * 保存指定文件的内容到磁盘
   * @param {number} [index] - 文件索引，默认为当前激活文件
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function saveFile(index) {
    const fileIndex = index !== undefined ? index : activeFileIndex.value
    if (fileIndex < 0 || fileIndex >= openFiles.value.length) {
      return { success: false, error: '无效的文件索引' }
    }

    const file = openFiles.value[fileIndex]
    const result = await saveFileContent(file.path, file.content)
    if (!result.success) {
      console.error('[fileStore] 保存文件失败:', result.error)
      return { success: false, error: result.error }
    }

    // 更新原始内容，标记为未修改
    file.originalContent = file.content
    modifiedFiles.value.delete(file.path)

    return { success: true }
  }

  /**
   * 更新指定文件的内容（编辑器内容变化时调用）
   * @param {string} filePath - 文件路径
   * @param {string} newContent - 新的文件内容
   */
  function updateFileContent(filePath, newContent) {
    const file = openFiles.value.find(f => f.path === filePath)
    if (!file) return

    file.content = newContent

    // 判断内容是否与原始内容不同，更新修改状态
    if (newContent !== file.originalContent) {
      modifiedFiles.value.add(filePath)
    } else {
      modifiedFiles.value.delete(filePath)
    }
  }

  /**
   * 切换文件的收藏/书签状态
   * @param {string} filePath - 文件路径
   */
  function toggleBookmark(filePath) {
    if (bookmarkedFiles.value.has(filePath)) {
      bookmarkedFiles.value.delete(filePath)
    } else {
      bookmarkedFiles.value.add(filePath)
    }
  }

  /**
   * 在指定目录下创建新文件
   * @param {string} parentPath - 父目录路径
   * @param {string} fileName - 新文件名
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  async function createFile(parentPath, fileName) {
    const result = await fsCreateFile(parentPath, fileName)
    if (!result.success) {
      return { success: false, error: result.error }
    }

    // 刷新文件树以反映新文件
    await refreshTree()

    return { success: true, path: result.data }
  }

  /**
   * 在指定目录下创建新文件夹
   * @param {string} parentPath - 父目录路径
   * @param {string} folderName - 新文件夹名
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  async function createFolder(parentPath, folderName) {
    const result = await fsCreateFolder(parentPath, folderName)
    if (!result.success) {
      return { success: false, error: result.error }
    }

    // 刷新文件树以反映新文件夹
    await refreshTree()

    return { success: true, path: result.data }
  }

  /**
   * 删除指定文件或文件夹
   * 如果该文件已打开，则先关闭对应标签
   * @param {string} filePath - 文件/文件夹路径
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function deleteFile(filePath) {
    const result = await fsDeleteFile(filePath)
    if (!result.success) {
      return { success: false, error: result.error }
    }

    // 如果删除的文件已打开，关闭对应标签
    const openIndex = openFiles.value.findIndex(f => f.path === filePath)
    if (openIndex !== -1) {
      // 强制关闭，不检查是否修改（已删除无法保存）
      modifiedFiles.value.delete(filePath)
      openFiles.value.splice(openIndex, 1)
      // 调整 activeFileIndex
      if (openFiles.value.length === 0) {
        activeFileIndex.value = -1
      } else if (activeFileIndex.value >= openFiles.value.length) {
        activeFileIndex.value = openFiles.value.length - 1
      } else if (activeFileIndex.value > openIndex) {
        activeFileIndex.value--
      }
    }

    // 从书签中移除
    bookmarkedFiles.value.delete(filePath)
    // 从修改列表中移除
    modifiedFiles.value.delete(filePath)

    // 刷新文件树
    await refreshTree()

    return { success: true }
  }

  /**
   * 重命名文件或文件夹
   * 如果该文件已打开，更新标签中的路径和名称
   * @param {string} filePath - 原文件路径
   * @param {string} newName - 新名称
   * @returns {Promise<{success: boolean, newPath?: string, error?: string}>}
   */
  async function renameFile(filePath, newName) {
    const result = await fsRenameFile(filePath, newName)
    if (!result.success) {
      return { success: false, error: result.error }
    }

    const newPath = result.data

    // 如果重命名的文件已打开，更新标签信息
    const openFile = openFiles.value.find(f => f.path === filePath)
    if (openFile) {
      openFile.path = newPath
      openFile.name = getFileName(newPath)
      openFile.type = getFileType(newPath)

      // 更新修改状态中的路径
      if (modifiedFiles.value.has(filePath)) {
        modifiedFiles.value.delete(filePath)
        modifiedFiles.value.add(newPath)
      }
    }

    // 更新书签中的路径
    if (bookmarkedFiles.value.has(filePath)) {
      bookmarkedFiles.value.delete(filePath)
      bookmarkedFiles.value.add(newPath)
    }

    // 刷新文件树
    await refreshTree()

    return { success: true, newPath }
  }

  /**
   * 切换到指定索引的标签
   * @param {number} index - 目标标签索引
   */
  function switchTab(index) {
    if (index >= 0 && index < openFiles.value.length) {
      activeFileIndex.value = index
    }
  }

  /**
   * 关闭除指定索引外的所有其他标签
   * 未保存的文件会被跳过，不会被强制关闭
   * @param {number} keepIndex - 要保留的标签索引
   */
  function closeOtherTabs(keepIndex) {
    if (keepIndex < 0 || keepIndex >= openFiles.value.length) return

    const keepFile = openFiles.value[keepIndex]
    const toClose = []

    // 收集需要关闭的标签（跳过未保存的）
    for (let i = openFiles.value.length - 1; i >= 0; i--) {
      if (i === keepIndex) continue
      const file = openFiles.value[i]
      if (modifiedFiles.value.has(file.path)) {
        // 未保存的文件跳过
        continue
      }
      toClose.push(i)
    }

    // 从后往前删除，避免索引偏移
    for (const index of toClose) {
      openFiles.value.splice(index, 1)
    }

    // 重新定位保留文件的索引
    const newIndex = openFiles.value.findIndex(f => f.path === keepFile.path)
    if (newIndex !== -1) {
      activeFileIndex.value = newIndex
    }
  }

  /**
   * 关闭所有标签
   * 未保存的文件会被跳过，不会被强制关闭
   */
  function closeAllTabs() {
    // 从后往前遍历，跳过未保存的文件
    for (let i = openFiles.value.length - 1; i >= 0; i--) {
      const file = openFiles.value[i]
      if (modifiedFiles.value.has(file.path)) {
        // 未保存的文件跳过
        continue
      }
      openFiles.value.splice(i, 1)
    }

    // 调整激活索引
    if (openFiles.value.length === 0) {
      activeFileIndex.value = -1
    } else {
      // 激活第一个剩余标签
      activeFileIndex.value = 0
    }
  }

  /**
   * 强制关闭指定索引的文件（不检查是否修改）
   * 用于用户确认放弃修改后的场景
   * @param {number} index - 文件索引
   */
  function forceCloseFile(index) {
    if (index < 0 || index >= openFiles.value.length) return

    const file = openFiles.value[index]
    modifiedFiles.value.delete(file.path)
    openFiles.value.splice(index, 1)

    if (openFiles.value.length === 0) {
      activeFileIndex.value = -1
    } else if (activeFileIndex.value >= openFiles.value.length) {
      activeFileIndex.value = openFiles.value.length - 1
    } else if (activeFileIndex.value > index) {
      activeFileIndex.value--
    }
  }

  /**
   * 关闭当前文件夹，清空所有文件相关状态
   */
  function closeFolder() {
    currentFolder.value = ''
    fileTree.value = null
    openFiles.value = []
    activeFileIndex.value = -1
    modifiedFiles.value.clear()
    // 保留书签，因为书签可能跨文件夹
  }

  return {
    // State
    currentFolder,
    fileTree,
    openFiles,
    activeFileIndex,
    modifiedFiles,
    bookmarkedFiles,
    loading,

    // Getters
    activeFile,
    activeFilePath,
    activeFileContent,
    isActiveFileModified,
    hasModifiedFiles,
    modifiedFilePaths,
    openFilePaths,

    // Actions
    openFolder,
    refreshTree,
    openFile,
    closeFile,
    saveFile,
    updateFileContent,
    toggleBookmark,
    createFile,
    createFolder,
    deleteFile,
    renameFile,
    switchTab,
    closeOtherTabs,
    closeAllTabs,
    forceCloseFile,
    closeFolder
  }
})
