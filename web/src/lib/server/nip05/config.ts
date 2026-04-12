import { normalizeManagedNip05Domain } from '$lib/ndk/nip05';

export type ManagedNip05Config = {
  domain: string | null;
  enabled: boolean;
};

export function getManagedNip05Config(): ManagedNip05Config {
  const domain = normalizeManagedNip05Domain(process.env.PUBLIC_NIP05_DOMAIN);

  return {
    domain,
    enabled: Boolean(domain)
  };
}
