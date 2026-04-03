import React, { useEffect, useRef, useState } from 'react'
import Editor, { useMonaco, loader } from '@monaco-editor/react'

// Lock monaco version for y-monaco compatibility
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0/min/vs' } });
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { MonacoBinding } from 'y-monaco'

export default function CodeEditor({ roomId, file, username, userColor, onSave, socket, editorRef, theme }) {
  const [editor, setEditor] = useState(null)
  const providerRef = useRef(null)
  const bindingRef = useRef(null)
  const [contentLoaded, setContentLoaded] = useState(false)
  const monaco = useMonaco()

  // Define language from extension
  const getLanguage = (filename) => {
    if (!filename) return 'javascript'
    const ext = filename.split('.').pop().toLowerCase()
    const map = {
      'js': 'javascript', 'jsx': 'javascript',
      'ts': 'typescript', 'tsx': 'typescript',
      'json': 'json', 'html': 'html', 'css': 'css',
      'py': 'python', 'java': 'java', 'go': 'go',
      'c': 'c', 'cpp': 'cpp', 'rs': 'rust',
      'md': 'markdown'
    }
    return map[ext] || 'plaintext'
  }

  useEffect(() => {
    if (monaco) {
      // Dark Theme
      monaco.editor.defineTheme('voidThemeDark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#0A0A14',
          'editor.lineHighlightBackground': '#1A1A2E',
          'editorLineNumber.foreground': '#6B6B80'
        }
      })

      // Light Theme
      monaco.editor.defineTheme('voidThemeLight', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#FFFFFF',
          'editor.lineHighlightBackground': '#F1F3F5',
          'editorLineNumber.foreground': '#adb5bd'
        }
      })
    }
  }, [monaco])

  useEffect(() => {
    if (monaco) {
      monaco.editor.setTheme(theme === 'dark' ? 'voidThemeDark' : 'voidThemeLight')
    }
  }, [monaco, theme])


  useEffect(() => {
    if (!file || !editor) return
    
    // Clean up previous binding
    if (bindingRef.current) bindingRef.current.destroy()
    if (providerRef.current) providerRef.current.destroy()

    const doc = new Y.Doc()
    // The provider room name is roomId + file path, so each file has its own sync room
    const syncRoom = `${roomId}:${file.path}`
    
    const wsUrl = `ws://localhost:3001/yjs`
    
    // Create connection
    const provider = new WebsocketProvider(wsUrl, syncRoom, doc)
    providerRef.current = provider

    // Set awareness (cursor and user presence)
    provider.awareness.setLocalStateField('user', {
      name: username,
      color: userColor || '#7B61FF'
    })

    const type = doc.getText('monaco')
    
    // Add binding
    const binding = new MonacoBinding(
      type,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    )
    bindingRef.current = binding

    // When the provider loads, check if the doc is empty. If it is, and we have file content from disk, load it.
    // However, Yjs sync is better initialized from the backend. For simplicity, we assume
    // the backend doesn't hold Yjs state on disk directly, we just read from disk once if Yjs is empty?
    // In our disk persistence architecture, the first person to open the file should populate it 
    // from disk if the Yjs doc is empty.
    let isFirstLoad = true
    provider.on('sync', (isSynced) => {
      if (isSynced && isFirstLoad) {
        if (type.length === 0) {
          // fetch current disk content
          socket.emit('file:read', file.path, (res) => {
            if (res && res.content && type.length === 0) {
              type.insert(0, res.content)
            }
            setContentLoaded(true)
          })
        } else {
          setContentLoaded(true)
        }
        isFirstLoad = false
      }
    })

    return () => {
      if (bindingRef.current) bindingRef.current.destroy()
      if (providerRef.current) providerRef.current.destroy()
    }
  }, [file, roomId, username, userColor, socket, editor])

  const autosaveTimeoutRef = useRef(null)

  const handleEditorDidMount = (editorInstance, monaco) => {
    setEditor(editorInstance)
    if (editorRef) {
      editorRef.current = editorInstance
    }
    
    // Add Cmd/Ctrl+S action
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave(file.path, editorInstance.getValue())
    })

    // Auto-save logic
    editorInstance.onDidChangeModelContent(() => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
      autosaveTimeoutRef.current = setTimeout(() => {
        onSave(file.path, editorInstance.getValue())
      }, 3000) // 3 seconds auto-save
    })
  }

  if (!file) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-void)' }}>
        Select a file to start editing
      </div>
    )
  }


  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', width: '100%', height: '100%' }}>
      {!contentLoaded && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'rgba(10,10,20,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          Syncing...
        </div>
      )}
      <Editor
        key={file.path /* Force remount for completely clean state isolation */}
        path={file.path}
        height="100%"
        language={getLanguage(file.name)}
        theme={theme === 'dark' ? 'voidThemeDark' : 'voidThemeLight'}
        onMount={handleEditorDidMount}

        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          fontSize: 14,
          fontFamily: 'var(--font-mono)',
          padding: { top: 16 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: true,
          formatOnPaste: true,
        }}
      />
    </div>
  )
}
