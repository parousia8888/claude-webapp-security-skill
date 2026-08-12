# Good first issues

Each item is deliberately bounded and has an objective acceptance test. Open an issue before
starting if one does not already exist.

1. Add malformed crawler JSON fixtures: missing `prefixes`, wrong prefix type, and invalid CIDR.
2. Add Windows/WSL documentation verified on a clean WSL2 image.
3. Add a `security.txt` informational check without treating its absence as a vulnerability.
4. Add a fixture for sitemap XML entities and CDATA edge cases.
5. Add a fake AWS CLI response for one additional `UNCHECKED` permission path.

For every code change, plant the failure and show the new test fails for the intended reason before
restoring the fix. Do not use live third-party sites as test fixtures.
