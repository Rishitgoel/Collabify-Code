import React, { useState, useEffect } from 'react'
import { GitBranch, GitCommit, GitPullRequest, Search, Check, RefreshCw, UploadCloud, DownloadCloud, Key, User, Github, Plus, Minus } from 'lucide-react'

export default function GitManager({ socket, githubToken }) {
  const [isRepo, setIsRepo] = useState(false)
  const [status, setStatus] = useState(null)
  const [commitMsg, setCommitMsg] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const BACKEND_URL = socket.io.uri || 'http://localhost:3001'

  const fetchStatus = () => {
    socket.emit('git:status', (res) => {
      if (res.error) {
        setErrorMsg(res.error)
      } else if (res.isRepo) {
        setIsRepo(true)
        setStatus(res.status)
        setErrorMsg('')
      } else {
        setIsRepo(false)
      }
    })
  }

  useEffect(() => {
    fetchStatus()

    // Auto-refresh Git status when workspace files change
    const triggerRefresh = () => fetchStatus()
    socket.on('file:saved', triggerRefresh)
    socket.on('file:refresh', triggerRefresh)
    socket.on('file:deleted', triggerRefresh)
    socket.on('file:renamed', triggerRefresh)

    return () => {
      socket.off('file:saved', triggerRefresh)
      socket.off('file:refresh', triggerRefresh)
      socket.off('file:deleted', triggerRefresh)
      socket.off('file:renamed', triggerRefresh)
    }
  }, [BACKEND_URL, socket])

  const handleClone = () => {
    if (!repoUrl) return
    setLoading(true)
    setErrorMsg('')
    socket.emit('git:clone', repoUrl, githubToken, (res) => {
      setLoading(false)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        fetchStatus()
      }
    })
  }

  const handleAddAll = () => {
    socket.emit('git:add', '.', (res) => {
      if (res.error) setErrorMsg(res.error)
      else fetchStatus()
    })
  }

  const handleStageFile = (filePath) => {
    socket.emit('git:add', filePath, (res) => {
      if (res.error) setErrorMsg(res.error)
      else fetchStatus()
    })
  }

  const handleUnstageFile = (filePath) => {
    socket.emit('git:unstage', filePath, (res) => {
      if (res.error) setErrorMsg(res.error)
      else fetchStatus()
    })
  }

  const handleCommit = () => {
    if (!commitMsg.trim()) {
      setErrorMsg('Please enter a commit message.')
      return
    }
    socket.emit('git:commit', commitMsg, (res) => {
      if (res.error) setErrorMsg(res.error)
      else {
        setCommitMsg('')
        fetchStatus()
      }
    })
  }

  const handlePush = () => {
    if (!githubToken) {
      setErrorMsg('Please sign in with GitHub before pushing.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    socket.emit('git:push', githubToken, (res) => {
      setLoading(false)
      if (res.error) setErrorMsg(res.error)
      else fetchStatus()
    })
  }

  const handlePull = () => {
    if (!githubToken) {
      setErrorMsg('Please sign in with GitHub before pulling.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    socket.emit('git:pull', githubToken, (res) => {
      setLoading(false)
      if (res.error) setErrorMsg(res.error)
      else fetchStatus()
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', overflowY: 'auto' }}>


      {errorMsg && (
        <div style={{ padding: '0.5rem', backgroundColor: 'rgba(248, 113, 113, 0.1)', color: '#F87171', fontSize: '0.8rem', borderBottom: '1px solid var(--border)' }}>
          {errorMsg}
        </div>
      )}

      {loading && (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--accent)' }}>
          <div className="spinner-small" style={{ margin: '0 auto 0.5rem' }}></div>
          Processing...
        </div>
      )}

      {!isRepo && !loading && (
        <div style={{ padding: '1rem' }}>
          <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
            Clone a Repository
          </div>
          <input 
            type="text" 
            placeholder="https://github.com/user/repo" 
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            style={styles.input}
          />
          <button style={styles.button} onClick={handleClone}>
            Clone Repo
          </button>
          <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Note: Cloning will download the files into the current workspace. Ensure it is empty.
          </div>
        </div>
      )}

      {isRepo && status && !loading && (
        <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
              <GitBranch size={16} color="var(--accent)" />
              {status.current}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button style={styles.syncButton} onClick={handlePull} title="Pull from Remote">
              <DownloadCloud size={16} /> Pull
            </button>
            <button style={styles.syncButton} onClick={handlePush} title="Push to Remote">
              <UploadCloud size={16} /> Push
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />

          <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Message</div>
          <textarea 
            placeholder="Commit message"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            style={{ ...styles.input, minHeight: '60px', resize: 'vertical' }}
          />
          <button style={styles.button} onClick={handleCommit}>
            <Check size={16} /> Commit
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Changes</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={fetchStatus} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Refresh Changes">
                <RefreshCw size={14} />
              </button>
              <button onClick={handleAddAll} style={{ fontSize: '0.8rem', padding: '2px 6px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }}>
                Stage All
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.85rem' }}>
            {status.files.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No changes.</div>
            ) : (
              <>
                {/* Staged Changes */}
                {status.files.filter(f => f.index !== ' ' && f.index !== '?').length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#4ADE80', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Staged Changes
                    </div>
                    {status.files.filter(f => f.index !== ' ' && f.index !== '?').map((file, i) => (
                      <div key={`staged-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border-transparent)' }}>
                        <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: '#4ADE80', fontSize: '0.75rem', fontWeight: 'bold', width: '12px', textAlign: 'center' }}>{file.index}</span>
                          {file.path}
                        </div>
                        <button onClick={() => handleUnstageFile(file.path)} style={{ background: 'transparent', border: 'none', color: 'var(--danger, #F87171)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Unstage file">
                          <Minus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Unstaged Changes */}
                {status.files.filter(f => f.working_dir !== ' ').length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#FBBF24', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Unstaged Changes
                    </div>
                    {status.files.filter(f => f.working_dir !== ' ').map((file, i) => (
                      <div key={`unstaged-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border-transparent)' }}>
                        <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: '#FBBF24', fontSize: '0.75rem', fontWeight: 'bold', width: '12px', textAlign: 'center' }}>{file.working_dir === '?' ? 'U' : file.working_dir}</span>
                          {file.path}
                        </div>
                        <button onClick={() => handleStageFile(file.path)} style={{ background: 'transparent', border: 'none', color: '#4ADE80', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Stage file">
                          <Plus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      )}

    </div>
  )
}

const styles = {
  input: {
    width: '100%',
    padding: '0.5rem',
    marginBottom: '0.5rem',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: '4px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '0.5rem',
    backgroundColor: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: 'bold'
  },
  syncButton: {
    flex: 1,
    padding: '0.5rem',
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.5rem'
  }
}
