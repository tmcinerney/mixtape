import { defineConfig } from 'vitest/config'

// AIDEV-NOTE: Replaces deprecated vitest.workspace.ts — uses test.projects instead.
export default defineConfig({
  test: {
    projects: [
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
    ],
  },
})
