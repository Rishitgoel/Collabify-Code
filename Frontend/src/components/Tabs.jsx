import React from 'react'

export default function Tabs({ openFiles, activeFile, onSelect, onClose }) {
  if (openFiles.length === 0) return null

  return (
    <div style={styles.container}>
      {openFiles.map(file => {
        const isActive = activeFile && activeFile.path === file.path
        return (
          <div 
            key={file.path}
            style={{ 
              ...styles.tab, 
              backgroundColor: isActive ? 'var(--bg-void)' : 'var(--bg-surface)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
            onClick={() => onSelect(file)}
          >
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </span>
            <span 
              style={styles.closeBtn} 
              onClick={(e) => { e.stopPropagation(); onClose(file.path) }}
            >
              ×
            </span>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    overflowX: 'auto'
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    borderRight: '1px solid var(--border)',
    transition: 'all 0.1s'
  },
  closeBtn: {
    cursor: 'pointer',
    padding: '0 4px',
    borderRadius: '4px',
    lineHeight: '1',
    fontWeight: 'bold'
  }
}
