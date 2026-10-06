# CI monorepo lab

An IKEA-shaped Workers monorepo used to compare monorepo CI across GitHub Actions, GitLab CI, and Cloudflare CI.

```bash
npm run generate   # regenerate the 81-file GitHub Actions setup
npm run simulate   # replay changes through each provider model -> lab/results.md
npm test           # tiny Worker/package tests
```

## Hosted runner benchmark

The root workflows compare the same monorepo fan-out on GitHub-hosted and Depot-managed four-CPU runners:

- `.github/workflows/benchmark-github.yml`
- `.github/workflows/benchmark-depot.yml`
- `.github/workflows/monorepo-benchmark.yml`

Each run creates a plan job, a simulation job, and 11 parallel workspace jobs. Every workspace job records lint, test, and build timings as a JSON artifact. This benchmark focuses on runner provisioning, matrix fan-out, checkout/setup overhead, and workflow compatibility; it does not yet measure dependency-cache throughput because the lab intentionally has no third-party dependencies.

## Repository

- `workers/`: router, image-manager, redirects, streams, coworker-channel, site, assets-sync
- `packages/`: config, shared, image-core, ui
- `infra/terraform/`: Cloudflare and Azure infrastructure
- Six environments: dev, test, qa, stage, preprod, prod

Dependency graph:

```text
config <- shared <- image-core <- image-manager
                               <- site
config <- ui <- site
shared <- router, redirects, coworker-channel
config <- streams, assets-sync
```

The CI path lists contain one realistic drift: `site` imports `image-core`, but its YAML paths were not updated.

## Variants

| Directory | Model |
| --- | --- |
| `ci/github-sprawl` | One workflow per Worker × trigger × environment: 81 files |
| `ci/github-consolidated` | One Workers workflow, `dorny/paths-filter`, dynamic matrix, `ci-ok` required check |
| `ci/gitlab` | One pipeline split into folders with `include`; job-level `rules:changes` |
| `ci/cloudflare/documented` | Uses only APIs from the Sep 16, 2026 dev docs |
| `ci/cloudflare/proposed` | Monorepo APIs Cloudflare CI would need; marked `PROPOSED` |

## Why GitHub teams split by Worker

GitHub `on.<event>.paths` filters a whole workflow. Jobs do not have native path filters.
A single workflow containing every Worker either runs all Workers or needs a custom change-detection job.
Teams also split files to get separate statuses, required checks, permissions, environments, concurrency groups, and run history.
GitHub requires workflow files directly in `.github/workflows`, so the result is a long flat list.

## Findings

- Static path filters can avoid unnecessary work, but they miss transitive dependencies when YAML drifts from the package graph.
- GitHub path-skipped workflows can leave required checks waiting; consolidated workflows need an always-running gate job.
- GitLab helps organization through folders and includes, but still relies on repeated hand-written paths.
- The documented Cloudflare CI API fixes YAML authoring, credential exposure, stale deploys, and run filtering by Worker.
- The documented API does not yet solve monorepo selection: connections have no path filters, workflows do not receive changed files, and `step.deploy()` targets the connection's Worker.
- Following the documented API literally gives 7 connections and 7 runs for every event, including docs-only and Terraform-only changes.

## Cloudflare CI requirements this lab suggests

1. Provide changed files in the event or through `step.changes()` for PR base/head and push before/after.
2. Discover Workers from Wrangler configs and compute affected Workers from the workspace graph.
3. Allow one workflow run to build, preview, and deploy multiple named Workers.
4. Support Wrangler environments plus durable approval gates with audit history.
5. Report one summary check and per-Worker checks; explain skipped Workers and count skips as success.
6. Show runs grouped by Worker, environment, workflow, and repository area.
7. Cache dependencies by lockfile/catalog across runs without GitHub's repository-wide cache eviction problem.
