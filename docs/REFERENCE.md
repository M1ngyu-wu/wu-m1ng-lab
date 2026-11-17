# 参考站研究与实现依据

2026-11-17 实际读取 [whymm.com.cn](https://whymm.com.cn/) 首页、公开文章与 main.css。网页工具初次不可达，随后通过本机 HTTP 请求成功读取。没有复制对方正文或直接复用其源代码。

观察：参考站采用 Hexo 静态内容结构，深蓝黑背景、低对比网格、青绿强调，首页主视觉后接统计与分类入口。导航围绕首页、归档、分类、标签和关于，搜索包含标题、分类、标签和正文。文章页包含面包屑、日期、字数、代码高亮、桌面目录与移动目录。文章以原理到题目复盘组织，强调可复现。

本项目沿用清晰的内容层级与阅读线索，重新设计 wu_m1ng 品牌。首页增加可交互的白名单终端，导航覆盖已批准的五项学习能力。文章元数据关联统一知识点，使图谱、实验、工具、自测和个人记录能够互相跳转。没有引入参考站的第三方访问统计，也没有把它的文章当成本站初始内容。

技术核对来源：

- [Astro 内容集合](https://docs.astro.build/en/guides/content-collections/)，并结合实际安装版本的类型声明调整新版 Markdown processor。
- [Cytoscape.js](https://js.cytoscape.org/)，用于节点样式、事件、布局和高亮。
- [GDB 内存命令](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Memory.html)，核对 x/nfu 的数量、单位和格式。
- [Linux syscall ABI](https://man7.org/linux/man-pages/man2/syscall.2.html)，核对 x86-64 参数寄存器。
- [Pwntools CLI](https://docs.pwntools.com/en/stable/commandline.html) 与 [ROPGadget](https://github.com/JonathanSalwan/ROPgadget)，核对 checksec、cyclic 和命令筛选语法。
- [Pagefind filters](https://pagefind.app/docs/filtering/)，使用属性捕获实现多个筛选维度。

工具数据的 source 字段保存逐条官方文档入口，便于后续版本变化时再次检查。
