import { browser } from '$app/environment';

const SETTINGS_KEY = 'cascade:agent-settings';

export type AgentSettings = {
  permission: 'propose-only' | 'trade-with-approval' | 'autonomous';
  capitalLimit: string;
  notifyMeeting: boolean;
  notifyProposals: boolean;
  notifyDigest: boolean;
};

const DEFAULTS: AgentSettings = {
  permission: 'propose-only',
  capitalLimit: '500',
  notifyMeeting: true,
  notifyProposals: true,
  notifyDigest: false
};

export function loadAgentSettings(): AgentSettings {
  if (!browser) return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAgentSettings(settings: AgentSettings): void {
  if (!browser) return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
