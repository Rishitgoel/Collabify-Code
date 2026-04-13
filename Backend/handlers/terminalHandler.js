import fs from 'fs-extra'
import path from 'path'
import pty from 'node-pty'
import os from 'os'
import { WORKSPACE_DIR, terminalRooms } from '../store/state.js'

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'

export default function registerTerminalHandlers(io, socket) {
  const getRoomTerminals = (roomId) => {
    let roomTerminals = terminalRooms.get(roomId)
    if (!roomTerminals) {
      roomTerminals = {
        sharedPty: null,
        currentController: null,
        controlQueue: [],
        userTerminals: new Map()
      }
      terminalRooms.set(roomId, roomTerminals)
    }
    return roomTerminals
  }

  const broadcastControlUpdated = (roomId, roomTerminals) => {
    io.to(roomId).emit('terminal:control_updated', {
       currentController: roomTerminals.currentController,
       controlQueue: roomTerminals.controlQueue
    })
  }

  socket.on('terminal:create_individual', ({ termId }) => {
    if (!termId) return
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const roomId = currentRoom
    const roomTerminals = getRoomTerminals(roomId)
    
    let userTermsMap = roomTerminals.userTerminals.get(socket.id)
    if (!userTermsMap) {
       userTermsMap = new Map()
       roomTerminals.userTerminals.set(socket.id, userTermsMap)
    }

    if (userTermsMap.size >= 3 && !userTermsMap.has(termId)) {
        socket.emit('terminal:output_individual', { termId, data: `\r\nError: Maximum 3 private terminals allowed.\r\n` })
        return
    }

    let userTermInfo = userTermsMap.get(termId)
    if (userTermInfo) {
       if (userTermInfo.disconnectTimeout) {
         clearTimeout(userTermInfo.disconnectTimeout)
         userTermInfo.disconnectTimeout = null
       }
       return
    }

    // Register immediately so the front-end shows the tab even if pty fails
    userTermsMap.set(termId, { pty: { write: () => {}, kill: () => {}, resize: () => {} }, disconnectTimeout: null })
    socket.emit('terminal:active_individual', Array.from(userTermsMap.keys()))

    try {
      const roomPath = path.join(WORKSPACE_DIR, roomId)
      if (!fs.existsSync(roomPath)) {
          throw new Error('Room workspace does not exist.')
      }
      const terminalEnv = { ...process.env, NODE_ENV: 'development' }
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: roomPath,
        env: terminalEnv,
        useConpty: true 
      })

      ptyProcess.onData((data) => {
        socket.emit('terminal:output_individual', { termId, data })
      })

      // Update with the real pty
      userTermsMap.set(termId, { pty: ptyProcess, disconnectTimeout: null })
      
    } catch (err) {
      setTimeout(() => {
        socket.emit('terminal:output_individual', { termId, data: `\r\n[!] Error: Failed to start terminal process.\r\n${err.message}\r\n` })
      }, 500)
    }
  })

  socket.on('terminal:close_individual', ({ termId }) => {
    if (!termId) return
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const roomTerminals = getRoomTerminals(currentRoom)
    const userTermsMap = roomTerminals.userTerminals.get(socket.id)
    if (userTermsMap && userTermsMap.has(termId)) {
       const termInfo = userTermsMap.get(termId)
       try { termInfo.pty.kill() } catch(e) {}
       if (termInfo.disconnectTimeout) clearTimeout(termInfo.disconnectTimeout)
       userTermsMap.delete(termId)
       socket.emit('terminal:active_individual', Array.from(userTermsMap.keys()))
    }
  })

  socket.on('terminal:request_active', () => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const roomTerminals = getRoomTerminals(currentRoom)
    const userTermsMap = roomTerminals.userTerminals.get(socket.id)
    if (userTermsMap) {
       socket.emit('terminal:active_individual', Array.from(userTermsMap.keys()))
    } else {
       socket.emit('terminal:active_individual', [])
    }
  })

  socket.on('terminal:join_shared', () => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const roomId = currentRoom
    const roomTerminals = getRoomTerminals(roomId)

    if (!roomTerminals.sharedPty) {
       try {
          const roomPath = path.join(WORKSPACE_DIR, roomId)
          if (!fs.existsSync(roomPath)) throw new Error('Room workspace does not exist.')
          const terminalEnv = { ...process.env, NODE_ENV: 'development' }
          const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: roomPath,
            env: terminalEnv,
            useConpty: true 
          })

          ptyProcess.onData((data) => {
            io.to(roomId).emit('terminal:output_shared', data)
          })

          roomTerminals.sharedPty = ptyProcess
       } catch (err) {
          socket.emit('terminal:output_shared', `\r\nError: Failed to start shared terminal.\r\n${err.message}\r\n`)
       }
    }
    
    socket.emit('terminal:control_updated', {
       currentController: roomTerminals.currentController,
       controlQueue: roomTerminals.controlQueue
    })
  })

  socket.on('terminal:request_control', () => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const roomId = currentRoom
    const roomTerminals = getRoomTerminals(roomId)

    if (!roomTerminals.currentController) {
       roomTerminals.currentController = socket.id
    } else {
       if (roomTerminals.currentController !== socket.id && !roomTerminals.controlQueue.includes(socket.id)) {
           roomTerminals.controlQueue.push(socket.id)
       }
    }
    broadcastControlUpdated(roomId, roomTerminals)
  })

  socket.on('terminal:release_control', () => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const roomId = currentRoom
    const roomTerminals = getRoomTerminals(roomId)

    if (roomTerminals.currentController === socket.id) {
       roomTerminals.currentController = roomTerminals.controlQueue.length > 0 ? roomTerminals.controlQueue.shift() : null
    } else {
       roomTerminals.controlQueue = roomTerminals.controlQueue.filter(id => id !== socket.id)
    }
    broadcastControlUpdated(roomId, roomTerminals)
  })
  
  socket.on('terminal:pass_control', ({ toUserId }) => {
     const currentRoom = socket.data.currentRoom
     if (!currentRoom) return
     const roomId = currentRoom
     const roomTerminals = getRoomTerminals(roomId)
     
     if (roomTerminals.currentController === socket.id) {
         roomTerminals.controlQueue = roomTerminals.controlQueue.filter(id => id !== toUserId)
         roomTerminals.currentController = toUserId
         broadcastControlUpdated(roomId, roomTerminals)
     }
  })

  socket.on('terminal:input', (payload) => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const roomId = currentRoom
    const roomTerminals = getRoomTerminals(roomId)

    const type = payload?.type || 'individual'
    const data = payload?.data || payload
    const termId = payload?.termId

    if (type === 'individual') {
        const userTermsMap = roomTerminals.userTerminals.get(socket.id)
        if (userTermsMap && termId) {
            const userTermInfo = userTermsMap.get(termId)
            if (userTermInfo && userTermInfo.pty) userTermInfo.pty.write(data)
        }
    } else if (type === 'shared') {
        if (roomTerminals.currentController === socket.id) {
            if (roomTerminals.sharedPty) roomTerminals.sharedPty.write(data)
        } else {
            socket.emit('terminal:output_shared', `\r\nError: You do not have control. Please request it to type.\r\n`)
        }
    }
  })

  socket.on('terminal:resize', (payload) => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const roomId = currentRoom
    const roomTerminals = getRoomTerminals(roomId)

    const type = payload?.type || 'individual'
    const cols = payload?.cols
    const rows = payload?.rows
    const termId = payload?.termId
    if (!cols || !rows) return

    try {
        if (type === 'individual') {
            const userTermsMap = roomTerminals.userTerminals.get(socket.id)
            if (userTermsMap && termId) {
                const userTermInfo = userTermsMap.get(termId)
                if (userTermInfo && userTermInfo.pty) userTermInfo.pty.resize(cols, rows)
            }
        } else if (type === 'shared') {
            if (roomTerminals.sharedPty) roomTerminals.sharedPty.resize(cols, rows)
        }
    } catch (e) {}
  })
}
