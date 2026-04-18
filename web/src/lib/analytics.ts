import { browser } from '$app/environment';

const ANALYTICS_KEY = 'cascade_analytics_events';
const SESSION_KEY = 'cascade_analytics_session';
const MAX_EVENTS = 2000;

export type AnalyticsEvent = {
  name: string;
  props: Record<string, string | undefined>;
  sessionId: string;
  timestamp: number;
};

function getSessionId(): string {
  if (!browser) return '';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function loadEvents(): AnalyticsEvent[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnalyticsEvent[];
  } catch {
    return [];
  }
}

function saveEvents(events: AnalyticsEvent[]): void {
  if (!browser) return;
  try {
    // Keep only the most recent MAX_EVENTS to avoid unbounded growth
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}

export function trackEvent(
  name: string,
  props: Record<string, string | undefined> = {}
): void {
  if (!browser) return;
  const event: AnalyticsEvent = {
    name,
    props,
    sessionId: getSessionId(),
    timestamp: Date.now()
  };
  const events = loadEvents();
  events.push(event);
  saveEvents(events);
}

export function getStoredEvents(): AnalyticsEvent[] {
  return loadEvents();
}
