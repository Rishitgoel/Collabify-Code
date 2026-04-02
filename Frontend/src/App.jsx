import React, { useState, useEffect } from 'react'
import EntryScreen from './components/EntryScreen'
import EditorWorkspace from './components/EditorWorkspace'
import { io } from 'socket.io-client'

// Connect to backend server
const socket = io('http://localhost:3001')

function App() {
  const [currentView, setCurrentView] = useState('ENTRY') // 'ENTRY' | 'WORKSPACE'
  const [roomData, setRoomData] = useState({ roomId: null, username: null, initialUsers: [] })
  const [isConnected, setIsConnected] = useState(socket.connected)

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))
    return () => {
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  const handleJoinRoom = (roomId, username, users) => {
    console.log('[DEBUG] App.handleJoinRoom:', { roomId, username, users })
    setRoomData({ roomId, username, initialUsers: users })
    setCurrentView('WORKSPACE')
  }

  const handleLeaveRoom = () => {
    socket.emit('leave-room')
    setRoomData({ roomId: null, username: null, initialUsers: [] })
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
        {currentView === 'ENTRY' ? (
          <EntryScreen onJoinRoom={handleJoinRoom} socket={socket} />
        ) : (
          <EditorWorkspace 
            roomId={roomData.roomId} 
            username={roomData.username} 
            initialUsers={roomData.initialUsers}
            onLeaveRoom={handleLeaveRoom}
            socket={socket}
          />
        )}
      </div>
    </div>
  )
}

export default App
