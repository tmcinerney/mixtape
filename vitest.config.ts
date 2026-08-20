import { defineConfig } from 'vitest/config'

// AIDEV-NOTE: Replaces deprecated vitest.workspace.ts — uses test.projects instead.

// AIDEV-NOTE: tsc emits compiled copies of the test files into each package's dist/,
// and vitest collects those as well as the TypeScript sources — so every shared and
// server suite ran TWICE. CI hits this too, because `pnpm typecheck` emits dist/ before
// `pnpm test` runs. Setting exclude per project is required: naming `projects` drops
// the inherited default exclude.
const EXCLUDE = ['**/node_modules/**', '**/dist/**']
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: 'packages/shared',
          environment: 'node',
          exclude: EXCLUDE,
        },
      },
      {
        test: {
          name: 'server',
          root: 'packages/server',
          environment: 'node',
          exclude: EXCLUDE,
        },
      },
      {
        test: {
          name: 'web',
          root: 'packages/web',
          environment: 'jsdom',
          exclude: EXCLUDE,
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
