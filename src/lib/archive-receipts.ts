import type { ArchiveDoc } from './archive';

declare const __ARCHIVE_RECEIPTS__: Record<string, string>;

export function withPublishedCommits(doc: ArchiveDoc): ArchiveDoc {
  const receipts = typeof __ARCHIVE_RECEIPTS__ === 'undefined' ? {} : __ARCHIVE_RECEIPTS__;
  return {
    ...doc,
    versions: doc.versions.map((v) => ({ ...v, commit: receipts[doc.id + '/' + v.version] })),
  };
}
