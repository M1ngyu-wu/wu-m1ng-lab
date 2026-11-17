import { useEffect, useState } from 'react';
import {
  hex,
  stackModel,
  libcAddresses,
  address,
  ropState,
  gadgetAddress,
  type Gadget,
  type ChainItem,
} from '../lib/simulation';
import { url } from '../lib/url';
const labels = {
  stack: 'Stack Overflow',
  rop: 'ROP Chain',
  ret2libc: 'ret2libc',
  syscall: 'Syscall',
};
const guides = {
  stack: {
    intro:
      '从 Buffer 起点逐字节写入，观察数据如何越过边界。本模型为保留帧指针的连续栈布局，不包含 Canary、对齐填充或其他局部变量。',
    points:
      '栈分配向低地址增长；数组连续写入向高地址推进。RBP 指向保存的旧帧指针，RSP 位于局部缓冲区起点。',
    mistake:
      '偏移恰好等于返回地址起点时，尚未覆盖其任何字节。实际程序的偏移应由调试测量，不能套用此模型。',
    article: 'stack-ret2libc',
  },
  rop: {
    intro:
      '把 Gadget 地址与参数数据依次放入栈。每次单步处理一个 Gadget，查看寄存器和 RSP 的变化。添加、删除或排序都会重置执行状态。',
    points:
      'pop 消耗一个 8 字节参数；Gadget 地址由前一次 ret 消耗。界面 RSP 显示已完成步骤后的累计消费位置，下一地址尚待读取。',
    mistake:
      '忽略 pop/ret 的栈槽消耗和 Gadget 副作用。system/syscall 在本模拟中只展示调用边界，不执行函数、不模拟完整内核行为。',
    article: 'rop-basics',
  },
  ret2libc: {
    intro:
      '按步骤理解：符号泄露 → 减去符号偏移 → 计算目标地址 → 构造调用链。所有地址均为可编辑的示例数据。',
    points:
      '基址 = 泄露符号地址 − 该符号在同一 libc 中的偏移。system 与 /bin/sh 必须来自同一份 libc。所有运算采用 BigInt，避免地址精度丢失。',
    mistake:
      '混用 libc 版本，或者泄露值并不指向符号起点。页对齐只是合理性检查，不是匹配正确的充分证据。',
    article: 'stack-ret2libc',
  },
  syscall: {
    intro:
      '选择 Linux 原生 x86-64 系统调用，编辑模拟寄存器，查看调用约定与参数表达式。界面只解释数据，不执行任何系统调用。',
    points:
      'RAX 为调用号。参数依次为 RDI、RSI、RDX、R10、R8、R9。原始返回值通常在 RAX；syscall 会改写 RCX、R11。',
    mistake:
      '把第四个参数放进 RCX，或把指针当成内存内容。execve 成功不会返回；原始 syscall 错误码与 libc 的 errno 包装不同。',
    article: 'syscall-basics',
  },
};
function Stack() {
  const [buffer, setBuffer] = useState(32),
    [length, setLength] = useState(24),
    [written, setWritten] = useState(24),
    [running, setRunning] = useState(false);
  const m = stackModel(buffer, written);
  const base = 0x7fffffffe000n;
  const size = buffer + 24;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () =>
        setWritten((v) => {
          if (v >= length) {
            setRunning(false);
            return v;
          }
          return v + 1;
        }),
      55,
    );
    return () => clearInterval(timer);
  }, [running, length]);
  const reset = (b: number, l: number) => {
    l = Math.max(0, Math.min(l, b + 24));
    setRunning(false);
    setBuffer(b);
    setLength(l);
    setWritten(l);
  };
  return (
    <div className="two-col">
      <div className="panel">
        <h2>调整写入，观察边界</h2>
        <p className="notice">拖动滑块即时更新；“模拟写入”从第 0 字节开始逐步填充。</p>
        <label className="field">
          <span>
            Buffer 大小 <b className="accent">{buffer} bytes</b>
          </span>
          <input
            aria-label="Buffer 大小"
            type="range"
            min="16"
            max="64"
            step="8"
            value={buffer}
            onChange={(e) => reset(+e.target.value, length)}
          />
        </label>
        <label className="field">
          <span>
            输入长度 <b className="accent">{length} bytes</b>
          </span>
          <input
            aria-label="输入长度"
            type="range"
            min="0"
            max={buffer + 24}
            value={length}
            onChange={(e) => reset(buffer, +e.target.value)}
          />
        </label>
        <div className="toolbar">
          <button
            className="button primary"
            onClick={() => {
              setWritten(0);
              setRunning(true);
            }}
          >
            模拟写入
          </button>
          <button
            className="button secondary"
            disabled={!running}
            onClick={() => setRunning(false)}
          >
            暂停
          </button>
          <button className="button secondary" onClick={() => reset(32, 24)}>
            重置
          </button>
        </div>
        <div className={`callout ${m.overflow ? 'warning' : ''}`} aria-live="polite">
          <b>
            {m.returnBytes
              ? '返回地址已被覆盖'
              : m.savedRbp
                ? 'Saved RBP 已被覆盖'
                : '数据位于 Buffer 内'}
          </b>
          <p>
            当前写入 {written} / {length} bytes · 越界 {m.overflow} bytes
          </p>
          <p>
            返回地址起点偏移：<strong data-testid="return-offset">{m.returnOffset}</strong> bytes
          </p>
          <p>
            Saved RBP：{m.savedRbp}/8 · Return Address：
            <span data-testid="return-bytes">{m.returnBytes}</span>/8 bytes
          </p>
        </div>
      </div>
      <div className="panel">
        <h2>Memory / Stack Frame</h2>
        <div className="stack-legend">
          <span>高地址 ↑ · 写入方向 ↑</span>
          <span>栈增长 ↓ · 低地址 ↓</span>
        </div>
        <div className="stack-header">
          <span>ADDRESS</span>
          <span>8 BYTES / ROW</span>
          <span>REGION</span>
        </div>
        {Array.from({ length: size / 8 }, (_, i) => size - 8 - i * 8).map((offset) => {
          const type =
            offset < buffer
              ? 'buffer'
              : offset === buffer
                ? 'rbp'
                : offset === buffer + 8
                  ? 'return'
                  : 'space';
          return (
            <div className="memory-row" key={offset}>
              <span>{hex(base + BigInt(offset))}</span>
              <div className={`memory-cells ${type}`}>
                {Array.from({ length: 8 }, (_, j) => (
                  <b className={offset + j < written ? 'written' : ''} key={j}>
                    {offset + j < written ? '41' : type === 'buffer' ? '00' : '··'}
                  </b>
                ))}
              </div>
              <em>
                {type === 'rbp'
                  ? 'Saved RBP ← RBP'
                  : type === 'return'
                    ? 'Return Address'
                    : type === 'space'
                      ? 'Caller stack'
                      : offset === 0
                        ? 'Buffer ← RSP'
                        : 'Buffer'}
              </em>
            </div>
          );
        })}
        <p className="notice">0x41 = “A”；·· 为未建模的原始值。每一行从左到右地址递增。</p>
      </div>
    </div>
  );
}
const initialChain = (): ChainItem[] => [
  { id: '1', op: 'pop rdi', value: '0x7ffff7bd8698' },
  { id: '2', op: 'ret', value: '0x0' },
  { id: '3', op: 'system', value: '0x0' },
];
function Rop() {
  const [chain, setChain] = useState(initialChain),
    [count, setCount] = useState(0),
    [playing, setPlaying] = useState(false),
    [op, setOp] = useState<Gadget>('pop rdi');
  const terminal = chain.findIndex((x) => x.op === 'system' || x.op === 'syscall');
  const limit = terminal < 0 ? chain.length : terminal + 1;
  const state = ropState(chain, count);
  const change = (next: ChainItem[]) => {
    setChain(next);
    setCount(0);
    setPlaying(false);
  };
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setCount((c) => {
          if (c >= limit) {
            setPlaying(false);
            return c;
          }
          return c + 1;
        }),
      900,
    );
    return () => clearInterval(timer);
  }, [playing, limit]);
  const move = (i: number, dir: number) => {
    const next = [...chain];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    change(next);
  };
  let slot = 0;
  return (
    <div className="two-col">
      <div className="panel">
        <h2>构造调用链</h2>
        <div className="toolbar" style={{ marginTop: 18 }}>
          <select
            aria-label="Gadget 类型"
            value={op}
            onChange={(e) => setOp(e.target.value as Gadget)}
          >
            {Object.keys(gadgetAddress).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button
            className="button primary"
            disabled={chain.length >= 16}
            onClick={() => change([...chain, { id: crypto.randomUUID(), op, value: '0x0' }])}
          >
            添加 Gadget
          </button>
        </div>
        <div className="chain-list">
          {chain.map((item, i) => (
            <div key={item.id} className={`chain-row ${count === i ? 'active' : ''}`}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <strong>
                {item.op}
                {item.op.startsWith('pop') ? '; ret' : ''}
              </strong>
              {item.op.startsWith('pop') && (
                <input
                  aria-label={`${item.op} 参数 ${i + 1}`}
                  value={item.value}
                  maxLength={18}
                  onChange={(e) =>
                    change(chain.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                  }
                />
              )}
              <button
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`上移第 ${i + 1} 个 Gadget`}
              >
                ↑
              </button>
              <button
                disabled={i === chain.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`下移第 ${i + 1} 个 Gadget`}
              >
                ↓
              </button>
              <button
                onClick={() => change(chain.filter((_, j) => j !== i))}
                aria-label={`删除第 ${i + 1} 个 Gadget`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {!chain.length && <p className="empty">链为空，请添加一个 Gadget。</p>}
        <div className="toolbar" style={{ marginTop: 20 }}>
          <button
            className="button primary"
            disabled={
              count >= limit ||
              playing ||
              chain.some((x) => x.op.startsWith('pop') && !/^0x[0-9a-f]{1,16}$/i.test(x.value))
            }
            onClick={() => setCount((c) => c + 1)}
          >
            单步执行
          </button>
          <button
            className="button secondary"
            disabled={
              count >= limit ||
              chain.some((x) => x.op.startsWith('pop') && !/^0x[0-9a-f]{1,16}$/i.test(x.value))
            }
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? '暂停' : '自动执行'}
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setCount(0);
              setPlaying(false);
            }}
          >
            重置执行
          </button>
        </div>
        <p className="notice">参数需为 0x 开头的 64 位十六进制。最多 16 个 Gadget。</p>
      </div>
      <div className="panel">
        <h2>寄存器与栈布局</h2>
        <p className="notice">
          已处理 {count}/{chain.length} 个 Gadget ·{' '}
          {count >= limit ? '到达模拟边界' : '下一步：' + chain[count]?.op}
        </p>
        <div className="register-grid">
          {Object.entries({ ...state.regs, RSP: hex(state.rsp) }).map(([k, v]) => (
            <div key={k}>
              <b>{k}</b>
              <span>{v}</span>
            </div>
          ))}
        </div>
        <pre className="code-output">
          {chain
            .flatMap((item) => {
              const result = [
                `${hex(0x7fffffffe000n + BigInt(slot++ * 8))}  ${gadgetAddress[item.op]}  ${item.op}`,
              ];
              if (item.op.startsWith('pop'))
                result.push(`${hex(0x7fffffffe000n + BigInt(slot++ * 8))}  ${item.value}  ← data`);
              return result;
            })
            .join('\n') || '空栈'}
        </pre>
        <div aria-live="polite" className="callout">
          {state.logs.at(-1) || '单步执行以观察寄存器变化。'}
          <p>system 仅展示参数边界；链内不模拟函数返回。地址读取计入对应 Gadget 步骤。</p>
        </div>
      </div>
    </div>
  );
}
function Ret2libc() {
  const [values, setValues] = useState({
      leak: '0x7ffff7a80aa0',
      offset: '0x80aa0',
      system: '0x50d60',
      binsh: '0x1d8698',
    }),
    [step, setStep] = useState(0);
  let result: ReturnType<typeof libcAddresses> | null = null,
    error = '';
  try {
    result = libcAddresses(values.leak, values.offset, values.system, values.binsh);
  } catch (e) {
    error = (e as Error).message;
  }
  const steps = ['泄露符号', '计算基址', '定位 system', '定位 /bin/sh', '构造调用链'];
  const explanations = [
    '假设已通过授权的本地实验获取 puts 的完整运行时地址。此页面不执行泄露。',
    '从泄露地址减去匹配版本的 puts 偏移，恢复 libc 加载基址。',
    '将 system 在相同 libc 中的偏移加到基址。',
    '将字符串 /bin/sh 的偏移加到相同基址。指针值不代表该内存已被验证。',
    '先将字符串地址传入 RDI，再调用 system。实际链还需核对 Gadget、对齐与返回路径。',
  ];
  return (
    <>
      <div className="step-flow">
        {steps.map((s, i) => (
          <button key={s} className={step === i ? 'active' : ''} onClick={() => setStep(i)}>
            {i + 1}. {s}
          </button>
        ))}
      </div>
      <div className="two-col">
        <div className="panel">
          <h2>编辑示例地址</h2>
          <p className="notice">选择上方步骤，阅读中文解释；地址变化会立即重新计算。</p>
          {(
            [
              ['leak', 'puts 泄露地址'],
              ['offset', 'puts 符号偏移'],
              ['system', 'system 偏移'],
              ['binsh', '/bin/sh 字符串偏移'],
            ] as const
          ).map(([id, label]) => (
            <label className="field" key={id}>
              {label}
              <input
                aria-label={label}
                className="mono"
                value={values[id]}
                maxLength={18}
                spellCheck={false}
                onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="panel">
          <h2>
            {step + 1}. {steps[step]}
          </h2>
          <div className="callout">{explanations[step]}</div>
          {error ? (
            <p role="alert" className="callout error">
              {error}
            </p>
          ) : (
            result && (
              <>
                <div className="address-result">
                  <span>libc base = leak − puts offset</span>
                  <code data-testid="libc-base">{hex(result.base)}</code>
                </div>
                <div className="address-result">
                  <span>system = base + system offset</span>
                  <code>{hex(result.system)}</code>
                </div>
                <div className="address-result">
                  <span>/bin/sh = base + string offset</span>
                  <code>{hex(result.binsh)}</code>
                </div>
                {!result.aligned && (
                  <p className="callout warning">基址不是 4 KiB 对齐，请检查泄露和偏移。</p>
                )}
                {step === 4 && (
                  <pre className="code-output">{`padding → pop rdi; ret\n${hex(result.binsh)} → system ${hex(result.system)}\n[还需核对栈对齐与后续返回地址]`}</pre>
                )}
              </>
            )
          )}
          <div className="toolbar" style={{ marginTop: 20 }}>
            <button
              className="button secondary"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              上一步
            </button>
            <button
              className="button primary"
              disabled={step === 4}
              onClick={() => setStep((s) => s + 1)}
            >
              下一步
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
const syscallDefs = [
  {
    name: 'read',
    number: 0,
    args: ['fd', 'buf', 'count'],
    values: ['0x0', '0x404000', '0x40', '0x0', '0x0', '0x0'],
  },
  {
    name: 'write',
    number: 1,
    args: ['fd', 'buf', 'count'],
    values: ['0x1', '0x404000', '0xd', '0x0', '0x0', '0x0'],
  },
  {
    name: 'mmap',
    number: 9,
    args: ['addr', 'length', 'prot', 'flags', 'fd', 'offset'],
    values: ['0x0', '0x1000', '0x3', '0x22', '0xffffffffffffffff', '0x0'],
  },
  {
    name: 'mprotect',
    number: 10,
    args: ['addr', 'length', 'prot'],
    values: ['0x404000', '0x1000', '0x3', '0x0', '0x0', '0x0'],
  },
  {
    name: 'execve',
    number: 59,
    args: ['filename', 'argv', 'envp'],
    values: ['0x404000', '0x405000', '0x0', '0x0', '0x0', '0x0'],
  },
];
const argRegs = ['RDI', 'RSI', 'RDX', 'R10', 'R8', 'R9'];
function Syscall() {
  const [selected, setSelected] = useState(1),
    [regs, setRegs] = useState(['0x1', ...syscallDefs[1].values]),
    [phase, setPhase] = useState(0);
  const def = syscallDefs.find(
    (d) => BigInt(d.number).toString(16) === (regs[0].replace(/^0x0*/, '').toLowerCase() || '0'),
  );
  let error = '';
  try {
    regs.forEach(address);
  } catch (e) {
    error = (e as Error).message;
  }
  const set = (i: number, value: string) => {
    setRegs((r) => r.map((v, j) => (i === j ? value : v)));
    setPhase(0);
  };
  return (
    <div className="two-col">
      <div className="panel">
        <h2>Linux x86-64 寄存器</h2>
        <label className="field" style={{ marginTop: 18 }}>
          调用预设
          <select
            aria-label="系统调用预设"
            value={selected}
            onChange={(e) => {
              const i = +e.target.value;
              setSelected(i);
              setRegs([hex(BigInt(syscallDefs[i].number)), ...syscallDefs[i].values]);
              setPhase(0);
            }}
          >
            {syscallDefs.map((d, i) => (
              <option key={d.name} value={i}>
                {d.name} · {d.number}
              </option>
            ))}
          </select>
        </label>
        <div className="register-grid">
          {['RAX', ...argRegs].map((r, i) => (
            <label className="field" key={r}>
              <span>
                {r} · {i === 0 ? '调用号' : def?.args[i - 1] || '未使用'}
              </span>
              <input
                aria-label={r}
                className="mono"
                value={regs[i]}
                maxLength={18}
                onChange={(e) => set(i, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2>从用户态到内核接口</h2>
        <div className="step-flow" style={{ marginTop: 20 }}>
          {['设置寄存器', '到达 syscall', '观察语义'].map((s, i) => (
            <button className={phase === i ? 'active' : ''} key={s} onClick={() => setPhase(i)}>
              {i + 1}. {s}
            </button>
          ))}
        </div>
        <pre className="code-output">
          {['RAX', ...argRegs].map((r, i) => `mov ${r.toLowerCase()}, ${regs[i]}`).join('\n') +
            '\n; syscall — 仅模拟，不执行'}
        </pre>
        {error ? (
          <p className="callout error" role="alert">
            {error}
          </p>
        ) : (
          <div className="callout" aria-live="polite">
            <b>
              {def
                ? `${def.name}(${def.args.map((_, i) => regs[i + 1]).join(', ')})`
                : '当前调用号未包含在教学预设中。'}
            </b>
            <p>
              {phase === 0
                ? '寄存器已准备。参数为模拟整数，指向的内存未建模。'
                : phase === 1
                  ? 'CPU 通过 syscall 指令切换到内核入口。RCX、R11 会被改写；此页面仅解释该过程。'
                  : def?.name === 'execve'
                    ? '若 execve 成功，进程映像被替换；失败时才返回错误。'
                    : `真实 ${def?.name || '系统调用'} 的结果依赖内核检查，不能从寄存器值推断成功。原始返回通常存入 RAX。`}
            </p>
          </div>
        )}
        <button
          className="button primary"
          disabled={!!error || phase === 2}
          onClick={() => setPhase((p) => p + 1)}
        >
          下一步模拟
        </button>
        <p className="notice">模拟不返回伪造的成功值；不会读写主机、映射内存或启动进程。</p>
      </div>
    </div>
  );
}
export default function PwnLab() {
  const [tab, setTab] = useState<keyof typeof labels>('stack');
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab');
    if (t && t in labels) setTab(t as keyof typeof labels);
  }, []);
  const guide = guides[tab];
  return (
    <>
      <div className="tabs" role="tablist" aria-label="实验类型">
        {Object.entries(labels).map(([id, label], i) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-controls="lab-panel"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id as keyof typeof labels);
              history.replaceState(null, '', `?tab=${id}`);
            }}
          >
            {String(i + 1).padStart(2, '0')} / {label}
          </button>
        ))}
      </div>
      <p className="callout">{guide.intro}</p>
      <div id="lab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab}>
        {tab === 'stack' ? (
          <Stack />
        ) : tab === 'rop' ? (
          <Rop />
        ) : tab === 'ret2libc' ? (
          <Ret2libc />
        ) : (
          <Syscall />
        )}
      </div>
      <div className="lab-details">
        <section className="panel">
          <h3>关键知识点</h3>
          <p>{guide.points}</p>
        </section>
        <section className="panel">
          <h3>常见错误</h3>
          <p>{guide.mistake}</p>
          <a
            className="text-link"
            style={{ marginTop: 12 }}
            href={url(`articles/${guide.article}/`)}
          >
            阅读关联文章 →
          </a>
        </section>
      </div>
    </>
  );
}
