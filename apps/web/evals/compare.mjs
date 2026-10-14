import { readFile } from "node:fs/promises";

// CLI tool to compare two evaluation benchmark JSON outputs side-by-side.
// Usage: pnpm --filter @brighte/web eval:compare <file1.json> <file2.json>

function formatPct(val) {
  if (val === undefined) return "N/A";
  return `${Math.round(val * 100)}%`;
}

function formatDeltaPct(val1, val2) {
  if (val1 === undefined || val2 === undefined) return "N/A";
  const diff = Math.round((val2 - val1) * 100);
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff}%`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: pnpm --filter @brighte/web eval:compare <baseline.json> <candidate.json>");
    process.exit(1);
  }

  const [path1, path2] = args;
  const file1Raw = await readFile(path1, "utf-8");
  const file2Raw = await readFile(path2, "utf-8");

  const run1 = JSON.parse(file1Raw);
  const run2 = JSON.parse(file2Raw);

  console.log("Evaluation Benchmark Comparison");
  console.log("===============================");
  console.log(`Baseline (A)  : ${run1.model} (${path1})`);
  console.log(`Candidate (B) : ${run2.model} (${path2})`);
  console.log("");

  const tasks = new Set([...Object.keys(run1.summary || {}), ...Object.keys(run2.summary || {})]);

  for (const task of tasks) {
    console.log(`Task: ${task.toUpperCase()}`);
    console.log("-".repeat(40));
    const stats1 = run1.summary?.[task] || {};
    const stats2 = run2.summary?.[task] || {};
    const metrics = new Set([...Object.keys(stats1), ...Object.keys(stats2)]);

    for (const metric of metrics) {
      const val1 = stats1[metric];
      const val2 = stats2[metric];

      if (typeof val1 === "number" && typeof val2 === "number" && val1 <= 1 && val2 <= 1) {
        console.log(`  ${metric.padEnd(30)}: Baseline = ${formatPct(val1).padEnd(6)} | Candidate = ${formatPct(val2).padEnd(6)} | Diff = ${formatDeltaPct(val1, val2)}`);
      } else {
        console.log(`  ${metric.padEnd(30)}: Baseline = ${String(val1).padEnd(6)} | Candidate = ${String(val2).padEnd(6)}`);
      }
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("Comparison failed:", err);
  process.exit(1);
});
