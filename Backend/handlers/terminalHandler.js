import fs from 'fs-extra'
import path from 'path'
import pty from 'node-pty'
import os from 'os'
import { WORKSPACE_DIR, ptys } from '../store/state.js'

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'

export default function registerTerminalHandlers(io, socket) {
  socket.on('terminal:start', () => {
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const roomId = currentRoom
    
    if (!ptys.has(roomId)) {
      try {
        const roomPath = path.join(WORKSPACE_DIR, roomId)
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
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return
    const ptyProcess = ptys.get(currentRoom)
    if (ptyProcess) {
      ptyProcess.write(data)
    }
  })

  socket.on('terminal:resize', ({ cols, rows }) => {
    const currentRoom = socket.data.currentRoom
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
}
