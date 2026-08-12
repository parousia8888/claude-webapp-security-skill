<h1 align="center">Web App Security Hardening</h1>
<h3 align="center">面向 AI coding agent 的证据优先安全审计、加固与复测</h3>

<p align="center">
  <a href="https://github.com/parousia8888/claude-webapp-security-skill/tags"><img src="https://img.shields.io/github/v/tag/parousia8888/claude-webapp-security-skill?sort=semver" alt="latest tag"></a>
  <a href="https://github.com/parousia8888/claude-webapp-security-skill/actions/workflows/ci.yml"><img src="https://github.com/parousia8888/claude-webapp-security-skill/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/parousia8888/claude-webapp-security-skill/actions/workflows/codeql.yml"><img src="https://github.com/parousia8888/claude-webapp-security-skill/actions/workflows/codeql.yml/badge.svg" alt="CodeQL"></a>
  <a href="https://github.com/parousia8888/claude-webapp-security-skill/stargazers"><img src="https://img.shields.io/github/stars/parousia8888/claude-webapp-security-skill?style=flat&logo=github" alt="stars"></a>
  <a href="https://github.com/parousia8888/claude-webapp-security-skill/network/members"><img src="https://img.shields.io/github/forks/parousia8888/claude-webapp-security-skill?style=flat&logo=github" alt="forks"></a>
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
  一套零运行时依赖的 agent skill 与 CLI，覆盖应用、API、LLM/OAuth、供应链、爬虫/WAF 与 AWS
  边界；未经复现的 scanner 命中不会被写成已确认漏洞。
</p>

## 一秒内看完完整闭环

命令会启动一个故意配置错误的本地 Web 应用，执行审计，切换到加固后的 fixture，再走同一条真实
CLI 路径复测。全程不访问外网。

```bash
git clone https://github.com/parousia8888/claude-webapp-security-skill.git
cd claude-webapp-security-skill
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
git clone --depth 1 https://github.com/parousia8888/claude-webapp-security-skill.git /tmp/webapp-security-hardening \
  && node /tmp/webapp-security-hardening/scripts/webapp-security.mjs install
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

可以让 Claude Code 或 Codex 调用 `webapp-security-hardening`，也可以直接运行相同的确定性工具：

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
  uses: parousia8888/claude-webapp-security-skill@42b2d27f5d589732c8eb987c5304b7e846bfdb84
  with:
    site: https://example.com
    acknowledge-authorization: true
    active-probe: false
    fail-on: high
```

上面的完整 SHA 是包含该 Action 的不可变 v0.3.0 checkpoint。计划中的稳定 API 是：

```yaml
uses: parousia8888/webapp-security-hardening@v1
```

截至 2026-08-13，这个短仓库尚不存在。需要新建/镜像仓库并维护移动的 `v1` tag；仅靠本仓库代码
无法让该引用生效。

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
gh attestation verify webapp-security-hardening-*.tar.gz \
  --repo parousia8888/claude-webapp-security-skill
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
