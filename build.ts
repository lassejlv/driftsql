import { $, build } from 'bun'
import pkg from './package.json'
import ora from 'ora'

const spinner = ora('Building...').start()

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

spinner.succeed('Build completed successfully')
