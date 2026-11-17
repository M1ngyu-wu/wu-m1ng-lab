export const categories = [
  {
    id: 'pwn',
    name: 'Pwn',
    description: '从栈帧到控制流，理解二进制的边界。',
    icon: 'terminal',
    color: '#53dfb6',
  },
  {
    id: 'web',
    name: 'Web',
    description: '从输入到信任，探索 Web 安全机制。',
    icon: 'globe',
    color: '#62b5fb',
  },
  {
    id: 'crypto',
    name: 'Crypto',
    description: '在数学结构与密码协议中寻找答案。',
    icon: 'key',
    color: '#c4a0ff',
  },
  {
    id: 'reverse',
    name: 'Reverse',
    description: '追踪指令，还原程序的真实逻辑。',
    icon: 'binary',
    color: '#f4b96e',
  },
  {
    id: 'misc',
    name: 'Misc',
    description: '取证、隐写与那些不设边界的思考。',
    icon: 'box',
    color: '#f18ab5',
  },
  {
    id: 'blockchain',
    name: 'Blockchain',
    description: '理解合约、状态与链上安全。',
    icon: 'blocks',
    color: '#90c7ea',
  },
  {
    id: 'linux',
    name: 'Linux & Tools',
    description: '打好系统基础，让工具成为思维的延伸。',
    icon: 'code',
    color: '#b4db79',
  },
] as const;
export type Category = (typeof categories)[number]['id'];
export interface Knowledge {
  id: string;
  name: string;
  category: Category;
  description: string;
  prerequisites: string[];
  lab?: string;
}
export const knowledge: Knowledge[] = [
  {
    id: 'linux',
    name: 'Linux 基础',
    category: 'linux',
    description: '理解进程、文件权限、标准输入输出和虚拟地址空间。',
    prerequisites: [],
  },
  {
    id: 'assembly',
    name: 'x86-64 汇编',
    category: 'pwn',
    description: '寄存器、mov、call、ret 与 Linux x86-64 调用约定。',
    prerequisites: ['linux'],
  },
  {
    id: 'stack-frame',
    name: 'Stack Frame · 栈帧',
    category: 'pwn',
    description: '函数的局部变量、保存的 RBP 和返回地址组成的运行时布局。示例假定保留帧指针。',
    prerequisites: ['assembly'],
    lab: 'stack',
  },
  {
    id: 'overflow',
    name: 'Buffer Overflow · 栈溢出',
    category: 'pwn',
    description: '写入超出缓冲区边界的数据，可能破坏相邻内存和控制流。',
    prerequisites: ['stack-frame'],
    lab: 'stack',
  },
  {
    id: 'gadget',
    name: 'ROP Gadget',
    category: 'pwn',
    description: '通常以 ret 结束的短指令序列；被复用来操作寄存器与栈指针。',
    prerequisites: ['assembly'],
    lab: 'rop',
  },
  {
    id: 'rop',
    name: 'ROP',
    category: 'pwn',
    description: '通过栈中的地址串联已有指令片段，理解执行流与数据的关系。',
    prerequisites: ['overflow', 'gadget'],
    lab: 'rop',
  },
  {
    id: 'ret2libc',
    name: 'ret2libc',
    category: 'pwn',
    description: '以同一 libc 中的符号泄露计算加载基址，再定位目标符号。',
    prerequisites: ['rop'],
    lab: 'ret2libc',
  },
  {
    id: 'shellcode',
    name: 'Shellcode',
    category: 'pwn',
    description: '用于特定执行上下文的机器码；本平台仅讨论原理，不执行输入。',
    prerequisites: ['assembly'],
  },
  {
    id: 'syscall',
    name: 'Syscall',
    category: 'pwn',
    description: '用户态请求内核服务的接口，区别于普通函数的 ABI。',
    prerequisites: ['assembly', 'linux'],
    lab: 'syscall',
  },
  {
    id: 'heap',
    name: '堆内存基础',
    category: 'pwn',
    description: '动态内存分配、对象生命周期与越界/UAF 的基本概念。',
    prerequisites: ['linux'],
  },
  {
    id: 'format',
    name: '格式化字符串',
    category: 'pwn',
    description: '格式串与参数不匹配会造成非预期读取或写入，应使用固定格式。',
    prerequisites: ['assembly'],
  },
  {
    id: 'gdb',
    name: 'GDB / pwndbg',
    category: 'linux',
    description: '设置断点、查看寄存器和内存，以证据验证程序行为。',
    prerequisites: ['linux'],
  },
  {
    id: 'pwntools',
    name: 'Pwntools',
    category: 'linux',
    description: 'CTF 中常用的 Python 二进制交互与打包库。',
    prerequisites: ['linux'],
  },
  {
    id: 'http',
    name: 'HTTP 与信任边界',
    category: 'web',
    description: '理解请求、响应、身份上下文与服务端对输入的处理。',
    prerequisites: [],
  },
  {
    id: 'sqli',
    name: 'SQL Injection',
    category: 'web',
    description: '将外部输入拼接进 SQL 语法会混淆数据与指令；使用参数绑定。',
    prerequisites: ['http'],
  },
  {
    id: 'xss',
    name: 'XSS',
    category: 'web',
    description: '非预期脚本进入可信页面上下文，需按输出上下文编码。',
    prerequisites: ['http'],
  },
  {
    id: 'ssrf',
    name: 'SSRF',
    category: 'web',
    description: '不受控的服务端 URL 请求可能跨越网络信任边界。',
    prerequisites: ['http'],
  },
  {
    id: 'ssti',
    name: 'SSTI',
    category: 'web',
    description: '不可信输入作为模板源码解析，导致服务端模板表达式被求值。',
    prerequisites: ['http'],
  },
  {
    id: 'modular',
    name: '模运算',
    category: 'crypto',
    description: '同余、逆元与模幂是理解基础公钥密码的起点。',
    prerequisites: [],
  },
  {
    id: 'disassembly',
    name: '反汇编基础',
    category: 'reverse',
    description: '从指令与控制流恢复程序语义，结合动态调试交叉验证。',
    prerequisites: ['assembly'],
  },
  {
    id: 'forensics',
    name: '文件取证',
    category: 'misc',
    description: '先识别文件格式与元数据，再保留证据并分析内容。',
    prerequisites: ['linux'],
  },
  {
    id: 'contracts',
    name: '智能合约基础',
    category: 'blockchain',
    description: '理解交易、存储和外部调用的执行顺序。',
    prerequisites: [],
  },
];
export const byId = (id: string) => knowledge.find((k) => k.id === id);
export function learningOrder(): Knowledge[] {
  const out: Knowledge[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(k: Knowledge) {
    if (visiting.has(k.id)) throw new Error(`知识依赖存在环：${k.id}`);
    if (visited.has(k.id)) return;
    visiting.add(k.id);
    k.prerequisites.forEach((id) => {
      const dep = byId(id);
      if (!dep) throw new Error(`未知依赖：${id}`);
      visit(dep);
    });
    visiting.delete(k.id);
    visited.add(k.id);
    out.push(k);
  }
  knowledge.forEach(visit);
  return out;
}
