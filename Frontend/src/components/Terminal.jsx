import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

export default function Terminal({ socket, roomId, theme }) {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const initializedRef = useRef(false)

  // Define terminal themes
  const darkTheme = {
    background: '#0A0A14',
    foreground: '#F0EFF4',
    cursor: '#7B61FF',
    selectionBackground: 'rgba(123, 97, 255, 0.3)',
  }

  const lightTheme = {
    background: '#F8F9FA',
    foreground: '#1A1A1A',
    cursor: '#6366F1',
    selectionBackground: 'rgba(99, 102, 241, 0.3)',
  }

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = theme === 'dark' ? darkTheme : lightTheme
    }
  }, [theme])

  useEffect(() => {
    if (!terminalRef.current || initializedRef.current) return
    initializedRef.current = true

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      scrollback: 5000,
      disableStdin: false,
      theme: theme === 'dark' ? darkTheme : lightTheme
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    
    term.open(terminalRef.current)
    
    // Slight delay to ensure parent dimensions are calculated
    setTimeout(() => {
      if (fitAddon) fitAddon.fit()
    }, 100)

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Send start signal to ensure backend starts PTY for this room
    socket.emit('terminal:start')

    term.onData((data) => {
      socket.emit('terminal:input', data)
    })

    const handleResize = () => {
      if (!initializedRef.current || !term || !term.element) return

      try {
        // Only fit if the terminal is actually in the document and visible
        if (term.element.isConnected && term.element.offsetParent !== null && fitAddon) {
          fitAddon.fit()
          socket.emit('terminal:resize', { cols: term.cols, rows: term.rows })
        }
      } catch (err) {
        // This catch handles the common "dimensions" undefined error from xterm internals
        console.debug('Terminal resize deferred:', err.message)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (initializedRef.current) {
        requestAnimationFrame(handleResize)
      }
    })
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    // Scroll automatically on new incoming output
    const handleOutput = (data) => {
      if (initializedRef.current && term) {
        term.write(data)
      }
    }

    socket.on('terminal:output', handleOutput)

    return () => {
      initializedRef.current = false
      socket.off('terminal:output', handleOutput)
      resizeObserver.disconnect()
      try {
        term.dispose()
      } catch (e) {
        console.error('Error disposing terminal:', e)
      }
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [socket, roomId])

  return (
    <div 
      style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', padding: '0.25rem 0' }} 
      ref={terminalRef} 
    />
  )
}


