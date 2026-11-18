---
title: 'CTF 环境下 SQL 注入原理：守住数据与指令的边界'
description: '从一个离线 SQLite 示例理解字符串拼接的风险，以及参数化查询的边界。'
date: 2026-11-13
category: web
tags: [SQL, Injection, SQLite, Defense]
difficulty: 入门
prerequisites: [HTTP 基础, SQL 查询基础]
knowledge: [sqli, http, xss, ssrf]
example: true
codeIndex: true
---

> 示例教程，仅使用内存数据库，不涉及线上站点或真实用户数据。

## 何时输入变成了语法

当程序使用字符串拼接把用户数据嵌入 SQL 源码时，数据库无法知道哪些字符只是用户提供的文本。问题在于边界丢失，而不是某个特殊关键字本身“危险”。

## 离线演示与安全写法

```python
import sqlite3

db = sqlite3.connect(':memory:')
db.execute('CREATE TABLE notes (title TEXT, body TEXT)')
db.execute('INSERT INTO notes VALUES (?, ?)', ('hello', 'example'))

user_title = "hello"
# 使用值参数绑定，数据库按数据解释 user_title
rows = db.execute('SELECT body FROM notes WHERE title = ?', (user_title,)).fetchall()
print(rows)
```

SQLite 的 `?` 是该驱动的参数风格，其他驱动可能使用 `%s` 或命名占位符。不要把 Python 字符串格式化与数据库参数绑定混为一谈。

## 参数绑定不适用于所有结构

表名、列名和排序关键字通常不能使用值占位符替代。动态排序应使用固定映射：把界面上的少量选项映射到程序内可信的列名，再拼接可信片段，绝不能直接拼接原始输入。

## 防御不是隐藏报错

参数化查询是基础；数据库最小权限、合理错误处理与审计进一步限制影响。隐藏错误信息不会修复注入，过滤少数字符也不足以覆盖不同语法与编码。

## 与其他 Web 风险建立联系

SQL 注入关注数据库解释器，XSS 关注浏览器执行上下文，SSRF 关注服务端网络请求权限。共同点是输入跨越信任边界；修复方式必须匹配目标上下文，而不能套用同一套转义规则。

## 自测与复盘

尝试解释：为什么绑定参数不能直接控制 ORDER BY 的列名？为什么最小权限能降低影响却不能消除漏洞？在 Learning 中完成 SQL 相关问题后，将自己的解释写入知识点笔记。

参考：[Python sqlite3 参数绑定](https://docs.python.org/3/library/sqlite3.html#how-to-use-placeholders-to-bind-values-in-sql-queries)、[OWASP SQL 注入防御](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)。
