/**
 * Cashu Mint TypeScript Type Definitions
 * Phase 1 - Foundation
 */

// Proof state tracking
export type ProofState = 'unspent' | 'spent' | 'reserved';

// Keyset unit types for prediction markets
export type KeysetUnit = 'long' | 'short';

// Keyset - group of public/private key pairs for a market
export interface Keyset {
  id: string;
  marketId: string;
  marketHash: string;
  longPubkey: string;
  shortPubkey: string;
  longPrivkey: string;
  shortPrivkey: string;
  reserveSat: number;
  createdAt: number;
  expiresAt?: number;
  nostrEventId?: string;
}

// Mint quote for NUT-02
export interface MintQuote {
  id: string;
  amount: number;
  unit: string;
  paid: boolean;
  paidAt?: number;
  createdAt: number;
  expiresAt: number;
  request?: string; // Lightning invoice for production
  keysetId: string;
}

// Proof - individual ecash note
export interface Proof {
  id: string;
  keysetId: string;
  amount: number;
  unit: string;
  secret: string;
  C: string; // Committed value
  state: ProofState;
  quoteId?: string;
  createdAt: number;
  spentAt?: number;
}

// Spent proof for audit trail
export interface SpentProof {
  id: number;
  proofId: string;
  swapTxid?: string;
  spentAt: number;
  spentByPubkey?: string;
}

// Database migration record
export interface Migration {
  id: number;
  name: string;
  executedAt: number;
  rollbackSql?: string;
}

// NUT-00 Mint Info response
export interface MintInfo {
  name: string;
  pubkey: string;
  version: string;
  description: string;
  nuts: {
    '0': { methods: string[]; unit: string };
    '2': { methods: string[]; unit: string };
    '3': { methods: string[]; unit: string };
  };
  motd: string;
}

// NUT-02 Mint quote request
export interface MintQuoteRequest {
  amount: number;
  unit?: string;
}

// NUT-02 Mint quote response
export interface MintQuoteResponse {
  quote: string;
  amount: number;
  unit: string;
  request?: string;
  paid: boolean;
  expiry: number;
}

// NUT-02 Output (blinded message for minting)
export interface MintOutput {
  amount: number;
  id: string;
  B_: string; // Blinded public key
  B: string;  // Public key
}

// NUT-02 Mint bolts request
export interface MintBoltRequest {
  quote: string;
  outputs: MintOutput[];
}

// NUT-02 Mint bolts response
export interface MintBoltResponse {
  signatures: Array<{
    amount: number;
    id: string;
    C_: string;
    C: string;
    dleq?: {
      e: string;
      s: string;
    };
  }>;
}

// NUT-03 Swap input proof
export interface SwapInput {
  amount: number;
  id: string;
  secret: string;
  C: string;
}

// NUT-03 Swap output request
export interface SwapOutput {
  amount: number;
  id: string;
  B_: string;
  B: string;
}

// NUT-03 Swap request
export interface SwapRequest {
  inputs: SwapInput[];
  outputs: SwapOutput[];
}

// NUT-03 Swap response
export interface SwapResponse {
  signatures: Array<{
    amount: number;
    id: string;
    C_: string;
    C: string;
    dleq?: {
      e: string;
      s: string;
    };
  }>;
}

// Nostr market event (kind 30000)
export interface MarketEvent {
  id: string;
  pubkey: string;
  createdAt: number;
  kind: 30000;
  tags: string[][];
  content: string;
  sig: string;
}

// Nostr keyset event (kind 30001)
export interface KeysetEvent {
  id: string;
  pubkey: string;
  createdAt: number;
  kind: 30001;
  tags: string[][];
  content: string;
  sig: string;
}

// API error response (NUT-00 compliant)
export interface ApiError {
  detail: string;
  code: string;
  type: string;
}

// Keyset derivation result
export interface KeysetDerivation {
  keysetId: string;
  longPublicKey: string;
  shortPublicKey: string;
  longPrivateKey: string;
  shortPrivateKey: string;
}

// Swap result
export interface SwapResult {
  amount: number;
  fee: number;
  outputProofs: Proof[];
}
