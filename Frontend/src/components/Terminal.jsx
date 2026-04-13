import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { Lock, Unlock, User, Users, ChevronRight, Plus, X } from 'lucide-react'

export default function Terminal({ socket, roomId, theme, terminalState, setTerminalState, roomUsers }) {
  const { mode, termId } = terminalState

  const indvDomRefs = useRef(new Map())
  const indvXtermRefs = useRef(new Map())
  const indvFitRefs = useRef(new Map())
  const initializedIndvIds = useRef(new Set())

  const sharedTerminalRef = useRef(null)
  const sharedXterm = useRef(null)
  const sharedFit = useRef(null)
  const initializedShared = useRef(false)

  const [activeIndvTerminals, setActiveIndvTerminals] = useState([])
  const [currentController, setCurrentController] = useState(null)
  const [controlQueue, setControlQueue] = useState([])

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
    const activeTheme = theme === 'dark' ? darkTheme : lightTheme
    indvXtermRefs.current.forEach(term => { term.options.theme = activeTheme })
    if (sharedXterm.current) sharedXterm.current.options.theme = activeTheme
  }, [theme])

  // Initial load request and socket bindings
  useEffect(() => {
    socket.emit('terminal:request_active')

    const handleActiveIndividual = (termIds) => {
      setActiveIndvTerminals(termIds)
      setTerminalState(prev => {
        if (prev.mode === 'individual' && (!prev.termId || !termIds.includes(prev.termId))) {
          return { ...prev, mode: termIds.length === 0 ? 'shared' : 'individual', termId: termIds.length > 0 ? termIds[0] : null }
        }
        return prev
      })
    }
    socket.on('terminal:active_individual', handleActiveIndividual)

    const handleOutputIndv = ({ termId: outTermId, data }) => {
      const term = indvXtermRefs.current.get(outTermId)
      if (term) term.write(data)
    }
    socket.on('terminal:output_individual', handleOutputIndv)

    if (!initializedShared.current && sharedTerminalRef.current) {
      initializedShared.current = true
      const term = new XTerm({
        cursorBlink: true, fontFamily: 'var(--font-mono)', fontSize: 14, scrollback: 5000,
        theme: theme === 'dark' ? darkTheme : lightTheme
      })
      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(sharedTerminalRef.current)
      sharedXterm.current = term
      sharedFit.current = fitAddon

      socket.emit('terminal:join_shared')
      term.onData(data => socket.emit('terminal:input', { type: 'shared', data }))
    }

    const handleOutputShared = data => { if (sharedXterm.current) sharedXterm.current.write(data) }
    socket.on('terminal:output_shared', handleOutputShared)

    const handleControlUpdated = ({ currentController: cc, controlQueue: cq }) => {
      setCurrentController(cc)
      setControlQueue(cq)
      if (sharedXterm.current) {
        sharedXterm.current.options.disableStdin = cc !== socket.id
        sharedXterm.current.options.cursorBlink = cc === socket.id
      }
    }
    socket.on('terminal:control_updated', handleControlUpdated)

    return () => {
      socket.off('terminal:active_individual', handleActiveIndividual)
      socket.off('terminal:output_individual', handleOutputIndv)
      socket.off('terminal:output_shared', handleOutputShared)
      socket.off('terminal:control_updated', handleControlUpdated)
    }
  }, [socket, setTerminalState, theme])

  // Mount specific individual terminals when their DOM container is ready
  useEffect(() => {
    activeIndvTerminals.forEach(tId => {
      const domRef = indvDomRefs.current.get(tId)
      if (domRef && !initializedIndvIds.current.has(tId)) {
        initializedIndvIds.current.add(tId)

        const term = new XTerm({
          cursorBlink: true, fontFamily: 'var(--font-mono)', fontSize: 14, scrollback: 5000,
          theme: theme === 'dark' ? darkTheme : lightTheme
        })
        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(domRef)

        indvXtermRefs.current.set(tId, term)
        indvFitRefs.current.set(tId, fitAddon)

        term.onData(data => socket.emit('terminal:input', { type: 'individual', termId: tId, data }))
      }
    })
    
    // Cleanup removed terminals
    initializedIndvIds.current.forEach(tId => {
       if (!activeIndvTerminals.includes(tId)) {
          const obsoleteTerm = indvXtermRefs.current.get(tId)
          if (obsoleteTerm) try { obsoleteTerm.dispose() } catch(e){}
          indvXtermRefs.current.delete(tId)
          indvFitRefs.current.delete(tId)
          initializedIndvIds.current.delete(tId)
       }
    })
  }, [activeIndvTerminals, socket, theme])

  // Resizing Observers
  useEffect(() => {
    const handleResize = () => {
      if (mode === 'individual' && termId) {
        const fit = indvFitRefs.current.get(termId)
        const term = indvXtermRefs.current.get(termId)
        if (fit && term?.element?.offsetParent) {
          try { fit.fit(); socket.emit('terminal:resize', { type: 'individual', termId, cols: term.cols, rows: term.rows }) } catch (e) {}
        }
      } else if (mode === 'shared' && sharedFit.current && sharedXterm.current?.element?.offsetParent) {
        try { sharedFit.current.fit(); socket.emit('terminal:resize', { type: 'shared', cols: sharedXterm.current.cols, rows: sharedXterm.current.rows }) } catch (e) {}
      }
    }

    const timeoutId = setTimeout(handleResize, 50)
    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(handleResize))

    if (sharedTerminalRef.current) resizeObserver.observe(sharedTerminalRef.current)
    indvDomRefs.current.forEach(ref => { if(ref) resizeObserver.observe(ref) })

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [mode, termId, socket, activeIndvTerminals])

  const handleCreatePrivate = () => {
    if (activeIndvTerminals.length >= 3) return
    const newId = `term-${Date.now()}`
    socket.emit('terminal:create_individual', { termId: newId })
    setTerminalState({ mode: 'individual', termId: newId })
  }

  const handleClosePrivate = (tId, e) => {
    e.stopPropagation()
    socket.emit('terminal:close_individual', { termId: tId })
  }

  const isController = currentController === socket.id
  const inQueue = controlQueue.includes(socket.id)
  
  const getUsername = (id) => {
    const user = roomUsers.find(u => u.id === id)
    return user ? user.username : 'Unknown'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.2rem', paddingLeft: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem', overflowX: 'auto', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          
          {activeIndvTerminals.map((tId, idx) => {
            const isActive = mode === 'individual' && termId === tId
            return (
              <div 
                key={tId}
                onClick={() => setTerminalState({ mode: 'individual', termId: tId })}
                style={{ 
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid', borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                  borderBottom: 'none', padding: '0.25rem 0.6rem', borderRadius: '4px 4px 0 0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem'
                }}
              >
                <User size={12}/> Private {idx + 1}
                <button 
                   onClick={(e) => handleClosePrivate(tId, e)}
                   style={{ background: 'transparent', border: 'none', color: 'inherit', display: 'flex', alignItems: 'center', padding: 0, marginLeft: '4px', cursor: 'pointer', opacity: 0.7 }}
                ><X size={12}/></button>
              </div>
            )
          })}

          {activeIndvTerminals.length < 3 && (
            <button 
              onClick={handleCreatePrivate}
              style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', alignSelf: 'flex-end', marginBottom: '0.3rem' }}
              title="New Private Terminal"
            >
              <Plus size={16}/>
            </button>
          )}

          {/* Separator */}
          <div style={{ width: '1px', height: '1.2rem', background: 'var(--border)', margin: '0 0.5rem', alignSelf: 'flex-end', marginBottom: '0.3rem' }} />

          <div 
            onClick={() => setTerminalState({ mode: 'shared', termId: null })}
            style={{ 
              background: mode === 'shared' ? 'var(--accent)' : 'transparent',
              color: mode === 'shared' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid', borderColor: mode === 'shared' ? 'var(--accent)' : 'var(--border)',
              borderBottom: 'none', padding: '0.25rem 0.6rem', borderRadius: '4px 4px 0 0',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem'
            }}
          >
            <Users size={12}/> Shared
          </div>

        </div>

        {/* Shared Terminal Controls */}
        {mode === 'shared' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', paddingRight: '0.5rem' }}>
            <span style={{ color: isController ? '#4ADE80' : 'var(--text-secondary)' }}>
              {isController ? 'You have control' : (currentController ? `${getUsername(currentController)} is typing` : 'Viewing mode')}
            </span>
            
            {isController ? (
              <button 
                onClick={() => socket.emit('terminal:release_control')}
                style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Unlock size={12}/> Release
              </button>
            ) : (
              <button 
                onClick={() => inQueue ? socket.emit('terminal:release_control') : socket.emit('terminal:request_control')}
                style={{ background: 'transparent', color: inQueue ? 'var(--text-secondary)' : '#4ADE80', border: `1px solid ${inQueue ? 'var(--border)' : '#4ADE80'}`, padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Lock size={12}/> {inQueue ? 'Cancel Request' : 'Request Control'}
              </button>
            )}
          </div>
        )}
      </div>

      {mode === 'shared' && controlQueue.length > 0 && (
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', overflowX: 'auto', paddingLeft: '0.5rem' }}>
            <strong>Queue:</strong>
            {controlQueue.map((uid, idx) => (
                <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {idx > 0 && <ChevronRight size={12}/>}
                    <span>{getUsername(uid)} {uid === socket.id ? '(You)' : ''}</span>
                    {isController && idx === 0 && (
                        <button 
                          onClick={() => socket.emit('terminal:pass_control', { toUserId: uid })}
                          style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '3px', padding: '1px 4px', cursor: 'pointer', fontSize: '0.65rem' }}
                        >
                          Pass
                        </button>
                    )}
                </div>
            ))}
         </div>
      )}

      {/* Terminal Playgrounds */}
      <div style={{ flex: 1, minHeight: 0, height: '100%', position: 'relative' }}>
          {activeIndvTerminals.map(tId => (
             <div 
               key={tId}
               ref={el => { if (el) indvDomRefs.current.set(tId, el) }} 
               style={{ width: '100%', height: '100%', display: (mode === 'individual' && termId === tId) ? 'block' : 'none', overflow: 'hidden' }} 
             />
          ))}
          <div ref={sharedTerminalRef} style={{ width: '100%', height: '100%', display: mode === 'shared' ? 'block' : 'none', overflow: 'hidden', opacity: (!isController && mode === 'shared') ? 0.8 : 1 }} />
      </div>
    </div>
  )
}
