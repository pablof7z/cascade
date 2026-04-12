type ClassDictionary = Record<string, boolean | null | undefined>;
type ClassValue = string | number | bigint | boolean | null | undefined | ClassDictionary | ClassValue[];

function normalizeClassValue(input: ClassValue): string {
  if (!input) return '';
  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'bigint') {
    return String(input);
  }
  if (Array.isArray(input)) {
    return input.map(normalizeClassValue).filter(Boolean).join(' ');
  }
  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([className]) => className)
      .join(' ');
  }

  return '';
}

/**
 * Minimal class combiner for the template's registry-installed components.
 */
export function cn(...inputs: ClassValue[]) {
	return inputs.map(normalizeClassValue).filter(Boolean).join(' ');
}
