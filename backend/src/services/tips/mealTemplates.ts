export type MealTemplateTag = "quick" | "balanced" | "heavy" | "junk";

export type MealTemplate = {
  slug: string;
  avgCalories: number;
  proteinRange: [number, number];
  tags: MealTemplateTag[];
  /** English label for tips. */
  label: string;
};

const TEMPLATES: MealTemplate[] = [
  { slug: "chicken-salad", avgCalories: 320, proteinRange: [25, 40], tags: ["balanced"], label: "a chicken salad" },
  { slug: "yogurt-fruit", avgCalories: 280, proteinRange: [10, 18], tags: ["quick", "balanced"], label: "yogurt with fruit" },
  { slug: "egg-sandwich", avgCalories: 350, proteinRange: [18, 28], tags: ["quick"], label: "an egg sandwich" },
  { slug: "pizza", avgCalories: 650, proteinRange: [20, 30], tags: ["heavy", "junk"], label: "a small pizza slice" },
  { slug: "beef-burger", avgCalories: 550, proteinRange: [28, 40], tags: ["heavy"], label: "a small beef burger" },
  { slug: "fish-rice", avgCalories: 480, proteinRange: [28, 38], tags: ["balanced"], label: "fish with rice" },
  { slug: "tofu-salad", avgCalories: 300, proteinRange: [15, 25], tags: ["balanced"], label: "tofu salad" },
  { slug: "chicken-sandwich", avgCalories: 420, proteinRange: [28, 38], tags: ["balanced"], label: "a chicken sandwich" },
];

const SLACK = 80;

function scoreTemplate(t: MealTemplate, habitSlugs: Record<string, number>): number {
  const habit = habitSlugs[t.slug] ?? 0;
  const proteinMid = (t.proteinRange[0] + t.proteinRange[1]) / 2;
  const quickBonus = t.tags.includes("quick") ? 0.5 : 0;
  const balancedBonus = t.tags.includes("balanced") ? 0.3 : 0;
  return habit * 3 + proteinMid / 40 + quickBonus + balancedBonus;
}

/**
 * English fragment suggesting one or two concrete options within calorie budget.
 */
export function pickSuggestion(remainingKcal: number, habitSlugs: Record<string, number>): string | null {
  if (!Number.isFinite(remainingKcal) || remainingKcal < 180) return null;

  const candidates = TEMPLATES.filter((t) => t.avgCalories <= remainingKcal + SLACK).sort(
    (a, b) => scoreTemplate(b, habitSlugs) - scoreTemplate(a, habitSlugs),
  );
  if (candidates.length === 0) return null;

  const first = candidates[0]!;
  const second = candidates.find((c) => c.slug !== first.slug);
  const low = Math.max(150, Math.round(remainingKcal * 0.55));
  const high = Math.round(Math.min(remainingKcal, first.avgCalories + 60));
  if (second) {
    return `Try something like ${first.label} or ${second.label} (~${low}–${high} kcal).`;
  }
  return `Try something like ${first.label} (~${low}–${high} kcal).`;
}

export function habitSlugCountsFromSlugs(slugs: (string | null | undefined)[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of slugs) {
    if (!s || s === "unknown") continue;
    m[s] = (m[s] ?? 0) + 1;
  }
  return m;
}
