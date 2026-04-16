# Deployment URLs

PENDING: Web deployment is being consolidated to `https://cascade.f7z.io` with a Live/Practice switch. Signet remains a separate mint backend but no longer needs a separate web deployment.

_Last verified: 2026-04-16._

## Signet

- Web: `https://signet.cascade.f7z.io`
- Mint + product API: `https://signet-mint.cascade.f7z.io`
- Nostr relay: `wss://signet-relay.cascade.f7z.io`
- Cashu info: `https://signet-mint.cascade.f7z.io/v1/info`
- Health check: `https://signet-mint.cascade.f7z.io/health`

The live signet web deployment currently embeds:

- `PUBLIC_CASCADE_API_URL=https://signet-mint.cascade.f7z.io`
- `PUBLIC_NOSTR_RELAYS=wss://purplepag.es,wss://signet-relay.cascade.f7z.io`

### Other live signet host observed

- `https://cascade-signet.f7z.io`

On 2026-04-15 this hostname served the same Vercel deployment as `https://signet.cascade.f7z.io`, but the explicit Vercel project-domain mapping we verified is `signet.cascade.f7z.io`. Prefer `signet.cascade.f7z.io` in docs, config, and tooling.

### Signet relay set exposed by the deployed web app

- `wss://purplepag.es`
- `wss://signet-relay.cascade.f7z.io`

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
- `web/src/routes/join/+page.svelte` and `web/src/routes/embed/+page.svelte` use `https://signet.cascade.f7z.io` as the signet fallback origin.
- `web/src/lib/cascade/config.ts` and the live deployed HTML expose `PUBLIC_CASCADE_API_URL=https://signet-mint.cascade.f7z.io` for the signet web deployment.
- `web/vercel.json` exists but only sets the install and build commands.
- There is no `web/next.config*`; the active frontend is SvelteKit, not Next.js.

### Live verification commands

Use these to confirm the current deployment state:

```bash
vercel inspect https://signet.cascade.f7z.io
vercel domains inspect signet.cascade.f7z.io
curl -sS https://signet-mint.cascade.f7z.io/v1/info
curl -sS https://signet.cascade.f7z.io | grep PUBLIC_CASCADE_API_URL
```

## Future workflow

1. Search the repo for `f7z.io`.
2. Check `mint/data/signet/config.toml` for the signet mint base URL.
3. Check `mint/DEPLOYMENT.md` for the intended edition hostnames and smoke-check endpoints.
4. Check `web/README.md` and `web/vercel.json` for frontend deployment clues.
5. Verify the live deployment with `vercel inspect`, `vercel domains inspect`, a direct `v1/info` fetch from the signet mint, and the embedded `PUBLIC_CASCADE_API_URL` on the signet web deployment.
