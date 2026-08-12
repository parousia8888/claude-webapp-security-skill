# OWASP Juice Shop

## Scope

- Repository: `juice-shop/juice-shop`
- Commit: [`1618a611b173b4bf114028e6e02549950606e29d`](https://github.com/juice-shop/juice-shop/tree/1618a611b173b4bf114028e6e02549950606e29d)
- Method: source-only review; no running instance
- Ground truth: the project calls itself intentionally insecure in its
  [README](https://github.com/juice-shop/juice-shop/blob/1618a611b173b4bf114028e6e02549950606e29d/README.md#L27-L31)
  and separates challenge behavior from unexpected vulnerabilities in
  [SECURITY.md](https://github.com/juice-shop/juice-shop/blob/1618a611b173b4bf114028e6e02549950606e29d/SECURITY.md#L3-L7).

## Confirmed representative finding

`confirmed`, CWE-89: the login route interpolates request email into a SQL string before passing
it to Sequelize. The source marks the expression as a vulnerable challenge line:
[routes/login.ts#L32-L35](https://github.com/juice-shop/juice-shop/blob/1618a611b173b4bf114028e6e02549950606e29d/routes/login.ts#L32-L35).

The repository also supplies its own correct remediation: bind both email and the hashed password
instead of constructing query syntax from user input:
[loginAdminChallenge_4_correct.ts#L14-L17](https://github.com/juice-shop/juice-shop/blob/1618a611b173b4bf114028e6e02549950606e29d/data/static/codefixes/loginAdminChallenge_4_correct.ts#L14-L17).
Its explanation explicitly rejects a custom blocklist and identifies binding as the effective
control:
[loginAdminChallenge.info.yml#L1-L9](https://github.com/juice-shop/juice-shop/blob/1618a611b173b4bf114028e6e02549950606e29d/data/static/codefixes/loginAdminChallenge.info.yml#L1-L9).

## False-positive handling

This is a confirmed vulnerable code path but `not applicable` as an undisclosed upstream security
report: it is intentional challenge behavior. Treating every challenge hit as a new project defect
would violate the target's threat model and inflate precision.

## What this does not prove

One confirmed challenge does not measure coverage across Juice Shop's full challenge inventory,
prove the CLI finds SQL injection automatically, or establish safety of any deployed instance.
