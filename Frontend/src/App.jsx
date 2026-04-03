import React, { useState, useEffect } from 'react'
import EntryScreen from './components/EntryScreen'
import EditorWorkspace from './components/EditorWorkspace'
import { io } from 'socket.io-client'

// Connect to backend server
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const socket = io(API_URL)

// Global singleton for local handles to ensure stability against React remounts
const GLOBAL_LOCAL_HANDLES = new Map()
window.collabifyHandles = GLOBAL_LOCAL_HANDLES

function App() {
  const [currentView, setCurrentView] = useState('ENTRY') // 'ENTRY' | 'WORKSPACE'
  const [roomData, setRoomData] = useState({ roomId: null, username: null, initialUsers: [] })
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [isRestoring, setIsRestoring] = useState(true)
  
  // Use a dummy state to trigger UI updates when handles change
  const [syncCount, setSyncCount] = useState(0)

  // ... (theme state logic) ...
  
  // Theme state management
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('collabify_theme') || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('collabify_theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))
    return () => {
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  // Auto-rejoin logic
  useEffect(() => {
    if (isConnected && currentView === 'ENTRY') {
      const savedSession = localStorage.getItem('collabify_session')
      if (savedSession) {
        try {
          const { roomId, username } = JSON.parse(savedSession)
          console.log('[DEBUG] Attempting auto-rejoin:', { roomId, username })
          
          socket.emit('join-room', roomId, username, (res) => {
            if (res.success) {
              console.log('[DEBUG] Auto-rejoin successful')
              handleJoinRoom(res.roomId, username, res.users)
            } else {
              console.warn('[DEBUG] Auto-rejoin failed:', res.error)
              localStorage.removeItem('collabify_session')
            }
            setIsRestoring(false)
          })
        } catch (e) {
          console.error('Failed to parse saved session', e)
          localStorage.removeItem('collabify_session')
          setIsRestoring(false)
        }
      } else {
        setIsRestoring(false)
      }
    } else if (isConnected) {
      // If we are already in workspace, we are not restoring anymore
      setIsRestoring(false)
    }
  }, [isConnected])

  const handleJoinRoom = (roomId, username, users) => {
    console.log('[DEBUG] App.handleJoinRoom:', { roomId, username, users })
    setRoomData({ roomId, username, initialUsers: users })
    localStorage.setItem('collabify_session', JSON.stringify({ roomId, username }))
    setCurrentView('WORKSPACE')
  }

  const handleLeaveRoom = () => {
    socket.emit('leave-room')
    setRoomData({ roomId: null, username: null, initialUsers: [] })
    localStorage.removeItem('collabify_session')
    setCurrentView('ENTRY')
  }

  return (
    <div className="app-container" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isConnected && (
        <div style={{ padding: '0.25rem', backgroundColor: 'var(--danger)', color: 'white', textAlign: 'center', fontSize: '0.8rem' }}>
          Connecting to server...
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {isRestoring ? (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '1rem',
            color: 'var(--text-secondary)'
          }}>
            <div className="spinner" style={{ 
              width: '40px', 
              height: '40px', 
              border: '4px solid var(--border)', 
              borderTop: '4px solid var(--accent)', 
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <p>Restoring your session...</p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : currentView === 'ENTRY' ? (
          <EntryScreen 
            onJoinRoom={handleJoinRoom} 
            socket={socket} 
            theme={theme} 
            toggleTheme={toggleTheme} 
          />
        ) : (
          <EditorWorkspace 
            roomId={roomData.roomId} 
            username={roomData.username} 
            initialUsers={roomData.initialUsers}
            onLeaveRoom={handleLeaveRoom}
            socket={socket}
            theme={theme}
            toggleTheme={toggleTheme}
            localHandles={GLOBAL_LOCAL_HANDLES}
            setLocalHandles={(newMap) => {
              GLOBAL_LOCAL_HANDLES.clear()
              for (let [key, value] of newMap) {
                GLOBAL_LOCAL_HANDLES.set(key, value)
              }
              setSyncCount(c => c + 1)
              console.log('[DEBUG] App: Global handles updated, count:', GLOBAL_LOCAL_HANDLES.size)
            }}
          />
        )}
      </div>
    </div>
  )
}


export default App
