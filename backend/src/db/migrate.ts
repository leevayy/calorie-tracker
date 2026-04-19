import { pool } from "./client.ts";

const migrationSql = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  daily_calorie_goal real NOT NULL DEFAULT 2000,
  weight_kg real,
  height_cm real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS food_entries (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day text NOT NULL,
  meal_type text NOT NULL,
  name text NOT NULL,
  calories real NOT NULL,
  protein real NOT NULL,
  carbs real NOT NULL,
  fats real NOT NULL,
  portion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_entries_user_day_idx ON food_entries (user_id, day);
CREATE INDEX IF NOT EXISTS food_entries_user_day_meal_idx ON food_entries (user_id, day, meal_type);

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS nutrition_goal text NOT NULL DEFAULT 'maintain';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_model_preference text NOT NULL DEFAULT 'qwen3';
ALTER TABLE users ALTER COLUMN ai_model_preference SET DEFAULT 'qwen3';

ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS meal_slug text;

CREATE TABLE IF NOT EXISTS maintenance_jobs (
  name text PRIMARY KEY,
  completed_at timestamptz NOT NULL DEFAULT now()
);
`;

async function main(): Promise<void> {
  await pool.query(migrationSql);
  await pool.end();
}

main().catch(async (error) => {
  console.error("Migration failed", error);
  await pool.end();
  process.exit(1);
});
