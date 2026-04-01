export type DataPoint = {
  timestamp: number
  pnl: number
}

export type AgentPnLData = {
  agentId: string
  agentName: string
  dataPoints: DataPoint[]
}

// 5 agent personas with varied P&L trajectories over 90 days (hourly)
const AGENT_PERSONAS = [
  { agentId: 'agent-alpha', agentName: 'Alpha', drift: 1.8, volatility: 12, bias: 0.55 },
  { agentId: 'agent-beta', agentName: 'Beta', drift: -0.4, volatility: 18, bias: -0.3 },
  { agentId: 'agent-gamma', agentName: 'Gamma', drift: 0.9, volatility: 8, bias: 0.2 },
  { agentId: 'agent-delta', agentName: 'Delta', drift: 2.5, volatility: 22, bias: 0.7 },
  { agentId: 'agent-epsilon', agentName: 'Epsilon', drift: -1.1, volatility: 14, bias: -0.5 },
]

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

export function generateMockAgentPnLData(): AgentPnLData[] {
  const now = Math.floor(Date.now() / 1000)
  const ninetyDaysAgo = now - 90 * 24 * 3600
  // Use hourly data points (90 days × 24 hours = 2160 points)
  const intervalSeconds = 3600

  return AGENT_PERSONAS.map((persona, personaIndex) => {
    const rand = seededRandom(personaIndex * 31337 + 42)
    const dataPoints: DataPoint[] = []
    let cumPnl = 0

    for (let ts = ninetyDaysAgo; ts <= now; ts += intervalSeconds) {
      // Random walk with drift and bias
      const noise = (rand() - 0.5 + persona.bias * 0.1) * persona.volatility
      cumPnl += persona.drift + noise
      dataPoints.push({ timestamp: ts, pnl: Math.round(cumPnl * 100) / 100 })
    }

    return {
      agentId: persona.agentId,
      agentName: persona.agentName,
      dataPoints,
    }
  })
}

export function filterDataByDays(data: AgentPnLData[], days: number | null): AgentPnLData[] {
  if (days === null) return data

  const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 3600
  return data.map((agent) => ({
    ...agent,
    dataPoints: agent.dataPoints.filter((pt) => pt.timestamp >= cutoff),
  }))
}
