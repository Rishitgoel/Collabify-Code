import React, { useState } from 'react'
import { Sun, Moon, Trash2 } from 'lucide-react'

export default function EntryScreen({ onJoinRoom, socket, theme, toggleTheme }) {
  const [username, setUsername] = useState('')
  const [roomId, setRoomId] = useState('')
  const [recentRooms, setRecentRooms] = useState(() => {
    try {
      const stored = localStorage.getItem('collabify_recent_rooms')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      return []
    }
  })

  // ... rest of the component state/functions ...
  const saveToRecent = (id, user) => {
    try {
      let rooms = [...recentRooms]
      const existingIdx = rooms.findIndex((r) => r.roomId === id)
      if (existingIdx >= 0) {
        rooms.splice(existingIdx, 1)
      }
      rooms.unshift({ roomId: id, username: user, lastAccessed: new Date().toISOString() })
      if (rooms.length > 5) rooms = rooms.slice(0, 5)
      setRecentRooms(rooms)
      localStorage.setItem('collabify_recent_rooms', JSON.stringify(rooms))
    } catch (e) {
      console.error('Failed to save to recent rooms', e)
    }
  }

  const handleDeleteRoom = (id, e) => {
    e.stopPropagation() // Prevent filling the room ID input
    if (window.confirm(`Permanently delete room ${id} and all its data from the server?`)) {
      socket.emit('room:delete', id, (res) => {
        if (res.success) {
          const updated = recentRooms.filter(r => r.roomId !== id)
          setRecentRooms(updated)
          localStorage.setItem('collabify_recent_rooms', JSON.stringify(updated))
        } else {
          alert('Failed to delete room from server: ' + res.error)
        }
      })
    }
  }

  const handleCreate = () => {
    if (username.length < 2) return alert('Username must be at least 2 characters')
    socket.emit('create-room', username, (res) => {
      if (res.success) {
        saveToRecent(res.roomId, username)
        onJoinRoom(res.roomId, username, res.users)
      } else {
        alert(res.error || 'Failed to create room')
      }
    })
  }

  const handleJoin = () => {
    if (username.length < 2) return alert('Username must be at least 2 characters')
    if (roomId.length < 3) return alert('Enter a valid room ID')
    socket.emit('join-room', roomId, username, (res) => {
      console.log('[DEBUG] EntryScreen handleJoin raw response:', res)
      if (res.success) {
        saveToRecent(res.roomId, username)
        onJoinRoom(res.roomId, username, res.users)
      } else {
        alert(res.error || 'Failed to join room')
      }
    })
  }

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to PERMANENTLY clear your recent rooms history and delete all their data from the server?')) {
      // Loop through all recent rooms and delete from backend
      recentRooms.forEach(room => {
        socket.emit('room:delete', room.roomId)
      })
      
      setRecentRooms([])
      localStorage.removeItem('collabify_recent_rooms')
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Theme Toggle Button */}

        <button 
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            padding: '0.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Collabify</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Real-time collaborative coding</p>

        <div style={styles.inputGroup}>
          <input 
            type="text" 
            placeholder="Enter your username..." 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', marginBottom: '1.5rem', textAlign: 'center' }}
          />
        </div>

        <button onClick={handleCreate} style={{ ...styles.btn, backgroundColor: 'var(--accent)', color: '#fff', width: '100%', marginBottom: '2rem' }}>
          Create New Room
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: 'var(--text-secondary)' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          <span style={{ padding: '0 1rem', fontSize: '0.85rem' }}>or join an existing room</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          <input 
            type="text" 
            placeholder="Room ID..." 
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={handleJoin} style={{ ...styles.btn, backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            Join
          </button>
        </div>

        {recentRooms.length > 0 && (
          <div style={{ marginTop: '2rem', textAlign: 'left' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '0.75rem' 
            }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Recent Rooms
              </div>
              <button 
                onClick={clearHistory}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--danger)', 
                  fontSize: '0.75rem', 
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                onMouseOut={(e) => e.target.style.background = 'none'}
              >
                Clear History
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentRooms.map((room) => (
                <div 
                  key={room.roomId}
                  onClick={() => {
                    setUsername(room.username);
                    setRoomId(room.roomId);
                  }}
                  style={{ 
                    padding: '0.75rem', 
                    backgroundColor: 'var(--bg-elevated)', 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'transform 0.2s, background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
                    e.currentTarget.style.transform = 'translateX(4px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                  title="Click to fill details"
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{room.roomId}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>as {room.username}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'right' }}>
                      {new Date(room.lastAccessed).toLocaleDateString()}
                    </div>
                    <button
                      onClick={(e) => handleDeleteRoom(room.roomId, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.2s, background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--danger)'
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)'
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                      title="Permanently delete from server"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'var(--bg-surface)',
    padding: '3rem',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '450px',
    textAlign: 'center',
    border: '1px solid var(--border)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    position: 'relative',
    zIndex: 1
  },
  btn: {
    padding: '0.75rem 1.5rem',
    fontWeight: '600',
    fontSize: '1rem',
  }
}
