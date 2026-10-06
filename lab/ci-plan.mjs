import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const roots = ["packages", "workers"];
const include = [];

for (const root of roots) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name);
    const packageJson = JSON.parse(await readFile(join(path, "package.json"), "utf8"));
    include.push({
      name: packageJson.name,
      path,
      kind: root === "workers" ? "worker" : "package"
    });
  }
}

include.sort((left, right) => left.name.localeCompare(right.name));
const matrix = JSON.stringify({ include });
const outputPath = process.env.GITHUB_OUTPUT;

if (outputPath) {
  await writeFile(outputPath, `matrix=${matrix}\n`, { flag: "a" });
}

console.log(matrix);

