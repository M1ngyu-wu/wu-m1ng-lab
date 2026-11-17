---
title: 'ROP Chain 构造基础：让栈上的数据成为执行顺序'
description: '逐个追踪 pop、ret 与 RSP，理解 Gadget 的输入、输出和副作用。'
date: 2026-11-15
category: pwn
tags: [ROP, Gadget, Registers]
difficulty: 基础
prerequisites: [栈帧, x86-64 汇编]
knowledge: [rop, gadget, pwntools, assembly]
example: true
---

> 示例教学。本文与实验均使用模拟地址，不连接攻击目标。

## 为什么从 ret 开始

在 x86-64 的简化模型中，`ret` 从 `[RSP]` 取出 8 字节地址作为新的 RIP，并将 RSP 加 8。ROP 让这串地址指向程序或库中已经存在的短指令序列。NX 限制数据页执行，因此复用现有可执行代码的思想与直接在栈上执行字节不同。

## Gadget 同时消费地址与数据

```asm
pop rdi
ret
```

进入该 Gadget 时，RSP 指向下一个数据槽。`pop rdi` 把该槽写进 RDI 并前进 8 字节，`ret` 再消费下一个地址。忽略任何一次消费都会使后续链错位。

```text
0x...e000  pop rdi; ret 的地址
0x...e008  0x7ffff7bd8698（参数数据）
0x...e010  system 的地址
```

## 不只检查名称

真实 Gadget 可能包含额外的 `pop`、内存写入或算术指令。需要核对全部指令、副作用和需要填入的占位数据。PIE 程序中的静态偏移必须加加载基址，不能直接当作运行时地址。

## 对齐与调用约定

SysV AMD64 普通函数参数通常依次放入 RDI、RSI、RDX、RCX、R8、R9。函数入口的栈对齐也有约束；额外的 `ret` 常用于调整 8 字节，但应按完整链计算，而非盲目添加。

$$\text{slot address}(i)=\text{stack base}+8i$$

## 用实验验证

在 ROP Lab 添加一个 `pop rdi`、一个 `ret` 和一个 `system`。先预测 RSP，再单步观察。重新排序后，实验会重置执行状态，避免展示与新链不一致的旧寄存器值。

实验将每个 Gadget 当作一个教学步骤；`system`、`syscall` 是停止于边界的模拟调用，没有建模完整函数内部行为或内核。示例链不会实际生成 Shell。

## 常见错误

- 将数据值当作 Gadget 地址，或反过来。
- 忽略小端序与指针宽度。
- 未检查额外 pop 和寄存器破坏。
- 把普通函数参数约定照搬到 syscall。

参考：[ROPGadget](https://github.com/JonathanSalwan/ROPgadget)、[Pwntools packing](https://docs.pwntools.com/en/stable/util/packing.html)。
