# CI monorepo simulation

Workspace: 7 Workers, 4 shared packages, 6 environments.
GitHub sprawl: 81 workflow files generated from the same model.

Columns: runs = top-level workflow runs/pipelines; selected = Workers tested or deployed; missed/extra compare with the pnpm dependency graph; stuck = required PR checks left waiting because their workflow was skipped (assumes every Worker PR check is required).

## A. PR edits router code

Event: `pull_request`; changed: `workers/router/src/handler.js`
Should affect: router

| Provider | Runs | Selected Workers | Missed | Extra | Stuck required checks | Notes |
| --- | ---: | --- | --- | --- | ---: | --- |
| GitHub: 81 files | 3 | router | - | - | 6 | 3 separate workflow runs |
| GitHub: consolidated | 2 | router | - | - | 0 | 1 workers run; dynamic matrix; ci-ok gate |
| GitLab: includes | 1 | router | - | - | 0 | 1 pipeline; folders via include |
| Cloudflare: documented | 7 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | assets-sync, coworker-channel, image-manager, redirects, site, streams | 0 | 7 connections; no path filter or changed files |
| Cloudflare: proposed | 1 | router | - | - | 0 | 1 run; graph-aware; skipped Workers explained |

## B. PR edits shared package

Event: `pull_request`; changed: `packages/shared/src/index.js`
Should affect: coworker-channel, image-manager, redirects, router, site

| Provider | Runs | Selected Workers | Missed | Extra | Stuck required checks | Notes |
| --- | ---: | --- | --- | --- | ---: | --- |
| GitHub: 81 files | 6 | coworker-channel, image-manager, redirects, router | site | - | 3 | 6 separate workflow runs |
| GitHub: consolidated | 2 | coworker-channel, image-manager, redirects, router | site | - | 0 | 1 workers run; dynamic matrix; ci-ok gate |
| GitLab: includes | 1 | coworker-channel, image-manager, redirects, router | site | - | 0 | 1 pipeline; folders via include |
| Cloudflare: documented | 7 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | assets-sync, streams | 0 | 7 connections; no path filter or changed files |
| Cloudflare: proposed | 1 | coworker-channel, image-manager, redirects, router, site | - | - | 0 | 1 run; graph-aware; skipped Workers explained |

## C. PR edits image-core (dependency drift)

Event: `pull_request`; changed: `packages/image-core/src/index.js`
Should affect: image-manager, site

| Provider | Runs | Selected Workers | Missed | Extra | Stuck required checks | Notes |
| --- | ---: | --- | --- | --- | ---: | --- |
| GitHub: 81 files | 3 | image-manager | site | - | 6 | 3 separate workflow runs |
| GitHub: consolidated | 2 | image-manager | site | - | 0 | 1 workers run; dynamic matrix; ci-ok gate |
| GitLab: includes | 1 | image-manager | site | - | 0 | 1 pipeline; folders via include |
| Cloudflare: documented | 7 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | assets-sync, coworker-channel, redirects, router, streams | 0 | 7 connections; no path filter or changed files |
| Cloudflare: proposed | 1 | image-manager, site | - | - | 0 | 1 run; graph-aware; skipped Workers explained |

## D. PR edits docs only

Event: `pull_request`; changed: `docs/architecture.md`
Should affect: no Workers

| Provider | Runs | Selected Workers | Missed | Extra | Stuck required checks | Notes |
| --- | ---: | --- | --- | --- | ---: | --- |
| GitHub: 81 files | 2 | - | - | - | 7 | 2 separate workflow runs |
| GitHub: consolidated | 2 | - | - | - | 0 | 1 workers run; dynamic matrix; ci-ok gate |
| GitLab: includes | 0 | - | - | - | 0 | no pipeline created |
| Cloudflare: documented | 7 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | 0 | 7 connections; no path filter or changed files |
| Cloudflare: proposed | 1 | - | - | - | 0 | 1 run; graph-aware; skipped Workers explained |

## E. PR updates lockfile

Event: `pull_request`; changed: `pnpm-lock.yaml`
Should affect: assets-sync, coworker-channel, image-manager, redirects, router, site, streams

| Provider | Runs | Selected Workers | Missed | Extra | Stuck required checks | Notes |
| --- | ---: | --- | --- | --- | ---: | --- |
| GitHub: 81 files | 10 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | - | 0 | 10 separate workflow runs |
| GitHub: consolidated | 2 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | - | 0 | 1 workers run; dynamic matrix; ci-ok gate |
| GitLab: includes | 1 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | - | 0 | 1 pipeline; folders via include |
| Cloudflare: documented | 7 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | - | 0 | 7 connections; no path filter or changed files |
| Cloudflare: proposed | 1 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | - | 0 | 1 run; graph-aware; skipped Workers explained |

## F. PR edits Terraform

Event: `pull_request`; changed: `infra/terraform/cloudflare/main.tf`
Should affect: no Workers + Terraform

| Provider | Runs | Selected Workers | Missed | Extra | Stuck required checks | Notes |
| --- | ---: | --- | --- | --- | ---: | --- |
| GitHub: 81 files | 3 | - | - | - | 7 | 3 separate workflow runs |
| GitHub: consolidated | 3 | - | - | - | 0 | 1 workers run; dynamic matrix; ci-ok gate |
| GitLab: includes | 1 | - | - | - | 0 | 1 pipeline; folders via include |
| Cloudflare: documented | 7 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | 0 | 7 connections; no path filter or changed files |
| Cloudflare: proposed | 1 | - | - | - | 0 | 1 run; graph-aware; skipped Workers explained |

## G. Merge shared package change to main

Event: `push`; changed: `packages/shared/src/index.js`
Should affect: coworker-channel, image-manager, redirects, router, site

| Provider | Runs | Selected Workers | Missed | Extra | Stuck required checks | Notes |
| --- | ---: | --- | --- | --- | ---: | --- |
| GitHub: 81 files | 16 | coworker-channel, image-manager, redirects, router | site | - | 0 | 16 separate workflow runs |
| GitHub: consolidated | 1 | coworker-channel, image-manager, redirects, router | site | - | 0 | 1 workers run; dynamic matrix; ci-ok gate |
| GitLab: includes | 1 | coworker-channel, image-manager, redirects, router | site | - | 0 | 1 pipeline; folders via include |
| Cloudflare: documented | 7 | assets-sync, coworker-channel, image-manager, redirects, router, site, streams | - | assets-sync, streams | 0 | 7 connections; no path filter or changed files |
| Cloudflare: proposed | 1 | coworker-channel, image-manager, redirects, router, site | - | - | 0 | 1 run; graph-aware; skipped Workers explained |

## Adding one Worker

| Provider | Config changes |
| --- | --- |
| GitHub: 81 files | 15 files mention router: 8 new Worker workflows, plus smoke and rollback lists |
| GitHub: consolidated | Add one paths-filter entry; repeat dependency paths by hand |
| GitLab: includes | Add one `ci/workers/<worker>.yml`; repeat dependency paths by hand |
| Cloudflare: documented | Add one connection + Worker permission; workflow cannot discover its Worker directory |
| Cloudflare: proposed | No workflow change; discovered from Wrangler config and workspace graph, subject to allowlist |
