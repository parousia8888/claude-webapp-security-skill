<h1 align="center">Web App Security Skill</h1>
<h3 align="center">面向 AI coding agent 的证据优先安全审计、加固与复测</h3>

<p align="center">
  <a href="https://github.com/parousia8888/web-app-security-skill/tags"><img src="https://img.shields.io/github/v/tag/parousia8888/web-app-security-skill?sort=semver" alt="latest tag"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/actions/workflows/ci.yml"><img src="https://github.com/parousia8888/web-app-security-skill/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/actions/workflows/codeql.yml"><img src="https://github.com/parousia8888/web-app-security-skill/actions/workflows/codeql.yml/badge.svg" alt="CodeQL"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/stargazers"><img src="https://img.shields.io/github/stars/parousia8888/web-app-security-skill?style=flat&logo=github" alt="stars"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/network/members"><img src="https://img.shields.io/github/forks/parousia8888/web-app-security-skill?style=flat&logo=github" alt="forks"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
  <a href="#信任与-release-证据"><img src="https://img.shields.io/badge/SBOM-SPDX%202.3-5965d8" alt="SPDX 2.3 SBOM"></a>
</p>

<p align="center">
  <a href="#一秒内看完完整闭环">Demo</a> ·
  <a href="#一条命令安装">安装</a> ·
  <a href="#使用">CLI</a> ·
  <a href="#github-action">GitHub Action</a> ·
  <a href="#五个源码案例">案例</a> ·
  <a href="README.md">English</a>
</p>

<p align="center">
  把 Web 项目交给 AI coding agent，完成范围确认、风险检查、最小加固、复测和证据交付。
</p>

## 能力边界

项目公开能力严格分成三层：

- **已自动化并有回归测试：** 本地 demo、crawl boundary、crawler 身份、edge 复测、安装器和
  GitHub Action 通过确定性产品路径运行。
- **Agent 按方法论执行：** 前端、API、LLM/OAuth、服务端、数据库、供应链、检测和 AWS 审查
  依赖项目上下文与 Agent 判断，不是一条自动扫描命令。
- **计划中：** 自动项目识别、稳定的多格式 finding、通用补丁/基线复测闭环尚未交付。

[生成的能力矩阵](docs/capabilities.md)为每项声明链接证据。结果只使用 `confirmed`、
`suspected`、`unknown`、`not_applicable`；无法执行的检查不是通过。安装 Skill 不代表项目已经安全。

## 一秒内看完完整闭环

命令会启动一个故意配置错误的本地 Web 应用，执行审计，切换到加固后的 fixture，再走同一条真实
CLI 路径复测。全程不访问外网。

```bash
git clone https://github.com/parousia8888/web-app-security-skill.git
cd web-app-security-skill
npm run demo -- --out ./demo-output
```

```text
before: 13 high, 6 medium
after:   0 high, 0 medium
```

| 输入 | 加固前发现 | 补丁证据 | 复测 |
|---|---|---|---|
| 本地故意脆弱 fixture | robots 阻断搜索/AI，sitemap 被禁爬，`/.env` 与 source map 返回 200，未知路径 soft-404 | 恢复公开爬取策略；敏感产物和未知路径改为 404 | 同一 CLI 路径，`13H / 6M -> 0H / 0M` |

查看 [`before.md` 预期发现](examples/insecure-demo/README.md)、生成的
`demo-output/hardening.patch` 与 `demo-output/after.md`。计数由回归测试固定，不是手写展示图。

## 一条命令安装

这条命令同时安装 Claude Code skill、Codex skill 和 `~/.local/bin/webapp-security` 普通 CLI。
若已有安装会直接拒绝；只有显式加入 `--force` 才会先生成带时间戳的备份再替换。

```bash
git clone --depth 1 https://github.com/parousia8888/web-app-security-skill.git /tmp/web-app-security-skill \
  && node /tmp/web-app-security-skill/scripts/webapp-security.mjs install
```

也可以只装单一入口：

```bash
node scripts/webapp-security.mjs install --target claude
node scripts/webapp-security.mjs install --target codex
node scripts/webapp-security.mjs install --target cli
node scripts/webapp-security.mjs install --target both   # Claude Code + Codex
```

系统支持范围与当前限制见[兼容矩阵](docs/compatibility.md)。

## 使用

可以让 Claude Code 或 Codex 调用 `web-app-security`，也可以直接运行相同的确定性工具：

```bash
# 默认被动：爬取边界与 crawler 可达性
webapp-security crawl --site https://example.com --out ./security-report

# 敏感路径主动探测：必须同时具备所有权/书面授权并显式确认
webapp-security crawl --site https://example.com --out ./security-report \
  --active-probe --acknowledge-authorization

# crawler 身份：精确产品 IP 段或 FCrDNS，不能只信 UA 字符串
webapp-security verify-crawler --ip 66.249.66.1 --ua Googlebot --ranges

# 默认被动：header、跳转、证书和 TLS 策略
webapp-security verify-edge --site https://example.com

# 只读 AWS 姿态清点
webapp-security aws --profile default --region us-east-1 --out ./security-report
```

主动限流复测同样要求 `--acknowledge-authorization`。网络或证据源失败会得到 `unknown` 和非零退出，
不会被描述成安全。

## GitHub Action

Composite Action 默认被动，且没有授权确认时不会执行：

```yaml
- name: Audit public crawl boundary
  uses: parousia8888/web-app-security-skill@c27a8ecae69271a5a2fdfb6acc314cb4ef3ea967
  with:
    site: https://example.com
    acknowledge-authorization: true
    active-probe: false
    fail-on: high
```

迁移提交落地后，把占位符替换为完整 commit SHA。计划中的稳定 API 是：

```yaml
uses: parousia8888/web-app-security-skill@v1
```

移动的 `v1` tag 只会在改名后的首个 release 通过 consumer test 后创建。

## 信任与 release 证据

- CI 覆盖 Ubuntu/macOS x Node 20/22、确定性 HTTP/HTTPS fixture 和 Bash 3.2 smoke test。
- release 与 CodeQL workflow 的第三方 Action 使用完整 commit SHA。
- tag 必须同时匹配 `VERSION`、changelog 和该版本的证据文件。
- release 产物包含可复现源码包、SPDX 2.3 SBOM、`SHA256SUMS` 与 GitHub build provenance attestation。
- [`SECURITY.md`](SECURITY.md)、[威胁模型](docs/threat-model.md)、
  [误报政策](docs/false-positive-policy.md)和[兼容矩阵](docs/compatibility.md)可供独立复核。

验证下载的 release 产物：

```bash
sha256sum -c SHA256SUMS
gh attestation verify web-app-security-skill-*.tar.gz \
  --repo parousia8888/web-app-security-skill
```

## 五个源码案例

案例集由三个故意脆弱基准和两个生产项目组成，全部固定到不可变 commit，只读源码，不探测线上实例。

| 项目 | 证据结果 |
|---|---|
| [OWASP Juice Shop](docs/case-studies/juice-shop.md) | 确认故意存在的 SQL 注入，并对应到上游 prepared statement 修复 |
| [OWASP NodeGoat](docs/case-studies/nodegoat.md) | 确认故意存在的服务端 `eval`、IDOR、开放跳转 |
| [DVWA](docs/case-studies/dvwa.md) | 确认 low/impossible 两档 SQLi、XSS、命令注入控制对照 |
| [Uptime Kuma](docs/case-studies/uptime-kuma.md) | SSRF 形态的出站 sink 被判为产品能力，不计漏洞 |
| [Mealie](docs/case-studies/mealie.md) | URL 抓取线索追踪到鉴权与私网 IP guard，不计漏洞 |

完整方法与限制见[案例总览](docs/case-studies/README.md)。这些案例验证方法论，不虚构一个尚非通用
SAST 引擎的 CLI 精度分数。

## 项目结构

阶段顺序是：Phase 0 授权范围 → 前端 → API → LLM/OAuth → 服务端源码 → 数据库隔离 → 供应链 →
蓝队检测 → 报告/补丁证据/复测。横向专题覆盖爬取边界、crawler 身份、source map/dotfile、
执行层、AWS、遗漏攻击面、回归门禁与安全部署。入口在 [`SKILL.md`](SKILL.md)。

公开 [roadmap](ROADMAP.md) 将正确性建设与传播建设分开。新贡献者可从
[Good First Issues](docs/GOOD_FIRST_ISSUES.md)、issue forms 和 [`CONTRIBUTING.md`](CONTRIBUTING.md)
开始。误报报告必须提供脱敏的最小 fixture 和期望分类；敏感信息走 private vulnerability reporting。

MIT License。
