-- Drop market mirror tables that belong on relays, not the mint.
-- market_launch_state: visibility projections, raw event cache, volume counters
-- lmsr_snapshots: price history for client reads (relay concern)
DROP TABLE IF EXISTS lmsr_snapshots;
DROP TABLE IF EXISTS market_launch_state;
