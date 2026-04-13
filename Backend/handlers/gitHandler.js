import simpleGit from 'simple-git'
import path from 'path'
import fs from 'fs-extra'
import { WORKSPACE_DIR } from '../store/state.js'
import { sanitizeRemoteUrl } from '../utils/gitHelpers.js'
import { scanDirectory } from '../utils/fileHelpers.js'

export default function registerGitHandlers(io, socket) {
  const broadcastFileList = async (roomId) => {
    if (!roomId) return 
    const roomPath = path.join(WORKSPACE_DIR, roomId)
    if (fs.existsSync(roomPath)) {
      const tree = await scanDirectory(roomPath, roomPath)
      io.to(roomId).emit('file:refresh', tree)
    }
  }

  socket.on('git:clone', async (repoUrl, githubToken, callback) => {
    const currentRoom = socket.data.currentRoom
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
        const git2 = simpleGit(path.join(WORKSPACE_DIR, socket.data.currentRoom))
        await git2.raw(['config', '--global', '--unset', 'http.https://github.com/.extraheader'])
      } catch (_) {}
      console.error(err)
      callback({ error: err.message })
    }
  })

  socket.on('git:status', async (callback) => {
    const currentRoom = socket.data.currentRoom
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
    const currentRoom = socket.data.currentRoom
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
    const currentRoom = socket.data.currentRoom
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
    const currentRoom = socket.data.currentRoom
    const currentUser = socket.data.currentUser
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
    const currentRoom = socket.data.currentRoom
    if (!currentRoom) return callback({ error: 'Not in a room' })
    try {
      const roomPath = path.join(WORKSPACE_DIR, currentRoom)
      const git = simpleGit(roomPath)
      const isRepo = await git.checkIsRepo('root')
      if (!isRepo) return callback({ error: 'Not a git repository.' })

      await sanitizeRemoteUrl(git)
      
      const status = await git.status()
      const branch = status.current || 'main'

      if (githubToken) {
        const authBase64 = Buffer.from(`x-access-token:${githubToken}`).toString('base64')
        await git.raw([
          '-c', 'credential.helper=',
          '-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${authBase64}`,
          'push', 'origin', branch
        ])
      } else {
        await git.push('origin', branch)
      }

      callback({ success: true })
    } catch (err) {
      console.error('[git:push] ERROR:', err.message)
      callback({ error: err.message })
    }
  })

  socket.on('git:pull', async (githubToken, callback) => {
    const currentRoom = socket.data.currentRoom
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
}
