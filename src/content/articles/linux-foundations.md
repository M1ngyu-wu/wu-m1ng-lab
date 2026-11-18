---
title: 'Linux 基础：文件、权限与进程的第一张地图'
description: '理解描述符、权限位和虚拟地址空间，为二进制分析建立系统基础。'
date: 2026-11-12
category: linux
tags: [Linux, Permissions, Process]
difficulty: 入门
prerequisites: []
knowledge: [linux, forensics, http]
example: true
codeIndex: true
---

> 示例学习笔记，不包含真实学习经历。

## 文件与目录权限

普通文件的 r、w、x 分别表示读取、修改与执行。目录上的 x 表示遍历路径，含义不能照搬普通文件。八进制权限以读取 4、写入 2、执行 1 组合：`640` 表示所有者读写、组只读、其他用户无权限。

```bash
ls -lah
file ./sample
readelf -h ./sample
```

先识别文件，再选择工具。不要根据扩展名判断可执行格式，也不要为了查看类型直接运行未知文件。

## 标准流与描述符

进程通常以 0、1、2 分别表示标准输入、标准输出与标准错误。描述符是进程的文件表索引，不是内存地址。`write(1, buf, count)` 中第一个参数是描述符，第二个参数才是缓冲区指针。

## 虚拟地址空间

进程看到的是虚拟地址。代码、堆、共享库、栈属于不同映射，地址受加载器、ASLR 与系统配置影响。两次运行看到不同地址并不意味着程序数据结构发生了改变。

## 建立可复现的环境笔记

记录系统版本、架构、编译器参数、库版本、工具版本和样本哈希。将原始证据与推断分开保存。长时间学习后，能重新得到同一个结论，比只记住某个命令更有价值。

参考：[GNU coreutils](https://www.gnu.org/software/coreutils/manual/coreutils.html)、[Linux intro(2)](https://man7.org/linux/man-pages/man2/intro.2.html)。
