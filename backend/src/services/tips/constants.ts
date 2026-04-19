export const TIP_CONFIDENCE_THRESHOLD = 0.6;
export const TIP_MAX_CHARS = 220;
export const PROTEIN_LOW_G = 20;
export const LATE_LOCAL_HOUR = 18;
export const LATE_CAL_FRACTION = 0.55;
export const UNDER_EAT_GOAL_RATIO = 0.78;
export const ERRATIC_CAL_CV = 0.5;
export const ERRATIC_GAP_STDEV_H = 4;

/** Large meal: at least this share of daily goal or absolute kcal. */
export function largeMealThresholdCalorieGoal(calorieGoal: number): number {
  return Math.max(400, calorieGoal * 0.35);
}
