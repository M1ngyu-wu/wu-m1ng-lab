import { withPublishedCommits } from './archive-receipts';
import type { ArchiveDoc } from './archive';
const files = import.meta.glob<{ default: ArchiveDoc }>('../data/archive/*.json', { eager: true });
export const publishedDocs = Object.values(files).map((file) => withPublishedCommits(file.default));
export function documentPath(doc: ArchiveDoc) {
  const remote = publishedDocs.find((item) => item.id === doc.id);
  return remote &&
    remote.versions.length === doc.versions.length &&
    remote.versions.at(-1)?.source.sha256 === doc.versions.at(-1)?.source.sha256
    ? 'writeups/' + doc.id + '/'
    : 'writeups/view/?id=' + encodeURIComponent(doc.id);
}
