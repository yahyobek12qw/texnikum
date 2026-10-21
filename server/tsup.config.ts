import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  // Ichki workspace paketi (TypeScript manba) bundle ichiga olinadi; boshqa barcha kutubxonalar tashqarida qoladi.
  noExternal: [/^@uchkoprik\//],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
