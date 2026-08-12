# Uptime Kuma

## Scope

- Repository: `louislam/uptime-kuma`
- Commit: [`6b5ea0155793e666666745fb8d6fef1e829543a2`](https://github.com/louislam/uptime-kuma/tree/6b5ea0155793e666666745fb8d6fef1e829543a2)
- Method: source and policy review only; no monitor or notification was sent
- Product context: a self-hosted monitoring system necessarily makes operator-configured outbound
  requests.

## Reviewed lead

The webhook provider sends GET or POST requests to a configured `webhookURL`:
[webhook.js#L11-L64](https://github.com/louislam/uptime-kuma/blob/6b5ea0155793e666666745fb8d6fef1e829543a2/server/notification-providers/webhook.js#L11-L64).
A sink-only rule could label this SSRF.

Classification: `not applicable` as a reportable finding from this evidence. Outbound requests to
operator-selected endpoints are core monitoring behavior, and the upstream policy explicitly says
not to report SSRF issues:
[SECURITY.md#L6-L18](https://github.com/louislam/uptime-kuma/blob/6b5ea0155793e666666745fb8d6fef1e829543a2/SECURITY.md#L6-L18).

The useful hardening question is deployment trust: who can create monitors or notifications, what
network the container can reach, and whether egress is segmented. The reviewed sink alone cannot
answer those questions.

## False-positive outcome

No vulnerability is counted. This row is retained because respecting a product's intended trust
boundary and disclosure policy is part of precision. A real report would require a separate,
authorized proof that an untrusted principal bypasses that boundary or reaches a prohibited asset.

## What this does not prove

The classification does not prove every outbound-request path is safe, endorse unrestricted
egress, or assess authenticated role boundaries. It records why a common static pattern is
insufficient evidence here.
