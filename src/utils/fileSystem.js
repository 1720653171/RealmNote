/**
 * 文件系统操作封装模块
 *
 * 封装 Electron 文件系统 API，提供统一的异步接口供渲染进程使用。
 * 所有操作通过 window.electronAPI（由 preload.js 暴露）与主进程通信。
 */

// ============================================================
// 辅助工具
// ============================================================

/**
 * 获取 Electron API 实例
 * 在非 Electron 环境下返回 null，便于开发时做降级处理
 */
function getAPI() {
  if (window.electronAPI) {
    return window.electronAPI
  }
  console.warn('[fileSystem] electronAPI 不可用，当前可能运行在浏览器环境')
  return null
}

/**
 * 统一错误处理包装器
 * @param {Function} fn - 异步操作函数
 * @param {string} operation - 操作名称，用于错误提示
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function wrapOperation(fn, operation) {
  try {
    const result = await fn()
    return { success: true, data: result }
  } catch (error) {
    console.error(`[fileSystem] ${operation} 失败:`, error)
    return { success: false, error: error.message || `${operation}操作失败` }
  }
}

/**
 * 从路径中提取文件名
 * @param {string} filePath - 文件路径
 * @returns {string} 文件名
 */
export function getFileName(filePath) {
  if (!filePath) return ''
  return filePath.replace(/\\/g, '/').split('/').pop() || ''
}

/**
 * 从路径中提取父目录路径
 * @param {string} filePath - 文件路径
 * @returns {string} 父目录路径
 */
export function getParentPath(filePath) {
  if (!filePath) return ''
  const normalized = filePath.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : ''
}

/**
 * 获取文件扩展名（小写，不含点）
 * @param {string} filePath - 文件路径
 * @returns {string} 扩展名
 */
export function getFileExtension(filePath) {
  if (!filePath) return ''
  const fileName = getFileName(filePath)
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return fileName.substring(dotIndex + 1).toLowerCase()
}

/**
 * 拼接路径片段
 * @param {...string} segments - 路径片段
 * @returns {string} 拼接后的路径
 */
export function joinPath(...segments) {
  return segments.join('/').replace(/\/+/g, '/')
}

// ============================================================
// 文件夹操作
// ============================================================

/**
 * 打开文件夹选择对话框
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function openFolderDialog() {
  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')
    const folderPath = await api.openFolderDialog()
    return folderPath
  }, '打开文件夹')
}

/**
 * 递归读取目录，返回树形结构数据
 * @param {string} dirPath - 目录路径
 * @param {Object} [options] - 选项
 * @param {number} [options.maxDepth=10] - 最大递归深度
 * @param {string[]} [options.excludeDirs=['node_modules', '.git', '.DS_Store']] - 排除的目录名
 * @returns {Promise<{success: boolean, tree?: object, error?: string}>}
 */
export async function readDirectoryRecursive(dirPath, options = {}) {
  const { maxDepth = 10, excludeDirs = ['node_modules', '.git', '.DS_Store', 'dist', 'dist_electron'] } = options

  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')

    async function buildTree(currentPath, depth) {
      if (depth > maxDepth) return null

      const dirResult = await api.readDir(currentPath)
      if (!dirResult.success) {
        throw new Error(dirResult.error)
      }

      const children = []
      // 先文件夹后文件，各自按名称排序
      const sortedFiles = dirResult.files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })

      for (const file of sortedFiles) {
        // 跳过排除的目录
        if (file.isDirectory && excludeDirs.includes(file.name)) {
          continue
        }

        const node = {
          name: file.name,
          path: file.path,
          isDirectory: file.isDirectory,
          isFile: file.isFile,
          extension: file.isFile ? getFileExtension(file.name) : '',
          children: undefined
        }

        if (file.isDirectory) {
          const subTree = await buildTree(file.path, depth + 1)
          if (subTree) {
            node.children = subTree
          }
        }

        children.push(node)
      }

      return children
    }

    // 构建根节点
    const rootName = getFileName(dirPath) || dirPath
    const tree = {
      name: rootName,
      path: dirPath,
      isDirectory: true,
      isFile: false,
      extension: '',
      children: await buildTree(dirPath, 0)
    }

    return tree
  }, '读取目录')
}

// ============================================================
// 文件读写操作
// ============================================================

/**
 * 读取文件内容，自动检测编码
 * @param {string} filePath - 文件路径
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export async function readFileContent(filePath) {
  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')
    const result = await api.readFile(filePath)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result.content
  }, '读取文件')
}

/**
 * 保存文件内容
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveFileContent(filePath, content) {
  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')
    const result = await api.writeFile(filePath, content)
    if (!result.success) {
      throw new Error(result.error)
    }
    return true
  }, '保存文件')
}

// ============================================================
// 文件/文件夹创建操作
// ============================================================

/**
 * 在指定目录下创建新文件
 * @param {string} parentPath - 父目录路径
 * @param {string} fileName - 新文件名
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function createFile(parentPath, fileName) {
  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')

    const newFilePath = joinPath(parentPath, fileName)

    // 检查文件是否已存在
    const exists = await api.exists(newFilePath)
    if (exists) {
      throw new Error(`文件 "${fileName}" 已存在`)
    }

    // 创建空文件
    const result = await api.writeFile(newFilePath, '')
    if (!result.success) {
      throw new Error(result.error)
    }

    return newFilePath
  }, '创建文件')
}

/**
 * 创建新文件夹
 * @param {string} parentPath - 父目录路径
 * @param {string} folderName - 新文件夹名
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function createFolder(parentPath, folderName) {
  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')

    const newFolderPath = joinPath(parentPath, folderName)

    // 检查文件夹是否已存在
    const exists = await api.exists(newFolderPath)
    if (exists) {
      throw new Error(`文件夹 "${folderName}" 已存在`)
    }

    const result = await api.mkdir(newFolderPath)
    if (!result.success) {
      throw new Error(result.error)
    }

    return newFolderPath
  }, '创建文件夹')
}

// ============================================================
// 文件/文件夹删除操作
// ============================================================

/**
 * 删除文件或文件夹（递归删除）
 * @param {string} filePath - 文件/文件夹路径
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteFile(filePath) {
  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')

    const result = await api.unlink(filePath)
    if (!result.success) {
      throw new Error(result.error)
    }

    return true
  }, '删除文件')
}

// ============================================================
// 文件/文件夹重命名操作
// ============================================================

/**
 * 重命名文件或文件夹
 * @param {string} filePath - 原文件路径
 * @param {string} newName - 新名称
 * @returns {Promise<{success: boolean, newPath?: string, error?: string}>}
 */
export async function renameFile(filePath, newName) {
  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')

    const parentPath = getParentPath(filePath)
    const newPath = joinPath(parentPath, newName)

    // 检查新名称是否已存在
    const exists = await api.exists(newPath)
    if (exists && newPath !== filePath.replace(/\\/g, '/')) {
      throw new Error(`"${newName}" 已存在`)
    }

    const result = await api.rename(filePath, newPath)
    if (!result.success) {
      throw new Error(result.error)
    }

    return newPath
  }, '重命名文件')
}

// ============================================================
// 文件移动操作
// ============================================================

/**
 * 移动文件到目标位置
 * @param {string} sourcePath - 源文件路径
 * @param {string} targetPath - 目标路径（含文件名）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function moveFile(sourcePath, targetPath) {
  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')

    // 检查源文件是否存在
    const sourceExists = await api.exists(sourcePath)
    if (!sourceExists) {
      throw new Error('源文件不存在')
    }

    // 检查目标位置是否已存在同名文件
    const targetExists = await api.exists(targetPath)
    if (targetExists) {
      throw new Error('目标位置已存在同名文件')
    }

    const result = await api.rename(sourcePath, targetPath)
    if (!result.success) {
      throw new Error(result.error)
    }

    return true
  }, '移动文件')
}

// ============================================================
// 文件状态查询操作
// ============================================================

/**
 * 获取文件状态信息
 * @param {string} filePath - 文件路径
 * @returns {Promise<{success: boolean, stats?: object, error?: string}>}
 */
export async function getFileStats(filePath) {
  return wrapOperation(async () => {
    const api = getAPI()
    if (!api) throw new Error('electronAPI 不可用')

    const result = await api.stat(filePath)
    if (!result.success) {
      throw new Error(result.error)
    }

    return result.stats
  }, '获取文件状态')
}

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    const api = getAPI()
    if (!api) return false
    return await api.exists(filePath)
  } catch {
    return false
  }
}

// ============================================================
// 文件类型判断
// ============================================================

/** Markdown 文件扩展名集合 */
const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkdn', 'mkd', 'mdwn', 'mdtxt', 'mdtext']

/** 图片文件扩展名集合 */
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico']

/** 代码文件扩展名集合 */
const CODE_EXTENSIONS = [
  'js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'java', 'c', 'cpp', 'h',
  'css', 'scss', 'less', 'html', 'json', 'yaml', 'yml', 'xml',
  'sh', 'bash', 'zsh', 'sql', 'go', 'rs', 'rb', 'php', 'swift'
]

/**
 * 判断是否为 Markdown 文件
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
export function isMarkdownFile(filePath) {
  return MARKDOWN_EXTENSIONS.includes(getFileExtension(filePath))
}

/**
 * 判断是否为图片文件
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
export function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.includes(getFileExtension(filePath))
}

/**
 * 判断是否为代码文件
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
export function isCodeFile(filePath) {
  return CODE_EXTENSIONS.includes(getFileExtension(filePath))
}

/**
 * 根据文件扩展名获取文件类型标识
 * @param {string} filePath - 文件路径
 * @returns {'markdown' | 'image' | 'code' | 'text' | 'unknown'} 文件类型
 */
export function getFileType(filePath) {
  if (isMarkdownFile(filePath)) return 'markdown'
  if (isImageFile(filePath)) return 'image'
  if (isCodeFile(filePath)) return 'code'
  const ext = getFileExtension(filePath)
  if (ext === 'txt') return 'text'
  if (ext) return 'unknown'
  return 'unknown'
}

// ============================================================
// 批量操作
// ============================================================

/**
 * 批量读取多个文件的内容
 * @param {string[]} filePaths - 文件路径数组
 * @returns {Promise<{success: boolean, files?: Object<string, string>, errors?: Object<string, string>}>}
 */
export async function readMultipleFiles(filePaths) {
  const files = {}
  const errors = {}

  const promises = filePaths.map(async (filePath) => {
    const result = await readFileContent(filePath)
    if (result.success) {
      files[filePath] = result.data
    } else {
      errors[filePath] = result.error
    }
  })

  await Promise.all(promises)

  return {
    success: Object.keys(errors).length === 0,
    files,
    errors: Object.keys(errors).length > 0 ? errors : undefined
  }
}

/**
 * 批量保存多个文件
 * @param {Object<string, string>} fileContents - 文件路径到内容的映射
 * @returns {Promise<{success: boolean, errors?: Object<string, string>}>}
 */
export async function saveMultipleFiles(fileContents) {
  const errors = {}

  const promises = Object.entries(fileContents).map(async ([filePath, content]) => {
    const result = await saveFileContent(filePath, content)
    if (!result.success) {
      errors[filePath] = result.error
    }
  })

  await Promise.all(promises)

  return {
    success: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined
  }
}

// ============================================================
// 默认导出
// ============================================================

export default {
  // 文件夹操作
  openFolderDialog,
  readDirectoryRecursive,

  // 文件读写
  readFileContent,
  saveFileContent,

  // 创建操作
  createFile,
  createFolder,

  // 删除操作
  deleteFile,

  // 重命名操作
  renameFile,

  // 移动操作
  moveFile,

  // 状态查询
  getFileStats,
  fileExists,

  // 路径工具
  getFileName,
  getParentPath,
  getFileExtension,
  joinPath,

  // 类型判断
  isMarkdownFile,
  isImageFile,
  isCodeFile,
  getFileType,

  // 批量操作
  readMultipleFiles,
  saveMultipleFiles
}
