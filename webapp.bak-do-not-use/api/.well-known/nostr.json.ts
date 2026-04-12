import type { VercelRequest, VercelResponse } from '@vercel/node'
import { nip05Store } from '../nip05'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  const name = req.query.name as string | undefined

  if (!name) {
    // Return all names
    return res.status(200).json({
      names: { ...nip05Store },
      relays: {}
    })
  }

  const normalizedName = name.toLowerCase().trim()
  const pubkey = nip05Store[normalizedName]

  if (!pubkey) {
    return res.status(200).json({
      names: {},
      relays: {}
    })
  }

  return res.status(200).json({
    names: { [normalizedName]: pubkey },
    relays: {}
  })
}
