---
title: 'Syscall 基础：从寄存器到 Linux 内核接口'
description: '区分函数调用与系统调用，用 read、write、mmap 理解参数的含义。'
date: 2026-11-14
category: pwn
tags: [Linux, Syscall, ABI]
difficulty: 基础
prerequisites: [Linux 基础, x86-64 汇编]
knowledge: [syscall, assembly, linux]
example: true
---

> 示例内容。只讨论 Linux 原生 x86-64 ABI，不能直接推广到 x32、i386、ARM 或其他系统。

## 调用号与参数寄存器

RAX 放系统调用号，前六个参数依次使用 RDI、RSI、RDX、R10、R8、R9。`syscall` 指令会改写 RCX、R11，原始返回值通常放回 RAX。普通函数调用第四个参数使用 RCX，这是两个 ABI 的重要区别。

| 调用     | RAX | 参数含义                              |
| -------- | --- | ------------------------------------- |
| read     | 0   | fd, buf, count                        |
| write    | 1   | fd, buf, count                        |
| mmap     | 9   | addr, length, prot, flags, fd, offset |
| mprotect | 10  | addr, length, prot                    |
| execve   | 59  | filename, argv, envp                  |

## write 的教学过程

```asm
mov rax, 1        ; write
mov rdi, 1        ; stdout
mov rsi, 0x404000 ; 模拟缓冲区指针
mov rdx, 13       ; 字节数量
; 不在本网站执行 syscall
```

指针数值并不等于指向的内容。内核需要检查地址范围、访问权限和描述符状态，不能因为寄存器“看起来正确”就断言调用成功。

## mmap 与 mprotect

`mmap` 创建映射，`mprotect` 改变现有映射的权限。后者的起始地址需要页对齐，长度会涉及页面粒度。标志值和失败条件应对照目标系统手册，不要把教学示例当作可移植配方。

## 返回值与错误

Linux 原始系统调用通常用负错误码表示失败，而 C 库包装函数通常返回 -1 并设置 errno。两者之间存在包装层。`execve` 成功时替换进程映像，不像普通函数那样返回原调用点。

## 在实验室练习

选择调用预设，逐项修改寄存器。实验会展示调用名和参数表达式，模拟返回只用于解释执行阶段，不读取主机内存、不创建映射，也不执行程序。

参考：[syscall(2)](https://man7.org/linux/man-pages/man2/syscall.2.html)、[write(2)](https://man7.org/linux/man-pages/man2/write.2.html)、[execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html)。
