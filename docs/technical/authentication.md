# Authentication & Identity

PENDING: the current `/join` and account-entry UI is being rewritten to keep signer transport and
key-management details behind product-language labels. Normal visible copy should describe device
setup, recovery, and app pairing without surfacing extension names, connection URIs, or raw
public-key identifiers.

## Model: Nostr Keypairs

There are no traditional user accounts on Cascade. No usernames. No passwords. No email addresses. No server-side user database.

Users are **Nostr keypairs**:
- **nsec** (private key) — 32-byte secret. Signs all events and transactions. Never leaves the user's device.
- **npub** (public key) — 32-byte identifier. The user's public identity. Visible to everyone.

A keypair is generated client-side. No round-trip to a server. The user is identified by their public key from the moment generation completes.

---

## Key Storage

The nsec is stored in localStorage on the user's browser. It is:
- Never sent to any server
- Never included in Nostr events
- Not shown during onboarding
- Not currently exposed through the Settings page UI (the Settings page shows Account ID / public key, not the nsec)

If the user clears their browser storage or loses their device without a backup, the key is gone. Key backup is the user's responsibility. The Settings page should make this clear.

---

## What Users See

**During onboarding** (`/join`):
- "Create an account" — not "Generate a Nostr keypair"
- "Sign in" — not "Connect with Nostr" or "Login with npub"
- No mention of keys, relays, pubkeys, or Nostr
- The `/join` page presents an **explicit choice**: "I'm a human trader" or "I'm an AI agent" — each leads to a distinct onboarding path
- On the human path, profile bootstrap may offer claiming a username on the deployment's managed NIP-05 domain
- On the agent branch, the UI should give the user a short instruction they can copy into the agent, pointing it at the hosted `SKILL.md`

The underlying cryptographic reality is intentionally abstracted. Users don't need to understand Nostr to use Cascade.

**In Settings** (`/settings`):
- Users can view and copy their **Account ID** (the public key) — not the private key/nsec
- Relay configuration is available for advanced users
- This is the only place where the technical layer is exposed
- **Note:** The settings page does not expose or allow copying the nsec in the current implementation. The UI shows "Account ID" with a copy button, which copies the public identifier — not the secret key.

**Never in any UI**:
- "Nostr"
- "npub" / "nsec"
- "relay"
- "pubkey"
- "event"

## Client Session Bootstrap

Cascade boots the browser-side NDK and session manager before handling account-entry actions.
Fresh page loads, especially in browser automation, can reach `/join` before that bootstrap path
finishes. In that state, account creation and sign-in controls should use the local session
manager as soon as it exists while the client NDK finishes connecting in the background. The UI
should only surface an inline error when the session layer itself is unavailable, rather than
blocking indefinitely on relay connection.

---

## NIP-46 Remote Signing _(planned / not yet implemented)_

> **Status:** NIP-46 is not currently implemented. The claim in earlier docs was incorrect.

The app uses client-side Nostr keypairs stored in localStorage, with NIP-07 browser extension support (e.g., Alby, nos2x) as an alternative signer. NIP-46 remote signing (for hardware signers or remote key management bunkers) is a future enhancement.

When implemented, NIP-46 would allow a user to authenticate without exposing their nsec to the browser — all signing requests would be forwarded to the remote signer.

---

## Key Generation

New keys are generated using standard cryptographic entropy (WebCrypto API or equivalent). The process:

1. Generate 32 bytes of random entropy
2. Derive the Nostr keypair (secp256k1)
3. Store nsec in localStorage
4. User is now authenticated — their npub is their identity

No server involvement. No account activation. No email confirmation.

---

## Managed NIP-05 Identities

Managed NIP-05 is an optional deployment capability.

- If `PUBLIC_NIP05_DOMAIN` is configured, onboarding/profile flows may let the user claim a username on that domain.
- Claiming a username writes a signed request to the app's managed NIP-05 registration endpoint.
- Example: claiming `bob` on a deployment configured for `cascade.f7z.io` registers `bob@cascade.f7z.io`.
- The same deployment should expose matching `/.well-known/nostr.json` responses for public NIP-05 resolution.

For public profile routing:

- `/p/bob@cascade.f7z.io` should resolve directly as that NIP-05 identifier
- `/p/bob` should be treated as a shortcut for `/p/bob@cascade.f7z.io` when the local managed domain is `cascade.f7z.io`
- `/p/f7z.io` should be left to NDK's normal root-NIP-05 handling for `_@f7z.io`, rather than being rewritten by app code

---

## Authorization Model

Cascade has no traditional account ACL layer, but launch does have an authenticated API model.

- Public read routes are readable without signing in.
- State-changing product API endpoints use NIP-98-signed HTTP requests.
- The web client signs authenticated API actions with the user's current Nostr key.
- Hosted agents and external agents use the same NIP-98-authenticated API surface.

Permissioned actions are enforced at the economic level and at the cryptographic level: you need spendable wallet value to trade, and you must sign authenticated API actions with a key you control.

This request signing authenticates the action signer only. It does not create a mint-side actor record for that pubkey and it does not turn bearer proofs into identity-bound assets.

---

## NIP-98 For Authenticated API Endpoints

Launch uses NIP-98 for authenticated product API endpoints.

- market-initialization or create-and-seed HTTP requests use NIP-98
- buy and sell requests use NIP-98
- bookmark writes use NIP-98
- discussion writes use NIP-98
- follow/unfollow writes use NIP-98

This request signing does **not** bind Cashu proofs to that pubkey. Cashu tokens remain bearer instruments, and a later seller does not need to be the same pubkey that authenticated an earlier trade.

It also does not imply that the mint keeps a special human or agent registry. A pubkey is just a pubkey at the API boundary.

Direct publication of a signed kind `982` to relays is a separate action. NIP-98 only applies when there is an HTTP product API action to authenticate.

For launch web flows, buy and sell requests are expected to carry NIP-98. The resulting kind `983` records therefore carry request-level attribution through the `p` tag in normal product use.

At the protocol level, the important meaning is unchanged: a `p` tag on kind `983` means "the pubkey that authenticated the HTTP request," not "the permanent owner of the proofs."

See [`docs/mint/auth.md`](../mint/auth.md) for the canonical trade-attribution model.

---

## Cashu Wallet Identity

The user's Cashu wallet is separate from their Nostr identity. Cashu tokens are bearer instruments — they're not tied to a pubkey. A user could hold tokens on any device without any link to their Nostr account.

In practice, the frontend ties the two together: the portfolio UI at `/portfolio` shows tokens associated with the current Nostr session. But at the protocol level, tokens are independent of identity.

This separation is intentional. Cashu's privacy model (bearer tokens, no identity linkage) is a feature, not a bug.

Because portfolio proofs are self-custodied, Cascade does not expose a canonical private `/api/wallet` endpoint for user balance lookup.
