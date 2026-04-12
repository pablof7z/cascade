import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => cleanup())

// Mock localStorage with a working in-memory implementation
let localStorageStore: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = value
  },
  removeItem: (key: string) => {
    delete localStorageStore[key]
  },
  clear: () => {
    localStorageStore = {}
  },
  // Expose for test cleanup
  _getStore: () => localStorageStore,
  _clearStore: () => {
    localStorageStore = {}
  },
}
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
