# Shipping the fix without taking the site down

Hardening changes land on the most dangerous surfaces: the reverse proxy, the WAF, the security-group, the container. A wrong edit here is not a bug in one feature — it is the whole origin returning 502, or every crawler getting a 403, or the DB connection dropping. The fix and the outage arrive on the same config line.

This is the phase every checklist skips and every real deploy needs. All of it was learned the hard way.

## The one rule: verify before it takes effect, never after

The failure mode is always the same shape — the validation step runs *after* the thing it validates is already live:

```bash
docker compose up -d --force-recreate nginx   # new config is now serving
docker exec nginx nginx -t                     # ← too late; if this fails the site is already down
```

By the time `nginx -t` fails, the running container is already crash-looping on the bad config and you cannot even `docker exec` into it (`is restarting, wait until the container is running`). **A validation that runs after cutover is not a validation.**

Correct shape — validate a throwaway copy, cut over only on success:

```bash
# 1. syntax-check in a disposable container that mounts the SAME deps the live one needs
docker run --rm \
  --network "$(docker inspect live-nginx -f '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}}{{end}}')" \
  -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$PWD/app.inc:/etc/nginx/conf.d/app.inc:ro" \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  nginx:1.27-alpine nginx -t
# 2. only if that exits 0:
docker compose up -d --force-recreate nginx
```

Two non-obvious things the disposable container needs, or it fails for the wrong reason (a false alarm that trains you to skip the check):
- **the same docker network**, or `proxy_pass http://api` fails with `host not found in upstream` — a resolution error, not a syntax error.
- **the cert volume**, or `ssl_certificate` fails with `cannot load certificate` — again not your syntax.

Getting three consecutive false alarms here is normal and *fine*: each one was caught before cutover, and the live site never moved.

## The single-file bind-mount inode trap

`docker compose` mounting a single file (`./nginx.conf:/etc/nginx/conf.d/default.conf`) binds the **inode**, not the path. `tar x`, most editors, and `mv` replace the file with a new inode. The running container still points at the old one, so:
- editing the file and `nginx -s reload` reloads the **old** content — your change silently does nothing;
- you must `up -d --force-recreate` (or restart) the container to re-bind the new inode.

Directory mounts (`./dist:/srv/web`) do not have this problem; overlay files inside them, never `rm -rf && recreate` the dir (that breaks open tabs holding old hashed asset names — see the frontend notes).

## nginx gotchas that pass review and fail at boot

- **`proxy_pass` with a URI part is illegal inside a regex `location`.** `location ~ "..." { proxy_pass http://api:3000/foo; }` → `[emerg]`, container won't start. Rewrite first: `rewrite ^ /foo break; proxy_pass http://api:3000;`. Prefix locations may carry a URI; regex ones may not.
- **`add_header` does not merge across levels.** Any `add_header` in a child block drops *all* inherited headers from the parent. A `location` with its own `Cache-Control` silently loses the server-level `X-Frame-Options`/CSP/`nosniff`. Re-add security headers in every block that sets any header of its own (static files, `index.html`, uploads).
- **`limit_req_zone` is `http`-context only.** In `map`/`server`-included files it must sit at the top level, not inside `server`.

## Every proxy/WAF/rate-limit change is an SEO change

Re-run the UA matrix (`crawl-surface-audit.mjs`) before and after. A rule meant to stop scanners that also trips Googlebot shows up as a ranking loss weeks later, with no error anywhere. Specifically:
- confirm PUBLIC content paths return 200 to a crawler UA, **before and after**;
- rate limits go only on probe paths and auth endpoints, never on content paths (`enforcement-layers.md` §3);
- prove it, don't assume it — see below.

## Prove the limiter actually engages (and only where intended)

A serially-issued `curl` loop will not trip a `30r/m` limiter — the request rate is below the threshold. You need small, bounded concurrency, and you must check both directions:

```bash
# probe path SHOULD start shedding (nginx limit_req returns 503 by default, or 429 if you set limit_req_status)
seq 30 | xargs -P30 -I_ curl -sk -o /dev/null -w '%{http_code}\n' -A probe "$SITE/.env" | sort | uniq -c
# public content MUST NOT be limited — every one is 200
seq 30 | xargs -P30 -I_ curl -sk -o /dev/null -w '%{http_code}\n' "$SITE/" | sort | uniq -c
```
"Config present" is not "config working". Verify the 503/429 appears on the probe class and never on the content class. (`limit_req` defaults to `503`; add `limit_req_status 429;` if you prefer the semantically-correct code — `503` can read to a crawler as "server broken".)

## Dependencies you break by hardening

- **Redis/Mongo/DB auth added → the healthcheck now needs the credential.** A bare `redis-cli ping` returns `NOAUTH` after you set `requirepass`, so the container is forever `unhealthy`, so everything `depends_on` it stalls. Fix the healthcheck in the same change: `redis-cli -a "$PW" ping | grep -q PONG`.
- **Container dropped to non-root → the writable volume must be owned by that uid.** Check the mount's owner before flipping `USER`; if it is root-owned the app can't write uploads and fails at runtime, not at build.
- **DB runtime role dropped to non-superuser → migrations, which need DDL, must use a different credential.** Keep the migration step on the privileged role and override its `DATABASE_URL` explicitly; the runtime container uses the restricted one. Document it where the deploy script lives, or the next migration fails with `permission denied` and looks like an outage.

## The always-have-a-way-back requirement

- Back up before any change that can lose data (a DB dump before a migration or a role change), and keep the backup where the app's own credentials cannot delete it.
- Keep the previous known-good image/config reachable for an instant rollback. A compromise or a bad deploy both end the same way: rebuild from known-good, do not repair in place.
- Record the deployed revision somewhere the running process can report (`APP_REVISION` → Sentry release, `/version`), so "which build introduced this" is answerable in seconds.
