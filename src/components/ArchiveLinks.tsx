import { useCatalog } from './useCatalog';
import { currentVersion } from '../lib/archive';
import { documentPath } from '../lib/archive-public';
import { url } from '../lib/url';
export default function ArchiveLinks({
  concepts = [],
  tool,
}: {
  concepts?: string[];
  tool?: string;
}) {
  const { docs } = useCatalog();
  const related = docs.filter((d) => {
    const v = currentVersion(d);
    return (tool && v.tools.includes(tool)) || v.concepts.some((c) => concepts.includes(c.id));
  });
  if (!related.length) return null;
  return (
    <div className="link-list">
      <h3>关联题解</h3>
      {related.map((d) => (
        <a key={d.id} href={url(documentPath(d))}>
          {currentVersion(d).title} →
        </a>
      ))}
    </div>
  );
}
