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
import simpleGit from 'simple-git'
import dotenv from 'dotenv'

dotenv.config()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())

// == GITHUB OAUTH ==
app.get('/auth/github', (req, res) => {
  const redirect_uri = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/github/callback'
  const client_id = process.env.GITHUB_CLIENT_ID
  
  if (!client_id) {
    return res.status(500).send('GITHUB_CLIENT_ID is not configured in the backend .env file')
  }
  
  const scope = 'repo'
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&scope=${scope}`)
})

app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code
  const client_id = process.env.GITHUB_CLIENT_ID
  const client_secret = process.env.GITHUB_CLIENT_SECRET
  
  if (!code) return res.status(400).send('No code provided by GitHub')

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        code
      })
    })
    const data = await tokenResponse.json()
    const token = data.access_token
    const scope = data.scope
    const tokenType = data.token_type
    
    console.log('[GitHub OAuth] Token received. Type:', tokenType, '| Scopes:', scope)

    if (token) {
      res.send(`
        <html>
          <head><title>GitHub Auth Success</title></head>
          <body>
            <p>Authentication successful! Closing window...</p>
            <script>
              window.opener.postMessage({ type: 'GITHUB_TOKEN', payload: '${token}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `)
    } else {
      res.status(400).send('Failed to retrieve token: ' + JSON.stringify(data))
    }
  } catch (error) {
    res.status(500).send('Server Error: ' + error.message)
  }
})
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
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const MAX_WORKSPACE_SIZE = 500 * 1024 * 1024 // 500MB

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

      io.to(roomId).emit('file:deleted', targetPath)
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

      io.to(roomId).emit('file:renamed', { oldPath, newPath })
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
      io.to(currentRoom).emit('file:saved', { path: filePath }) // Broadcast that a file was modified
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

  // == GIT EVENTS ==

  // Helper: strip any embedded credentials from a git remote URL
  function stripCredentialsFromUrl(url) {
    try {
      const parsed = new URL(url)
      parsed.username = ''
      parsed.password = ''
      return parsed.toString()
    } catch {
      return url
    }
  }

  // Helper: ensure the origin remote URL has no embedded credentials
  async function sanitizeRemoteUrl(git) {
    try {
      const remotes = await git.getRemotes(true)
      const origin = remotes.find(r => r.name === 'origin')
      if (origin) {
        const cleanUrl = stripCredentialsFromUrl(origin.refs.push)
        if (cleanUrl !== origin.refs.push) {
          await git.remote(['set-url', 'origin', cleanUrl])
          console.log('[Git] Cleaned embedded credentials from remote URL')
        }
      }
    } catch (_) {}
  }

  socket.on('git:clone', async (repoUrl, githubToken, callback) => {
    if (!currentRoom) return callback({ error: 'Not in a room' })
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const git = simpleGit(roomPath)
      
      if (githubToken) {
        const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${githubToken}`).toString('base64')}`
        await git.addConfig('http.https://github.com/.extraheader', authHeader, false, 'global')
      }
      
      await git.clone(repoUrl, '.')

      if (githubToken) {
        try { await git.raw(['config', '--global', '--unset', 'http.https://github.com/.extraheader']) } catch (_) {}
      }

      await broadcastFileList(currentRoom)
      callback({ success: true })
    } catch (err) {
      try {
        const git2 = simpleGit(path.join(WORKSPACE_DIR, currentRoom))
        await git2.raw(['config', '--global', '--unset', 'http.https://github.com/.extraheader'])
      } catch (_) {}
      console.error(err)
      callback({ error: err.message })
    }
  })

  socket.on('git:status', async (callback) => {
    if (!currentRoom) return callback({ error: 'Not in a room' })
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const git = simpleGit(roomPath)
      
      const isRepo = await git.checkIsRepo('root')
      if (!isRepo) return callback({ isRepo: false })

      await sanitizeRemoteUrl(git)

      const status = await git.status()
      callback({ isRepo: true, status })
    } catch (err) {
      callback({ error: err.message })
    }
  })

  socket.on('git:add', async (files, callback) => {
    if (!currentRoom) return callback({ error: 'Not in a room' })
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const git = simpleGit(roomPath)
      const isRepo = await git.checkIsRepo('root')
      if (!isRepo) return callback({ error: 'Not a git repository.' })
      
      await git.add(files)
      callback({ success: true })
    } catch (err) {
      callback({ error: err.message })
    }
  })

  socket.on('git:unstage', async (file, callback) => {
    if (!currentRoom) return callback({ error: 'Not in a room' })
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const git = simpleGit(roomPath)
      const isRepo = await git.checkIsRepo('root')
      if (!isRepo) return callback({ error: 'Not a git repository.' })
      
      await git.reset(['--', file])
      callback({ success: true })
    } catch (err) {
      callback({ error: err.message })
    }
  })

  socket.on('git:commit', async (message, callback) => {
    if (!currentRoom) return callback({ error: 'Not in a room' })
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const git = simpleGit(roomPath)
      const isRepo = await git.checkIsRepo('root')
      if (!isRepo) return callback({ error: 'Not a git repository.' })
      
      if (!message || !message.trim()) {
        return callback({ error: 'Commit message cannot be empty.' })
      }

      await git.addConfig('user.name', currentUser?.username || 'Collabify User')
      await git.addConfig('user.email', `${currentUser?.username || 'user'}@collabify.local`)
      await git.commit(message)
      callback({ success: true })
    } catch (err) {
      callback({ error: err.message })
    }
  })

  socket.on('git:push', async (githubToken, callback) => {
    console.log('[git:push] Called. Token present:', !!githubToken, '| Room:', currentRoom)
    if (!currentRoom) return callback({ error: 'Not in a room' })
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      console.log('[git:push] Room path:', roomPath)
      const git = simpleGit(roomPath)
      const isRepo = await git.checkIsRepo('root')
      console.log('[git:push] Is repo:', isRepo)
      if (!isRepo) return callback({ error: 'Not a git repository.' })

      await sanitizeRemoteUrl(git)
      
      const status = await git.status()
      const branch = status.current || 'main'
      console.log('[git:push] Branch:', branch, '| Modified files:', status.modified.length)

      if (githubToken) {
        const authBase64 = Buffer.from(`x-access-token:${githubToken}`).toString('base64')
        console.log('[git:push] Pushing with auth header...')
        const result = await git.raw([
          '-c', 'credential.helper=',
          '-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${authBase64}`,
          'push', 'origin', branch
        ])
        console.log('[git:push] Push result:', result)
      } else {
        console.log('[git:push] Pushing without auth...')
        await git.push('origin', branch)
      }

      console.log('[git:push] Success!')
      callback({ success: true })
    } catch (err) {
      console.error('[git:push] ERROR:', err.message)
      callback({ error: err.message })
    }
  })

  socket.on('git:pull', async (githubToken, callback) => {
    if (!currentRoom) return callback({ error: 'Not in a room' })
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const git = simpleGit(roomPath)
      const isRepo = await git.checkIsRepo('root')
      if (!isRepo) return callback({ error: 'Not a git repository.' })

      await sanitizeRemoteUrl(git)

      if (githubToken) {
        const authBase64 = Buffer.from(`x-access-token:${githubToken}`).toString('base64')
        await git.raw([
          '-c', 'credential.helper=',
          '-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${authBase64}`,
          'pull', 'origin'
        ])
      } else {
        await git.pull()
      }

      await broadcastFileList(currentRoom)
      callback({ success: true })
    } catch (err) {
      callback({ error: err.message })
    }
  })



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
