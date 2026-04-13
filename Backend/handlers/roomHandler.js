import fs from 'fs-extra'
import path from 'path'
import { nanoid } from 'nanoid'
import { rooms, terminalRooms, chatHistory, userColors, WORKSPACE_DIR } from '../store/state.js'
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
      const roomTerminals = terminalRooms.get(roomId)
      if (roomTerminals) {
        if (roomTerminals.sharedPty) {
          try { roomTerminals.sharedPty.kill() } catch (e) {}
        }
        for (const [userId, userTermsMap] of roomTerminals.userTerminals.entries()) {
          for (const [termId, termInfo] of userTermsMap.entries()) {
             try { termInfo.pty.kill() } catch (e) {}
             if (termInfo.disconnectTimeout) clearTimeout(termInfo.disconnectTimeout)
          }
        }
        terminalRooms.delete(roomId)
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
        const roomTerminals = terminalRooms.get(roomId)
        if (roomTerminals) {
          if (roomTerminals.sharedPty) {
            try { roomTerminals.sharedPty.kill() } catch (e) {}
          }
          for (const [userId, userTermsMap] of roomTerminals.userTerminals.entries()) {
            for (const [termId, termInfo] of userTermsMap.entries()) {
               try { termInfo.pty.kill() } catch (e) {}
               if (termInfo.disconnectTimeout) clearTimeout(termInfo.disconnectTimeout)
            }
          }
          terminalRooms.delete(roomId)
        }
      } else {
        const roomTerminals = terminalRooms.get(roomId)
        if (roomTerminals) {
          if (roomTerminals.currentController === socket.id) {
            roomTerminals.currentController = roomTerminals.controlQueue.length > 0 ? roomTerminals.controlQueue.shift() : null
            io.to(roomId).emit('terminal:control_updated', { currentController: roomTerminals.currentController, controlQueue: roomTerminals.controlQueue })
          }
          
          roomTerminals.controlQueue = roomTerminals.controlQueue.filter(id => id !== socket.id)
          io.to(roomId).emit('terminal:control_updated', { currentController: roomTerminals.currentController, controlQueue: roomTerminals.controlQueue })
          
          const userTermsMap = roomTerminals.userTerminals.get(socket.id)
          if (userTermsMap) {
            for (const [termId, termInfo] of userTermsMap.entries()) {
               termInfo.disconnectTimeout = setTimeout(() => {
                 try { termInfo.pty.kill() } catch (e) {}
                 userTermsMap.delete(termId)
                 if (userTermsMap.size === 0) {
                   roomTerminals.userTerminals.delete(socket.id)
                 }
               }, 60000)
            }
          }
        }
      }
    }
    socket.data.currentRoom = null
    socket.data.currentUser = null
  }
}
