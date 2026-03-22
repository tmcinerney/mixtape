import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  // AIDEV-NOTE: Don't bundle dependencies — they have native addons (onnxruntime-node,
  // sharp) or dynamic requires (@huggingface/transformers) that break when bundled.
  // Only bundle the workspace shared package since it's local source.
  noExternal: ['@mixtape/shared'],
})
