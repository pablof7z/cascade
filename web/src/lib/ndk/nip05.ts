export const MANAGED_NIP05_NAME_RE = /^[a-z0-9_-]{1,64}$/;
export const NIP05_REGISTRATION_AUTH_KIND = 27235;
export const NIP05_REGISTRATION_AUTH_WINDOW_SECONDS = 5 * 60;

export function normalizeManagedNip05Name(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isValidManagedNip05Name(value: string | null | undefined): boolean {
  return MANAGED_NIP05_NAME_RE.test(normalizeManagedNip05Name(value));
}

export function normalizeManagedNip05Domain(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return url.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function formatManagedNip05Identifier(name: string, domain: string): string {
  return `${normalizeManagedNip05Name(name)}@${domain}`;
}

export function managedNip05NameFromIdentifier(
  identifier: string | null | undefined,
  domain: string | null | undefined
): string | undefined {
  const normalizedDomain = normalizeManagedNip05Domain(domain);
  const trimmedIdentifier = (identifier ?? '').trim().toLowerCase();
  if (!trimmedIdentifier || !normalizedDomain) return undefined;

  const [name, identifierDomain] = trimmedIdentifier.split('@');
  if (!name || identifierDomain !== normalizedDomain) return undefined;
  if (!isValidManagedNip05Name(name)) return undefined;

  return name;
}

export function profileLookupIdentifier(
  identifier: string | null | undefined,
  localDomain: string | null | undefined
): string {
  const trimmedIdentifier = (identifier ?? '').trim().toLowerCase();
  const normalizedDomain = normalizeManagedNip05Domain(localDomain);

  if (!trimmedIdentifier) return '';
  if (!normalizedDomain) return trimmedIdentifier;
  if (trimmedIdentifier.includes('@')) return trimmedIdentifier;
  if (trimmedIdentifier.includes('.')) return trimmedIdentifier;
  if (!isValidManagedNip05Name(trimmedIdentifier)) return trimmedIdentifier;

  return formatManagedNip05Identifier(trimmedIdentifier, normalizedDomain);
}
