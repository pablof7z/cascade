const NAME_NAMESPACE = 'nip05:name';
const PUBKEY_NAMESPACE = 'nip05:pubkey';

const memoryPubkeyByName = new Map<string, string>();
const memoryNameByPubkey = new Map<string, string>();

function nameKey(name: string): string {
  return `${NAME_NAMESPACE}:${name}`;
}

function pubkeyKey(pubkey: string): string {
  return `${PUBKEY_NAMESPACE}:${pubkey}`;
}

function hasKvStore(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function runKvCommand(...parts: string[]): Promise<unknown> {
  const baseUrl = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Vercel KV is not configured.');
  }

  const commandUrl = `${baseUrl.replace(/\/$/, '')}/${parts.map((part) => encodeURIComponent(part)).join('/')}`;
  const response = await fetch(commandUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`KV request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.result ?? null;
}

async function getValue(key: string): Promise<string | null> {
  if (!hasKvStore()) return null;

  const result = await runKvCommand('get', key);
  return typeof result === 'string' ? result : null;
}

async function setValue(key: string, value: string): Promise<void> {
  if (!hasKvStore()) return;
  await runKvCommand('set', key, value);
}

async function deleteValue(key: string): Promise<void> {
  if (!hasKvStore()) return;
  await runKvCommand('del', key);
}

export function hasPersistentNip05Store(): boolean {
  return hasKvStore();
}

export async function getNip05Pubkey(name: string): Promise<string | null> {
  const normalizedName = name.toLowerCase();

  if (hasKvStore()) {
    return getValue(nameKey(normalizedName));
  }

  return memoryPubkeyByName.get(normalizedName) ?? null;
}

export async function getNip05NameForPubkey(pubkey: string): Promise<string | null> {
  if (hasKvStore()) {
    return getValue(pubkeyKey(pubkey));
  }

  return memoryNameByPubkey.get(pubkey) ?? null;
}

export async function setNip05(name: string, pubkey: string): Promise<void> {
  const normalizedName = name.toLowerCase();
  const previousName = await getNip05NameForPubkey(pubkey);

  if (previousName && previousName !== normalizedName) {
    if (hasKvStore()) {
      await deleteValue(nameKey(previousName));
    } else {
      memoryPubkeyByName.delete(previousName);
    }
  }

  if (hasKvStore()) {
    await setValue(nameKey(normalizedName), pubkey);
    await setValue(pubkeyKey(pubkey), normalizedName);
    return;
  }

  memoryPubkeyByName.set(normalizedName, pubkey);
  memoryNameByPubkey.set(pubkey, normalizedName);
}

export async function clearNip05ForPubkey(pubkey: string): Promise<void> {
  const currentName = await getNip05NameForPubkey(pubkey);
  if (!currentName) return;

  if (hasKvStore()) {
    await deleteValue(nameKey(currentName));
    await deleteValue(pubkeyKey(pubkey));
    return;
  }

  memoryPubkeyByName.delete(currentName);
  memoryNameByPubkey.delete(pubkey);
}
