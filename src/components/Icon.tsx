import {
  Terminal,
  Globe,
  KeyRound,
  Binary,
  Box,
  Blocks,
  Code2,
  ArrowUpRight,
  Network,
  FlaskConical,
  BookOpen,
  Command,
  Route,
  ShieldCheck,
  ChevronRight,
  Search,
  Sun,
  Moon,
  Menu,
  Rss,
  ArrowRight,
  Clock,
  Layers,
  GraduationCap,
  Fingerprint,
} from 'lucide-react';
const icons = {
  terminal: Terminal,
  globe: Globe,
  key: KeyRound,
  binary: Binary,
  box: Box,
  blocks: Blocks,
  code: Code2,
  arrow: ArrowUpRight,
  network: Network,
  lab: FlaskConical,
  book: BookOpen,
  command: Command,
  route: Route,
  shield: ShieldCheck,
  chevron: ChevronRight,
  search: Search,
  sun: Sun,
  moon: Moon,
  menu: Menu,
  rss: Rss,
  right: ArrowRight,
  clock: Clock,
  layers: Layers,
  learning: GraduationCap,
  fingerprint: Fingerprint,
};
export default function Icon({
  name,
  size = 20,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const I = icons[name as keyof typeof icons] || Terminal;
  return <I size={size} strokeWidth={1.6} aria-hidden="true" {...props} />;
}
