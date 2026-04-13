import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// == GITHUB OAUTH ==
router.get('/github', (req, res) => {
  const redirect_uri = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/github/callback'
  const client_id = process.env.GITHUB_CLIENT_ID
  
  if (!client_id) {
    return res.status(500).send('GITHUB_CLIENT_ID is not configured in the backend .env file')
  }
  
  const scope = 'repo'
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&scope=${scope}`)
})

router.get('/github/callback', async (req, res) => {
  const code = req.query.code
  const client_id = process.env.GITHUB_CLIENT_ID
  const client_secret = process.env.GITHUB_CLIENT_SECRET
  
  if (!code) return res.status(400).send('No code provided by GitHub')

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        code
      })
    })
    const data = await tokenResponse.json()
    const token = data.access_token
    
    if (token) {
      res.send(`
        <html>
          <head><title>GitHub Auth Success</title></head>
          <body>
            <p>Authentication successful! Closing window...</p>
            <script>
              window.opener.postMessage({ type: 'GITHUB_TOKEN', payload: '${token}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `)
    } else {
      res.status(400).send('Failed to retrieve token: ' + JSON.stringify(data))
    }
  } catch (error) {
    res.status(500).send('Server Error: ' + error.message)
  }
})

export default router
