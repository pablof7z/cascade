# Deployment URLs

_Last verified: 2026-04-16._

## Canonical Product URLs

- Web: `https://cascade.f7z.io`
- Live mint + product API: `https://mint.f7z.io`
- Practice mint + product API: `https://signet-mint.cascade.f7z.io`
- Default Nostr relays: `wss://purplepag.es,wss://relay.damus.io,wss://relay.primal.net`
- Practice Cashu info: `https://signet-mint.cascade.f7z.io/v1/info`
- Practice health check: `https://signet-mint.cascade.f7z.io/health`

The webapp is a single Vercel deployment with a Live/Practice switch. Live uses market/trade kinds
`982`/`983` and the mainnet mint. Practice uses market/trade kinds `980`/`981` and the signet mint.
Both editions can share relays because the event kinds separate the streams.

The canonical environment shape is:

```text
PUBLIC_CASCADE_MAINNET_API_URL=https://mint.f7z.io
PUBLIC_CASCADE_MAINNET_MINT_URL=https://mint.f7z.io
PUBLIC_CASCADE_SIGNET_API_URL=https://signet-mint.cascade.f7z.io
PUBLIC_CASCADE_SIGNET_MINT_URL=https://signet-mint.cascade.f7z.io
PUBLIC_NOSTR_RELAYS=wss://purplepag.es,wss://relay.damus.io,wss://relay.primal.net
```

## Legacy Hosts

- `https://signet.cascade.f7z.io`
- `https://cascade-signet.f7z.io`
- `wss://signet-relay.cascade.f7z.io`

These may still exist for compatibility or local infrastructure, but new docs, config, and tooling should target the single web deployment and shared relay list.

### Local signet relay host

On this machine the Cascade signet relay is the Docker container
`cascade-nostr-relay`, bound to `127.0.0.1:7781` with restart policy
`unless-stopped`. Its ignored local data and config live under
`data/signet-relay/`. Caddy terminates TLS for
`signet-relay.cascade.f7z.io` and proxies to `localhost:7781`.

## Mainnet

- Web: `https://cascade.f7z.io`
- Mint + product API: `https://mint.f7z.io`

## How these URLs were determined

### Repository sources

- `mint/data/signet/config.toml` sets the signet mint URL to `https://signet-mint.cascade.f7z.io`.
- `mint/DEPLOYMENT.md` documents the edition split and explicitly names `signet-mint.cascade.f7z.io` as the signet mint hostname.
- `web/README.md` documents the mainnet Vercel deployment at `https://cascade.f7z.io`.
- `web/src/routes/join/+page.svelte` and `web/src/routes/embed/+page.svelte` use `https://cascade.f7z.io` as the fallback origin.
- `web/src/lib/cascade/config.ts` selects the mint/API URL from the active edition.
- `web/vercel.json` exists but only sets the install and build commands.
- There is no `web/next.config*`; the active frontend is SvelteKit, not Next.js.

### Live verification commands

Use these to confirm the current deployment state:

```bash
vercel inspect https://cascade.f7z.io
vercel domains inspect cascade.f7z.io
curl -sS https://signet-mint.cascade.f7z.io/v1/info
curl -sS https://cascade.f7z.io | grep PUBLIC_CASCADE_SIGNET_API_URL
```

## Future workflow

1. Search the repo for `f7z.io`.
2. Check `mint/data/signet/config.toml` for the signet mint base URL.
3. Check `mint/DEPLOYMENT.md` for the intended edition hostnames and smoke-check endpoints.
4. Check `web/README.md` and `web/vercel.json` for frontend deployment clues.
5. Verify the live deployment with `vercel inspect`, `vercel domains inspect`, direct `v1/info` fetches from the mints, and the embedded edition mint URLs on the web deployment.
