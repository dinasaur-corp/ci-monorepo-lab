import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  approvalEnvironments,
  automaticEnvironments,
  environments,
  handMaintainedPaths,
  root,
  workers,
} from "./model.mjs";

const out = join(root, "ci/github-sprawl/.github");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "workflows"), { recursive: true });
mkdirSync(join(out, "actions/setup"), { recursive: true });

const files = new Map();
const yamlList = (items, indent) => items.map((item) => `${" ".repeat(indent)}- "${item}"`).join("\n");
const setup = `      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup`;

writeFileSync(
  join(out, "actions/setup/action.yml"),
  `name: Setup monorepo
description: Install Node.js, pnpm, and workspace dependencies
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: pnpm
    - run: pnpm install --frozen-lockfile
      shell: bash
`,
);

for (const worker of workers()) {
  const paths = (file) => [...handMaintainedPaths(worker), `.github/workflows/${file}`, ".github/actions/setup/**"];

  const prFile = `worker-${worker}-pr.yml`;
  files.set(
    prFile,
    `name: "worker / ${worker} / pr"

on:
  pull_request:
    paths:
${yamlList(paths(prFile), 6)}

concurrency:
  group: ${worker}-pr-\${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write

jobs:
  verify:
    runs-on: [self-hosted, azure-vnet, large]
    steps:
${setup}
      - run: pnpm --filter @lab/${worker} lint
      - run: pnpm --filter @lab/${worker} test
      - run: pnpm --filter @lab/${worker} exec wrangler deploy --dry-run --env test
`,
  );

  for (const env of environments) {
    const file = `worker-${worker}-deploy-${env}.yml`;
    const automatic = automaticEnvironments.includes(env);
    const trigger = automatic
      ? `  push:
    branches: [main]
    paths:
${yamlList(paths(file), 6)}
  workflow_dispatch:`
      : `  workflow_dispatch:
    inputs:
      ref:
        description: Git ref to promote
        required: true
        default: main`;
    files.set(
      file,
      `name: "worker / ${worker} / deploy / ${env}"

on:
${trigger}

concurrency:
  group: ${worker}-${env}
  cancel-in-progress: false

permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    runs-on: [self-hosted, azure-vnet, large]
    environment: ${env}${approvalEnvironments.includes(env) ? "  # required reviewers configured in GitHub" : ""}
    steps:
${setup}
      - run: pnpm --filter @lab/${worker} build
      - run: pnpm --filter @lab/${worker} exec wrangler deploy --env ${env}
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN_${env.toUpperCase()} }}
          CLOUDFLARE_ACCOUNT_ID: \${{ vars.CLOUDFLARE_ACCOUNT_ID }}
`,
    );
  }

  files.set(
    `worker-${worker}-preview-cleanup.yml`,
    `name: "worker / ${worker} / preview cleanup"

on:
  pull_request:
    types: [closed]
    paths:
${yamlList([`workers/${worker}/**`], 6)}

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Delete preview alias ${worker}-pr-\${{ github.event.pull_request.number }}"
`,
  );
}

files.set(
  "terraform-plan.yml",
  `name: "infra / terraform / plan"

on:
  pull_request:
    paths:
      - "infra/terraform/**"

jobs:
  plan:
    runs-on: [self-hosted, azure-vnet, large]
    strategy:
      matrix:
        environment: [${environments.join(", ")}]
    steps:
      - uses: actions/checkout@v4
      - run: terraform -chdir=infra/terraform/cloudflare plan -var environment=\${{ matrix.environment }}
      - run: echo "Post plan summary as PR comment"
`,
);

for (const env of environments) {
  files.set(
    `terraform-apply-${env}.yml`,
    `name: "infra / terraform / apply / ${env}"

on:
${automaticEnvironments.includes(env) ? `  push:
    branches: [main]
    paths:
      - "infra/terraform/**"
` : ""}  workflow_dispatch:

jobs:
  apply:
    runs-on: [self-hosted, azure-vnet, large]
    environment: ${env}
    steps:
      - uses: actions/checkout@v4
      - run: terraform -chdir=infra/terraform/cloudflare apply -auto-approve -var environment=${env}
`,
  );
  files.set(
    `r2-static-assets-${env}.yml`,
    `name: "assets / r2 / ${env}"

on:
${automaticEnvironments.includes(env) ? `  push:
    branches: [main]
    paths:
      - "workers/assets-sync/public/**"
` : ""}  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    environment: ${env}
    steps:
      - uses: actions/checkout@v4
      - run: pnpm dlx wrangler r2 object put ikea-static-${env}/favicon.ico --file workers/assets-sync/public/favicon.ico
`,
  );
  files.set(
    `smoke-${env}.yml`,
    `name: "smoke / ${env}"

on:
  workflow_run:
    workflows: [${workers().map((worker) => `"worker / ${worker} / deploy / ${env}"`).join(", ")}]
    types: [completed]
  workflow_dispatch:

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - run: curl --fail https://${env === "prod" ? "" : `${env}.`}ikea.example/en/
`,
  );
}

const misc = {
  "lint.yml": `name: "repo / lint"

on:
  pull_request:

jobs:
  lint:
    runs-on: [self-hosted, azure-vnet, large]
    steps:
${setup}
      - run: pnpm -r lint
`,
  "codeql.yml": `name: "security / codeql"

on:
  pull_request:
  schedule:
    - cron: "0 3 * * 1"

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
`,
  "dependency-review.yml": `name: "security / dependency review"

on:
  pull_request:
    paths:
      - "pnpm-lock.yaml"
      - "**/package.json"

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
`,
  "e2e-nightly.yml": `name: "e2e / nightly"

on:
  schedule:
    - cron: "0 2 * * *"

jobs:
  e2e:
    runs-on: [self-hosted, azure-vnet, large]
    steps:
${setup}
      - run: pnpm playwright test
`,
  "cache-prune.yml": `name: "maintenance / prune actions cache"

on:
  schedule:
    - cron: "0 */6 * * *"

jobs:
  prune:
    runs-on: ubuntu-latest
    steps:
      - run: gh cache list --limit 100 --sort last_accessed_at --order asc
`,
  "rollback.yml": `name: "ops / rollback worker"

on:
  workflow_dispatch:
    inputs:
      worker:
        type: choice
        options: [${workers().join(", ")}]
      environment:
        type: choice
        options: [${environments.join(", ")}]

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: \${{ inputs.environment }}
    steps:
      - run: pnpm dlx wrangler rollback --name ikea-\${{ inputs.worker }}-\${{ inputs.environment }}
`,
};
for (const [file, body] of Object.entries(misc)) files.set(file, body);

for (const [file, body] of files) writeFileSync(join(out, "workflows", file), body);
console.log(`Generated ${files.size} workflow files in ci/github-sprawl/.github/workflows`);
