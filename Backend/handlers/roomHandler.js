import fs from 'fs-extra'
import path from 'path'
import { nanoid } from 'nanoid'
import { rooms, ptys, chatHistory, userColors, WORKSPACE_DIR } from '../store/state.js'
import { validateRoomId } from '../utils/validation.js'

export default function registerRoomHandlers(io, socket) {
  socket.on('create-room', async (username, callback) => {
    try {
      const roomId = nanoid(10)
      validateRoomId(roomId)
      socket.data.currentRoom = roomId
      
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      await fs.ensureDir(roomPath)
  
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Map() })
      }
      
      joinRoomSync(roomId, username, io, socket, callback)
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
  
      socket.data.currentRoom = roomId
      joinRoomSync(roomId, username, io, socket, callback)
    } catch (err) {
      callback({ error: err.message })
    }
  })

  socket.on('room:delete', async (roomId, callback) => {
    try {
      validateRoomId(roomId)
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      
      if (fs.existsSync(roomPath)) {
        await fs.remove(roomPath)
      }
      
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
      
      if (callback) callback({ success: true })
    } catch (err) {
      console.error(`Error deleting room ${roomId}:`, err)
      if (callback) callback({ error: err.message })
    }
  })

  socket.on('leave-room', () => {
    handleLeave(io, socket)
  })

  socket.on('disconnect', () => {
    handleLeave(io, socket)
  })
}

function joinRoomSync(roomId, username, io, socket, callback) {
  const room = rooms.get(roomId)
  const color = userColors[room.users.size % userColors.length]
  const currentUser = { id: socket.id, username, color, inVoice: false }
  
  socket.data.currentUser = currentUser
  room.users.set(socket.id, currentUser)
  socket.join(roomId)

  io.to(roomId).emit('room:users', Array.from(room.users.values()))
  
  callback({ 
    success: true, 
    roomId, 
    user: currentUser, 
    users: Array.from(room.users.values()) 
  })
}

function handleLeave(io, socket) {
  const { currentRoom, currentUser } = socket.data
  if (currentRoom && currentUser) {
    const roomId = currentRoom
    const room = rooms.get(roomId)
    if (room) {
      room.users.delete(socket.id)
      socket.leave(roomId)
      io.to(roomId).emit('room:users', Array.from(room.users.values()))
      
      if (room.users.size === 0) {
        const ptyProcess = ptys.get(roomId)
        if (ptyProcess) {
          try { ptyProcess.kill() } catch (e) {}
          ptys.delete(roomId)
        }
      }
    }
    socket.data.currentRoom = null
    socket.data.currentUser = null
  }
}
