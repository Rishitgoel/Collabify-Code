import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

export default function Terminal({ socket, roomId }) {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!terminalRef.current || initializedRef.current) return
    initializedRef.current = true

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      scrollback: 5000,
      disableStdin: false,
      theme: {
        background: '#0A0A14',
        foreground: '#F0EFF4',
        cursor: '#7B61FF',
        selectionBackground: 'rgba(123, 97, 255, 0.3)',
      }
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
      if (term.element) {
        fitAddon.fit()
        socket.emit('terminal:resize', { cols: term.cols, rows: term.rows })
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      // Throttle or direct fit to react to the React-Resizable-Panels continuous dragged bounding box
      requestAnimationFrame(handleResize)
    })
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    // Scroll automatically on new incoming output
    const handleOutput = (data) => {
      term.write(data)
    }

    socket.on('terminal:output', handleOutput)

    return () => {
      socket.off('terminal:output', handleOutput)
      resizeObserver.disconnect()
      term.dispose()
      initializedRef.current = false
    }
  }, [socket, roomId])

  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', padding: '0.25rem 0' }} ref={terminalRef} />
  )
}
