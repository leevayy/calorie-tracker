import { describe, expect, it } from "vitest";
import { fractionOfLocalDayElapsed, getDayPhaseFromLocalHm } from "./dayPhase.ts";

describe("dayPhase", () => {
  it("classifies late night and day segments", () => {
    expect(getDayPhaseFromLocalHm("02:30")).toBe("late_night");
    expect(getDayPhaseFromLocalHm("04:00")).toBe("morning");
    expect(getDayPhaseFromLocalHm("14:00")).toBe("day");
    expect(getDayPhaseFromLocalHm("20:00")).toBe("evening");
  });

  it("fractionOfLocalDayElapsed is 0–1", () => {
    expect(fractionOfLocalDayElapsed("00:00")).toBe(0);
    expect(fractionOfLocalDayElapsed("12:00")).toBeCloseTo(0.5, 5);
    expect(fractionOfLocalDayElapsed("23:59")).toBeLessThan(1.001);
  });
});
