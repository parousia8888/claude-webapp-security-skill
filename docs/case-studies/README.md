# Reproducible case studies

These studies apply the skill's source-audit method to five public repositories at immutable
commits. They are not claims that the current CLI is a general SAST scanner. No hosted instance
was probed, no exploit payload was sent, and no new vulnerability was disclosed.

| Project | Role in corpus | Confirmed from source/upstream ground truth | False-positive or scope result |
|---|---|---|---|
| [OWASP Juice Shop](juice-shop.md) | Intentionally vulnerable Node/TypeScript app | SQL injection implementation and upstream prepared-statement fix | Challenge code is not a zero-day in the project |
| [OWASP NodeGoat](nodegoat.md) | Intentionally vulnerable Node app | Server-side `eval`, IDOR, open redirect | Comments are ground truth here, not a production-code heuristic |
| [DVWA](dvwa.md) | Intentionally vulnerable PHP app | SQLi/XSS/command-injection low vs impossible controls | Low-security files must not be conflated with hardened variants |
| [Uptime Kuma](uptime-kuma.md) | Production monitoring product | User-configured outbound HTTP is a product capability | SSRF-shaped sinks are not reported without a boundary bypass |
| [Mealie](mealie.md) | Production recipe manager | Auth, password hashing, private-default data and URL-fetch guard found | URL fetching alone is not evidence of SSRF |

## Method

1. Fetch exactly the recorded commit.
2. Read the project's security policy and intended product behavior.
3. Trace a narrow source path from input to security boundary.
4. Classify as `confirmed`, `suspected`, `unknown`, or `not applicable` under the
   [false-positive policy](../false-positive-policy.md).
5. Record what the evidence does not prove.

Reproduce the corpus without executing any target:

```bash
git clone https://github.com/juice-shop/juice-shop.git && git -C juice-shop checkout 1618a611b173b4bf114028e6e02549950606e29d
git clone https://github.com/OWASP/NodeGoat.git && git -C NodeGoat checkout c5cb68a7084e4ae7dcc60e6a98768720a81841e8
git clone https://github.com/digininja/DVWA.git && git -C DVWA checkout 209930b26ef16b1636dfac74ca49b5557fd0528e
git clone https://github.com/louislam/uptime-kuma.git && git -C uptime-kuma checkout 6b5ea0155793e666666745fb8d6fef1e829543a2
git clone https://github.com/mealie-recipes/mealie.git && git -C mealie checkout 2fc22cea43f2978533f3a89a1ddeb1e6a18b245f
```

The production-project rows deliberately include closed leads. A corpus containing only known
vulnerable applications measures recall against easy ground truth but says little about precision.
