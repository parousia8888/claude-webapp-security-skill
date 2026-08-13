# Good first issues

The GitHub issue owns scope, discussion and status. Each linked issue includes a local fixture,
planted-failure requirement, objective acceptance tests and an explicit no-third-party-target
boundary.

| Issue | Area | Why it is bounded |
|---|---|---|
| [#1 Add malformed, empty, and stale crawler-range fixtures](https://github.com/parousia8888/web-app-security-skill/issues/1) | Rules | Completed after v0.3.0; retained here as regression provenance |
| [#2 Preserve UNCHECKED for AWS permission-denied inventory paths](https://github.com/parousia8888/web-app-security-skill/issues/2) | AWS | Completed after v0.3.0; retained here as regression provenance |
| [#3 Verify the install and tutorial lifecycle on a clean WSL2 image](https://github.com/parousia8888/web-app-security-skill/issues/3) | Docs | Execute the published lifecycle and record compatibility evidence |
| [#4 Add an informational security.txt source check](https://github.com/parousia8888/web-app-security-skill/issues/4) | Rules | Absence must not become a vulnerability or threshold failure |
| [#5 Cover sitemap XML entities and CDATA edge cases](https://github.com/parousia8888/web-app-security-skill/issues/5) | Rules | Completed after v0.3.0; retained here as regression provenance |

Completed after v0.3.0: [#1](https://github.com/parousia8888/web-app-security-skill/issues/1),
[#2](https://github.com/parousia8888/web-app-security-skill/issues/2), and
[#5](https://github.com/parousia8888/web-app-security-skill/issues/5). Their local fixtures remain
in the default test suite as regression evidence; they are no longer available starter tasks.

Larger help-wanted work is tracked separately:

- [#6 Add ShellCheck and define an evidence-based coverage threshold](https://github.com/parousia8888/web-app-security-skill/issues/6)
- [#7 Define alert ownership before enabling dependency review and secret scanning](https://github.com/parousia8888/web-app-security-skill/issues/7)

Before opening a pull request, reproduce the gap, add a test that fails for the intended reason,
implement the smallest change, and run `npm run check`. Do not use live third-party sites or cloud
accounts as contribution fixtures.
