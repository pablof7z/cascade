import { browser } from '$app/environment';
import { storageKey } from '$lib/cascade/config';

const SETTINGS_KEY = storageKey('agent_settings');

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

function normalisePermission(val: unknown): AgentSettings['permission'] {
  if (val === 'propose-only' || val === 'trade-with-approval' || val === 'autonomous') {
    return val;
  }
  return DEFAULTS.permission;
}

function normaliseCapitalLimit(val: unknown): string {
  if (typeof val === 'number' && Number.isInteger(val) && val >= 0) {
    return String(val);
  }
  if (typeof val === 'string' && /^\d+$/.test(val)) return val;
  return DEFAULTS.capitalLimit;
}

function normaliseBool(val: unknown, fallback: boolean): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

export function loadAgentSettings(): AgentSettings {
  if (!browser) return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      permission: normalisePermission(parsed.permission),
      capitalLimit: normaliseCapitalLimit(parsed.capitalLimit),
      notifyMeeting: normaliseBool(parsed.notifyMeeting, DEFAULTS.notifyMeeting),
      notifyProposals: normaliseBool(parsed.notifyProposals, DEFAULTS.notifyProposals),
      notifyDigest: normaliseBool(parsed.notifyDigest, DEFAULTS.notifyDigest),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAgentSettings(settings: AgentSettings): void {
  if (!browser) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures (quota, private mode, etc.)
  }
}
