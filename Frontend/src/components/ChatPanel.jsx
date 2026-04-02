import React, { useState, useEffect, useRef, useMemo } from 'react'
import Peer from 'simple-peer'
import { Mic, MicOff, Send, Volume2, User, Wifi, WifiOff, MessageCircle } from 'lucide-react'

// WebRTC STUN servers for reliable connectivity across different networks
const peerConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  sdpSemantics: 'unified-plan'
}

export default function ChatPanel({ socket, username, roomUsers = [] }) {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef(null)

  // Voice State
  const [inVoice, setInVoice] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const localStreamRef = useRef(null)
  const peersRef = useRef(new Map()) // socketId -> peer instance
  const [, setPeersState] = useState(0) // trigger re-render on peer list changes

  useEffect(() => {
    // 1. Fetch chat history on mount
    socket.emit('chat:history', (history) => {
      setMessages(history)
      scrollToBottom()
    })

    // 2. Chat messaging handlers
    const handleMessage = (msg) => {
      setMessages(prev => [...prev, msg])
      scrollToBottom()
    }
    socket.on('chat:message', handleMessage)

    return () => {
      socket.off('chat:message', handleMessage)
    }
  }, [socket])

  useEffect(() => {
    // 3. WebRTC signaling events
    const handleUserJoinedVoice = (peerId) => {
      if (!inVoice || !localStreamRef.current) return
      console.log('[Voice] Initiating connection to newcomer:', peerId)
      createPeer(peerId, true)
    }

    const handleVoiceSignal = ({ from, signal }) => {
      if (!inVoice) return
      let peer = peersRef.current.get(from)
      if (!peer) {
        console.log('[Voice] Receiving connection from:', from)
        peer = createPeer(from, false)
      }
      peer.signal(signal)
    }

    const handleUserLeftVoice = (peerId) => {
      console.log('[Voice] User left voice:', peerId)
      destroyPeer(peerId)
    }

    socket.on('voice:user-joined', handleUserJoinedVoice)
    socket.on('voice:signal', handleVoiceSignal)
    socket.on('voice:user-left', handleUserLeftVoice)

    return () => {
      socket.off('voice:user-joined', handleUserJoinedVoice)
      socket.off('voice:signal', handleVoiceSignal)
      socket.off('voice:user-left', handleUserLeftVoice)
    }
  }, [socket, inVoice])

  // Permanent cleanup on unmount only
  useEffect(() => {
    return () => {
      leaveVoice()
    }
  }, [])


  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleSend = (e) => {
    e.preventDefault()
    if (!inputText.trim()) return
    socket.emit('chat:send', inputText)
    setInputText('')
  }

  // == VOICE CHAT CORE LOGIC ==

  const createPeer = (peerId, initiator) => {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: localStreamRef.current,
      config: peerConfig
    })

    peer.on('signal', signal => {
      socket.emit('voice:signal', { to: peerId, signal })
    })

    peer.on('stream', stream => {
      console.log('[Voice] Connected stream from:', peerId)
      let audio = document.getElementById(`audio-${peerId}`)
      if (!audio) {
        audio = document.createElement('audio')
        audio.id = `audio-${peerId}`
        audio.autoplay = true
        document.body.appendChild(audio)
      }
      audio.srcObject = stream
      audio.play().catch(err => console.warn('[Voice] Play blocked by browser:', err))
    })

    peer.on('close', () => destroyPeer(peerId))
    peer.on('error', err => {
      console.error('[Voice] Peer error:', err)
      destroyPeer(peerId)
    })

    peersRef.current.set(peerId, peer)
    setPeersState(v => v + 1)
    return peer
  }

  const destroyPeer = (peerId) => {
    const peer = peersRef.current.get(peerId)
    if (peer) {
      peer.destroy()
      peersRef.current.delete(peerId)
      setPeersState(v => v + 1)
    }
    const audio = document.getElementById(`audio-${peerId}`)
    if (audio) audio.remove()
  }

  const joinVoice = async () => {
    try {
      console.log('[Voice] Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      localStreamRef.current = stream
      setInVoice(true)
      setMicMuted(false)
      socket.emit('voice:join')
      console.log('[Voice] Joined voice channel successfully')
    } catch (err) {
      console.error('[Voice] Mic Access Error:', err)
      alert("Could not access microphone. Ensure permissions are granted.")
    }
  }

  const leaveVoice = () => {
    if (!inVoice && !localStreamRef.current) return
    
    console.log('[Voice] Leaving voice channel...')
    socket.emit('voice:leave')
    setInVoice(false)
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    peersRef.current.forEach(peer => peer.destroy())
    peersRef.current.clear()
    setPeersState(v => v + 1)
    
    document.querySelectorAll('audio[id^="audio-"]').forEach(el => el.remove())
  }

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setMicMuted(!audioTrack.enabled)
      }
    }
  }

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const voiceParticipants = useMemo(() => {
    return roomUsers.filter(u => u.inVoice)
  }, [roomUsers])

  return (
    <div style={styles.container}>
      {/* Premium Header: Users in Voice */}
      <div style={styles.voiceHeader}>
        <div style={styles.voiceHeaderTop}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <div style={{ ...styles.statusDot, backgroundColor: voiceParticipants.length > 0 ? 'var(--success)' : 'var(--text-secondary)' }} />
             <span style={styles.voiceTitle}>Voice Channel</span>
          </div>
          <span style={styles.participantCount}>{voiceParticipants.length} active</span>
        </div>
        <div style={styles.participantList}>
          {voiceParticipants.length === 0 ? (
            <div style={styles.emptyVoice}>No users in voice</div>
          ) : (
            voiceParticipants.map(u => (
              <div key={u.id} style={styles.participantBadge}>
                <div style={{ ...styles.userDot, backgroundColor: u.color }} />
                <span title={u.username} style={styles.participantName}>{u.username}</span>
                {u.id === socket.id && <span style={styles.selfLabel}>(You)</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Messages Window */}
      <div style={styles.messagesArea}>
        {messages.length === 0 && (
          <div style={styles.noMessages}>
            <MessageCircle size={32} color="var(--border)" style={{ marginBottom: '1rem' }} />
            <p>Start a conversation in this room</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={msg.timestamp + i} style={styles.messageRow}>
            <div style={{ ...styles.messageIndicator, backgroundColor: msg.color }} />
            <div style={styles.messageContent}>
              <div style={styles.messageHeader}>
                <span style={{ ...styles.userName, color: msg.color }}>{msg.username}</span>
                <span style={styles.timeStamp}>{formatTime(msg.timestamp)}</span>
              </div>
              <p style={styles.messageText}>{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.footer}>
        {/* Voice Control Bar */}
        <div style={styles.voiceControls}>
          {!inVoice ? (
            <button onClick={joinVoice} style={styles.joinBtn}>
              <Mic size={16} /> Join Voice
            </button>
          ) : (
            <div style={styles.activeVoiceControls}>
              <div style={styles.activeStatus}>
                <div style={styles.pulseContainer}>
                  <div style={styles.pulseInner} />
                  <div style={styles.pulseRing} />
                </div>
                <span style={styles.connectedText}>Broadcasting</span>
              </div>
              <div style={styles.voiceActionGroup}>
                <button onClick={toggleMic} style={{...styles.iconBtn, backgroundColor: micMuted ? 'var(--danger)' : 'var(--bg-void)'}}>
                  {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button onClick={leaveVoice} style={styles.leaveBtn}>Disconnect</button>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} style={styles.inputForm}>
          <input 
            type="text" 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Type a message..." 
            style={styles.chatInput} 
          />
          <button type="submit" style={styles.sendBtn}>
            <Send size={18} />
          </button>
        </form>
      </div>

      <style>{`
        @keyframes voicePulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    backgroundColor: 'var(--bg-elevated)',
  },
  voiceHeader: {
    padding: '1rem',
    background: 'linear-gradient(to bottom, var(--bg-void), transparent)',
    borderBottom: '1px solid var(--border)',
  },
  voiceHeaderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  voiceTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)'
  },
  participantCount: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)'
  },
  participantList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem'
  },
  emptyVoice: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    padding: '0.25rem 0'
  },
  participantBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.3rem 0.6rem',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    maxWidth: '120px'
  },
  userDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0
  },
  participantName: {
    fontSize: '0.75rem',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  selfLabel: {
    fontSize: '0.65rem',
    color: 'var(--text-secondary)'
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  noMessages: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    opacity: 0.5
  },
  messageRow: {
    display: 'flex',
    gap: '1rem',
    position: 'relative'
  },
  messageIndicator: {
    width: '3px',
    height: '100%',
    borderRadius: '3px',
    opacity: 0.3,
    flexShrink: 0
  },
  messageContent: {
    flex: 1,
    minWidth: 0
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '0.2rem'
  },
  userName: {
    fontSize: '0.85rem',
    fontWeight: '700'
  },
  timeStamp: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)'
  },
  messageText: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
    wordBreak: 'break-word'
  },
  footer: {
    padding: '1rem',
    backgroundColor: 'var(--bg-void)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  voiceControls: {
    width: '100%'
  },
  joinBtn: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'var(--accent)',
    color: 'white',
    fontWeight: '700',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    boxShadow: '0 4px 15px rgba(123, 97, 255, 0.3)'
  },
  activeVoiceControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0'
  },
  activeStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  pulseContainer: {
    position: 'relative',
    width: '12px',
    height: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pulseInner: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--success)',
    zIndex: 1
  },
  pulseRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    backgroundColor: 'var(--success)',
    animation: 'voicePulse 2s infinite ease-out'
  },
  connectedText: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--success)'
  },
  voiceActionGroup: {
    display: 'flex',
    gap: '0.5rem'
  },
  iconBtn: {
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  leaveBtn: {
    padding: '0 1rem',
    height: '36px',
    backgroundColor: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    fontSize: '0.75rem',
    fontWeight: '700',
    borderRadius: 'var(--radius-sm)'
  },
  inputForm: {
    display: 'flex',
    gap: '0.5rem'
  },
  chatInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem',
    color: 'white'
  },
  sendBtn: {
    width: '48px',
    height: '48px',
    backgroundColor: 'var(--accent)',
    color: 'white',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  }
}
