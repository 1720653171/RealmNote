/**
 * 应用图标生成脚本
 * 1. 将原始 png 居中缩放至 256x256 正方形（透明背景）→ assets/icon.png
 * 2. 将 icon.png 转换为 assets/icon.ico（electron-builder 使用）
 *
 * 用法：node scripts/make-icon.js <源png路径>
 */
const path = require('path')
const fs = require('fs')

async function main() {
  const src = process.argv[2]
  if (!src || !fs.existsSync(src)) {
    console.error('用法: node scripts/make-icon.js <源png路径>')
    process.exit(1)
  }
  const { default: sharp } = await import('sharp')
  const assets = path.resolve(__dirname, '../assets')
  fs.mkdirSync(assets, { recursive: true })
  const pngPath = path.join(assets, 'icon.png')

  await sharp(src)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(pngPath)
  console.log('已生成:', pngPath)
}

main()
