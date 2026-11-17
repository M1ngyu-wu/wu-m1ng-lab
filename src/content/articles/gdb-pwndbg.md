---
title: 'GDB 与 pwndbg：把调试变成可验证的推理'
description: '断点、寄存器、栈内存与反汇编，建立一套可以重复的观察方法。'
date: 2026-11-16
category: linux
tags: [GDB, pwndbg, Debugging]
difficulty: 入门
prerequisites: [Linux 命令行]
knowledge: [gdb, stack-frame, assembly]
example: true
---

> 示例教程。仅对可信的本地教学程序操作，不代表个人研究成果。

## 先提出可以验证的问题

调试的目的不是不断运行命令，而是回答一个明确问题。例如：“这次函数返回前，栈上保存的地址是否改变？”先记录编译参数、架构、工具版本和输入，再比较执行前后的证据。

## 从暂停开始

```text
gdb -q ./sample
break main
run
info registers rsp rbp rip
```

`break main` 需要符号信息。没有符号时，可以用 `starti` 在首条指令暂停，再结合映射和反汇编定位。启动程序会执行其代码，只使用你理解且可信的本地样本。

## 用正确单位查看内存

```text
x/16bx $rsp
x/8gx $rsp
x/6i $rip
```

第一条显示 16 个单字节，第二条显示 8 个 8 字节值，第三条显示 6 条指令。`x/nfu addr` 中 n 是数量，f 是格式，u 是单位。不要把十六进制数字的显示顺序误认为内存地址的增长方向。

## 单步与控制流

`si` 执行一条机器指令，并进入调用；`ni` 也按指令步进，但通常跳过调用内部。`continue` 运行至下一断点或异常。多线程、信号与反调试行为会改变观察上下文，因此每次都要确认当前线程与程序计数器。

```text
disassemble /r main
si
ni
bt
```

## pwndbg 的辅助视图

```text
context
telescope $rsp 16
vmmap
```

这些命令需要先正确安装并加载 pwndbg。`context` 汇总当前状态，`telescope` 递归展示指针，`vmmap` 帮助区分栈、代码和库映射。可视化输出是辅助，仍应对照原始字节验证。

## 常见误区与复盘

如果地址每次变化，先检查 PIE/ASLR 和运行方式，不要直接认定计算错误。若命令提示寄存器不可用，确认程序是否已启动且暂停。复盘笔记应包含：问题、输入、暂停位置、证据、结论和仍未排除的替代解释。

参考：[GDB 官方手册](https://sourceware.org/gdb/current/onlinedocs/gdb.html/)、[pwndbg 文档](https://pwndbg.re/pwndbg/latest/)。
