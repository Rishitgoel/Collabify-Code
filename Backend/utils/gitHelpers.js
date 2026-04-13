/**
 * Helper: strip any embedded credentials from a git remote URL
 */
export function stripCredentialsFromUrl(url) {
  try {
    const parsed = new URL(url)
    parsed.username = ''
    parsed.password = ''
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Helper: ensure the origin remote URL has no embedded credentials
 */
export async function sanitizeRemoteUrl(git) {
  try {
    const remotes = await git.getRemotes(true)
    const origin = remotes.find(r => r.name === 'origin')
    if (origin) {
      const cleanUrl = stripCredentialsFromUrl(origin.refs.push)
      if (cleanUrl !== origin.refs.push) {
        await git.remote(['set-url', 'origin', cleanUrl])
        console.log('[Git] Cleaned embedded credentials from remote URL')
      }
    }
  } catch (_) {}
}
