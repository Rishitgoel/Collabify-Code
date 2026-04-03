import React, { useState, useEffect, useRef } from 'react'
import { Folder, File, FileCode2, FileJson, FileImage, Image as ImageIcon, ChevronRight, ChevronDown, Plus, Trash2, Edit2, Upload, FilePlus, FolderPlus, FolderOpen } from 'lucide-react'

const getFileIcon = (filename) => {
  if (!filename) return <File size={16} />
  const ext = filename.split('.').pop().toLowerCase()
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'html':
    case 'css':
      return <FileCode2 size={16} color="var(--accent)" />
    case 'json':
      return <FileJson size={16} color="#FBBF24" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
      return <ImageIcon size={16} color="#4ADE80" />
    default:
      return <File size={16} color="var(--text-secondary)" />
  }
}

export default function FileManager({ socket, onOpenFile, localHandles, setLocalHandles }) {
  const [tree, setTree] = useState([])
  const [expandedFolders, setExpandedFolders] = useState(new Set(['']))
  const [isSyncing, setIsSyncing] = useState(false)
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const currentDirHandleRef = useRef(null)

  const EXCLUDED_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', 'target', 'vendor', '__pycache__', '.vercel', '.idea', '.vscode', 'out', 'coverage', 'venv', 'env']

  useEffect(() => {
    socket.emit('file:list', (initialTree) => {
      setTree(initialTree)
    })

    socket.on('file:refresh', (newTree) => {
      setTree(newTree)
    })

    return () => {
      socket.off('file:refresh')
    }
  }, [socket])

  const handleOpenLocalFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('Your browser does not support the File System Access API. Please use Chrome or Edge.')
      return
    }

    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
      currentDirHandleRef.current = dirHandle
      await handleResync()
      alert(`Successfully synced local folder: ${dirHandle.name}`)
    } catch (err) {
      setIsSyncing(false)
      if (err.name !== 'AbortError') {
        console.error('Error opening local folder:', err)
        alert('Failed to open local folder.')
      }
    }
  }

  const handleResync = async () => {
    if (!currentDirHandleRef.current) return
    
    setIsSyncing(true)
    const newHandles = new Map()

    try {
      const scanFolder = async (handle, relativePath = '') => {
        for await (const entry of handle.values()) {
          const entryPath = (relativePath ? `${relativePath}/${entry.name}` : entry.name).trim().replace(/\\/g, '/')
          
          if (entry.kind === 'directory') {
            if (EXCLUDED_DIRS.includes(entry.name)) continue
            await new Promise((resolve) => socket.emit('folder:create', entryPath, () => resolve()))
            await scanFolder(entry, entryPath)
          } else {
            newHandles.set(entryPath, entry)
            
            // Read content and sync to backend
            const file = await entry.getFile()
            const content = await file.text()
            await new Promise((resolve) => socket.emit('file:create', entryPath, content, () => resolve()))
          }
        }
      }

      await scanFolder(currentDirHandleRef.current)
      setLocalHandles(newHandles)
      console.log(`[LOCAL] Sync complete. Total handles: ${newHandles.size}`)
    } catch (err) {
      console.error('[LOCAL] Sync error:', err)
      alert('Sync failed. Please ensure you have granted permissions.')
    } finally {
      setIsSyncing(false)
    }
  }

  const checkFileExists = (nodes, pathToCheck) => {
    for (const node of nodes) {
      if (node.path === pathToCheck) return true
      if (node.children && checkFileExists(node.children, pathToCheck)) return true
    }
    return false
  }

  const getOrCreateLocalHandle = async (fullPath, type = 'file') => {
    if (!currentDirHandleRef.current) return null
    const parts = fullPath.split('/').filter(p => p.length > 0)
    let currentDir = currentDirHandleRef.current
    
    // Traverse to the parent directory
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true })
    }
    
    const name = parts[parts.length - 1]
    if (type === 'directory') {
      return await currentDir.getDirectoryHandle(name, { create: true })
    } else {
      return await currentDir.getFileHandle(name, { create: true })
    }
  }

  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath)
    } else {
      newExpanded.add(folderPath)
    }
    setExpandedFolders(newExpanded)
  }

  const handleCreateFile = async (basePath = '') => {
    const name = prompt('Enter file name:')
    if (!name) return
    const fullPath = (basePath ? `${basePath}/${name}` : name).trim().replace(/\\/g, '/')
    
    if (checkFileExists(tree, fullPath)) {
      alert(`File "${fullPath}" already exists!`)
      return
    }

    // 1. Create on Server
    socket.emit('file:create', fullPath, '', (res) => {
      if (res && res.error) alert(`Error creating file: ${res.error}`)
    })

    // 2. Create on Local Disk if workspace is open
    if (currentDirHandleRef.current) {
      try {
        const handle = await getOrCreateLocalHandle(fullPath, 'file')
        if (handle) {
          const newHandles = new Map(localHandles)
          newHandles.set(fullPath, handle)
          setLocalHandles(newHandles)
          console.log(`[LOCAL] Mirrored creation for: ${fullPath}`)
        }
      } catch (err) {
        console.error('[LOCAL] Mirroring failed for creation:', err)
      }
    }
  }

  const handleCreateFolder = async (basePath = '') => {
    const name = prompt('Enter folder name:')
    if (!name) return
    const fullPath = (basePath ? `${basePath}/${name}` : name).trim().replace(/\\/g, '/')
    
    if (checkFileExists(tree, fullPath)) {
      alert(`Folder "${fullPath}" already exists!`)
      return
    }

    // 1. Create on Server
    socket.emit('folder:create', fullPath, (res) => {
      if (res && res.error) alert(`Error creating folder: ${res.error}`)
    })

    // 2. Create on Local Disk if workspace is open
    if (currentDirHandleRef.current) {
      try {
        await getOrCreateLocalHandle(fullPath, 'directory')
        console.log(`[LOCAL] Mirrored folder creation for: ${fullPath}`)
        // We don't need to store directory handles in localHandles currently, 
        // as handleSave only needs file handles.
      } catch (err) {
        console.error('[LOCAL] Mirroring failed for folder creation:', err)
      }
    }
  }

  const handleDelete = async (e, path) => {
    e.stopPropagation()
    if (confirm(`Are you sure you want to delete ${path}?`)) {
      // 1. Delete from Server
      socket.emit('file:delete', path, (res) => {
        if (res && res.error) alert(`Error deleting: ${res.error}`)
      })

      // 2. Delete from Local Disk if open
      if (currentDirHandleRef.current) {
        try {
          const parts = path.split('/').filter(p => p.length > 0)
          let currentDir = currentDirHandleRef.current
          
          // Traverse to the parent directory
          for (let i = 0; i < parts.length - 1; i++) {
            currentDir = await currentDir.getDirectoryHandle(parts[i])
          }
          
          const name = parts[parts.length - 1]
          await currentDir.removeEntry(name, { recursive: true })
          
          // Update handle map
          const newHandles = new Map(localHandles)
          newHandles.delete(path)
          setLocalHandles(newHandles)
          console.log(`[LOCAL] Mirrored deletion for: ${path}`)
        } catch (err) {
          console.error('[LOCAL] Mirroring failed for deletion:', err)
        }
      }
    }
  }

  const handleRename = (e, oldPath) => {
    e.stopPropagation()
    const newName = prompt('Enter new name:', oldPath.split('/').pop())
    if (!newName) return
    const parts = oldPath.split('/')
    parts.pop()
    const newPath = parts.length > 0 ? `${parts.join('/')}/${newName}` : newName
    socket.emit('file:rename', oldPath, newPath, (res) => {
        if (res && res.error) alert(`Error renaming: ${res.error}`)
    })
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Filter out common large/hidden folders that would overwhelm the socket
    const filteredFiles = files.filter(file => {
      const path = file.webkitRelativePath || file.name
      return !EXCLUDED_DIRS.some(dir => path.includes(`${dir}/`))
    })

    if (filteredFiles.length < files.length) {
      console.log(`Skipped ${files.length - filteredFiles.length} files from excluded directories (node_modules, etc.).`)
    }

    // Process files sequentially to avoid overwhelming the socket connection
    for (const file of filteredFiles) {
      const path = file.webkitRelativePath || file.name

      if (checkFileExists(tree, path)) {
        // Overwrite or skip logic
      }

      await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          socket.emit('file:create', path, ev.target.result, (res) => {
            if (res && res.error) {
              console.error(`Error uploading "${path}":`, res.error)
            }
            resolve()
          })
        }
        reader.onerror = () => {
          console.error(`Error reading "${path}"`)
          resolve()
        }
        reader.readAsText(file)
      })
    }
    
    // Clear input
    e.target.value = null
  }


  const renderTree = (nodes, depth = 0) => {
    const sorted = [...nodes].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name)
      return a.type === 'folder' ? -1 : 1
    })

    return sorted.map((node) => {
      const isExpanded = expandedFolders.has(node.path)
      const paddingLeft = `${depth * 1 + 0.5}rem`

      if (node.type === 'folder') {
        return (
          <div key={node.path}>
            <div 
              style={{ ...styles.item, paddingLeft }}
              onClick={() => toggleFolder(node.path)}
              className="tree-item"
            >
              <span style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '0.25rem' }}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={16} color="#60A5FA" fill="#60A5FA" fillOpacity={0.2} />
                <span className="truncate">{node.name}</span>
              </span>
              <div className="item-actions">
                <FilePlus size={14} onClick={(e) => { e.stopPropagation(); handleCreateFile(node.path) }} title="New File" />
                <FolderPlus size={14} onClick={(e) => { e.stopPropagation(); handleCreateFolder(node.path) }} title="New Folder" />
                <Edit2 size={12} onClick={(e) => handleRename(e, node.path)} />
                <Trash2 size={12} onClick={(e) => handleDelete(e, node.path)} className="text-danger" />
              </div>
            </div>
            {isExpanded && node.children && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        )
      }

      // File
      return (
        <div 
          key={node.path} 
          style={{ ...styles.item, paddingLeft: `${(depth * 1) + 1.5}rem` }}
          onClick={() => onOpenFile(node)}
          className="tree-item"
        >
          <span style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '0.35rem' }}>
            {getFileIcon(node.name)}
            <span className="truncate">{node.name}</span>
          </span>
          <div className="item-actions">
            <Edit2 size={12} onClick={(e) => handleRename(e, node.path)} />
            <Trash2 size={12} onClick={(e) => handleDelete(e, node.path)} className="text-danger" />
          </div>
        </div>
      )
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={styles.toolbar}>
        <div className="toolbar-btn" onClick={() => handleCreateFile('')} title="New File">
          <FilePlus size={16} />
        </div>
        <div className="toolbar-btn" onClick={() => handleCreateFolder('')} title="New Folder">
          <FolderPlus size={16} />
        </div>
        <div className="toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Upload Files">
          <Upload size={16} />
        </div>
        <div 
           className={`toolbar-btn ${isSyncing ? 'pulse' : ''}`} 
           onClick={handleOpenLocalFolder} 
           title="Open Local Workspace (WOW Factor)"
           style={{ color: 'var(--accent)', border: '1px solid var(--accent-transparent)' }}
        >
           <FolderOpen size={16} />
        </div>

        {currentDirHandleRef.current && (
          <div 
            className="toolbar-btn" 
            onClick={handleResync} 
            title="Re-sync Local Folder"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Upload size={16} className={isSyncing ? 'spin' : ''} />
          </div>
        )}
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload} 
        />
      </div>
      <div style={styles.treeContainer}>
        {isSyncing ? (
           <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent)' }}>
             <div className="spinner-small" style={{ margin: '0 auto 1rem' }} />
             Syncing local project...
           </div>
        ) : tree.length === 0 ? (
           <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
             Workspace is empty. Create or upload a file.
           </div>
        ) : (
          renderTree(tree)
        )}
      </div>
    </div>
  )
}

const styles = {
  toolbar: {
    display: 'flex',
    padding: '0.5rem',
    borderBottom: '1px solid var(--border)',
    gap: '0.5rem'
  },
  treeContainer: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBottom: '1rem',
    paddingTop: '0.5rem'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.35rem 0.5rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    transition: 'background-color 0.1s',
    userSelect: 'none'
  }
}
