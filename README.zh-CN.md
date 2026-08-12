# Web 应用安全与加固 —— 一个 Claude Code skill

[English](README.md) · **中文**

把一个 Web 应用从「从没审计过」推到「已加固」，分九个阶段 —— 并且把爬取边界**定下来**，而不是靠猜。

让所有 AI 爬虫进来，把所有恶意扫描挡在外面。这两件事并不矛盾，这个 skill 讲清楚了具体怎么做。

[安装](#安装) · [何时加载](#agent-什么时候该加载这个-skill) · [核心思路](#值得抄走的那个思路) · [阶段总表](#阶段总表) · [脚本](#三个脚本) · [边界](#这个-skill-不会做的事) · [仓库结构](#仓库结构)

---

## 目录

- [这是什么](#这是什么)
- [安装](#安装)
- [agent 什么时候该加载这个 skill](#agent-什么时候该加载这个-skill)
- [值得抄走的那个思路](#值得抄走的那个思路)
- [阶段总表](#阶段总表)
  - [Phase 0–8](#阶段总表)
  - [横向专题](#横向专题可单独使用)
- [三个脚本](#三个脚本)
  - [crawl-surface-audit.mjs](#crawl-surface-auditmjs)
  - [verify-crawler-ip.mjs](#verify-crawler-ipmjs)
  - [aws-exposure-audit.sh](#aws-exposure-auditsh)
- [这个 skill 不会做的事](#这个-skill-不会做的事)
- [仓库结构](#仓库结构)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

---

## 这是什么

- **一套分阶段的审计流程** —— 授权门闩 → 前端 → API → LLM 与身份 → 代码 → 数据库 → 供应链 → 检测 → 复测。每个阶段一个参考文件，含具体检查项、测试手法和完成标准。
- **三个只读审计脚本** —— 爬取面审计（含爬虫 UA 矩阵）、爬虫身份验证（FCrDNS + 厂商 IP 段）、AWS 姿态清点。
- **爬取边界的决策模型** —— 哪些路径必须对 Googlebot、Bingbot、GPTBot、OAI-SearchBot、ClaudeBot、Claude-User、PerplexityBot 保持开放，哪些绝不能被爬，以及**到底哪一层在真正执行**。

写给 agent 执行，也写给人复核。除 Node 18+ 外无依赖，AWS CLI 可选。

[↑ 回到顶部](#web-应用安全与加固--一个-claude-code-skill)

---

## 安装

```bash
# Claude Code
git clone https://github.com/parousia8888/claude-webapp-security-skill \
  ~/.claude/skills/webapp-security-hardening

# Codex
git clone https://github.com/parousia8888/claude-webapp-security-skill \
  ~/.codex/skills/webapp-security-hardening
```

目录名必须是 `webapp-security-hardening` —— 要和 `SKILL.md` 里的 `name:` 字段一致。

装好后直接对 agent 说「审计一下我的站暴露了什么」或「帮我加固 AWS」，skill 会自动加载。

也可以不经 agent 直接跑脚本：

```bash
node ~/.claude/skills/webapp-security-hardening/scripts/crawl-surface-audit.mjs --site https://example.com --out ./reports
node ~/.claude/skills/webapp-security-hardening/scripts/verify-crawler-ip.mjs --ip 66.249.66.1 --ua Googlebot --ranges
bash  ~/.claude/skills/webapp-security-hardening/scripts/aws-exposure-audit.sh --profile default --region us-east-1
```

[↑ 回到顶部](#web-应用安全与加固--一个-claude-code-skill)

---

## agent 什么时候该加载这个 skill

```yaml
load_when:
  - 用户要求做安全审计、渗透测试计划，或 Web 应用的加固路线图
  - 用户问什么该被爬，或提到 robots.txt / llms.txt / sitemap / noindex
  - 用户想放行 AI 爬虫但拦住扫描器
  - 改了 WAF / CDN / 爬虫拦截设置后，搜索或 AI 引流量掉了
  - 用户问打到站上的爬虫是不是真的 Googlebot / GPTBot
  - 发现私有页面、后台、source map 或分享链接被索引或泄露
  - 用户问 IDOR、BOLA、爆破、限流、竞态条件或 SSRF
  - 用户问 prompt 注入、LLM 成本滥用，或 OAuth token 混淆
  - 用户要加固 AWS：安全组、IMDSv2、S3 公开访问、IAM、CloudTrail、预算告警
do_not_load_when:
  - 只是写业务功能，不涉及任何安全问题
  - 目标是用户并不控制的第三方资产
```

[↑ 回到顶部](#web-应用安全与加固--一个-claude-code-skill)

---

## 值得抄走的那个思路

「到底该对机器人开放什么」之所以让人头疼，是因为**把两个决策当成了一个**。

**先按路径分桶，再按爬虫分类。**

| 分桶 | 谁可以取 | 靠什么执行 |
|---|---|---|
| **PUBLIC** | 所有 IP，无需 cookie、无需 JS、无需挑战 | 什么都不拦 —— 这正是重点。在这里加限流就是在给自己安排一次 SEO 事故 |
| **PRIVATE** | 只有已认证且已授权的主体 | 服务端鉴权。**永远不是 robots.txt** |
| **UNLISTED** | 知道 URL 就能取，但绝不能被索引 | `X-Robots-Tag: noindex` + 高熵 token。**绝不能用 `Disallow`** |

由此推出的几条，能解掉大部分痛点：

- **`robots.txt` 不是访问控制。** 它是一份你亲手公开的「我觉得这些路径值得关注」清单。每一行都要当成交给攻击者的情报来对待。
- **同一路径上 `Disallow` + `noindex` 是死锁。** 遵守 `Disallow` 的爬虫根本不会抓这个页面，也就永远读不到 `noindex`；只要有人链接过它，这个 URL 可能永久留在索引里、且没有摘要。**二选一。**
- **屏蔽训练爬虫不会降低搜索或 AI 引用的可见性。** `GPTBot` 是训练用的；`OAI-SearchBot` 才是搜索索引。`ClaudeBot` 是通用爬虫；`Claude-SearchBot` 和 `Claude-User` 分别是搜索和真人触发的抓取。这是两个独立决策，但常年被混为一谈。
- **绝不要屏蔽真人触发的抓取器**（`ChatGPT-User`、`Claude-User`、`Perplexity-User`）—— 另一端有个活人在等，屏蔽了他看到的就是「你的站坏了」。
- **`Google-Extended` 和 `Applebot-Extended` 是 robots.txt 的令牌，不是 UA。** 在 WAF 上拦它们毫无作用。

而让「开放」变安全的关键在这里：

> **爬虫和扫描器请求的东西根本不同。** 真爬虫几乎不 404 —— 它只抓你的 sitemap 和链接告诉它的东西；扫描器 60–100% 的请求都是 404。所以**单客户端 404 率**是可得的信噪比最高、误报最低的扫描器探测信号，而且对 SEO 零成本。

[↑ 回到顶部](#web-应用安全与加固--一个-claude-code-skill)

---

## 阶段总表

| 阶段 | 重点 | 主动测试 | 参考文件 |
|---|---|---|---|
| 0 | 范围与授权锚定 | 门闩 | [`phase-0-scope.md`](references/phase-0-scope.md) |
| 1 | 前端暴露面收敛 | 否 | [`phase-1-frontend.md`](references/phase-1-frontend.md) |
| 2 | API 安全，10 个阶段 | 是 | [`phase-2-api.md`](references/phase-2-api.md) |
| 3 | LLM 安全 + 联合身份 | 是 | [`phase-3-llm-identity.md`](references/phase-3-llm-identity.md) |
| 4 | 服务端代码审计 | 需源码 | [`phase-4-code-audit.md`](references/phase-4-code-audit.md) |
| 5 | 数据库与数据层 | 是 | [`phase-5-database.md`](references/phase-5-database.md) |
| 6 | 供应链 | 部分 | [`phase-6-supply-chain.md`](references/phase-6-supply-chain.md) |
| 7 | 蓝队：检测与监控 | 否 | [`phase-7-detection.md`](references/phase-7-detection.md) |
| 8 | 报告与复测 | 否 | [`phase-8-report.md`](references/phase-8-report.md) |

### 横向专题（可单独使用）

| 主题 | 参考文件 |
|---|---|
| 该开放什么、该关什么；robots.txt、llms.txt、sitemap、noindex | [`crawl-boundary.md`](references/crawl-boundary.md) |
| 证明爬虫不是伪造的 UA | [`bot-verification.md`](references/bot-verification.md) |
| 每条规则该放在哪一层：CDN、WAF、nginx、应用 | [`enforcement-layers.md`](references/enforcement-layers.md) |
| source map、点文件、后台、分享链接 | [`exposure-checks.md`](references/exposure-checks.md) |
| AWS：安全组、IMDSv2、S3、IAM、CloudTrail、预算 | [`aws-hardening.md`](references/aws-hardening.md) |
| 检查清单通常漏掉的攻击面 | [`overlooked-surface.md`](references/overlooked-surface.md) |
| Phase 0 的授权锚定模板，直接拷走用 | [`assets/scope-template.md`](assets/scope-template.md) |

单看 Phase 2 覆盖了什么，就能看出深度：从源码而非文档提取路由清单、JWT 的 `aud`/`iss`/算法校验、跨账号 BOLA（`GET`/`PATCH`/`DELETE` 都测）、把鉴权中间件覆盖率做成自动化测试、六类不止按 IP 计的限流、竞态条件与由数据库唯一约束兜底的幂等键、带解析后 IP 校验的 SSRF 白名单，以及响应数据最小化。

[↑ 回到顶部](#web-应用安全与加固--一个-claude-code-skill)

---

## 三个脚本

### `crawl-surface-audit.mjs`

解析 `robots.txt`、`llms.txt` 和所有声明的 sitemap，与线上真实响应交叉核对，再用 11 个爬虫 UA 重放关键 URL，抓出 WAF 误拦和 cloaking。

```
# Crawl surface audit — https://example.com

**Findings:** 1 high · 1 medium · 0 low · 3 info

- **[high] source-map-exposed** — A production source map is publicly served;
  it reconstructs original sources and comments.
- **[medium] soft-404-catchall** — A non-existent path returns 200 with the app
  shell instead of 404. Crawlers index and re-crawl garbage URLs, real 404s become
  invisible, and the highest-signal scanner-detection rule (404 ratio per client)
  stops working.

## UA matrix — https://example.com/

| Agent | Status | Bytes | X-Robots-Tag |
|---|---|---|---|
| browser | 200 | 47768 | — |
| Googlebot | 200 | 47768 | — |
| OAI-SearchBot | 200 | 47768 | — |
| GPTBot | 200 | 47768 | — |
| Claude-User | 200 | 47768 | — |
| PerplexityBot | 200 | 47768 | — |
```

按 UA 出现的状态码或体积差异**本身就是发现**：`403` 说明你的边缘在拦爬虫，体积差说明你在 cloaking。

### `verify-crawler-ip.mjs`

UA 字符串是一个声称，不是身份。这个脚本对 Google、Bing、Apple、Yandex、Baidu 做正反向确认的反查（FCrDNS），对 AI 爬虫用厂商公布的前缀列表做 CIDR 匹配。IPv4 / IPv6 都支持。

```
| IP              | Claimed UA   | Verdict     | Vendor  | Method          |
|-----------------|--------------|-------------|---------|-----------------|
| 66.249.66.1     | Googlebot    | verified    | google  | fcrdns          |
| 203.0.113.9     | Googlebot    | **spoofed** | google  | fcrdns          |
| 20.171.207.1    | GPTBot/1.1   | verified    | gptbot  | published-range |
```

全程贯彻一条规则：UA 可以用来**拒绝**，永远不能用来**放行**。白名单只认已验证身份 —— 而且 `verified` 换来的只是限流豁免，绝不是访问私有路径的权限。

### `aws-exposure-audit.sh`

只读的 `describe`/`list`/`get` 调用，覆盖身份、网络、计算、存储、数据库、边缘和日志。因权限不足而失败的检查一律标为 `UNCHECKED`，绝不算作通过 —— 一份会悄悄跳过检查的审计，比没有审计更糟。

```
- **[HIGH]** no account-level S3 Block Public Access configuration exists
- **[HIGH]** instance `i-0abc…` allows IMDSv1 — any SSRF can steal its role credentials
- **[MED]**  no AWS Budgets configured — for an AI product, spend is the earliest abuse alarm
- [ok] CloudTrail `mgmt-trail` is logging

- HIGH: 1 · MEDIUM: 3 · LOW: 3 · UNCHECKED: 0
```

[↑ 回到顶部](#web-应用安全与加固--一个-claude-code-skill)

---

## 这个 skill 不会做的事

写在前面，因为一个「你让干啥就干啥」的安全工具本身就是风险。

- **没有授权锚定就不做主动测试。** Phase 0 要求先有 `scope.md` 和归属证明 —— `.well-known` 令牌、DNS TXT 记录，或可演示的控制台访问权 —— 才发出第一个主动请求。对用户并不控制的主机做测试会被拒绝。
- **不做破坏性验证。** 每个发现都用「足够弱但足够说明问题」的证据：一条你自己的记录、一个返回的标记串、一个状态码。绝不批量导出，绝不碰别人的数据，绝不用打瘫服务来证明缺少限流。
- **输出里不含秘密。** 报告只写存在性、状态码、计数和脱敏后的路径 —— 绝不写 token、cookie、鉴权头、完整分享 URL、用户邮箱或真实客户端 IP。
- **没复现就不算确认。** 扫描器命中和 grep 匹配只是线索，报告里会如实标注。

每份审计交付物末尾都有明确的**「这份结果不能证明什么」**一节：没覆盖到的面、HTTP-only 审计从未评估的 JS 渲染内容，以及凭证权限不足而没能执行的检查。

[↑ 回到顶部](#web-应用安全与加固--一个-claude-code-skill)

---

## 仓库结构

```
SKILL.md                  入口；阶段总表与硬性规则
references/               9 个阶段指南 + 6 个横向专题
scripts/
  crawl-surface-audit.mjs robots/llms/sitemap 审计 + 爬虫 UA 矩阵 + 暴露面探测
  verify-crawler-ip.mjs   FCrDNS 与厂商 IP 段的爬虫身份验证
  aws-exposure-audit.sh   只读 AWS 姿态清点
assets/scope-template.md  Phase 0 的授权锚定模板，拷进你的仓库即可
llms.txt                  本仓库的机器可读摘要
```

[↑ 回到顶部](#web-应用安全与加固--一个-claude-code-skill)

---

## 参与贡献

最欢迎针对三类最容易过期的内容做勘误：厂商爬虫 UA、厂商公布的 IP 段地址、AWS 服务默认值。`verify-crawler-ip.mjs` 支持 `--source name=url`，新厂商列表不用等发版就能直接用上。

## 许可证

MIT.
