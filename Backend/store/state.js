import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Shared state Maps
export const rooms = new Map() // roomId -> { users: Map(socketId -> { username, color }) }
export const terminalRooms = new Map() // roomId -> { sharedPty, currentController, controlQueue, userTerminals: Map<userId, { pty, disconnectTimeout }> }
export const chatHistory = new Map() // roomId -> [ { username, message, timestamp, color } ]

// Constants
export const userColors = ['#F87171', '#FBBF24', '#4ADE80', '#60A5FA', '#818CF8', '#A78BFA', '#F472B6', '#34D399']
export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
export const MAX_WORKSPACE_SIZE = 500 * 1024 * 1024 // 500MB
export const WORKSPACE_DIR = path.join(__dirname, '..', 'workspace')
