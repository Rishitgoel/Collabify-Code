import fs from 'fs-extra'
import path from 'path'
import { docs } from 'y-websocket/bin/utils'
import { WORKSPACE_DIR, MAX_FILE_SIZE, MAX_WORKSPACE_SIZE } from '../store/state.js'
import { validatePath } from '../utils/validation.js'
import { getDirSize, scanDirectory } from '../utils/fileHelpers.js'

export default function registerFileHandlers(io, socket) {
  
  const broadcastFileList = async (roomId) => {
    if (!roomId) return 
    const roomPath = path.join(WORKSPACE_DIR, roomId)
    if (fs.existsSync(roomPath)) {
      const tree = await scanDirectory(roomPath, roomPath)
      io.to(roomId).emit('file:refresh', tree)
    }
  }

  socket.on('file:list', async (callback) => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return callback([])
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      if (!fs.existsSync(roomPath)) return callback([])
      const tree = await scanDirectory(roomPath, roomPath)
      callback(tree)
    } catch (err) {
      console.error(err)
      callback([])
    }
  })

  socket.on('file:create', async (filePath, content, callback) => {
    const roomId = socket.data.currentRoom
    if (!roomId) {
      if (callback) callback({ error: 'Not in a room' })
      return
    }
    try {
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      const fullPath = validatePath(roomPath, filePath)
      
      const currentSize = await getDirSize(roomPath)
      const newSize = currentSize + (content ? Buffer.byteLength(content) : 0)
      if (newSize > MAX_WORKSPACE_SIZE) {
        throw new Error('Workspace storage limit reached (500MB).')
      }

      await fs.ensureFile(fullPath)
      if (content !== undefined) {
        if (typeof content === 'string' && content.length > MAX_FILE_SIZE) {
            throw new Error('File size exceeds limit.')
        }
        await fs.writeFile(fullPath, content)
        const roomName = `${roomId}:${filePath.replace(/\\/g, '/')}`
        const doc = docs.get(roomName)
        if (doc) {
          const type = doc.getText('monaco')
          doc.transact(() => {
            type.delete(0, type.length)
            type.insert(0, content)
          })
        }
      }
      await broadcastFileList(roomId)
      if (callback) callback({ success: true })
    } catch (err) {
      if (callback) callback({ error: err.message })
    }
  })

  socket.on('folder:create', async (folderPath, callback) => {
    const roomId = socket.data.currentRoom
    if (!roomId) return
    try {
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      const fullPath = validatePath(roomPath, folderPath)
      await fs.ensureDir(fullPath)
      await broadcastFileList(roomId)
      if (callback) callback({ success: true })
    } catch (err) {
      if (callback) callback({ error: err.message })
    }
  })

  socket.on('file:delete', async (targetPath, callback) => {
    const roomId = socket.data.currentRoom
    if (!roomId) return
    try {
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      const fullPath = validatePath(roomPath, targetPath)
      await fs.remove(fullPath)
      
      const roomNamePrefix = `${roomId}:${targetPath.replace(/\\/g, '/')}`
      for (const [key, doc] of docs.entries()) {
        if (key === roomNamePrefix || key.startsWith(roomNamePrefix + '/')) {
          docs.delete(key)
        }
      }

      io.to(roomId).emit('file:deleted', targetPath)
      await broadcastFileList(roomId)
      if (callback) callback({ success: true })
    } catch (err) {
      if (callback) callback({ error: err.message })
    }
  })

  socket.on('file:rename', async (oldPath, newPath, callback) => {
    const roomId = socket.data.currentRoom
    if (!roomId) return
    try {
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      const oldFull = validatePath(roomPath, oldPath)
      const newFull = validatePath(roomPath, newPath)
      await fs.move(oldFull, newFull)

      const oldPrefix = `${roomId}:${oldPath.replace(/\\/g, '/')}`
      for (const [key, doc] of docs.entries()) {
        if (key === oldPrefix || key.startsWith(oldPrefix + '/')) {
          docs.delete(key)
        }
      }

      io.to(roomId).emit('file:renamed', { oldPath, newPath })
      await broadcastFileList(roomId)
      if (callback) callback({ success: true })
    } catch (err) {
      if (callback) callback({ error: err.message })
    }
  })

  socket.on('file:read', async (filePath, callback) => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return callback({ error: 'Not in a room' })
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const fullPath = validatePath(roomPath, filePath)
      const content = await fs.readFile(fullPath, 'utf8')
      callback({ content })
    } catch (err) {
      callback({ error: err.message })
    }
  })

  socket.on('file:save', async (filePath, content, callback) => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const fullPath = validatePath(roomPath, filePath)
      
      if (typeof content === 'string' && content.length > MAX_FILE_SIZE) {
        throw new Error('File size exceeds limit.')
      }

      await fs.writeFile(fullPath, content)
      io.to(currentRoom).emit('file:saved', { path: filePath })
      if (callback) callback({ success: true })
    } catch (err) {
      if (callback) callback({ error: err.message })
    }
  })
}
