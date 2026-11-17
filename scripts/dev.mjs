import { spawnSync, spawn } from 'node:child_process';
const build = spawnSync(process.execPath, ['scripts/astro.mjs', 'build'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
const index = spawnSync(
  process.execPath,
  ['node_modules/pagefind/lib/runner/bin.cjs', '--site', 'dist'],
  { stdio: 'inherit' },
);
if (index.status !== 0) process.exit(index.status || 1);
const dev = spawn(
  process.execPath,
  ['scripts/astro.mjs', 'dev', '--host', '127.0.0.1', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
dev.on('exit', (code) => process.exit(code ?? 1));
