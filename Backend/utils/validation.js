import path from 'path'

/**
 * Validates that a target path is strictly within a base directory.
 * Prevents path traversal outside of the room's workspace.
 */
export function validatePath(baseDir, relativePath) {
  const fullPath = path.resolve(baseDir, relativePath)
  if (!fullPath.startsWith(path.resolve(baseDir))) {
    throw new Error('Access denied: Path traversal detected.')
  }
  return fullPath
}

/**
 * Validates that a Room ID is alphanumeric only.
 */
export function validateRoomId(roomId) {
  if (!/^[a-zA-Z0-9_\-]+$/.test(roomId)) {
    throw new Error('Invalid Room ID: Alphanumeric only.')
  }
}
