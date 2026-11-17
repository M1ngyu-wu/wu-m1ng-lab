export const hex = (value: bigint) => `0x${value.toString(16)}`;
export function address(text: string): bigint {
  if (!/^0x[0-9a-f]{1,16}$/i.test(text)) throw new Error('请输入 0x 开头的 64 位十六进制数。');
  return BigInt(text);
}
export function libcAddresses(leak: string, offset: string, system: string, binsh: string) {
  const base = address(leak) - address(offset);
  if (base < 0n) throw new Error('泄露地址不能小于符号偏移。');
  const sys = base + address(system),
    bin = base + address(binsh);
  if (sys > 0xffffffffffffffffn || bin > 0xffffffffffffffffn)
    throw new Error('计算结果超出 64 位地址范围。');
  return { base, system: sys, binsh: bin, aligned: base % 4096n === 0n };
}
export function stackModel(buffer: number, input: number) {
  return {
    returnOffset: buffer + 8,
    overflow: Math.max(0, input - buffer),
    savedRbp: Math.min(8, Math.max(0, input - buffer)),
    returnBytes: Math.min(8, Math.max(0, input - buffer - 8)),
  };
}
export type Gadget = 'pop rdi' | 'pop rsi' | 'pop rdx' | 'ret' | 'system' | 'syscall';
export interface ChainItem {
  id: string;
  op: Gadget;
  value: string;
}
export const gadgetAddress: Record<Gadget, string> = {
  'pop rdi': '0x401203',
  'pop rsi': '0x401205',
  'pop rdx': '0x401207',
  ret: '0x40101a',
  system: '0x7ffff7a50d60',
  syscall: '0x401230',
};
export function ropState(chain: ChainItem[], count: number) {
  let rsp = 0x7fffffffe000n;
  const regs: Record<string, string> = { RDI: '0x0', RSI: '0x0', RDX: '0x0' };
  const logs: string[] = [];
  for (const item of chain.slice(0, count)) {
    rsp += 8n; // 每个 Gadget 地址由前一条 ret 从栈中取出。
    if (item.op.startsWith('pop ')) {
      const reg = item.op.slice(4).toUpperCase();
      regs[reg] = item.value;
      rsp += 8n;
      logs.push(`${item.op}: ${reg} ← ${item.value}，ret 交接给下一地址。`);
    } else if (item.op === 'system') logs.push(`模拟 system(RDI=${regs.RDI})；不执行真实函数。`);
    else if (item.op === 'syscall')
      logs.push(`模拟 syscall；RAX 需由调用者预先设置，此链未建模内核返回值。`);
    else logs.push('ret：从栈读取下一个地址。');
  }
  return { rsp, regs, logs };
}
