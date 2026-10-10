/**
 * 浏览器验证模式适配器
 *
 * 在非 Electron 环境（npm run dev + Chrome/Edge）下，提供与 preload.js
 * 暴露的 window.electronAPI 完全同构的接口，底层使用 File System Access API
 * （showDirectoryPicker 等，Chromium 内核浏览器原生支持）实现文件操作，
 * 使应用无需打包即可在浏览器中全功能验证。
 *
 * 路径方案：以用户选择的文件夹为根，伪路径形如 "/<文件夹名>/子目录/文件.md"，
 * 所有目录句柄缓存在 dirHandles 中，文件通过父目录句柄解析。
 */

// 根目录句柄与伪路径
let rootHandle = null
let rootPath = ''

/** 目录句柄缓存：伪路径 -> FileSystemDirectoryHandle */
const dirHandles = new Map()

// ============================================================
// 辅助工具
// ============================================================

/** 确保已选择根目录 */
function ensureRoot() {
  if (!rootHandle) {
    throw new Error('尚未打开文件夹，请先点击"打开文件夹"')
  }
}

/** 规范化伪路径（去尾部斜杠） */
function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '') || '/'
}

/** 拼接子路径 */
function joinPath(parent, name) {
  const base = normalizePath(parent)
  return (base === '/' ? '' : base) + '/' + name
}

/** 拆分为路径段数组 */
function segments(p) {
  return normalizePath(p).split('/').filter(Boolean)
}

/** 获取指定伪路径的目录句柄（必须已注册） */
function getDirHandle(dirPath) {
  const key = normalizePath(dirPath)
  const handle = dirHandles.get(key)
  if (!handle) {
    throw new Error(`目录句柄不存在: ${key}`)
  }
  return handle
}

/** 请求读写权限（首次打开目录时调用） */
async function ensurePermission(handle) {
  if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    await handle.requestPermission({ mode: 'readwrite' })
  }
}

/** 判断错误是否为"用户取消选择" */
function isAbortError(error) {
  return error && (error.name === 'AbortError' || error.name === 'NotAllowedError')
}

// ============================================================
// 适配器工厂
// ============================================================

export function createBrowserAPI() {
  if (typeof window.showDirectoryPicker !== 'function') {
    console.warn(
      '[browserAPI] 当前浏览器不支持 File System Access API，' +
      '请使用 Chrome / Edge 等 Chromium 内核浏览器进行验证'
    )
  }

  return {
    /** 是否浏览器验证模式（供 UI 判断展示提示） */
    __isBrowserMode: true,

    // ---------------- 文件夹选择 ----------------

    /**
     * 打开文件夹：弹出系统目录选择器
     * @returns {Promise<string|null>} 根伪路径，取消返回 null
     */
    openFolderDialog: async () => {
      if (typeof window.showDirectoryPicker !== 'function') {
        throw new Error('当前浏览器不支持目录选择，请使用 Chrome / Edge')
      }
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
        await ensurePermission(handle)
        rootHandle = handle
        rootPath = '/' + handle.name
        dirHandles.clear()
        dirHandles.set(rootPath, handle)
        return rootPath
      } catch (error) {
        if (isAbortError(error)) return null
        throw error
      }
    },

    // ---------------- 文件读写 ----------------

    /**
     * 读取文本文件
     * @returns {Promise<{success: boolean, content?: string, error?: string}>}
     */
    readFile: async (filePath) => {
      try {
        ensureRoot()
        const segs = segments(filePath)
        const name = segs.pop()
        const parent = getDirHandle('/' + segs.join('/'))
        const fileHandle = await parent.getFileHandle(name)
        const file = await fileHandle.getFile()
        return { success: true, content: await file.text() }
      } catch (error) {
        return { success: false, error: error.message }
      }
    },

    /**
     * 写入文本文件（不存在则创建）
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    writeFile: async (filePath, content) => {
      try {
        ensureRoot()
        const segs = segments(filePath)
        const name = segs.pop()
        const parent = getDirHandle('/' + segs.join('/'))
        const fileHandle = await parent.getFileHandle(name, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(content ?? '')
        await writable.close()
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    },

    // ---------------- 目录操作 ----------------

    /**
     * 读取目录（单层，返回与主进程 read-dir 一致的结构）
     * @returns {Promise<{success: boolean, files?: Array, error?: string}>}
     */
    readDir: async (dirPath) => {
      try {
        ensureRoot()
        const handle = getDirHandle(dirPath)
        const files = []
        for await (const entry of handle.values()) {
          const isDirectory = entry.kind === 'directory'
          files.push({
            name: entry.name,
            isDirectory,
            isFile: entry.kind === 'file',
            path: joinPath(dirPath, entry.name)
          })
          // 注册子目录句柄，供后续读写使用
          if (isDirectory) {
            dirHandles.set(joinPath(dirPath, entry.name), entry)
          }
        }
        return { success: true, files }
      } catch (error) {
        return { success: false, error: error.message }
      }
    },

    /**
     * 创建目录（支持递归创建）
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    mkdir: async (dirPath) => {
      try {
        ensureRoot()
        const segs = segments(dirPath)
        // 从根开始逐段创建；段数超出已注册深度时基于最近的可解析父级
        let current = '/' + segs[0]
        if (!dirHandles.has(current)) {
          throw new Error('目录不在已打开的文件夹内: ' + dirPath)
        }
        let handle = dirHandles.get(current)
        for (let i = 1; i < segs.length; i++) {
          current = joinPath(current, segs[i])
          handle = await handle.getDirectoryHandle(segs[i], { create: true })
          dirHandles.set(current, handle)
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    },

    /**
     * 删除文件或目录（目录递归删除）
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    unlink: async (filePath) => {
      try {
        ensureRoot()
        const segs = segments(filePath)
        const name = segs.pop()
        const parent = getDirHandle('/' + segs.join('/'))
        await parent.removeEntry(name, { recursive: true })
        // 清理句柄缓存中被删除的子路径
        const prefix = normalizePath(filePath) + '/'
        for (const key of [...dirHandles.keys()]) {
          if (key === normalizePath(filePath) || key.startsWith(prefix)) {
            dirHandles.delete(key)
          }
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    },

    /**
     * 重命名/移动（File System Access API 无原生 rename，采用复制+删除实现）
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    rename: async (oldPath, newPath) => {
      try {
        ensureRoot()
        const oldSegs = segments(oldPath)
        const oldName = oldSegs.pop()
        const oldParent = getDirHandle('/' + oldSegs.join('/'))
        const newSegs = segments(newPath)
        const newName = newSegs.pop()
        const newParent = getDirHandle('/' + newSegs.join('/'))

        const oldEntry = await oldParent.getFileHandle(oldName).catch(() => null)
        if (oldEntry) {
          // 文件：读出内容写入新路径
          const file = await oldEntry.getFile()
          const content = await file.text()
          const newFileHandle = await newParent.getFileHandle(newName, { create: true })
          const writable = await newFileHandle.createWritable()
          await writable.write(content)
          await writable.close()
          await oldParent.removeEntry(oldName)
        } else {
          // 目录：递归复制后删除
          const oldDir = getDirHandle(oldPath)
          const newDir = await newParent.getDirectoryHandle(newName, { create: true })
          dirHandles.set(newPath, newDir)
          for await (const entry of oldDir.values()) {
            const childOld = joinPath(oldPath, entry.name)
            const childNew = joinPath(newPath, entry.name)
            const r = await this.rename(childOld, childNew)
            if (!r.success) throw new Error(r.error)
          }
          await oldParent.removeEntry(oldName, { recursive: true })
        }
        dirHandles.delete(normalizePath(oldPath))
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    },

    // ---------------- 状态查询 ----------------

    /**
     * 获取文件/目录状态
     * @returns {Promise<{success: boolean, stats?: object, error?: string}>}
     */
    stat: async (filePath) => {
      try {
        ensureRoot()
        const segs = segments(filePath)
        const name = segs.pop()
        const parent = getDirHandle('/' + segs.join('/'))
        try {
          const fileHandle = await parent.getFileHandle(name)
          const file = await fileHandle.getFile()
          return {
            success: true,
            stats: {
              size: file.size,
              isDirectory: false,
              isFile: true,
              mtime: new Date(file.lastModified),
              birthtime: new Date(file.lastModified)
            }
          }
        } catch (e) {
          // 非文件则尝试目录
          const dirHandle = await parent.getDirectoryHandle(name)
          return {
            success: true,
            stats: {
              size: 0,
              isDirectory: true,
              isFile: false,
              mtime: new Date(0),
              birthtime: new Date(0)
            },
            _handle: dirHandle
          }
        }
      } catch (error) {
        return { success: false, error: error.message }
      }
    },

    /**
     * 判断路径是否存在
     * @returns {Promise<boolean>}
     */
    exists: async (filePath) => {
      try {
        ensureRoot()
        const segs = segments(filePath)
        const name = segs.pop()
        const parent = getDirHandle('/' + segs.join('/'))
        await parent.getFileHandle(name).catch(() => parent.getDirectoryHandle(name))
        return true
      } catch (error) {
        return false
      }
    },

    // ---------------- 应用配置 ----------------

    /** 读取应用配置（浏览器模式存于 localStorage） */
    getConfig: async () => {
      try {
        return JSON.parse(localStorage.getItem('realmnote-browser-config') || '{}')
      } catch (error) {
        return {}
      }
    },

    /** 保存应用配置 */
    saveConfig: async (config) => {
      try {
        localStorage.setItem('realmnote-browser-config', JSON.stringify(config || {}))
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    },

    // ---------------- 事件监听（浏览器模式下菜单不可用，空实现） ----------------

    onFolderOpened: () => {},

    removeFolderOpenedListener: () => {}
  }
}
