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
          // AIDEV-NOTE: auth-client refuses to start a login while the client id is
          // still the placeholder. Give the suite a real-looking one.
          env: { VITE_YOTO_CLIENT_ID: 'test-client-id' },
        },
      },
    ],
  },
})
