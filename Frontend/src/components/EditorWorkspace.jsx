import React, { useState, useRef } from 'react'
import FileManager from './FileManager'
import Tabs from './Tabs'
import CodeEditor from './CodeEditor'
import Terminal from './Terminal'
import ChatPanel from './ChatPanel'
import ParticipantsList from './ParticipantsList'
import GitManager from './GitManager'
import { MessageSquare, Play, Copy, Check, Save, Sun, Moon, HardDrive, Folder, GitBranch, Github } from 'lucide-react'
import { Panel, Group, Separator } from 'react-resizable-panels'

export default function EditorWorkspace({ roomId, username, initialUsers = [], onLeaveRoom, socket, theme, toggleTheme, localHandles, setLocalHandles }) {
  const [openFiles, setOpenFiles] = useState([])
  const [activeFile, setActiveFile] = useState(null)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [roomUsers, setRoomUsers] = useState(initialUsers)
  const [savedToast, setSavedToast] = useState(null) // { name: string, isLocal: boolean }
  const [activeSidebarTab, setActiveSidebarTab] = useState('files')
  
  const editorRef = useRef(null)

  // ... (rest of the hooks and handlers stay the same) ...
  const [githubToken, setGithubToken] = useState(localStorage.getItem('githubToken') || '')
  const BACKEND_URL = socket.io.uri || 'http://localhost:3001'

  React.useEffect(() => {
    const handleMessage = (event) => {
      const expectedOrigin = new URL(BACKEND_URL).origin
      if (event.origin !== expectedOrigin) return

      if (event.data && event.data.type === 'GITHUB_TOKEN') {
        setGithubToken(event.data.payload)
        localStorage.setItem('githubToken', event.data.payload)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [BACKEND_URL])

  const handleGitHubLogin = () => {
    const width = 500
    const height = 600
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2
    window.open(`${BACKEND_URL}/auth/github`, 'github-oauth', `width=${width},height=${height},top=${top},left=${left}`)
  }

  React.useEffect(() => {
    const handleUsers = (users) => setRoomUsers(users)
    
    const handleFileDeleted = (deletedPath) => {
      setOpenFiles(prevOpen => {
        const remaining = prevOpen.filter(f => f.path !== deletedPath && !f.path.startsWith(deletedPath + '/'))
        
        setActiveFile(prevActive => {
           if (prevActive && (prevActive.path === deletedPath || prevActive.path.startsWith(deletedPath + '/'))) {
               return remaining.length > 0 ? remaining[remaining.length - 1] : null
           }
           return prevActive
        })
        
        return remaining
      })
    }
    
    const handleFileRenamed = ({ oldPath, newPath }) => {
      // Simplest approach: close the old tab so they can reopen the new one
      handleFileDeleted(oldPath)
    }

    socket.on('room:users', handleUsers)
    socket.on('file:deleted', handleFileDeleted)
    socket.on('file:renamed', handleFileRenamed)
    return () => {
      socket.off('room:users', handleUsers)
      socket.off('file:deleted', handleFileDeleted)
      socket.off('file:renamed', handleFileRenamed)
    }
  }, [socket])

  const handleManualSave = () => {
    if (activeFile && editorRef.current) {
      handleSave(activeFile.path, editorRef.current.getValue(), true)
    }
  }

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const handleOpenFile = (node) => {
    if (!openFiles.find(f => f.path === node.path)) {
      setOpenFiles(prev => [...prev, node])
    }
    setActiveFile(node)
  }

  const handleCloseFile = (path) => {
    const newOpenFiles = openFiles.filter(f => f.path !== path)
    setOpenFiles(newOpenFiles)
    if (activeFile?.path === path) {
      setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null)
    }
  }

  const handleSave = async (path, content, isManual = false) => {
    let savedLocally = false
    const normalizedPath = path.trim().replace(/\\/g, '/')

    // 1. Save to Render Server (for Terminal/Collab)
    socket.emit('file:save', normalizedPath, content, (res) => {
      if (res && res.error) {
        console.error('Server save error:', res.error)
      } else if (isManual && !savedLocally) {
        setSavedToast({ name: normalizedPath.split('/').pop(), isLocal: false })
        setTimeout(() => setSavedToast(null), 2000)
      }
    })

    // 2. Save back to Local Disk iff manual save
    if (!isManual) return

    // Fallback: use global singleton if prop for some reason is stale or empty
    const handlesMap = (localHandles && localHandles.size > 0) ? localHandles : (window.collabifyHandles || new Map())
    
    // Try exact match
    let handle = handlesMap.get(normalizedPath)
    
    // Fallback: Case-insensitive match if exact fails
    if (!handle) {
      const keys = Array.from(handlesMap.keys())
      const lowerPath = normalizedPath.toLowerCase()
      const match = keys.find(k => k.toLowerCase() === lowerPath)
      if (match) {
        handle = handlesMap.get(match)
        console.log(`[LOCAL] Exact match failed, but found case-insensitive match: ${match}`)
      }
    }

    if (handle) {
      try {
        const permissionStatus = await handle.queryPermission({ mode: 'readwrite' })
        if (permissionStatus !== 'granted') {
           const requested = await handle.requestPermission({ mode: 'readwrite' })
           if (requested !== 'granted') throw new Error('Permission denied')
        }

        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        
        savedLocally = true
        setSavedToast({ name: normalizedPath.split('/').pop(), isLocal: true })
        setTimeout(() => setSavedToast(null), 2000)
        console.log(`[LOCAL] Success manual saving: ${path}`)

      } catch (err) {
        console.error(`[LOCAL] Error manual saving: ${path}`, err)
        alert(`Failed to save to your computer: ${err.message}`)
      }
    } else {
      console.warn(`[LOCAL] No handle found for: ${normalizedPath}`)
      console.log(`[LOCAL] Available handles in memory:`, Array.from(handlesMap.keys()))
      
      // If we see handles in the list but not the one we want, it's definitely a path naming issue
      if (handlesMap.size > 0) {
        alert(`Local save skipped: This file was not found in your opened local folder. (Path: ${normalizedPath})`)
      }
    }
  }

  const handleRunFile = () => {
    if (!activeFile) return
    const ext = activeFile.path.split('.').pop().toLowerCase()
    const safePath = `"${activeFile.path}"`
    let cmd = ''
    
    switch (ext) {
      case 'js': cmd = `node ${safePath}`; break
      case 'py': cmd = `python ${safePath}`; break
      case 'java': cmd = `java ${safePath}`; break
      case 'cpp': cmd = `g++ ${safePath} -o program.exe ; .\\program.exe`; break
      case 'c': cmd = `gcc ${safePath} -o program.exe ; .\\program.exe`; break
      case 'go': cmd = `go run ${safePath}`; break
      case 'rs': cmd = `rustc ${safePath} -o program.exe ; .\\program.exe`; break
      default: cmd = `echo "Auto-run not supported for .${ext} files"`; break
    }
    
    socket.emit('terminal:input', cmd + '\r\n')
  }

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      
      {/* Toast Notification */}
      {savedToast && (
        <div className={`save-toast ${savedToast.isLocal ? 'local' : ''}`}>
          {savedToast.isLocal ? <HardDrive size={14} /> : <Save size={14} />}
          Saved {savedToast.name}
        </div>
      )}
      <div style={styles.topBar}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: '600' }}>Room: </span>
          <span style={{ color: 'var(--text-accent)' }}>{roomId}</span>
          <button
            onClick={handleCopyRoomId}
            title="Copy Room ID"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: copied ? '#4ADE80' : 'var(--text-secondary)',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.2s ease'
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>● {username}</span>
          
          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme}
            style={{ ...styles.leaveBtn, color: 'var(--text-primary)', borderColor: 'var(--border)', padding: '0.35rem' }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {activeFile && (
            <>
              <button 
                onClick={handleManualSave}
                style={{ ...styles.leaveBtn, color: 'var(--text-primary)', borderColor: 'var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                title="Save File (Ctrl+S)"
              >
                <Save size={16} fill="currentColor" /> Save
              </button>
              <button 
                onClick={handleRunFile}
                style={{ ...styles.leaveBtn, color: '#4ADE80', borderColor: '#4ADE80', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                title="Run File"
              >
                <Play size={16} fill="currentColor" /> Run
              </button>
            </>
          )}
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)} 
            style={{ ...styles.leaveBtn, color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            title="Toggle Chat"
          >
            <MessageSquare size={16} />
          </button>
          <button onClick={onLeaveRoom} style={styles.leaveBtn}>Leave Room</button>
        </div>
      </div>


      {/* Main Layout */}
      <Group orientation="horizontal" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Sidebar */}
        <Panel id="sidebar" order={1} defaultSize={20} minSize={10} style={{ backgroundColor: 'var(--bg-elevated)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{...styles.panelHeader, display: 'flex', gap: '0', padding: '0'}}>
            <button 
              style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeSidebarTab === 'files' ? '2px solid var(--accent)' : '2px solid transparent', color: activeSidebarTab === 'files' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold' }}
              onClick={() => setActiveSidebarTab('files')}
            ><Folder size={14}/> Files</button>
            <button 
              style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeSidebarTab === 'git' ? '2px solid var(--accent)' : '2px solid transparent', color: activeSidebarTab === 'git' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold' }}
              onClick={() => setActiveSidebarTab('git')}
            ><GitBranch size={14}/> Git</button>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeSidebarTab === 'files' ? (
              <FileManager 
                socket={socket} 
                onOpenFile={handleOpenFile} 
                localHandles={localHandles}
                setLocalHandles={setLocalHandles}
              />
            ) : (
              <GitManager socket={socket} githubToken={githubToken} />
            )}
          </div>
          
          <div style={{ padding: githubToken ? '0.5rem 1rem' : '1rem', borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
            {githubToken ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#4ADE80', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={14} /> Signed in (GitHub)
                </div>
                <button 
                  onClick={() => { setGithubToken(''); localStorage.removeItem('githubToken'); }} 
                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGitHubLogin}
                style={{ width: '100%', padding: '0.5rem', backgroundColor: '#24292e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}
              >
                <Github size={16} /> Sign in with GitHub
              </button>
            )}
          </div>

          <ParticipantsList users={roomUsers} currentUserId={socket.id} />
        </Panel>

        <Separator className="panel-resize-handle" />

        {/* Center: Editor + Terminal */}
        <Panel id="center" order={2} defaultSize={isChatOpen ? 60 : 80} minSize={30}>
          <Group orientation="vertical">
            
            {/* Editor Area */}
            <Panel id="editor" order={1} defaultSize={70} minSize={20} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Tabs 
                openFiles={openFiles} 
                activeFile={activeFile} 
                onSelect={setActiveFile} 
                onClose={handleCloseFile} 
              />
              <div style={{ flex: 1, backgroundColor: '#0A0A14', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <CodeEditor 
                  key={activeFile ? activeFile.path : 'empty'}
                  roomId={roomId}
                  file={activeFile}
                  username={username}
                  socket={socket}
                  onSave={handleSave}
                  editorRef={editorRef}
                  theme={theme}
                />

              </div>
            </Panel>

            <Separator className="panel-resize-handle" />

            {/* Terminal */}
            <Panel id="terminal" order={2} defaultSize={30} minSize={10} style={{ backgroundColor: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <div style={styles.panelHeader}>Terminal</div>
              <div style={{ flex: 1, padding: '0 1rem', overflow: 'hidden' }}>
                <Terminal socket={socket} roomId={roomId} theme={theme} />
              </div>

            </Panel>
            
          </Group>
        </Panel>

        {/* Chat Panel */}
        {isChatOpen && (
          <>
            <Separator className="panel-resize-handle" />
            <Panel id="chat" order={3} defaultSize={20} minSize={15} style={{ backgroundColor: 'var(--bg-elevated)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <div style={styles.panelHeader}>Chat & Voice</div>
              <ChatPanel socket={socket} username={username} roomUsers={roomUsers} />
            </Panel>
          </>
        )}
      </Group>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%'
  },
  topBar: {
    height: '48px',
    backgroundColor: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 1rem',
    zIndex: 10
  },
  leaveBtn: {
    backgroundColor: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    padding: '0.25rem 0.75rem',
    fontSize: '0.875rem'
  },
  mainLayout: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  sidebar: {
    width: '250px',
    backgroundColor: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column'
  },
  panelHeader: {
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--bg-elevated)',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  editorArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  tabsHeader: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
    color: 'var(--text-secondary)'
  },
  terminalPanel: {
    height: '200px',
    backgroundColor: 'var(--bg-surface)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column'
  },
  chatPanel: {
    width: '300px',
    backgroundColor: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column'
  }
}
