import React from 'react'
import { User, Users } from 'lucide-react'

export default function ParticipantsList({ users = [], currentUserId }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Users size={14} color="var(--text-secondary)" />
        <span style={styles.title}>Live Participants</span>
        <span style={styles.badge}>{users.length}</span>
      </div>
      
      <div style={styles.list}>
        {users.length === 0 ? (
          <div style={styles.empty}>No other users</div>
        ) : (
          users.map((user) => (
            <div key={user.id} style={styles.userRow}>
              <div style={styles.userIconWrapper}>
                <div style={{ ...styles.userIndicator, backgroundColor: user.color }} />
                <User size={14} color={user.color} />
              </div>
              <span style={{ ...styles.userName, color: user.id === currentUserId ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {user.username}
                {user.id === currentUserId && <span style={styles.youLable}> (You)</span>}
              </span>
              {user.inVoice && (
                <div style={styles.voiceStatus} title="In Voice Channel">
                   <div style={styles.voiceDot} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '1rem',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--bg-void)',
    maxHeight: '200px',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem'
  },
  title: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    flex: 1
  },
  badge: {
    fontSize: '0.7rem',
    backgroundColor: 'var(--bg-elevated)',
    padding: '0.1rem 0.4rem',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    overflowY: 'auto'
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.25rem 0'
  },
  userIconWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '50%'
  },
  userIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    border: '2px solid var(--bg-void)'
  },
  userName: {
    fontSize: '0.85rem',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1
  },
  youLable: {
    fontSize: '0.75rem',
    opacity: 0.6,
    fontStyle: 'italic'
  },
  voiceStatus: {
    width: '12px',
    height: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  voiceDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--success)',
    boxShadow: '0 0 8px var(--success)'
  },
  empty: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: '1rem 0'
  }
}
