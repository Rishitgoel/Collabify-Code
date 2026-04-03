import React, { useState, useEffect, useRef } from 'react'
import { Folder, File, FileCode2, FileJson, FileImage, Image as ImageIcon, ChevronRight, ChevronDown, Plus, Trash2, Edit2, Upload, FilePlus, FolderPlus } from 'lucide-react'

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

export default function FileManager({ socket, onOpenFile }) {
  const [tree, setTree] = useState([])
  const [expandedFolders, setExpandedFolders] = useState(new Set(['']))
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

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

  const checkFileExists = (nodes, pathToCheck) => {
    for (const node of nodes) {
      if (node.path === pathToCheck) return true
      if (node.children && checkFileExists(node.children, pathToCheck)) return true
    }
    return false
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

  const handleCreateFile = (basePath = '') => {
    const name = prompt('Enter file name:')
    if (!name) return
    const fullPath = basePath ? `${basePath}/${name}` : name
    if (checkFileExists(tree, fullPath)) {
      alert(`File "${fullPath}" already exists!`)
      return
    }
    socket.emit('file:create', fullPath, '', (res) => {
      if (res && res.error) alert(`Error creating file: ${res.error}`)
    })
  }

  const handleCreateFolder = (basePath = '') => {
    const name = prompt('Enter folder name:')
    if (!name) return
    const fullPath = basePath ? `${basePath}/${name}` : name
    if (checkFileExists(tree, fullPath)) {
      alert(`Folder "${fullPath}" already exists!`)
      return
    }
    socket.emit('folder:create', fullPath, (res) => {
        if (res && res.error) alert(`Error creating folder: ${res.error}`)
    })
  }

  const handleDelete = (e, path) => {
    e.stopPropagation()
    if (confirm(`Are you sure you want to delete ${path}?`)) {
      socket.emit('file:delete', path, (res) => {
        if (res && res.error) alert(`Error deleting: ${res.error}`)
      })
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
    const EXCLUDED_DIRS = ['node_modules', '.git', '.next', 'dist', 'build']
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
        // For large uploads, we might want to automatically skip or overwrite 
        // to avoid thousands of confirm dialogs.
        // Let's just overwrite for now or only prompt once.
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
    // Sort: folders first, then files alphabetically
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
        <div className="toolbar-btn" onClick={() => folderInputRef.current?.click()} title="Upload Folder">
          <Folder size={16} /><Upload size={10} style={{ position: 'absolute', bottom: 4, right: 4 }} />
        </div>
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload} 
        />
        <input 
          type="file" 
          webkitdirectory="true" 
          directory="true" 
          multiple 
          ref={folderInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload} 
        />
      </div>
      <div style={styles.treeContainer}>
        {tree.length === 0 ? (
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
