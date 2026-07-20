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