# wu_m1ng — Cyber Security Lab

个人网络安全知识库与交互式学习平台。Astro 静态页面负责内容，React 仅承载实验、图谱和学习交互，不需要数据库、账号或付费 API。

网站地址：[https://m1ngyu-wu.github.io/wu-m1ng-lab/](https://m1ngyu-wu.github.io/wu-m1ng-lab/)。源码仓库：[M1ngyu-wu/wu-m1ng-lab](https://github.com/M1ngyu-wu/wu-m1ng-lab)。向 main 分支推送更新后，GitHub Actions 会自动检查、构建并重新发布网站；构建进度可在仓库 Actions 中查看。

## 安装与 Windows PowerShell 启动

使用 Node.js 24.13+（推荐 24 LTS）和 npm。项目锁定依赖版本于 package-lock.json。

```powershell
git clone https://github.com/M1ngyu-wu/wu-m1ng-lab.git
Set-Location wu-m1ng-lab
npm ci
npm run dev
```

打开终端打印的地址，默认 http://127.0.0.1:4321/。dev 会先生成一次文章与搜索索引，再启动带热更新的 Astro。文章修改能热更新；**搜索索引更新需重启 dev 或重新构建**。搜索不会调用外部服务。

```powershell
npm run check      # TypeScript / Astro 检查
npm run build      # Astro 生产构建 + Pagefind 中文全文索引
npm test           # 内存边界、地址精度、关联数据、备份校验、答题和站内链接检查
npm run preview    # 预览 dist 生产产物
npm run test:e2e   # Edge 浏览器交互与移动布局测试，自动启动 preview
```

浏览器测试默认使用本机 Microsoft Edge（channel: msedge）。其他系统可安装 Edge，或将 playwright.config.ts 的 channel 去掉并运行 `npx playwright install chromium`。Node 包和浏览器均只用于开发测试，不会随静态网站运行。

Astro 命令通过 scripts/astro.mjs 启动，显式关闭框架遥测。没有接入第三方访问追踪。Windows 环境若执行策略阻止 npm.ps1，可将命令中的 `npm` 换成 `npm.cmd`，无需更改系统执行策略。

## 目录

```text
src/
  assets/                   # 文章图片，Astro 处理资源路径
  content/articles/         # Markdown / MDX 文章，一文件一文章
  content.config.ts         # 文章元数据类型与关联 ID 校验
  data/
    profile.ts              # 品牌、个人资料、联系方式、真实项目
    knowledge.ts            # 分类、知识点、前置依赖、实验关联
    tools.ts                # 命令、解释、示例、注意事项和官方来源
    questions.ts            # 题型、答案、解析、知识点与文章关联
  components/
    PwnLab.tsx              # Stack / ROP / ret2libc / Syscall
    KnowledgeGraph.tsx      # Cytoscape 图谱与可键盘访问的选择器
    Toolbox.tsx             # 筛选、复制、收藏
    Learning.tsx            # 学习记录与备份恢复
    Quiz.tsx                # 题解自测、错题、复习计划
  lib/
    simulation.ts           # 可单独验证的模拟与地址运算
    storage.ts              # 本地记录、完整格式校验与复习调度
    articles.ts             # 文章排序、日期、阅读时间
    url.ts                  # 统一 base path，兼容 Pages 子路径
  layouts/Layout.astro      # 品牌、导航、搜索、主题与页脚
  pages/                    # 首页、文章、归档、分类、知识点、工具等
  styles/global.css         # 深浅主题、响应式与阅读规范
public/favicon.svg
templates/writeup.md        # 九节 CTF 复盘模板
tests/                      # 核心测试和浏览器测试
docs/                       # 设计依据、验证结果、维护说明
.github/workflows/pages.yml # GitHub Pages 部署
.openai/hosting.json         # Sites 项目标识与静态部署目录
```

## 已提供的内容与功能

- 首页终端支持白名单教学命令，所有统计来自真实内容集合和项目配置。
- 6 篇示例文章、7 个分类、22 个知识点、24 条工具用法和 18 道自测题。初始学习记录为空。
- Markdown / MDX、Shiki、KaTeX、Mermaid、代码复制、阅读进度、章节高亮、目录、相关文章与前后篇。
- 4 种 Pwn 模拟：逐字节栈覆盖、可排序的 ROP 链、64 位 ret2libc 运算、可编辑的 syscall 寄存器。
- 图谱由知识点依赖、文章元数据和工具关联生成。可拖动缩放、搜索筛选、显示资源节点和高亮依赖路径。学习状态同步至节点颜色。
- 工具关键词 / 类别 / 标签筛选，复制、收藏、详情和官方文档。
- 知识点状态、分钟数、自评、笔记自动保存；方向进度、依赖排序和最近学习记录。
- 单选、多选、判断、简答、闪卡；答题解析、历史错题、掌握标记、知识点筛选与可调整的间隔复习。
- Pagefind 中文全文搜索、Ctrl/Cmd+K、Esc、分类和内容类型筛选；RSS、sitemap、robots、404。

这些内容都是教学示例，**不代表个人竞赛成绩、真实题目利用结果或学习成果**。个人项目数默认 0；About 的经历与联系方式预留填写。

## 添加文章

复制 templates/writeup.md 到 src/content/articles/my-first-writeup.md，文件名成为路由 `/articles/my-first-writeup/`。普通笔记也可使用相同字段，kind 设置为 Note。支持 .mdx 扩展名。

```yaml
---
title: '我的第一篇复盘'
description: '一句话说明问题与结论'
date: 2026-11-17
category: pwn
tags: [Stack, CTF]
difficulty: 基础
prerequisites: [Linux 基础, 汇编]
knowledge: [stack-frame, overflow]
kind: Writeup
example: true
---
```

category 为 pwn / web / crypto / reverse / misc / blockchain / linux。difficulty 为 入门 / 基础 / 进阶。knowledge 必须引用已有 ID；错误的引用会使构建失败。前置知识是展示用名称，知识点之间的正式依赖在 knowledge.ts 维护。

真实文章确认信息与证据后再将 example 改为 false。无需修改首页、归档或图谱，它们会重新统计并关联。添加图片推荐放在 src/assets，Markdown 使用相对文件路径。代码块写语言名；公式用 `$...$` 或 `$$...$$`；流程图使用 mermaid 代码块。

## 添加知识点与关联

在 src/data/knowledge.ts 的 knowledge 数组添加：

```ts
{ id:'new-topic', name:'新知识点', category:'pwn',
  description:'说明范围与前提', prerequisites:['stack-frame'], lab:'stack' }
```

ID 保持稳定，不要使用 **proto** 等特殊键。prerequisites 为已有知识点 ID，不允许循环；lab 可省略或为 stack / rop / ret2libc / syscall。文章、工具与题库引用同一 ID，即可出现在知识详情与图谱中。`npm test` 会核对前置依赖、唯一性和引用。

图谱节点类型支持方向、知识点、文章、工具、教学 CTF 题与项目。项目由 profile.projects 的实际数据生成，初始为空。点击文章节点显示入口，再进入文章。无需维护另一份手写图谱。

## 添加工具命令

编辑 src/data/tools.ts，填写唯一 id、name、command、category、tags、explanation、example、caution、knowledge 和 source。source 应指向能核对参数的官方文档。会运行程序或有潜在影响的命令设置 dangerous:true；界面将突出提示。IDA/Ghidra 的界面操作应明确标为快捷键或菜单，避免误认为 Shell 命令。

工具列表和独立详情页会自动生成，详情页进入全文索引。页面只允许展示和复制，不执行命令。

## 添加自测题

编辑 src/data/questions.ts：

```ts
{ id:'q19', type:'single', knowledge:'stack-frame',
  prompt:'题干', options:['选项 A','选项 B'], answers:['选项 A'],
  explanation:'解释为什么正确', pitfall:'常见误解', article:'stack-ret2libc' }
```

type 支持 single / multiple / boolean / short / flashcard。多选答案必须与 options 完全一致；简答 answers 可列出多个认可写法，匹配会忽略空白和部分结尾标点，不会调用 AI 评分。闪卡需要先主动回忆，再查看答案并自评；统计会标明含自评。

article 是不带扩展名的文章 ID。题目会自动出现在关联文章、知识详情和 Learning 中。

## 学习记录备份与恢复

记录保存在当前来源域名的 localStorage，主键为 `wu_m1ng.lab.v1`。主题偏好独立存储。不同浏览器、不同端口和不同域名不共享记录；本地预览切换到线上前，应先导出再在新地址导入。

Learning → 备份与恢复 → 导出 JSON。文件包含 status、minutes、updated、rating、notes、favorites、attempts、reviews。恢复时选择文件，平台验证版本、知识点 / 题目 / 工具 ID、字段类型、日期和大小，先展示条目数量，再点击“确认替换并导入”。验证失败或取消不会覆盖原记录；写入失败会明确提示。

导入是完整替换，不是合并。恢复前先导出当前备份。最大备份 10 MB、最多 10000 条答题记录；笔记每个知识点 20000 字符。存储异常时可“导出原始存储”，避免丢失无法解析的原文件。清除浏览器站点数据会清除记录，请定期备份。

复习按连续正确次数安排 1 / 3 / 7 / 14 / 30 天间隔，答错 10 分钟后可复盘，也可手动修改日期。错题保留历史，需主动标记掌握后才退出待复盘集合。掌握题目与掌握知识点是两种记录，不会以一次答题擅自改写个人知识状态。

## 修改个人资料、品牌和主题

src/data/profile.ts：bio、experience、github、email、projects。空联系方式不显示，不生成无效外链。添加项目时写真实名称、描述与 URL。

网站目前统一为 wu_m1ng。更名时修改 profile、Layout、RSS、package、favicon 和本文中对应名称，并全文检索旧名称检查 SEO。src/styles/global.css 中 :root 和 `[data-theme=light]` 定义两组设计变量，--bg / --surface / --text / --muted / --accent 控制主要视觉。

## 生产与部署

```powershell
npm run check
npm run build
npm test
npm run preview
```

产物位于 dist，包含静态 HTML、客户端 JS/CSS、Pagefind 索引、RSS 与 sitemap。无需 Node 后端。Mermaid 体积较大，因此文章仅在存在流程图时动态导入，构建可能给出该延迟加载分块的体积提示。

部署前设置真实来源与路径，影响 canonical、RSS、sitemap 和所有站内入口：

```powershell
$env:SITE_URL = 'https://你的域名'
$env:BASE_PATH = '/'
npm run build
```

### GitHub Pages

将源码推送到你的 GitHub 仓库，Settings → Pages → Source 选择 GitHub Actions，仓库包含的 .github/workflows/pages.yml 会安装、检查、构建、测试并部署 dist。Node 使用 24。

普通项目仓库部署默认 `https://用户名.github.io/仓库名/`，BASE_PATH 为 `/仓库名`；用户主页仓库或自定义域名在 Actions Variables 中设置 BASE_PATH 为 `/`，SITE_URL 设置为最终来源（不含项目路径）。仓库工作流不会更改已有域名或 DNS。

也可以手动构建：

```powershell
$env:SITE_URL = 'https://用户名.github.io'
$env:BASE_PATH = '/仓库名'
npm run build
```

### Vercel

导入源码仓库，Framework 选择 Astro 或 Other，Build Command 为 `npm run build`，Output Directory 为 `dist`，Node 24，环境变量 SITE_URL 为实际 Vercel / 自定义域名，BASE_PATH 为 `/`。不需要服务器适配器。仓库提供 vercel.json。

### Sites

.openai/hosting.json 记录本次创建的 Sites 项目标识，dist 是静态目录。必须保留 ID，后续更新沿用同一个站点。Sites 默认私有预览，需要站点所有者访问。域名 whymm.com.cn 仅作为设计参考；本项目没有更改该网站、其托管或 DNS。

## 模型边界与后续内容维护

栈实验为连续布局，未模拟 Canary、优化器、硬件异常；ROP 以 Gadget 为步骤，不建模完整 libc 与内核；ret2libc 假设同一构建的符号匹配；Syscall 只显示约定和语义，不声称真实执行成功。所有输入仅是浏览器数据。

没有账号、评论、社交、收费、AI、云同步或远程利用接口。浏览器本地记录和 JSON 备份就是第一版的完整持久化方式。演示文章、工具和自测是起点，后续应以自己的证据和复盘逐步替换、扩充。
