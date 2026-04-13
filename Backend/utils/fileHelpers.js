import fs from 'fs-extra'
import path from 'path'

/**
 * Calculates total size of a directory recursively.
 */
export async function getDirSize(dirPath) {
  let size = 0
  const items = await fs.readdir(dirPath, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name)
    if (item.isDirectory()) {
      size += await getDirSize(fullPath)
    } else {
      const stats = await fs.stat(fullPath)
      size += stats.size
    }
  }
  return size
}

/**
 * Scans directory and returns tree structure.
 */
export async function scanDirectory(dir, basePath) {
  const results = []
  const items = await fs.readdir(dir, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    const relPath = path.relative(basePath, fullPath).replace(/\\/g, '/')
    if (item.isDirectory()) {
      results.push({
        name: item.name,
        path: relPath,
        type: 'folder',
        children: await scanDirectory(fullPath, basePath)
      })
    } else {
      results.push({
        name: item.name,
        path: relPath,
        type: 'file'
      })
    }
  }
  return results
}
