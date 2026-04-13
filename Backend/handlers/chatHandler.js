import { chatHistory } from '../store/state.js'

export default function registerChatHandlers(io, socket) {
  socket.on('chat:history', (callback) => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return callback([])
    const history = chatHistory.get(currentRoom) || []
    callback(history)
  })

  socket.on('chat:send', (messageText) => {
    const currentRoom = socket.data.currentRoom
    const currentUser = socket.data.currentUser
    if (!currentRoom || !currentUser) return
    
    const message = {
      username: currentUser.username,
      color: currentUser.color,
      text: messageText,
      timestamp: Date.now()
    }
    
    let history = chatHistory.get(currentRoom)
    if (!history) {
      history = []
      chatHistory.set(currentRoom, history)
    }
    history.push(message)
    if (history.length > 100) history.shift()

    io.to(currentRoom).emit('chat:message', message)
  })
}
