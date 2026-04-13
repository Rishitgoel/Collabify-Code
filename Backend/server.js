import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'
import cors from 'cors'
import fs from 'fs-extra'
import dotenv from 'dotenv'

import authRouter from './api/auth.js'
import { WORKSPACE_DIR } from './store/state.js'

import registerRoomHandlers from './handlers/roomHandler.js'
import registerFileHandlers from './handlers/fileHandler.js'
import registerGitHandlers from './handlers/gitHandler.js'
import registerTerminalHandlers from './handlers/terminalHandler.js'
import registerChatHandlers from './handlers/chatHandler.js'
import registerVoiceHandlers from './handlers/voiceHandler.js'

dotenv.config()

const app = express()
app.use(cors())

// API Routes
app.use('/auth', authRouter)

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

// Initialize workspace root
fs.ensureDirSync(WORKSPACE_DIR)

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Initialize connection state context
  socket.data.currentRoom = null
  socket.data.currentUser = null

  // Register modular handlers
  registerRoomHandlers(io, socket)
  registerFileHandlers(io, socket)
  registerGitHandlers(io, socket)
  registerTerminalHandlers(io, socket)
  registerChatHandlers(io, socket)
  registerVoiceHandlers(io, socket)
})

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
