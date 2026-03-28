import type { VercelRequest, VercelResponse } from '@vercel/node'

// In-memory store for development, will persist across requests in production
// For production, consider using Vercel KV or a database
const nip05Store: Record<string, string> = {}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    const name = req.query.name as string | undefined
    if (!name) {
      return res.status(400).json({ error: 'Missing name parameter' })
    }

    const normalizedName = name.toLowerCase().trim()
    const exists = normalizedName in nip05Store

    return res.status(200).json({ exists })
  }

  if (req.method === 'POST') {
    let body: { name?: string; pubkey?: string }
    
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }

    const { name, pubkey } = body

    if (!name || !pubkey) {
      return res.status(400).json({ error: 'Missing name or pubkey' })
    }

    const normalizedName = name.toLowerCase().trim()

    // Validate name format (alphanumeric, underscores, hyphens)
    if (!/^[a-z0-9_-]+$/i.test(normalizedName)) {
      return res.status(400).json({ error: 'Invalid name format' })
    }

    // Validate pubkey format (64 hex chars)
    if (!/^[a-f0-9]{64}$/i.test(pubkey)) {
      return res.status(400).json({ error: 'Invalid pubkey format' })
    }

    if (normalizedName in nip05Store) {
      return res.status(409).json({ error: 'Name already taken' })
    }

    nip05Store[normalizedName] = pubkey

    return res.status(201).json({ success: true, name: normalizedName, pubkey })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// Export store for use by well-known endpoint
export { nip05Store }
