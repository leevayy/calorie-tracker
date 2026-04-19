/**
 * Manual one-off: fill `food_entries.meal_slug` for legacy rows. Run inside the pod with DATABASE_URL + AI keys set.
 *
 *   npx tsx scripts/backfill-meal-slugs.ts
 *   npx tsx scripts/backfill-meal-slugs.ts --dry-run
 *
 * Exits immediately if maintenance job `meal_slug_backfill_v1` already completed (table `maintenance_jobs`).
 */
import { pool } from "../src/db/client.ts";
import { resolveMealSlugFromLoggedName } from "../src/services/mealSlug.ts";
import type { AiModelPreference } from "../src/contracts/common.ts";
import { AiModelPreferenceSchema } from "../src/contracts/common.ts";

const JOB_NAME = "meal_slug_backfill_v1";

function coerceAiModelPreference(raw: string): AiModelPreference {
  const parsed = AiModelPreferenceSchema.safeParse(raw);
  return parsed.success ? parsed.data : "qwen3";
}

type Row = {
  id: string;
  name: string;
  ai_model_preference: string;
};

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  const done = await pool.query(`SELECT 1 FROM maintenance_jobs WHERE name = $1`, [JOB_NAME]);
  if (done.rowCount && done.rowCount > 0) {
    console.log(`[backfill-meal-slugs] Job "${JOB_NAME}" already completed — exiting.`);
    await pool.end();
    return;
  }

  const { rows } = await pool.query<Row>(
    `SELECT fe.id, fe.name, u.ai_model_preference
     FROM food_entries fe
     INNER JOIN users u ON u.id = fe.user_id
     WHERE fe.meal_slug IS NULL
     ORDER BY fe.created_at ASC`,
  );

  const total = rows.length;
  console.log(`[backfill-meal-slugs] Rows to process: ${total}${dryRun ? " (dry-run)" : ""}`);

  let n = 0;
  for (const row of rows) {
    n += 1;
    const slug = await resolveMealSlugFromLoggedName(row.name, {
      aiModelPreference: coerceAiModelPreference(row.ai_model_preference),
    });
    console.log(`[${n}/${total}] ${row.id} "${row.name}" -> ${slug}`);
    if (!dryRun) {
      await pool.query(`UPDATE food_entries SET meal_slug = $1 WHERE id = $2`, [slug, row.id]);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!dryRun && total >= 0) {
    await pool.query(
      `INSERT INTO maintenance_jobs (name, completed_at) VALUES ($1, now())
       ON CONFLICT (name) DO UPDATE SET completed_at = excluded.completed_at`,
      [JOB_NAME],
    );
    console.log(`[backfill-meal-slugs] Recorded job "${JOB_NAME}".`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("[backfill-meal-slugs] Failed:", err);
  await pool.end();
  process.exit(1);
});
