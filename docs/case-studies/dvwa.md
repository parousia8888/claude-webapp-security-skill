# Damn Vulnerable Web Application

## Scope

- Repository: `digininja/DVWA`
- Commit: [`209930b26ef16b1636dfac74ca49b5557fd0528e`](https://github.com/digininja/DVWA/tree/209930b26ef16b1636dfac74ca49b5557fd0528e)
- Method: source-only review of paired security levels; no running instance
- Ground truth: the project [warns that it is intentionally vulnerable](https://github.com/digininja/DVWA/blob/209930b26ef16b1636dfac74ca49b5557fd0528e/README.md#L9-L26).

## Confirmed before/after controls

| Surface | `low` evidence | `impossible` evidence |
|---|---|---|
| SQL injection | Request ID is concatenated into SQL: [low.php#L8-L13](https://github.com/digininja/DVWA/blob/209930b26ef16b1636dfac74ca49b5557fd0528e/vulnerabilities/sqli/source/low.php#L8-L13) | Prepared query, typed bind and CSRF check: [impossible.php#L4-L35](https://github.com/digininja/DVWA/blob/209930b26ef16b1636dfac74ca49b5557fd0528e/vulnerabilities/sqli/source/impossible.php#L4-L35) |
| Reflected XSS | Request name is echoed into HTML: [low.php](https://github.com/digininja/DVWA/blob/209930b26ef16b1636dfac74ca49b5557fd0528e/vulnerabilities/xss_r/source/low.php) | Output is encoded with `htmlspecialchars`: [impossible.php](https://github.com/digininja/DVWA/blob/209930b26ef16b1636dfac74ca49b5557fd0528e/vulnerabilities/xss_r/source/impossible.php) |
| Command injection | Request IP is appended to a shell command: [low.php](https://github.com/digininja/DVWA/blob/209930b26ef16b1636dfac74ca49b5557fd0528e/vulnerabilities/exec/source/low.php) | Octet validation and reconstruction restrict the argument: [impossible.php](https://github.com/digininja/DVWA/blob/209930b26ef16b1636dfac74ca49b5557fd0528e/vulnerabilities/exec/source/impossible.php) |

## False-positive handling

A repository-wide grep would return both insecure and hardened implementations. Reporting all
matches without preserving the selected security level would turn the `impossible` variants into
false positives and lose the configuration boundary.

## What this does not prove

This source comparison does not prove that the `impossible` mode is vulnerability-free, which
mode any third-party deployment selects, or that every defense remains effective under its PHP,
database and web-server configuration.
