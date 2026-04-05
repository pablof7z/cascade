// Testnet configuration - simple module-level state
export const TESTNET_LABELS = {
  label: 'Testnet',
  description: 'Paper trading mode with test sats'
} as const;

let testnetValue = false;

export const isTestnet = {
  subscribe: (callback: (value: boolean) => void) => {
    callback(testnetValue);
    return () => {};
  },
  get: () => testnetValue,
};

export function toggle() {
  testnetValue = !testnetValue;
}

export function setTestnet(value: boolean) {
  testnetValue = value;
}
