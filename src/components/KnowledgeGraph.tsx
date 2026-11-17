import { useEffect, useRef, useState } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import { categories, knowledge } from '../data/knowledge';
import { tools } from '../data/tools';
import { questions } from '../data/questions';
import { profile } from '../data/profile';
import { useLab } from './useLab';
import { url } from '../lib/url';
export interface ArticleLink {
  id: string;
  title: string;
  knowledge: string[];
  category: string;
  kind: string;
}
export default function KnowledgeGraph({ articles }: { articles: ArticleLink[] }) {
  const container = useRef<HTMLDivElement>(null),
    cy = useRef<Core | null>(null);
  const { data } = useLab();
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('全部'),
    [selected, setSelected] = useState('overflow'),
    [showResources, setShowResources] = useState(false),
    [graphError, setGraphError] = useState('');
  const node = knowledge.find((k) => k.id === selected);
  const currentArticle = articles.find((a) => `a:${a.id}` === selected),
    currentTool = tools.find((t) => `t:${t.id}` === selected);
  useEffect(() => {
    if (!container.current) return;
    const elements: ElementDefinition[] = [];
    const allowed = knowledge.filter((k) => category === '全部' || k.category === category);
    const ids = new Set(allowed.map((k) => k.id));
    const edge = (source: string, target: string, relation: string) =>
      elements.push({ data: { id: `${source}>${target}`, source, target, relation } });
    categories
      .filter((c) => category === '全部' || c.id === category)
      .forEach((c) =>
        elements.push({
          data: { id: `c:${c.id}`, label: c.name, type: 'direction', color: c.color },
        }),
      );
    allowed.forEach((k) => {
      elements.push({
        data: {
          id: k.id,
          label: k.name.split(' · ')[0],
          type: 'knowledge',
          color:
            data.study[k.id]?.status === '已掌握'
              ? '#5be1b5'
              : data.study[k.id]?.status === '学习中'
                ? '#efbd78'
                : '#7d99b4',
        },
      });
      edge(`c:${k.category}`, k.id, '属于');
      k.prerequisites.filter((p) => ids.has(p)).forEach((p) => edge(p, k.id, '前置知识'));
    });
    if (showResources) {
      articles
        .filter((a) => a.knowledge.some((k) => ids.has(k)))
        .forEach((a) => {
          elements.push({
            data: {
              id: `a:${a.id}`,
              label: a.title.slice(0, 17) + '…',
              type: 'article',
              color: '#bdacf4',
            },
          });
          a.knowledge.filter((k) => ids.has(k)).forEach((k) => edge(k, `a:${a.id}`, '参考文章'));
          if (a.kind === 'Writeup') {
            elements.push({
              data: { id: `q:${a.id}`, label: '示例 CTF 题', type: 'challenge', color: '#ecb57b' },
            });
            edge(`a:${a.id}`, `q:${a.id}`, '应用于');
          }
        });
      tools
        .filter((t) => t.knowledge.some((k) => ids.has(k)))
        .forEach((t) => {
          elements.push({
            data: { id: `t:${t.id}`, label: t.name, type: 'tool', color: '#6abce3' },
          });
          t.knowledge.filter((k) => ids.has(k)).forEach((k) => edge(k, `t:${t.id}`, '相关工具'));
        });
      profile.projects.forEach((p, i) =>
        elements.push({ data: { id: `p:${i}`, label: p.name, type: 'project', color: '#a7d275' } }),
      );
    }
    try {
      const isLight = document.documentElement.dataset.theme === 'light';
      const instance = cytoscape({
        container: container.current,
        elements,
        layout: {
          name: 'cose',
          animate: false,
          nodeRepulsion: () => (showResources ? 14000 : 9000),
          idealEdgeLength: () => 100,
          randomize: false,
        },
        minZoom: 0.2,
        maxZoom: 3,
        wheelSensitivity: 0.2,
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              'font-size': 10,
              color: isLight ? '#1c3545' : '#bdd0de',
              'background-color': 'data(color)',
              width: 13,
              height: 13,
              'text-valign': 'bottom',
              'text-margin-y': 8,
              'text-max-width': '110px',
              'text-wrap': 'wrap',
              'border-width': 2,
              'border-color': isLight ? '#e5f0f1' : '#13232e',
            },
          },
          {
            selector: 'node[type="direction"]',
            style: { width: 28, height: 28, 'font-size': 14, 'font-weight': 'bold' },
          },
          {
            selector: 'node[type="article"]',
            style: { shape: 'round-rectangle', width: 18, height: 14 },
          },
          { selector: 'node[type="tool"]', style: { shape: 'diamond', width: 18, height: 18 } },
          {
            selector: 'node[type="challenge"]',
            style: { shape: 'triangle', width: 20, height: 20 },
          },
          { selector: 'node[type="project"]', style: { shape: 'hexagon', width: 22, height: 22 } },
          {
            selector: 'edge',
            style: {
              width: 1,
              'line-color': isLight ? '#b1c6cd' : '#28404e',
              'target-arrow-color': isLight ? '#b1c6cd' : '#28404e',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              opacity: 0.7,
            },
          },
          { selector: '.dim', style: { opacity: 0.12 } },
          {
            selector: 'node.focus',
            style: {
              'border-color': '#5be1b5',
              'border-width': 4,
              width: 23,
              height: 23,
              opacity: 1,
            },
          },
          {
            selector: 'edge.focus',
            style: {
              'line-color': '#5be1b5',
              'target-arrow-color': '#5be1b5',
              width: 2,
              opacity: 1,
            },
          },
        ],
      });
      cy.current = instance;
      instance.on('tap', 'node', (e) => {
        const id = e.target.id();
        if (id.startsWith('q:')) setSelected(`a:${id.slice(2)}`);
        else setSelected(id);
      });
      const theme = () => {
        const light = document.documentElement.dataset.theme === 'light';
        instance
          .style()
          .selector('node')
          .style('color', light ? '#1c3545' : '#bdd0de')
          .update();
      };
      window.addEventListener('theme-change', theme);
      return () => {
        window.removeEventListener('theme-change', theme);
        instance.destroy();
        cy.current = null;
      };
    } catch {
      setGraphError('图形视图无法启动，可使用下方知识点选择器与详情链接。');
    }
  }, [category, showResources, data.study]);
  useEffect(() => {
    const instance = cy.current;
    if (!instance) return;
    instance.elements().removeClass('dim focus');
    const id = selected;
    const target = instance.getElementById(id);
    if (!target.length) return;
    let nodes = target
      .union(target.predecessors())
      .union(target.successors())
      .union(target.neighborhood());
    instance.elements().addClass('dim');
    nodes.removeClass('dim').addClass('focus');
  }, [selected, category, showResources, data.study]);
  const matches = knowledge.filter(
    (k) =>
      (category === '全部' || k.category === category) &&
      `${k.name} ${k.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <input
          aria-label="搜索知识节点"
          value={query}
          placeholder="搜索知识点，例如 ROP、SQL…"
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="图谱方向"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option>全部</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className="filter-chip"
          aria-pressed={showResources}
          onClick={() => setShowResources((v) => !v)}
        >
          显示文章与工具
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setCategory('全部');
            setQuery('');
            setSelected('');
            cy.current?.elements().removeClass('dim focus');
            cy.current?.fit(undefined, 30);
          }}
        >
          全局视图
        </button>
      </div>
      {query && (
        <div className="toolbar" aria-live="polite">
          {matches.map((k) => (
            <button
              className="filter-chip"
              key={k.id}
              onClick={() => {
                setSelected(k.id);
                cy.current?.animate(
                  { center: { eles: cy.current.getElementById(k.id) }, zoom: 1.1 },
                  { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250 },
                );
              }}
            >
              {k.name}
            </button>
          ))}
          {!matches.length && <span className="muted small">没有匹配节点。</span>}
        </div>
      )}
      <p className="notice">
        拖动节点 · 滚轮缩放 · 点击高亮前置和后续路径 · 青绿＝已掌握，琥珀＝学习中 ·
        初始知识数据为示例
      </p>
      {graphError && (
        <div role="alert" className="callout warning">
          {graphError}
        </div>
      )}
      <div className="graph-layout">
        <div
          ref={container}
          className="graph-canvas"
          role="img"
          aria-label="网络安全知识关系图，键盘用户可使用右侧选择器浏览"
        />
        <aside className="panel graph-info">
          <label className="field">
            键盘浏览知识点
            <select
              aria-label="选择知识节点"
              value={node ? selected : ''}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">选择一个节点</option>
              {matches.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          {node ? (
            <>
              <span className="eyebrow">KNOWLEDGE NODE</span>
              <h3 style={{ marginTop: 10 }}>{node.name}</h3>
              <p>{node.description}</p>
              <span className="filter-chip">{data.study[node.id]?.status || '未开始'}</span>
              <h4 style={{ marginTop: 20 }}>前置知识</h4>
              <div className="link-list">
                {node.prerequisites.map((id) => (
                  <button className="filter-chip" key={id} onClick={() => setSelected(id)}>
                    {knowledge.find((k) => k.id === id)?.name}
                  </button>
                ))}
                {!node.prerequisites.length && <p>无前置依赖。</p>}
              </div>
              <div className="link-list">
                <a href={url(`knowledge/${node.id}/`)}>查看完整知识关联 →</a>
                <a href={url(`learning/?node=${node.id}`)}>记录学习进度 →</a>
                {node.lab && <a href={url(`lab/?tab=${node.lab}`)}>进入关联实验 →</a>}
                {articles
                  .filter((a) => a.knowledge.includes(node.id))
                  .map((a) => (
                    <a key={a.id} href={url(`articles/${a.id}/`)}>
                      {a.title} →
                    </a>
                  ))}
              </div>
              <p style={{ marginTop: 18 }}>
                {tools.filter((t) => t.knowledge.includes(node.id)).length} 条关联工具 ·{' '}
                {questions.filter((q) => q.knowledge === node.id).length} 道自测题
              </p>
            </>
          ) : currentArticle ? (
            <>
              <h3>{currentArticle.title}</h3>
              <p>示例技术文章 · 与知识点元数据自动关联。</p>
              <a className="button primary" href={url(`articles/${currentArticle.id}/`)}>
                阅读文章 →
              </a>
            </>
          ) : currentTool ? (
            <>
              <h3>{currentTool.name}</h3>
              <p>{currentTool.explanation}</p>
              <a className="button primary" href={url(`tools/#${currentTool.id}`)}>
                查看工具 →
              </a>
            </>
          ) : (
            <>
              <h3>把知识连接起来</h3>
              <p>选择方向、知识点、文章或工具节点，查看它们之间的关联。</p>
              <p>
                圆形：方向 / 知识点
                <br />
                矩形：文章 · 菱形：工具
                <br />
                三角：示例题目 · 六边形：项目
              </p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
