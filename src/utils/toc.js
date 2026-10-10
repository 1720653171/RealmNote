/**
 * 将标题文本转换为合法的 HTML 锚点 ID（slug）
 * 规则：小写 → 保留中文/字母/数字/空格/连字符 → 空格转连字符 → 合并连字符 → 去首尾连字符
 * @param {string} text - 标题文本
 * @returns {string} slug 化后的 ID
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿\s-]/g, '')  // 移除特殊字符，保留中文、字母、数字、空格、连字符
    .replace(/\s+/g, '-')                     // 空格替换为连字符
    .replace(/-+/g, '-')                      // 合并连续连字符
    .replace(/^-+|-+$/g, '')                  // 去除首尾连字符
}

/**
 * 从 Markdown 源文本中提取所有标题
 * @param {string} content - Markdown 源文本
 * @returns {Array<{id: string, text: string, level: number, line: number}>} 标题列表（扁平结构）
 */
export function extractHeadings(content) {
  if (!content || typeof content !== 'string') {
    return []
  }

  const lines = content.split('\n')
  const headingRegex = /^(#{1,6})\s+(.+)$/
  const idCounts = new Map()
  const headings = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headingRegex)
    if (!match) continue

    const level = match[1].length
    const text = match[2].trim()
    let id = slugify(text)

    // 处理重复标题：追加 -2, -3 等后缀
    if (idCounts.has(id)) {
      const count = idCounts.get(id) + 1
      idCounts.set(id, count)
      id = `${id}-${count}`
    } else {
      idCounts.set(id, 1)
    }

    headings.push({
      id,
      text,
      level,
      line: i + 1   // 行号从 1 开始
    })
  }

  return headings
}

export default {
  slugify,
  extractHeadings
}
