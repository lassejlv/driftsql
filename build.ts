import { $, build } from 'bun'
import pkg from './package.json'
import consola from 'consola'

consola.info('Starting build process...')

await build({
  target: 'node',
  format: 'esm',
  outdir: 'dist',
  entrypoints: ['src/index.ts'],
  minify: {
    whitespace: true,
  },
  external: Object.keys(pkg.dependencies),
})

await $`bun x tsc`

consola.success('Build completed successfully')
