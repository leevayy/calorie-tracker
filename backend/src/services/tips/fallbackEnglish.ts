import { getDayPhaseFromLocalHm, fractionOfLocalDayElapsed } from "./dayPhase.ts";
import { habitSlugCountsFromSlugs, pickSuggestion } from "./mealTemplates.ts";
import type { TipContext } from "./types.ts";

/** Deterministic English for tips / localization input. */
export function buildEnglishFallbackTipMessage(context: TipContext): string {
  const phase = getDayPhaseFromLocalHm(context.localTimeHm);
  const rawDelta = context.calorieGoal - context.consumedCalories;
  const remaining = rawDelta;

  if (phase === "late_night" && context.consumedCalories === 0) {
    return "The day just started — focus on rest and keep logging tomorrow so tips stay on target.";
  }

  if (phase === "late_night") {
    return "It is late — skip heavy eating now; log tomorrow’s meals for better pacing.";
  }

  const pct = Math.round((context.consumedCalories / context.calorieGoal) * 100);
  const delta = Math.round(Math.abs(rawDelta));
  const deltaText =
    rawDelta >= 0 ? `${delta} kcal below your goal` : `${delta} kcal above your goal`;
  const macroLow = context.proteinG < 60;
  const macroTip = macroLow
    ? "Consider adding protein in your next meal."
    : "Your protein intake looks solid today.";
  const communityText =
    context.communityAvgCalories == null
      ? ""
      : ` People in your cohort average ${Math.round(context.communityAvgCalories)} kcal today.`;

  const habits = habitSlugCountsFromSlugs(context.recentLogs.map((l) => l.mealSlug));
  const reco =
    remaining >= 200 && remaining <= 900
      ? pickSuggestion(remaining, habits)
      : null;

  let base = `${pct}% of goal, ${deltaText}. ${macroTip}${communityText}`.trim();

  const dayFrac = fractionOfLocalDayElapsed(context.localTimeHm);
  if (dayFrac >= 0.55 && rawDelta > context.calorieGoal * 0.35) {
    base += " It is getting late locally — plan a solid meal so you do not finish the day short.";
  }

  if (reco) {
    base += ` ${reco}`;
  }

  base += " Log your next meal so tips stay on target.";
  return base;
}
