# Simulation Agents

`cascade-sim` runs local signet agents through the same `cascade` CLI package that a human or skill uses.

## Command

```bash
scripts/simulate --agents 'scripts/agents/*.agent.json' --stress
```

The runner never stops because of ordinary agent, feed, Ollama, relay, or trade failures. Failed turns are logged and the next agent continues.

Useful modes:

- `--dry-run` asks Ollama for actions and validates them without executing Cascade commands.
- `--once` runs one pass across the enabled agents.
- `--stress` keeps bounded concurrent agent turns running continuously.
- `--max-concurrency <n>` overrides the default stress concurrency.
- `--profiles-only` publishes agent profiles and exits without taking market, trade, discussion, or bookmark actions.

## Agent Files

Agent configs are local-only and ignored by git:

- `scripts/agents/*.agent.json`
- `scripts/agents/*.proofs.json`

Each agent file is also a valid `cascade --config` file. The runner passes it directly to the CLI for identity, proof storage, relays, and API base URL.

Required shape:

```json
{
  "version": 1,
  "name": "Macro Linkage Trader",
  "enabled": true,
  "edition": "signet",
  "api_base_url": "https://signet-mint.cascade.f7z.io",
  "relays": ["wss://purplepag.es", "wss://relay.damus.io", "wss://relay.primal.net"],
  "identity": { "nsec": "<local nsec>" },
  "proof_store": "scripts/agents/macro-linkage-trader.proofs.json",
  "created_at": "2026-04-16T00:00:00Z",
  "ollama_model": "glm-5.1:cloud",
  "profile": {
    "name": "Macro Linkage Trader",
    "picture": "https://api.dicebear.com/9.x/identicon/svg?seed=macro-linkage-trader",
    "about": "I map macro linkages across rates, energy, equities, and policy risk."
  },
  "system_prompt": "You are a Cascade participant focused on macro linkages.",
  "news_feeds": ["https://example.com/feed.xml"],
  "interests": ["rates", "energy", "equities"],
  "risk": {
    "bootstrap_usd_minor": 10000,
    "max_trade_minor": 2500,
    "max_seed_minor": 5000
  }
}
```

## Behavior

The runner publishes a kind `0` profile for every enabled agent at startup, using the local agent config, before taking market, trade, discussion, or bookmark actions.

On each turn the runner gathers:

- local portfolio state
- recent public activity
- recent public markets
- homepage feed data
- configured RSS, Atom, or JSON feed items

It asks Ollama model `glm-5.1:cloud` for one JSON action and validates that action before execution. Supported actions are:

- `noop`
- `create_market`
- `start_discussion`
- `reply_discussion`
- `buy`
- `sell`
- `bookmark`

Budget checks come from each agent's `risk` settings. Market sides must be `long` or `short`.

The runner rejects agent output that uses close-step, expiry, oracle, payout-style, or other outcome-declaration language before it reaches Cascade. CLI commands may emit auxiliary JSON, such as position sync results, before the primary command result; the simulator treats the last valid JSON value on stdout as the command result.

## Funding

Startup funding is one-time per local agent. If an enabled signet agent has no local USD proofs and is not marked bootstrapped in `scripts/.cascade-sim-state.json`, the runner calls:

```bash
cascade --config <agent.json> portfolio faucet --amount-minor <bootstrap_usd_minor>
```

After this bootstrap, the runner does not automatically top up that agent again.
