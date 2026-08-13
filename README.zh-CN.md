<h1 align="center">Web App Security Skill</h1>
<h3 align="center">用 AI coding agent 和可复现证据完成 Web 项目范围确认、检查、加固与复测</h3>

<p align="center">
  <a href="https://github.com/parousia8888/web-app-security-skill/tags"><img src="https://img.shields.io/github/v/tag/parousia8888/web-app-security-skill?sort=semver" alt="latest tag"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/actions/workflows/ci.yml"><img src="https://github.com/parousia8888/web-app-security-skill/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/actions/workflows/codeql.yml"><img src="https://github.com/parousia8888/web-app-security-skill/actions/workflows/codeql.yml/badge.svg" alt="CodeQL"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
  <a href="#信任与-release-证据"><img src="https://img.shields.io/badge/SBOM-SPDX%202.3-5965d8" alt="SPDX 2.3 SBOM"></a>
</p>

<p align="center">
  <a href="#查看结果">Demo</a> ·
  <a href="#安装">安装</a> ·
  <a href="#执行第一个项目">首个项目</a> ·
  <a href="docs/tutorial.zh-CN.md">完整教程</a> ·
  <a href="#github-action">GitHub Action</a> ·
  <a href="#3-个普通项目旅程">项目旅程</a> ·
  <a href="README.md">English</a>
</p>

<p align="center">
  面向使用 AI coding agent 的 Web 产品作者与开发者，不要求具备攻防背景。先查看下方本地结果，
  然后安装并执行首个项目提示词。
</p>

> 把 Web 项目交给 AI coding agent，完成范围确认、风险检查、最小加固、复测和证据交付。

<p align="center">
  <a href="docs/demo-evidence.md"><img src="docs/assets/demo.gif" alt="自有本地 fixture：审计发现 2 个 security HIGH、11 个 discoverability HIGH 加 5 个 MEDIUM，以及 1 个 reliability MEDIUM；展示可审查补丁后，同一路径复测没有 active HIGH 或 MEDIUM finding"></a>
</p>

<p align="center"><a href="docs/demo-evidence.md">查看该演示对应的生成报告与补丁证据。</a></p>

## 查看结果

命令会启动一个故意配置错误的本地 Web 应用，执行审计，切换到加固后的 fixture，再走同一条真实
CLI 路径复测。全程不访问外网。

| 输入 | Security | Discoverability | Reliability | 可审查变更 | 复测 |
|---|---:|---:|---:|---|---|
| 自有本地 fixture | 2 HIGH | 11 HIGH + 5 MEDIUM | 1 MEDIUM | 爬取策略、暴露产物、未知路由状态 | 0 active HIGH / MEDIUM |

```bash
git clone https://github.com/parousia8888/web-app-security-skill.git
cd web-app-security-skill
npm run demo -- --out ./demo-output
```

阅读[生成的加固前 / 变更建议 / 复测证据](docs/demo-evidence.md)，再检查
`demo-output/summary.md`、`before.json`、`hardening.patch` 与 `after.json`。仓库门禁会重新生成证据，
结果变化但文档未更新时会失败。

完整的安装到卸载流程见经过测试的[第一个项目教程](docs/tutorial.zh-CN.md)。

## 安装

这条命令同时安装 Claude Code skill、Codex skill 和 `~/.local/bin/webapp-security` 普通 CLI。
若已有安装会直接拒绝；只有显式加入 `--force` 才会先生成带时间戳的备份再替换。该命令下载不可变
bootstrap 并在执行前验证 SHA-256，然后验证选定 release 的 manifest、checksums、SBOM、源码提交和
归档，再进入安装。

```bash
( set -eu; p="$(mktemp "${TMPDIR:-/tmp}/web-app-security-bootstrap.XXXXXX")"; trap 'rm -f "$p"' EXIT HUP INT TERM; curl --proto '=https' --proto-redir '=https' --tlsv1.2 --fail --silent --show-error --location --output "$p" 'https://raw.githubusercontent.com/parousia8888/web-app-security-skill/55c3de22cb373581b9723467c0d2663917c6df84/scripts/bootstrap-install.sh?immutable=55c3de2'; node -e 'const c=require("node:crypto"),f=require("node:fs"),p=process.argv[1],e=process.argv[2],a=c.createHash("sha256").update(f.readFileSync(p)).digest("hex");if(a!==e){console.error(`bootstrap SHA-256 mismatch: ${a}`);process.exit(1)}' "$p" 'bdb3951d6085d24c83b7590c0295702cdce8b6c15b0247747bf93b67649e78bd'; sh "$p" )
```

也可以只装单一入口：

```bash
sh bootstrap-install.sh --target claude
sh bootstrap-install.sh --target codex
sh bootstrap-install.sh --target cli
sh bootstrap-install.sh --target both   # Claude Code + Codex
```

简写示例以已经通过上方命令下载并验证 `bootstrap-install.sh` 为前提。显式版本、离线/人工验证、
attestation 及信任锚说明见[可信安装](docs/verified-installation.zh-CN.md)。系统支持范围与当前限制见
[兼容矩阵](docs/compatibility.md)。

查看版本、升级或卸载：

```bash
webapp-security version
# 对可识别的现有安装运行已验证 bootstrap，并选择 upgrade 模式。
sh bootstrap-install.sh --mode upgrade
webapp-security uninstall
```

`upgrade` 只替换带有 Web App Security Skill 可识别 marker（或已记录旧 Skill 身份）的安装，并保留
时间戳备份。`uninstall` 删除可识别的当前安装但保留这些备份。未知目录或 launcher 即使配合
`install --force` 也会被拒绝。

## 执行第一个项目

在 Claude Code 或 Codex 中打开目标仓库，然后发送：

```bash
webapp-security start .
```

命令会创建私有项目身份及 `.webapp-security/runs/<run-id>/security-scope.yml`，记录检测到的框架、
包管理器、lockfile 与部署/配置路径，全程不访问网络。检查 scope 后，再发送：

```text
在这个仓库使用 $web-app-security。先只执行源码与本地检查，记录范围和假设；把每项结果标为 confirmed、suspected、unknown 或 not_applicable；准备最小且可审查的加固补丁，未经批准不应用高风险或生产变更；复测每项已应用修复，最后列出已修复、仍存在和未覆盖的风险。
```

随后可运行确定性源码路径：

```bash
webapp-security audit .webapp-security/runs/<run-id> --fail-on high
webapp-security explain <finding-id> --report .webapp-security/runs/<run-id>/report.json
webapp-security start . --run-id <retest-run-id>
webapp-security retest .webapp-security/runs/<retest-run-id> \
  --baseline .webapp-security/runs/<run-id>/report.json
```

每次源码 audit 会写出 v2 JSON、Markdown、HTML、SARIF、JUnit、SHA-256 sidecar 和
`proposed.patch`。直接对项目执行的一次性 audit 使用 ephemeral identity，不能作为复测 baseline。
`fixed` 必须同时满足 persisted subject/scope 相同、rule 兼容、本次 coverage 已完成且条件明确不存在。
命令不会应用补丁，也不授予部署探测权限。

## 能力边界

能力使用两个互相独立的维度，避免把支撑工具计入漏洞检测覆盖：

- **类别：** 检测；证据与报告；生命周期与分发；或 Agent 方法论。
- **成熟度：** `stable`、`experimental`、`agent_guided` 或 `planned`。

当前 stable 检测家族包括窄范围源码 audit、crawl boundary、crawler 身份验证、edge 验证和
只读 AWS inventory helper。项目识别、demo、报告 renderer、复测基础设施、安装器与 GitHub
Action 虽然都有测试，但不构成更多 detector 家族。Gitleaks 与 OSV-Scanner adapter 仍是
`planned`；API 授权、业务逻辑、LLM/OAuth、数据层、供应链和更广的 AWS 审查仍属于 Agent
方法论，直到具体 adapter 获得回归证据。

[生成的能力矩阵](docs/capabilities.md)为每项类别与成熟度声明链接证据。结果只使用 `confirmed`、
`suspected`、`unknown`、`not_applicable`；无法执行的检查不是通过。安装 Skill 不代表项目已经安全。

## 确定性工具

可以让 Claude Code 或 Codex 调用 `web-app-security`，也可以直接运行相同的确定性工具：

```bash
# 无网络项目识别与版本化 scope
webapp-security start .

# 只读源码 audit、finding 解释与强制 baseline 复测
webapp-security audit .webapp-security/runs/<run-id> --fail-on high
webapp-security explain <finding-id> --report <report.json>
webapp-security start . --run-id <retest-run-id>
webapp-security retest .webapp-security/runs/<retest-run-id> \
  --baseline <report.json> --fail-on high

# 历史 v1 报告保持不可比较；移动/clone 的项目必须显式绑定
webapp-security migrate-report <v1-report.json> --scope <security-scope.yml> \
  --acknowledge-subject <subject-id> --out <new-directory>
webapp-security rebind <moved-project> --scope <security-scope.yml> \
  --acknowledge-subject <subject-id>

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

Source、crawl、demo、crawler identity、edge 与 AWS 结论现在共用同一套 v2 finding、coverage、
policy 和退出码 runtime；各工具的原始 observation 与结论分开写出。历史 v1 报告只用于展示、
release 校验与显式的不可比较迁移，不能作为可比较 baseline。

## GitHub Action

Composite Action 默认被动，且没有授权确认时不会执行：

```yaml
- name: Audit public crawl boundary
  uses: parousia8888/web-app-security-skill@d7df9fa6efd466c3eb13768c3b9ad259d2636e04
  with:
    site: https://example.com
    acknowledge-authorization: true
    active-probe: false
    fail-on: high
```

需要可重复 CI 时使用上面的不可变 commit。稳定大版本别名是：

```yaml
uses: parousia8888/web-app-security-skill@v1
```

移动的 `v1` tag 只在版本化 release 通过真实 consumer workflow 后更新；接受更新前应检查 release note。

## 信任与 release 证据

- CI 覆盖 Ubuntu/macOS x Node 20/22、确定性 HTTP/HTTPS fixture 和 Bash 3.2 smoke test。
- release 与 CodeQL workflow 的第三方 Action 使用完整 commit SHA。
- tag 必须同时匹配 `VERSION`、changelog 和该版本的证据文件；tag 带签名，release 记录来源 commit。
- release 产物包含可复现源码包、SPDX 2.3 SBOM、`SHA256SUMS` 与 GitHub build provenance attestation。
  CI 会构建两次并逐字节比较全部产物，再在禁止网络的隔离 HOME 中从解包产物执行完整生命周期。
- [`SECURITY.md`](SECURITY.md)、[威胁模型](docs/threat-model.md)、
  [误报政策](docs/false-positive-policy.md)和[兼容矩阵](docs/compatibility.md)可供独立复核。

验证下载的 release 产物：

```bash
sha256sum -c SHA256SUMS
gh attestation verify web-app-security-skill-*.tar.gz \
  --repo parousia8888/web-app-security-skill
git -c gpg.ssh.allowedSignersFile=.github/release-signers verify-tag v0.3.0
```

## 3 个普通项目旅程

普通项目集先运行当前确定性路径，再记录人工追踪、误报关闭、修复/复测及未覆盖面。所有源码固定到
不可变 commit；未探测任何线上实例。

| 项目 | 确定性结果 | 人工结论 |
|---|---|---|
| [Linkwarden](docs/case-studies/journeys/linkwarden.md) | 修正 workspace/template 精度后 0 finding | URL fetch 路径追踪到 scheme、DNS/IP 与 redirect 控制；局部归类 `not_applicable` |
| [Healthchecks](docs/case-studies/journeys/healthchecks.md) | 修正 requirements/template 精度后 0 finding | 仅从源码无法确认生产环境值，保留 `unknown` |
| [Open WebUI](docs/case-studies/journeys/open-webui.md) | 1 个 medium `suspected` source-map lead | 本地代表性补丁复测为 `fixed`；公开交付仍未知 |

阅读[结构化旅程、精确命令与证据边界](docs/case-studies/journeys/README.md)。零 finding 与误报关闭
同样保留；这里不计算 precision 分数。

另有 **5 个既有源码方法论案例**：三个故意脆弱基准与两个生产项目，作为独立 corpus 保留。

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

[生成式 launch evidence](docs/launch-evidence.md)只汇集可复现的能力、demo、项目旅程、方法论案例和
release 事实。[发布素材包](docs/adoption/launch-brief.zh-CN.md)提供带证据链接的中英文渠道草稿，
以及可复用的公开案例/私下披露流程，但不声称外部发布已经发生。

MIT License。
