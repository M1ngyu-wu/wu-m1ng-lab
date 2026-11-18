import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// A commit cannot contain its own SHA. The first commit that adds each immutable
// version receipt supplies that SHA when the site builds.
export function archiveReceipts() {
  if (!existsSync('src/data/archive-revisions')) return {};
  let history;
  try {
    history = execFileSync(
      'git',
      [
        'log',
        '--reverse',
        '--diff-filter=A',
        '--name-only',
        '--format=commit:%H',
        '--',
        'src/data/archive-revisions',
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (error) {
    if (process.env.GITHUB_ACTIONS) throw error;
    return {}; // A source ZIP has no Git history.
  }
  const receipts = {};
  let commit;
  for (const line of history.split(/\r?\n/)) {
    if (line.startsWith('commit:')) commit = line.slice(7);
    const match = /^src\/data\/archive-revisions\/(wu-[0-9a-f]{24})\/([1-9]\d*)\.txt$/.exec(line);
    if (match && commit) receipts[match[1] + '/' + match[2]] ??= commit;
  }
  return receipts;
}
