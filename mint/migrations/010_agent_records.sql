CREATE TABLE IF NOT EXISTS agents (
    edition TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    thesis TEXT NOT NULL DEFAULT '',
    owner_pubkey TEXT,
    agent_type TEXT NOT NULL DEFAULT 'connected',
    status TEXT NOT NULL DEFAULT 'idle',
    metadata_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_active_at INTEGER,
    PRIMARY KEY (edition, pubkey)
);

CREATE INDEX IF NOT EXISTS idx_agents_edition_updated_at
    ON agents(edition, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agents_owner_pubkey
    ON agents(owner_pubkey, updated_at DESC);
