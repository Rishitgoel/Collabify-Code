import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { WebSocketServer } from 'ws'
import { setupWSConnection, docs } from 'y-websocket/bin/utils'
import cors from 'cors'
import { nanoid } from 'nanoid'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import pty from 'node-pty'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())

const server = http.createServer(app)

// Socket.IO for room management, terminal, chat, and file operations
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// y-websocket server for Yjs sync
const wss = new WebSocketServer({ noServer: true })
wss.on('connection', setupWSConnection)

server.on('upgrade', (request, socket, head) => {
  if (request.url.startsWith('/yjs/')) {
    // Strip the /yjs/ prefix to use the rest as the room name for y-websocket
    const docName = request.url.slice(5)
    // We can pass information if needed, but setupWSConnection uses the URL path
    request.url = '/' + docName
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }
})

const PORT = process.env.PORT || 3001
const WORKSPACE_DIR = path.join(__dirname, 'workspace')

// Initialize workspace root
fs.ensureDirSync(WORKSPACE_DIR)

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'

// In-memory store
const rooms = new Map() // roomId -> { users: Map(socketId -> { username, color }) }
const ptys = new Map() // roomId -> pty process
const chatHistory = new Map() // roomId -> [ { username, message, timestamp, color } ]
const userColors = ['#F87171', '#FBBF24', '#4ADE80', '#60A5FA', '#818CF8', '#A78BFA', '#F472B6', '#34D399']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_WORKSPACE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Validates that a target path is strictly within a base directory.
 * Prevents path traversal outside of the room's workspace.
 */
function validatePath(baseDir, relativePath) {
  const fullPath = path.resolve(baseDir, relativePath)
  if (!fullPath.startsWith(path.resolve(baseDir))) {
    throw new Error('Access denied: Path traversal detected.')
  }
  return fullPath
}

/**
 * Validates that a Room ID is alphanumeric only.
 */
function validateRoomId(roomId) {
  if (!/^[a-zA-Z0-9_\-]+$/.test(roomId)) {
    throw new Error('Invalid Room ID: Alphanumeric only.')
  }
}

/**
 * Calculates total size of a directory recursively.
 */
async function getDirSize(dirPath) {
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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  let currentRoom = null
  let currentUser = null

  socket.on('create-room', async (username, callback) => {
    try {
      const roomId = nanoid(10)
      validateRoomId(roomId) // Double check nanoid output
      currentRoom = roomId
      
      // Create room workspace on disk
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      await fs.ensureDir(roomPath)
  
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Map() })
      }
      
      joinRoomSync(roomId, username, socket, callback)
    } catch (err) {
      callback({ error: err.message })
    }
  })

  socket.on('join-room', (roomId, username, callback) => {
    try {
      validateRoomId(roomId)
      
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      if (!fs.existsSync(roomPath)) {
        return callback({ error: 'Room does not exist' })
      }
  
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Map() })
      }
  
      currentRoom = roomId
      joinRoomSync(roomId, username, socket, callback)
    } catch (err) {
      callback({ error: err.message })
    }
  })

  function joinRoomSync(roomId, username, socket, callback) {
    const room = rooms.get(roomId)
    const color = userColors[room.users.size % userColors.length]
    currentUser = { id: socket.id, username, color }
    
    room.users.set(socket.id, currentUser)
    socket.join(roomId)

    console.log(`User ${username} joined ${roomId}`)

    // Broadcast updated users
    io.to(roomId).emit('room:users', Array.from(room.users.values()))
    
    console.log(`[Join] Users in room ${roomId}:`, Array.from(room.users.values()))
    callback({ 
      success: true, 
      roomId, 
      user: currentUser, 
      users: Array.from(room.users.values()) 
    })
  }

  socket.on('room:delete', async (roomId, callback) => {
    try {
      validateRoomId(roomId)
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      
      // Permanently remove the entire directory from disk
      if (fs.existsSync(roomPath)) {
        await fs.remove(roomPath)
      }
      
      // Cleanup in-memory state if room is active
      if (rooms.has(roomId)) {
        rooms.delete(roomId)
      }
      if (chatHistory.has(roomId)) {
        chatHistory.delete(roomId)
      }
      const ptyProcess = ptys.get(roomId)
      if (ptyProcess) {
        try { ptyProcess.kill() } catch (e) {}
        ptys.delete(roomId)
      }
      
      console.log(`Room ${roomId} permanently deleted from disk and memory.`)
      if (callback) callback({ success: true })
    } catch (err) {
      console.error(`Error deleting room ${roomId}:`, err)
      if (callback) callback({ error: err.message })
    }
  })

  socket.on('leave-room', () => {

    handleLeave()
  })

  socket.on('disconnect', () => {
    handleLeave()
  })

  function handleLeave() {
    if (currentRoom && currentUser) {
      const roomId = currentRoom
      const room = rooms.get(roomId)
      if (room) {
        room.users.delete(socket.id)
        socket.leave(roomId)
        io.to(roomId).emit('room:users', Array.from(room.users.values()))
        
        // Clean up PTY if the room is now empty
        if (room.users.size === 0) {
          const ptyProcess = ptys.get(roomId)
          if (ptyProcess) {
            try {
              ptyProcess.kill()
            } catch (e) {
              // ignore kill errors
            }
            ptys.delete(roomId)
          }
        }
      }
      currentRoom = null
      currentUser = null
    }
  }

  // == FILE SYS EVENTS ==
  socket.on('file:list', async (callback) => {
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

  // Broadcast function to refresh file tree for all clients in the room
  const broadcastFileList = async (roomId) => {
    if (!roomId) return // Safety check
    const roomPath = path.join(WORKSPACE_DIR, roomId)
    if (fs.existsSync(roomPath)) {
      const tree = await scanDirectory(roomPath, roomPath)
      io.to(roomId).emit('file:refresh', tree)
    }
  }


  socket.on('file:create', async (filePath, content, callback) => {
    const roomId = currentRoom
    if (!roomId) {
      if (callback) callback({ error: 'Not in a room' })
      return
    }
    try {
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      const fullPath = validatePath(roomPath, filePath)
      
      // Check total workspace size before adding new content
      const currentSize = await getDirSize(roomPath)
      const newSize = currentSize + (content ? Buffer.byteLength(content) : 0)
      if (newSize > MAX_WORKSPACE_SIZE) {
        throw new Error('Workspace storage limit reached (50MB).')
      }

      await fs.ensureFile(fullPath)
      if (content !== undefined) {
        if (typeof content === 'string' && content.length > MAX_FILE_SIZE) {
            throw new Error('File size exceeds limit.')
        }
        await fs.writeFile(fullPath, content)
        // Also update Yjs memory state if currently open in any clients
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
    const roomId = currentRoom
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
    const roomId = currentRoom
    if (!roomId) return
    try {
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      const fullPath = validatePath(roomPath, targetPath)
      await fs.remove(fullPath)
      
      // CLEAN UP Yjs docs
      const roomNamePrefix = `${roomId}:${targetPath.replace(/\\/g, '/')}`
      for (const [key, doc] of docs.entries()) {
        if (key === roomNamePrefix || key.startsWith(roomNamePrefix + '/')) {
          docs.delete(key)
        }
      }

      await broadcastFileList(roomId)
      if (callback) callback({ success: true })
    } catch (err) {
      if (callback) callback({ error: err.message })
    }

  })

  socket.on('file:rename', async (oldPath, newPath, callback) => {
    const roomId = currentRoom
    if (!roomId) return
    try {
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      const oldFull = validatePath(roomPath, oldPath)
      const newFull = validatePath(roomPath, newPath)
      await fs.move(oldFull, newFull)

      // Update Yjs docs map if needed (simplest is clear old ones)
      const oldPrefix = `${roomId}:${oldPath.replace(/\\/g, '/')}`
      for (const [key, doc] of docs.entries()) {
        if (key === oldPrefix || key.startsWith(oldPrefix + '/')) {
          docs.delete(key)
        }
      }

      await broadcastFileList(roomId)
      if (callback) callback({ success: true })
    } catch (err) {
      if (callback) callback({ error: err.message })
    }

  })

  socket.on('file:read', async (filePath, callback) => {
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

  // 'file:save' will write content to the file
  socket.on('file:save', async (filePath, content, callback) => {
    if (!currentRoom) return
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const fullPath = validatePath(roomPath, filePath)
      
      if (typeof content === 'string' && content.length > MAX_FILE_SIZE) {
        throw new Error('File size exceeds limit.')
      }

      await fs.writeFile(fullPath, content)
      if (callback) callback({ success: true })
    } catch (err) {
      if (callback) callback({ error: err.message })
    }
  })

  async function scanDirectory(dir, basePath) {
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

  // == TERMINAL EVENTS ==
  socket.on('terminal:start', () => {
    if (!currentRoom) return
    const roomId = currentRoom // capture current value
    
    if (!ptys.has(roomId)) {
      try {
        const roomPath = path.join(WORKSPACE_DIR, roomId)
        // Ensure the roomPath is valid and exists
        if (!fs.existsSync(roomPath)) {
            throw new Error('Room workspace does not exist.')
        }

        const ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd: roomPath,
          env: process.env,
          useConpty: true 
        })

        ptyProcess.onData((data) => {
          // Always broadcast to the specific room ID this PTY belongs to
          io.to(roomId).emit('terminal:output', data)
        })

        ptys.set(roomId, ptyProcess)
        console.log(`PTY started for room: ${roomId}`)
      } catch (err) {
        console.error(`Failed to spawn PTY for room ${roomId}:`, err)
        socket.emit('terminal:output', `\r\nError: Failed to start terminal process.\r\n${err.message}\r\n`)
      }
    }
  })

  socket.on('terminal:input', (data) => {
    if (!currentRoom) return
    const ptyProcess = ptys.get(currentRoom)
    if (ptyProcess) {
      ptyProcess.write(data)
    }
  })

  socket.on('terminal:resize', ({ cols, rows }) => {
    if (!currentRoom) return
    const ptyProcess = ptys.get(currentRoom)
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows)
      } catch (e) {
        // resize error ignored
      }
    }
  })

  // == CHAT EVENTS ==
  socket.on('chat:history', (callback) => {
    if (!currentRoom) return callback([])
    const history = chatHistory.get(currentRoom) || []
    callback(history)
  })

  socket.on('chat:send', (messageText) => {
    if (!currentRoom || !currentUser) return
    const message = {
      username: currentUser.username,
      color: currentUser.color,
      text: messageText,
      timestamp: Date.now()
    }
    
    // Save to history buffer (max 100)
    let history = chatHistory.get(currentRoom)
    if (!history) {
      history = []
      chatHistory.set(currentRoom, history)
    }
    history.push(message)
    if (history.length > 100) history.shift()

    io.to(currentRoom).emit('chat:message', message)
  })

  // == VOICE (WebRTC SIGNALING) EVENTS ==
  socket.on('voice:join', () => {
    if (!currentRoom || !currentUser) return
    currentUser.inVoice = true
    
    // Notify others in room that a user joined voice
    socket.to(currentRoom).emit('voice:user-joined', socket.id)
    
    // Broadcast updated users to show who is in voice
    const room = rooms.get(currentRoom)
    if (room) {
      io.to(currentRoom).emit('room:users', Array.from(room.users.values()))
    }
  })

  socket.on('voice:signal', ({ to, signal }) => {
    if (!currentRoom) return
    // Relay WebRTC signal to specific user
    io.to(to).emit('voice:signal', { from: socket.id, signal })
  })

  socket.on('voice:leave', () => {
    if (!currentRoom || !currentUser) return
    currentUser.inVoice = false
    
    socket.to(currentRoom).emit('voice:user-left', socket.id)
    
    // Broadcast updated users
    const room = rooms.get(currentRoom)
    if (room) {
      io.to(currentRoom).emit('room:users', Array.from(room.users.values()))
    }
  })

}) // End of io.on connection

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
