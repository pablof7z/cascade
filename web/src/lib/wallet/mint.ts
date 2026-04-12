export { getMintUrl, normalizeMintUrl } from '$lib/cascade/config';

export function shortMintLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
