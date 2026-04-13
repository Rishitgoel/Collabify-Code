import { rooms } from '../store/state.js'

export default function registerVoiceHandlers(io, socket) {
  socket.on('voice:join', () => {
    const currentRoom = socket.data.currentRoom
    const currentUser = socket.data.currentUser
    if (!currentRoom || !currentUser) return
    
    // Update reference
    const room = rooms.get(currentRoom)
    if (room) {
      const user = room.users.get(socket.id)
      if (user) {
        user.inVoice = true
      }
    }
    
    socket.to(currentRoom).emit('voice:user-joined', socket.id)
    
    if (room) {
      io.to(currentRoom).emit('room:users', Array.from(room.users.values()))
    }
  })

  socket.on('voice:signal', ({ to, signal }) => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    io.to(to).emit('voice:signal', { from: socket.id, signal })
  })

  socket.on('voice:leave', () => {
    const currentRoom = socket.data.currentRoom
    const currentUser = socket.data.currentUser
    if (!currentRoom || !currentUser) return
    
    const room = rooms.get(currentRoom)
    if (room) {
      const user = room.users.get(socket.id)
      if (user) {
        user.inVoice = false
      }
    }
    
    socket.to(currentRoom).emit('voice:user-left', socket.id)
    
    if (room) {
      io.to(currentRoom).emit('room:users', Array.from(room.users.values()))
    }
  })
}
