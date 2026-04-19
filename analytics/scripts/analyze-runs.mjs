/**
 * Reads parse-food benchmark JSON files under analytics/runs/<YYYY-MM-DD>/[subfolder]/
 * and writes report.html (MAE bars + predicted vs expected scatter).
 *
 * Usage (from repo): cd analytics && npm run analyze -- 2026-04-03
 * Debug subfolder: npm run analyze -- 2026-04-03 debug
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const analyticsRoot = join(__dirname, "..");

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function medianSorted(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mae(deltas) {
  if (!deltas.length) return null;
  return mean(deltas.map((d) => Math.abs(d)));
}

function rmse(deltas) {
  if (!deltas.length) return null;
  return Math.sqrt(mean(deltas.map((d) => d * d)));
}

function sumNutrients(suggestions) {
  let cal = 0;
  let prot = 0;
  for (const s of suggestions) {
    cal += Number(s.calories) || 0;
    prot += Number(s.protein) || 0;
  }
  return { cal, prot };
}

function slugMatch(expected, predicted) {
  const e = String(expected ?? "").trim().toLowerCase();
  const p = String(predicted ?? "").trim().toLowerCase();
  if (!e || !p || p === "—") return false;
  return e === p;
}

function buildSlugRows(results) {
  const rows = [];
  for (const row of results) {
    if (row.error) {
      rows.push({
        query: row.query,
        expectedSlug: row.expectedSlug ?? "",
        predictedSlug: "—",
        match: false,
        skipped: true,
      });
      continue;
    }
    const exp = row.expectedSlug ?? "";
    const pred = row.suggestions?.[0]?.mealSlug;
    const predictedSlug = pred != null && String(pred).trim() !== "" ? String(pred) : "—";
    rows.push({
      query: row.query,
      expectedSlug: exp,
      predictedSlug,
      match: slugMatch(exp, pred),
      skipped: !String(exp).trim(),
    });
  }
  let evaluated = 0;
  let hits = 0;
  for (const r of rows) {
    if (r.skipped) continue;
    evaluated += 1;
    if (r.match) hits += 1;
  }
  return { rows, evaluated, hits, accuracyPct: evaluated ? (100 * hits) / evaluated : null };
}

async function main() {
  const date = process.argv[2];
  const sub = process.argv[3] ?? "";
  if (!date || !/^\d{4}-\d{2}-\d{2}(-\d+)?$/.test(date)) {
    console.error("Usage: node scripts/analyze-runs.mjs <YYYY-MM-DD> [subfolder]");
    console.error("Example: node scripts/analyze-runs.mjs 2026-04-03");
    console.error("Example: node scripts/analyze-runs.mjs 2026-04-03 debug");
    process.exit(1);
  }

  const runDir = sub ? join(analyticsRoot, "runs", date, sub) : join(analyticsRoot, "runs", date);
  let names;
  try {
    names = await readdir(runDir);
  } catch {
    console.error(`Cannot read directory: ${runDir}`);
    process.exit(1);
  }

  const jsonFiles = names.filter((n) => n.endsWith(".json") && n !== "package.json");
  if (!jsonFiles.length) {
    console.error(`No benchmark *.json files in ${runDir}`);
    process.exit(1);
  }

  const models = [];

  for (const file of jsonFiles.sort()) {
    const modelName = file.replace(/\.json$/i, "");
    const raw = await readFile(join(runDir, file), "utf8");
    const data = JSON.parse(raw);
    const results = data.results;
    if (!Array.isArray(results)) {
      console.warn(`Skip ${file}: missing results[]`);
      continue;
    }

    const calDeltas = [];
    const protDeltas = [];
    const scatterCal = [];
    const scatterProt = [];
    const latencies = [];
    let errors = 0;
    const { rows: slugRows, evaluated: slugEvaluated, hits: slugHits, accuracyPct: slugAccuracyPct } =
      buildSlugRows(results);

    for (const row of results) {
      if (typeof row.durationMs === "number" && !Number.isNaN(row.durationMs)) {
        latencies.push(row.durationMs);
      }
      if (row.error) {
        errors += 1;
        continue;
      }
      const exp = row.expectedResult;
      if (!exp) continue;
      const { cal: predCal, prot: predProt } = sumNutrients(row.suggestions ?? []);
      const expCal = Number(exp.calories) || 0;
      const expProt = Number(exp.protein) || 0;
      calDeltas.push(predCal - expCal);
      protDeltas.push(predProt - expProt);
      scatterCal.push({ x: expCal, y: predCal });
      scatterProt.push({ x: expProt, y: predProt });
    }

    const latSorted = [...latencies].sort((a, b) => a - b);
    models.push({
      name: modelName,
      errors,
      okCount: calDeltas.length,
      maeCalories: mae(calDeltas),
      maeProtein: mae(protDeltas),
      rmseCalories: rmse(calDeltas),
      rmseProtein: rmse(protDeltas),
      meanCalDelta: calDeltas.length ? mean(calDeltas) : null,
      meanProtDelta: protDeltas.length ? mean(protDeltas) : null,
      scatterCalories: scatterCal,
      scatterProtein: scatterProt,
      avgParseMs: latencies.length ? mean(latencies) : null,
      medianParseMs: latencies.length ? medianSorted(latSorted) : null,
      minParseMs: latencies.length ? latSorted[0] : null,
      maxParseMs: latencies.length ? latSorted[latSorted.length - 1] : null,
      totalParseMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) : null,
      slugRows,
      slugEvaluated,
      slugHits,
      slugAccuracyPct,
    });
  }

  if (!models.length) {
    console.error("No valid model files to analyze.");
    process.exit(1);
  }

  const anySlugRows = models.some((m) => Array.isArray(m.slugRows) && m.slugRows.length > 0);
  let slugSection = "";
  if (anySlugRows) {
    const m0 = models[0].slugRows ?? [];
    const headerCells = models.map((m) => `<th>${escapeHtml(m.name)}</th>`).join("");
    const bodyRows = [];
    for (let i = 0; i < m0.length; i++) {
      const qFull = m0[i]?.query ?? "";
      const qShort = escapeHtml(qFull.length > 72 ? `${qFull.slice(0, 72)}…` : qFull);
      const exp = escapeHtml(m0[i]?.expectedSlug || "—");
      const cells = models
        .map((m) => {
          const cell = m.slugRows?.[i];
          if (!cell) return "<td>—</td>";
          const slug = escapeHtml(cell.predictedSlug || "—");
          const mark = cell.skipped ? "—" : cell.match ? "✓" : "✗";
          return `<td title="${slug}">${slug} ${mark}</td>`;
        })
        .join("");
      bodyRows.push(
        `<tr><td>${i + 1}</td><td title="${escapeHtml(qFull)}">${qShort}</td><td>${exp}</td>${cells}</tr>`,
      );
    }
    slugSection = `
  <h2>Meal slugs (first suggestion)</h2>
  <p class="muted">Compared to <code>expectedSlug</code> in <code>analytics/trainingData.json</code>. ✓ = exact case-insensitive match on first parsed item&rsquo;s <code>mealSlug</code>.</p>
  <div style="overflow-x:auto">
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Query</th>
        <th>Expected slug</th>
        ${headerCells}
      </tr>
    </thead>
    <tbody>
      ${bodyRows.join("\n")}
    </tbody>
  </table>
  </div>`;
  } else {
    slugSection = `
  <h2>Meal slugs</h2>
  <p class="muted">No slug rows in this run (re-run <code>npm run benchmark:parse-food</code> after updating training data / parser so results include <code>expectedSlug</code> and <code>mealSlug</code>).</p>`;
  }

  const chartPalette = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#dc2626", "#0891b2"];

  const payload = {
    runDir: runDir.replace(/\\/g, "/"),
    date,
    subfolder: sub || null,
    models,
    chartPalette,
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Parse-food benchmark — ${escapeHtml(date)}${sub ? ` / ${escapeHtml(sub)}` : ""}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 1.25rem; max-width: 1100px; }
    h1 { font-size: 1.25rem; }
    h2 { font-size: 1rem; margin-top: 1.75rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.875rem; }
    th, td { border: 1px solid #8884; padding: 0.35rem 0.5rem; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    .charts { display: grid; gap: 1.5rem; }
    @media (min-width: 720px) { .charts.two { grid-template-columns: 1fr 1fr; } }
    @media (min-width: 900px) { .charts.metrics3 { grid-template-columns: 1fr 1fr 1fr; } }
    .chart-box { position: relative; height: 280px; }
    .muted { color: #666; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>Parse-food benchmark report</h1>
  <p class="muted">${escapeHtml(payload.runDir)}</p>

  <h2>Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Model</th>
        <th>OK rows</th>
        <th>Errors</th>
        <th>MAE kcal</th>
        <th>MAE protein (g)</th>
        <th>RMSE kcal</th>
        <th>RMSE protein</th>
        <th>Mean Δ kcal</th>
        <th>Mean Δ protein</th>
        <th>Slug hits</th>
        <th>Slug rows</th>
        <th>Slug acc %</th>
        <th>Avg parse (ms)</th>
        <th>Median (ms)</th>
        <th>Parse min–max (ms)</th>
        <th>Total parse (s)</th>
      </tr>
    </thead>
    <tbody>
      ${models
        .map(
          (m) => `<tr>
        <td>${escapeHtml(m.name)}</td>
        <td>${m.okCount}</td>
        <td>${m.errors}</td>
        <td>${fmt(m.maeCalories)}</td>
        <td>${fmt(m.maeProtein)}</td>
        <td>${fmt(m.rmseCalories)}</td>
        <td>${fmt(m.rmseProtein)}</td>
        <td>${fmt(m.meanCalDelta)}</td>
        <td>${fmt(m.meanProtDelta)}</td>
        <td>${m.slugEvaluated != null ? m.slugHits ?? "—" : "—"}</td>
        <td>${m.slugEvaluated != null ? m.slugEvaluated : "—"}</td>
        <td>${m.slugAccuracyPct != null ? fmt(m.slugAccuracyPct) : "—"}</td>
        <td>${fmt(m.avgParseMs)}</td>
        <td>${fmt(m.medianParseMs)}</td>
        <td>${fmtMinMax(m.minParseMs, m.maxParseMs)}</td>
        <td>${fmtSeconds(m.totalParseMs)}</td>
      </tr>`,
        )
        .join("\n")}
    </tbody>
  </table>

  ${slugSection}

  <div class="charts two metrics3">
    <div>
      <h2>MAE — calories (kcal)</h2>
      <div class="chart-box"><canvas id="maeCal"></canvas></div>
    </div>
    <div>
      <h2>MAE — protein (g)</h2>
      <div class="chart-box"><canvas id="maeProt"></canvas></div>
    </div>
    <div>
      <h2>Avg parse latency</h2>
      <p class="muted">Wall time per training row (same rows as benchmark).</p>
      <div class="chart-box"><canvas id="latencyAvg"></canvas></div>
    </div>
  </div>

  <div class="charts">
    <div>
      <h2>Predicted vs expected — calories</h2>
      <p class="muted">Each point is one training row (summed suggestions). Perfect agreement lies on the diagonal.</p>
      <div class="chart-box" style="height:360px"><canvas id="scatterCal"></canvas></div>
    </div>
    <div>
      <h2>Predicted vs expected — protein (g)</h2>
      <div class="chart-box" style="height:360px"><canvas id="scatterProt"></canvas></div>
    </div>
  </div>

  <script type="application/json" id="report-data">${JSON.stringify(payload)}</script>
  <script>
    const DATA = JSON.parse(document.getElementById('report-data').textContent);
    const labelColor = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? '#e5e5e5' : '#171717';
    const gridColor = 'rgba(128,128,128,0.2)';
    Chart.defaults.color = labelColor;
    Chart.defaults.borderColor = gridColor;

    const names = DATA.models.map((m) => m.name);
    const palette = DATA.chartPalette;

    new Chart(document.getElementById('maeCal'), {
      type: 'bar',
      data: {
        labels: names,
        datasets: [{
          label: 'MAE kcal',
          data: DATA.models.map((m) => m.maeCalories ?? 0),
          backgroundColor: names.map((_, i) => palette[i % palette.length]),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });

    new Chart(document.getElementById('maeProt'), {
      type: 'bar',
      data: {
        labels: names,
        datasets: [{
          label: 'MAE protein (g)',
          data: DATA.models.map((m) => m.maeProtein ?? 0),
          backgroundColor: names.map((_, i) => palette[i % palette.length]),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });

    new Chart(document.getElementById('latencyAvg'), {
      type: 'bar',
      data: {
        labels: names,
        datasets: [{
          label: 'Avg ms / row',
          data: DATA.models.map((m) => m.avgParseMs ?? 0),
          backgroundColor: names.map((_, i) => palette[i % palette.length]),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Milliseconds' },
          },
        },
      },
    });

    function scatterChart(canvasId, key, axisLabel) {
      const datasets = DATA.models.map((m, i) => ({
        label: m.name,
        data: m[key],
        backgroundColor: palette[i % palette.length],
        pointRadius: 4,
        pointHoverRadius: 6,
      }));
      const all = DATA.models.flatMap((m) => m[key]);
      const maxVal = Math.max(1, ...all.flatMap((p) => [p.x, p.y]));
      const pad = maxVal * 0.05;
      datasets.push({
        label: 'y = x',
        data: [{ x: 0, y: 0 }, { x: maxVal + pad, y: maxVal + pad }],
        showLine: true,
        pointRadius: 0,
        borderColor: 'rgba(128,128,128,0.7)',
        borderDash: [6, 4],
        borderWidth: 1,
      });
      new Chart(document.getElementById(canvasId), {
        type: 'scatter',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: 'Expected ' + axisLabel },
              beginAtZero: true,
              suggestedMax: maxVal + pad,
            },
            y: {
              title: { display: true, text: 'Predicted ' + axisLabel },
              beginAtZero: true,
              suggestedMax: maxVal + pad,
            },
          },
        },
      });
    }

    scatterChart('scatterCal', 'scatterCalories', 'kcal');
    scatterChart('scatterProt', 'scatterProtein', 'protein (g)');
  </script>
</body>
</html>
`;

  const outPath = join(runDir, "report.html");
  await writeFile(outPath, html, "utf8");
  console.log(`Wrote ${outPath.replace(/\\/g, "/")}`);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(1);
}

function fmtMinMax(min, max) {
  if (min == null || max == null || Number.isNaN(min) || Number.isNaN(max)) return "—";
  return `${Number(min).toFixed(0)}–${Number(max).toFixed(0)}`;
}

function fmtSeconds(totalMs) {
  if (totalMs == null || Number.isNaN(totalMs)) return "—";
  return (totalMs / 1000).toFixed(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
