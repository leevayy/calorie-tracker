/**
 * Estimates and writes dietary fiber for food log rows in a recent day range (default: last 7 days, inclusive).
 * Uses the same Yandex AI stack as parse-food (`estimateFiberGramsWithAi`).
 *
 * Runs **at most once per database**: records `maintenance_jobs.fiber_recent_backfill_v1` after a real run.
 * Exits immediately if that job already exists (use `--ignore-job` to run again).
 *
 * Prerequisites: run `pnpm db:migrate` so `food_entries.fiber` and `maintenance_jobs` exist.
 *
 * From `backend/`:
 *   pnpm backfill:fiber-recent
 *   pnpm backfill:fiber-recent -- --dry-run
 *   pnpm backfill:fiber-recent -- --days=14
 *   pnpm backfill:fiber-recent -- --force   (re-estimate even when fiber > 0)
 *   pnpm backfill:fiber-recent -- --ignore-job
 *
 * Requires DATABASE_URL, JWT_SECRET (env bootstrap), and YANDEX_AI_STUDIO_API_KEY.
 */
import { pool } from "../src/db/client.ts";
import { env } from "../src/env.ts";
import { AiModelPreferenceSchema, type AiModelPreference } from "../src/contracts/common.ts";
import { estimateFiberGramsWithAi } from "../src/services/ai.ts";

const JOB_NAME = "fiber_recent_backfill_v1";

function coerceAiModelPreference(raw: string): AiModelPreference {
  const parsed = AiModelPreferenceSchema.safeParse(raw);
  return parsed.success ? parsed.data : "qwen3";
}

function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Row = {
  id: string;
  user_id: string;
  day: string;
  name: string;
  portion: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  ai_model_preference: string;
};

function parseArgs(argv: string[]): { dryRun: boolean; force: boolean; ignoreJob: boolean; days: number } {
  let dryRun = false;
  let force = false;
  let ignoreJob = false;
  let days = 7;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    if (a === "--force") force = true;
    if (a === "--ignore-job") ignoreJob = true;
    const m = /^--days=(\d+)$/.exec(a);
    if (m) days = Math.max(1, Math.min(90, Number(m[1])));
  }
  return { dryRun, force, ignoreJob, days };
}

async function main(): Promise<void> {
  const { dryRun, force, ignoreJob, days } = parseArgs(process.argv.slice(2));

  if (!ignoreJob) {
    const done = await pool.query(`SELECT 1 FROM maintenance_jobs WHERE name = $1`, [JOB_NAME]);
    if (done.rowCount && done.rowCount > 0) {
      console.log(
        `[backfill-fiber-recent] Job "${JOB_NAME}" already completed — skipping (use --ignore-job to run again).`,
      );
      await pool.end();
      return;
    }
  }

  if (!env.YANDEX_AI_STUDIO_API_KEY?.trim()) {
    console.error("[backfill-fiber-recent] YANDEX_AI_STUDIO_API_KEY is required.");
    process.exit(1);
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const from = localIsoDate(start);
  const to = localIsoDate(end);

  const fiberPredicate = force ? "TRUE" : "(coalesce(fe.fiber, 0) = 0)";

  const { rows } = await pool.query<Row>(
    `SELECT fe.id, fe.user_id, fe.day, fe.name, fe.portion, fe.calories, fe.protein, fe.carbs, fe.fats, fe.fiber, u.ai_model_preference
     FROM food_entries fe
     INNER JOIN users u ON u.id = fe.user_id
     WHERE fe.day >= $1 AND fe.day <= $2 AND ${fiberPredicate}
     ORDER BY fe.day ASC, fe.created_at ASC`,
    [from, to],
  );

  const total = rows.length;
  console.log(
    `[backfill-fiber-recent] Range ${from} .. ${to} (${days} day(s)); rows: ${total}${dryRun ? " (dry-run)" : ""}${force ? " (force)" : ""}`,
  );

  let n = 0;
  const byDay = new Map<string, number>();
  for (const row of rows) {
    n += 1;
    const modelPref = coerceAiModelPreference(row.ai_model_preference);
    const prevFiber = Number(row.fiber ?? 0);
    let fiber: number;
    try {
      fiber = await estimateFiberGramsWithAi(
        {
          name: row.name,
          portion: row.portion,
          calories: row.calories,
          protein: row.protein,
          carbs: row.carbs,
          fats: row.fats,
        },
        modelPref,
      );
    } catch (e) {
      console.error(`[${n}/${total}] ${row.id} AI error:`, e);
      continue;
    }

    byDay.set(row.day, (byDay.get(row.day) ?? 0) + fiber);
    console.log(
      `[${n}/${total}] ${row.day} ${row.id} "${row.name}" fiber ${prevFiber.toFixed(1)} -> ${fiber.toFixed(1)} g`,
    );
    if (!dryRun) {
      await pool.query(`UPDATE food_entries SET fiber = $1 WHERE id = $2`, [fiber, row.id]);
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  console.log(
    `\n[backfill-fiber-recent] Sum of assigned fiber (g) for processed rows, by day — not net delta from previous values:`,
  );
  const daysSorted = [...byDay.keys()].sort();
  for (const d of daysSorted) {
    console.log(`  ${d}: ~${(byDay.get(d) ?? 0).toFixed(1)} g (from processed rows)`);
  }

  if (!dryRun) {
    await pool.query(
      `INSERT INTO maintenance_jobs (name, completed_at) VALUES ($1, now())
       ON CONFLICT (name) DO UPDATE SET completed_at = excluded.completed_at`,
      [JOB_NAME],
    );
    console.log(`\n[backfill-fiber-recent] Recorded job "${JOB_NAME}" — this script will no-op next time unless you pass --ignore-job.`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("[backfill-fiber-recent] Failed:", err);
  await pool.end();
  process.exit(1);
});
