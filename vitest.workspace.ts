import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'shared',
      root: 'packages/shared',
      environment: 'node',
    },
  },
  {
    test: {
      name: 'server',
      root: 'packages/server',
      environment: 'node',
    },
  },
  {
    test: {
      name: 'web',
      root: 'packages/web',
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
    },
  },
])
