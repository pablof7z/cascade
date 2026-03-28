import { schnorr } from '@noble/secp256k1'

const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bech32Encode(prefix: string, data: Uint8Array): string {
  const values = convertBits(data, 8, 5, true)
  const checksum = bech32Checksum(prefix, values)
  const combined = [...values, ...checksum]
  return prefix + '1' + combined.map(v => BECH32_ALPHABET[v]).join('')
}

function convertBits(data: Uint8Array, fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0
  let bits = 0
  const result: number[] = []
  const maxv = (1 << toBits) - 1

  for (const value of data) {
    acc = (acc << fromBits) | value
    bits += fromBits
    while (bits >= toBits) {
      bits -= toBits
      result.push((acc >> bits) & maxv)
    }
  }

  if (pad && bits > 0) {
    result.push((acc << (toBits - bits)) & maxv)
  }

  return result
}

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const v of values) {
    const b = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i]
    }
  }
  return chk
}

function bech32HrpExpand(hrp: string): number[] {
  const result: number[] = []
  for (const c of hrp) {
    result.push(c.charCodeAt(0) >> 5)
  }
  result.push(0)
  for (const c of hrp) {
    result.push(c.charCodeAt(0) & 31)
  }
  return result
}

function bech32Checksum(hrp: string, data: number[]): number[] {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]
  const polymod = bech32Polymod(values) ^ 1
  const result: number[] = []
  for (let i = 0; i < 6; i++) {
    result.push((polymod >> (5 * (5 - i))) & 31)
  }
  return result
}

function randomPrivateKey(): Uint8Array {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytes
}

export type NostrKeyPair = {
  privateKey: Uint8Array
  publicKey: Uint8Array
  nsec: string
  npub: string
  pubkeyHex: string
}

export function generateKeyPair(): NostrKeyPair {
  const privateKey = randomPrivateKey()
  const publicKey = schnorr.getPublicKey(privateKey)
  
  return {
    privateKey,
    publicKey,
    nsec: bech32Encode('nsec', privateKey),
    npub: bech32Encode('npub', publicKey),
    pubkeyHex: bytesToHex(publicKey),
  }
}

const KEYS_STORAGE_KEY = 'cascade-nostr-keys'

export function loadStoredKeys(): NostrKeyPair | null {
  if (typeof window === 'undefined') return null
  
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY)
    if (!raw) return null
    
    const { nsec, npub, pubkeyHex } = JSON.parse(raw)
    const privateKey = bech32Decode(nsec)
    const publicKey = hexToBytes(pubkeyHex)
    
    return { privateKey, publicKey, nsec, npub, pubkeyHex }
  } catch {
    return null
  }
}

export function saveKeys(keys: NostrKeyPair): void {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify({
    nsec: keys.nsec,
    npub: keys.npub,
    pubkeyHex: keys.pubkeyHex,
  }))
}

function bech32Decode(str: string): Uint8Array {
  const sep = str.lastIndexOf('1')
  const data = str.slice(sep + 1)
  const values: number[] = []
  
  for (const c of data) {
    const idx = BECH32_ALPHABET.indexOf(c)
    if (idx === -1) throw new Error('Invalid bech32 character')
    values.push(idx)
  }
  
  // Remove checksum (last 6 values)
  const dataValues = values.slice(0, -6)
  const bytes = convertBits5to8(dataValues)
  
  return new Uint8Array(bytes)
}

function convertBits5to8(data: number[]): number[] {
  let acc = 0
  let bits = 0
  const result: number[] = []

  for (const value of data) {
    acc = (acc << 5) | value
    bits += 5
    while (bits >= 8) {
      bits -= 8
      result.push((acc >> bits) & 0xff)
    }
  }

  return result
}
