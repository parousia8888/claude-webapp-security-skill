#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) {
  console.error('usage: node scripts/generate-adoption-assets.mjs [--check]');
  process.exit(2);
}

const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const publication = json('docs/adoption/publication.json');
const metadata = json('docs/github-metadata.json');
const contract = json('docs/public-contract.json');
const capabilities = json('docs/capabilities.json');
const demo = json('docs/assets/demo.json').result;
const journeys = json('docs/case-studies/journeys/evidence.json');
const ordinaryReview = json('docs/case-studies/journeys/v0.5.0-evidence.json');
const ruleCorpus = json('docs/stable-rule-corpus.json');
const version = read('VERSION').trim();
const releaseState = json('docs/release-state.json');
const published = releaseState.publishedRelease;
const releaseEvidencePath = published.evidence;

function requireFact(condition, message) {
  if (!condition) throw new Error(message);
}

requireFact(publication.schemaVersion === 1, 'publication schemaVersion must be 1');
requireFact(releaseState.schemaVersion === 1, 'release-state schemaVersion must be 1');
requireFact(metadata.repository === publication.repositoryUrl.replace('https://github.com/', ''), 'repository sources disagree');
requireFact(metadata.promise?.en && metadata.promise?.['zh-CN'], 'canonical promises are missing');
requireFact(existsSync(join(ROOT, releaseEvidencePath)), `published release evidence is missing for v${published.version}`);
requireFact(demo.boundary === 'owned-local-source-fixture-no-network', 'demo must remain an owned local source fixture');
requireFact(demo.before?.state === 'suspected' && demo.before?.ruleId
  && demo.before?.technicalTerm && demo.before?.plainLanguage && demo.before?.consequence
  && demo.before?.evidenceBoundary && demo.proposal?.status === 'review_required'
  && demo.proposal?.sideEffects?.length && demo.securityRetest?.baselineState === 'fixed'
  && demo.functionalRetest?.status === 'passed', 'source demo facts are invalid');
requireFact(journeys.journeys?.length === contract.projectJourneys?.length, 'ordinary journey sources disagree');
requireFact(contract.methodStudies?.length > 0, 'method studies are missing');
requireFact(journeys.journeys.every((journey) => /^[a-f0-9]{40}$/.test(journey.commit || '')), 'journeys must pin immutable commits');
requireFact(journeys.method?.hostedInstancesProbed === false
  && journeys.method?.projectDependenciesExecuted === false
  && journeys.method?.osvPublicAdvisoryNetwork === true,
  'journey source/network boundary drifted');
requireFact(ordinaryReview.projects?.length === journeys.journeys.length
  && ordinaryReview.method?.hostedInstancesProbed === false
  && ordinaryReview.method?.networkAccessPerformed === false,
  'v0.5.0 ordinary review boundary drifted');
requireFact(ruleCorpus.counts?.stableTotal === 30, 'stable rule corpus count drifted');

const capabilityCount = (category, maturity) => capabilities.capabilities.filter((item) =>
  item.category === category && (!maturity || item.maturity === maturity)).length;
const categorizedCount = Object.keys(capabilities.categories).reduce((sum, category) =>
  sum + capabilityCount(category), 0);
requireFact(categorizedCount === capabilities.capabilities.length, 'capability categories are incomplete');
const facts = {
  product: publication.product,
  repo: publication.repositoryUrl,
  marketplace: publication.marketplaceUrl,
  promiseEn: metadata.promise.en,
  promiseZh: metadata.promise['zh-CN'],
  version,
  publishedVersion: published.version,
  release: published.url,
  capabilities: capabilities.capabilities.length,
  stableDetection: capabilityCount('detection', 'stable'),
  plannedDetection: capabilityCount('detection', 'planned'),
  evidenceReporting: capabilityCount('evidence_reporting'),
  lifecycleDistribution: capabilityCount('lifecycle_distribution'),
  guided: capabilityCount('agent_guided_methodology'),
  demoFinding: demo.before.technicalTerm,
  demoState: demo.before.state,
  demoSeverity: demo.before.severity,
  demoBoundary: demo.before.evidenceBoundary,
  demoProposal: demo.proposal.summary,
  demoSideEffect: demo.proposal.sideEffects.join(' '),
  securityRetest: demo.securityRetest.baselineState,
  functionalRetest: demo.functionalRetest.status,
  stableRules: ruleCorpus.counts.stableTotal,
  builtInRisk: ruleCorpus.counts.builtInRisk,
  builtInIntegrity: ruleCorpus.counts.builtInIntegrity,
  externalRisk: ruleCorpus.counts.externalRisk,
  reviewFindings: ordinaryReview.aggregate.findings,
  reviewUseful: ordinaryReview.aggregate.reviewClasses.useful_lead,
  reviewBenign: ordinaryReview.aggregate.reviewClasses.expected_benign_match,
  reviewUnknown: ordinaryReview.aggregate.reviewClasses.unknown,
  reviewConfirmed: ordinaryReview.aggregate.reviewClasses.confirmed,
  journeys: journeys.journeys.length,
  studies: contract.methodStudies.length,
};
const demoEn = `${facts.demoFinding}, ${facts.demoState.toUpperCase()} ${facts.demoSeverity.toUpperCase()}`;
const demoZh = `${facts.demoFinding}，${facts.demoState} ${facts.demoSeverity.toUpperCase()}`;
const demoAfterEn = `security ${facts.securityRetest}; functional ${facts.functionalRetest}`;
const demoAfterZh = `security ${facts.securityRetest}；functional ${facts.functionalRetest}`;

const generatedNote = '<!-- Generated by scripts/generate-adoption-assets.mjs. Edit structured sources, not this file. -->';
const enLimits = publication.limitations.en.map((item) => `- ${item}`).join('\n');
const zhLimits = publication.limitations['zh-CN'].map((item) => `- ${item}`).join('\n');
const installLink = `${facts.repo}/blob/main/docs/verified-installation.md`;
const installZhLink = `${facts.repo}/blob/main/docs/verified-installation.zh-CN.md`;
const demoLink = `${facts.repo}/blob/main/docs/demo-evidence.md`;
const capabilityLink = `${facts.repo}/blob/main/docs/capabilities.md`;
const journeysLink = `${facts.repo}/blob/main/docs/case-studies/journeys/README.md`;
const reviewLink = `${facts.repo}/blob/main/docs/case-studies/journeys/v0.5.0-review.md`;
const launchEvidenceLink = `${facts.repo}/blob/main/docs/launch-evidence.md`;

const outputs = new Map();
function add(path, lines) {
  outputs.set(path, `${Array.isArray(lines) ? lines.join('\n') : lines}\n`);
}

add('docs/adoption/launch-brief.md', [
  '# Web App Security Skill: evidence-led launch brief',
  '',
  generatedNote,
  '',
  facts.promiseEn,
  '',
  `**For:** ${publication.audience.en}`,
  '',
  `**What it is:** ${publication.positioning.en}`,
  '',
  '## The inspect-patch-retest loop',
  '',
  `The repository-owned local source demo begins with **${demoEn}**, explains what the pattern does and does not prove, proposes argument-separated execution, names a quoting/platform side effect, and records **${demoAfterEn}**. It sends no network request and does not execute project dependencies.`,
  '',
  `[Watch the generated demo and inspect its reports](${demoLink}).`,
  '',
  '## What is implemented',
  '',
  `The current source contract lists **${facts.stableDetection} stable narrow detection families** and **${facts.plannedDetection} planned detection capabilities**. Separately, it records **${facts.evidenceReporting} evidence/reporting**, **${facts.lifecycleDistribution} lifecycle/distribution**, and **${facts.guided} agent-guided** capabilities. Demo, report, installer and Action behavior are not counted as vulnerability detection.`,
  '',
  `[Review every capability and its evidence](${capabilityLink}).`,
  '',
  `The v0.5.0 built-in review classifies all **${facts.reviewFindings} findings** from **${facts.journeys} fixed-commit ordinary projects** as ${facts.reviewUseful} useful leads, ${facts.reviewBenign} expected benign matches, ${facts.reviewUnknown} unknown and ${facts.reviewConfirmed} confirmed missing-lockfile facts. This is not a vulnerability count or precision/recall claim. A separate ${facts.studies}-study corpus exercises broader source methodology.`,
  '',
  `[Review the v0.5.0 classification](${reviewLink}) and [historical journey method](${journeysLink}).`,
  '',
  '## Install and distribution',
  '',
  `Release [v${facts.publishedVersion}](${facts.release}) provides a signed tag, reproducible source archive, SPDX SBOM, checksums, release manifest and provenance. The supported one-command installer pins and verifies its bootstrap before execution, then verifies the selected release assets and metadata.`,
  '',
  `- [Verified installation](${installLink})`,
  `- [GitHub Marketplace Action](${facts.marketplace})`,
  `- [Generated launch evidence](${launchEvidenceLink})`,
  '',
  '## Limits to preserve when quoting',
  '',
  enLimits,
  '',
  `Community publication, independent user-session results and upstream validation remain \`${publication.externalState.communityPublication}\`. This brief is a publication kit, not evidence that any external post or validation has occurred.`,
]);

add('docs/adoption/launch-brief.zh-CN.md', [
  '# Web App Security Skill：证据型发布简报',
  '',
  generatedNote,
  '',
  facts.promiseZh,
  '',
  `**面向：**${publication.audience['zh-CN']}`,
  '',
  `**产品形态：**${publication.positioning['zh-CN']}`,
  '',
  '## 检查、补丁与复测闭环',
  '',
  `仓库自有本地源码 demo 的初始结果为 **${demoZh}**，随后说明 pattern 能证明和不能证明什么，提出参数分离的执行方式，列出 quoting/跨平台副作用，并记录 **${demoAfterZh}**。该 fixture 不访问网络，也不执行项目依赖。`,
  '',
  `[查看生成的 demo、报告与补丁](${demoLink})。`,
  '',
  '## 已实现范围',
  '',
  `版本化合同当前列出 **${facts.stableDetection} 个 stable 窄检测家族**和 **${facts.plannedDetection} 项 planned 检测能力**；另行记录 **${facts.evidenceReporting} 项证据/报告**、**${facts.lifecycleDistribution} 项生命周期/分发**与 **${facts.guided} 项 agent-guided** 能力。Demo、报告、安装器和 Action 不计入漏洞检测覆盖。`,
  '',
  `[逐项查看能力与证据](${capabilityLink})。`,
  '',
  `v0.5.0 built-in 复核把 **${facts.journeys} 个固定 commit 普通项目**中的 **${facts.reviewFindings} 条 finding**逐条归类为 ${facts.reviewUseful} 条有用线索、${facts.reviewBenign} 条预期良性命中、${facts.reviewUnknown} 条 unknown 和 ${facts.reviewConfirmed} 条已确认的缺 lockfile 事实。这不是漏洞数量或 precision/recall。另有 ${facts.studies} 个独立源码方法论案例。`,
  '',
  `[查看 v0.5.0 人工分类](${reviewLink})与[历史旅程方法](${journeysLink})。`,
  '',
  '## 安装与分发',
  '',
  `Release [v${facts.publishedVersion}](${facts.release}) 提供签名 tag、可复现源码归档、SPDX SBOM、校验和、release manifest 与 provenance。受支持的一条命令安装路径在执行前固定并校验 bootstrap，随后校验所选 release 的资产与元数据。`,
  '',
  `- [可信安装说明](${installZhLink})`,
  `- [GitHub Marketplace Action](${facts.marketplace})`,
  `- [生成式 launch evidence](${launchEvidenceLink})`,
  '',
  '## 引用时必须保留的限制',
  '',
  zhLimits,
  '',
  `社区发布、独立用户 session 结果和上游验证仍为 \`${publication.externalState.communityPublication}\`。本简报只是发布素材，不代表外部文章或验证已经发生。`,
]);

add('docs/adoption/channels/technical-long-form.md', [
  '# Technical long-form draft',
  '',
  generatedNote,
  '',
  '## Title',
  '',
  'Building a reviewable web-security loop for AI coding agents',
  '',
  '## Draft',
  '',
  `I built [${facts.product}](${facts.repo}) around one constraint: a security workflow should leave reviewable evidence instead of ending at a list of warnings. The workflow records scope, classifies evidence, proposes a minimal patch, and requires a retest before calling a finding fixed.`,
  '',
  `The repository-owned source demo starts with ${demoEn}. It keeps the evidence boundary visible, shows the shell-free patch and records ${demoAfterEn}. [The generated reports and patch are public](${demoLink}).`,
  '',
  `The current contract names ${facts.stableDetection} stable narrow detection families and keeps ${facts.evidenceReporting} evidence/reporting plus ${facts.lifecycleDistribution} lifecycle/distribution capabilities outside that detection count. Context-heavy API, identity, data and cloud review still depends on ${facts.guided} agent-guided methods and human review. [The full category-by-maturity matrix links each claim to evidence](${capabilityLink}).`,
  '',
  `I also ran the v0.5.0 built-in path over ${facts.journeys} ordinary projects at immutable commits. No hosted project was contacted, no dependency executed and no network request made. All ${facts.reviewFindings} findings were reviewed as ${facts.reviewUseful} useful leads, ${facts.reviewBenign} expected benign matches, ${facts.reviewUnknown} unknown and ${facts.reviewConfirmed} confirmed facts. A separate ${facts.studies}-study corpus exercises broader source review. [Classification and reproduction](${reviewLink}).`,
  '',
  `Distribution is part of the threat model. [v${facts.publishedVersion}](${facts.release}) includes a signed tag, reproducible archive, SPDX SBOM, checksums, manifest and provenance. The recommended installer verifies an immutable bootstrap before execution, then verifies the release it installs.`,
  '',
  'The useful review question is not whether this replaces an AppSec team or a general scanner; it does not. The question is whether the evidence states, patch boundary, retest contract and installation chain are strict enough to make an agent-assisted first pass safer and easier to review.',
  '',
  `Repository: ${facts.repo}`,
  '',
  '### Limits',
  '',
  enLimits,
  '',
  '> Publication status: draft. No external publication or upstream endorsement is claimed.',
]);

add('docs/adoption/channels/show-hn.md', [
  '# Show HN draft',
  '',
  generatedNote,
  '',
  '## Title',
  '',
  'Show HN: Web App Security Skill - inspect, patch, and retest with coding agents',
  '',
  '## Submission text',
  '',
  `I built ${facts.product}, an open-source skill and CLI for recording scope, running narrow deterministic checks, proposing reviewable hardening patches, and retesting applied changes.`,
  '',
  `The local demo is generated from a repository-owned source fixture: ${demoEn}, then a reviewable patch, then ${demoAfterEn}. The repository records ${facts.builtInRisk} built-in risk, ${facts.builtInIntegrity} evidence-integrity and ${facts.externalRisk} external-adapter stable rules, and a fully classified ${facts.journeys}-project review.`,
  '',
  `The installer verifies pinned bootstrap bytes and release assets; v${facts.publishedVersion} includes a signed tag, reproducible archive, SBOM, checksums, manifest and provenance.`,
  '',
  `Demo evidence: ${demoLink}`,
  '',
  `Repository: ${facts.repo}`,
  '',
  'It is not a general SAST engine or proof that a project is secure. I am looking for technical review of the evidence-state model, false-positive handling, retest semantics and verified install path.',
  '',
  '> Publication status: draft; submitting to Hacker News remains an owner action.',
]);

add('docs/adoption/channels/reddit.md', [
  '# Reddit discussion draft',
  '',
  generatedNote,
  '',
  '## Suggested title',
  '',
  'I built an open-source inspect -> patch -> retest security skill for AI coding agents; feedback on the evidence model?',
  '',
  '## Post',
  '',
  `I am working on [${facts.product}](${facts.repo}). It combines an agent workflow with deterministic local tooling: record scope, classify results as confirmed/suspected/unknown/not_applicable, produce a patch for review, then require baseline retest evidence before marking anything fixed.`,
  '',
  `The reproducible owned-source demo shows ${demoEn} -> ${demoAfterEn} and keeps the evidence boundary, side effect, reports and patch in the repository. The rule corpus identifies ${facts.stableRules} stable source/deployment rules by category, while agent-guided methods remain separate.`,
  '',
  `I kept the ${facts.journeys} ordinary-project source journeys at immutable commits and included zero-finding, false-positive and unknown results. No hosted instance was probed. Release v${facts.publishedVersion} adds a signed tag, reproducible archive, SBOM, checksums, manifest and provenance.`,
  '',
  `Evidence inventory: ${launchEvidenceLink}`,
  '',
  'Questions for review:',
  '',
  '- Are the four evidence states sufficient for keeping source leads separate from reproduced findings?',
  '- Which failure modes should the patch/retest contract reject before a result can be called fixed?',
  '- What would you need to inspect before trusting the verified installer?',
  '',
  'This is not positioned as a general scanner, a precision benchmark or proof that an application is secure.',
  '',
  '> Publication status: draft; subreddit selection and posting require a rule check at posting time.',
]);

const shortPost = `${facts.product}: inspect -> patch -> retest for AI coding agents. ${facts.stableDetection} stable narrow detection families; evidence and distribution are counted separately; fixed-commit cases; verified releases. Not a general scanner. ${facts.repo}`;
requireFact(shortPost.length <= 280, `short post exceeds 280 characters (${shortPost.length})`);
add('docs/adoption/channels/x-short-post.md', [
  '# X / short-post draft',
  '',
  generatedNote,
  '',
  shortPost,
  '',
  `Character count before platform URL shortening: ${shortPost.length}.`,
  '',
  '> Publication status: draft.',
]);

add('docs/adoption/channels/v2ex.md', [
  '# V2EX 发布草稿',
  '',
  generatedNote,
  '',
  '## 标题',
  '',
  '做了一个 Web App Security Skill：让 AI coding agent 留下可审查的检查、补丁和复测证据',
  '',
  '## 正文',
  '',
  `项目地址：${facts.repo}`,
  '',
  `这个项目把 Web 安全加固拆成范围确认、证据分类、最小补丁和双重复测。自有本地源码 fixture 的 demo 为 ${demoZh}，应用可审查补丁后记录 ${demoAfterZh}；证据边界、副作用、报告、补丁和生成方式都可以检查。`,
  '',
  `目前能力合同明确列出 ${facts.stableDetection} 个 stable 窄检测家族、${facts.plannedDetection} 项 planned 检测能力和 ${facts.guided} 项 agent-guided 方法；证据/报告与分发能力不计入检测覆盖。另有 ${facts.journeys} 个固定 commit 的普通开源项目旅程，保留零 finding、误报关闭和 unknown 结果，未探测线上实例。`,
  '',
  `v${facts.publishedVersion} release 提供签名 tag、可复现归档、SPDX SBOM、校验和、manifest 与 provenance。安装路径会先固定并校验 bootstrap，再校验 release 资产。`,
  '',
  `Demo 证据：${demoLink}`,
  '',
  `能力边界：${capabilityLink}`,
  '',
  '想重点讨论三个工程问题：证据状态是否足够严格、怎样降低误报但不把 unknown 当安全、verified install 的信任链还缺什么。',
  '',
  '边界：不是通用 SAST 或全覆盖漏洞扫描器，安装后也不能证明项目安全；案例不声称得到上游验证。',
  '',
  '> 发布状态：草稿；节点选择、标题和发布时间需发布时检查。',
]);

add('docs/adoption/channels/chinese-developer-community.md', [
  '# 中文开发者社区长文草稿',
  '',
  generatedNote,
  '',
  '## 标题',
  '',
  'Web App Security Skill：把 AI 辅助安全加固变成可复核的证据闭环',
  '',
  '## 摘要',
  '',
  `${facts.product} 是一个开源 agent skill 与 CLI，目标是让 Web 项目的首次安全加固形成“范围确认 -> 结果分级 -> 最小补丁 -> 复测”的可审查记录。`,
  '',
  '## 正文',
  '',
  `项目没有把一次扫描结果当成安全结论。每项结果必须处于 confirmed、suspected、unknown 或 not_applicable；补丁默认只输出供审查，只有沿基线复测后才可记录为 fixed。`,
  '',
  `可复现 demo 使用仓库自有本地源码 fixture，初始结果是 ${demoZh}，展示补丁后记录 ${demoAfterZh}。它不请求第三方目标、不执行项目依赖，证据边界、副作用、生成脚本、JSON/Markdown 报告和 patch 都在仓库中。`,
  '',
  `当前能力合同按 category 与 maturity 分开记录：${facts.stableDetection} 个 stable 窄检测家族、${facts.plannedDetection} 项 planned 检测能力、${facts.evidenceReporting} 项证据/报告能力、${facts.lifecycleDistribution} 项生命周期/分发能力和 ${facts.guided} 项 agent-guided 方法。这个分层避免把 demo、报告、安装器或强上下文审查描述成检测覆盖。`,
  '',
  `案例证据包括 ${facts.journeys} 个固定 commit 的普通项目旅程和 ${facts.studies} 个源码方法论案例，其中两个项目按设计重叠。普通项目旅程不探测托管实例、不执行项目依赖；仅 OSV-Scanner 可查询公共 advisory 服务，并公开 confirmed 事实、误报关闭、suspected 与 unknown。`,
  '',
  `供应链方面，v${facts.publishedVersion} 提供签名 tag、可复现源码包、SPDX SBOM、SHA-256 校验和、release manifest 与构建 provenance；推荐安装路径在执行前校验固定 bootstrap，再验证 release。`,
  '',
  `- 项目：${facts.repo}`,
  `- Demo：${demoLink}`,
  `- 可信安装：${installZhLink}`,
  `- 完整证据清单：${launchEvidenceLink}`,
  '',
  '### 需要保留的限制',
  '',
  zhLimits,
  '',
  '> 发布状态：草稿。没有声称已在任何中文社区发布，也没有声称获得第三方或上游验证。',
]);

add('docs/adoption/citations.md', [
  '# Citation and fact sheet',
  '',
  generatedNote,
  '',
  'Quote the claims below with their evidence links and limits. Do not convert repository counts',
  'into a security score, precision estimate or universal coverage claim.',
  '',
  '| ID | Citable claim | Evidence | Required qualifier |',
  '|---|---|---|---|',
  `| \`product.workflow\` | ${facts.promiseEn} | [README](${facts.repo}#readme) | Agent-guided work still requires project context and review. |`,
  `| \`demo.before-after\` | The repository-owned local source fixture records ${demoEn}, a reviewable proposal and ${demoAfterEn}. | [Generated demo evidence](${demoLink}) | The lead is suspected; no exploitability or third-party coverage claim. |`,
  `| \`capabilities.contract\` | The current source contract lists ${facts.stableDetection} stable narrow detection families and ${facts.plannedDetection} planned detection capabilities, separately from ${facts.evidenceReporting} evidence/reporting, ${facts.lifecycleDistribution} lifecycle/distribution and ${facts.guided} agent-guided capabilities. | [Generated capability matrix](${capabilityLink}) | Supporting or guided capability counts are not vulnerability coverage or precision. |`,
  `| \`cases.ordinary\` | ${facts.journeys} ordinary project journeys use immutable source commits with no hosted instance probed. | [Journey evidence](${journeysLink}) | Source-only scope; zero, false-positive and unknown outcomes remain visible; no upstream validation claimed. |`,
  `| \`cases.method\` | ${facts.studies} separate fixed-commit studies exercise the source-review methodology. | [Case-study method](${facts.repo}/blob/main/docs/case-studies/README.md) | Not a CLI precision benchmark. |`,
  `| \`release.integrity\` | v${facts.publishedVersion} records a signed tag, reproducible archive, SPDX SBOM, checksums, manifest and provenance. | [Release evidence](${facts.repo}/blob/main/${releaseEvidencePath}) | Artifact identity/origin does not prove every security conclusion. |`,
  `| \`distribution.marketplace\` | The composite Action is listed in GitHub Marketplace. | [Marketplace](${facts.marketplace}) | Listing presence is not adoption or security evidence. |`,
  '',
  '## Machine-readable source',
  '',
  'Use [`share-metadata.json`](share-metadata.json) for the same current facts. It is regenerated',
  'and checked in normal repository lint.',
]);

const share = {
  schemaVersion: 1,
  generatedBy: 'scripts/generate-adoption-assets.mjs',
  product: facts.product,
  repository: facts.repo,
  marketplace: facts.marketplace,
  productVersion: facts.version,
  release: { version: facts.publishedVersion, url: facts.release, state: 'published' },
  promise: { en: facts.promiseEn, 'zh-CN': facts.promiseZh },
  capabilityContract: {
    total: facts.capabilities,
    stableDetection: facts.stableDetection,
    plannedDetection: facts.plannedDetection,
    evidenceReporting: facts.evidenceReporting,
    lifecycleDistribution: facts.lifecycleDistribution,
    agentGuided: facts.guided,
    evidence: capabilityLink,
  },
  ownedLocalDemo: {
    finding: { technicalTerm: facts.demoFinding, state: facts.demoState, severity: facts.demoSeverity },
    proposal: { summary: facts.demoProposal, sideEffect: facts.demoSideEffect },
    retest: { security: facts.securityRetest, functional: facts.functionalRetest },
    thirdPartyTarget: false,
    networkAccess: false,
    evidence: demoLink,
  },
  caseEvidence: {
    ordinaryFixedCommitJourneys: facts.journeys,
    methodologyStudies: facts.studies,
    hostedInstancesProbedInOrdinaryJourneys: false,
    upstreamValidationClaimed: false,
    v050Review: {
      findings: facts.reviewFindings,
      usefulLeads: facts.reviewUseful,
      expectedBenignMatches: facts.reviewBenign,
      unknown: facts.reviewUnknown,
      confirmedFacts: facts.reviewConfirmed,
    },
    evidence: journeysLink,
  },
  externalState: publication.externalState,
  prohibitedInferences: [
    'general scanner coverage',
    'precision percentage',
    'project is secure',
    'upstream validation',
    'external publication already occurred'
  ]
};
add('docs/adoption/share-metadata.json', JSON.stringify(share, null, 2));

let stale = false;
for (const [path, content] of outputs) {
  const target = join(ROOT, path);
  if (check) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== content) {
      console.error(`adoption assets: stale ${path}`);
      stale = true;
    }
  } else {
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content);
  }
}
if (stale) process.exit(1);
console.log(`adoption assets ${check ? 'current' : 'generated'}: ${outputs.size} files, ${facts.capabilities} capabilities, ${facts.journeys} journeys, ${facts.studies} studies`);
