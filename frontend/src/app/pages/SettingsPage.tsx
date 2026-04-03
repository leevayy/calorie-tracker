import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ArrowLeft, Moon, Sun, LogOut } from "lucide-react";
import { AsyncSection } from "../components/AsyncSection";
import { Card } from "../components/ds/Card";
import { Button } from "../components/ds/Button";
import { Input } from "../components/ds/Input";
import { useTheme } from "../components/ThemeProvider";
import { useRequireAuth } from "../hooks/useRequireAuth";
import type { NutritionGoal, PreferredLanguage } from "@contracts/common";
import type { UpdateProfileRequest } from "@contracts/profile";
import { useRootStore } from "@/stores/StoreContext";
import { NUTRITION_GOAL_OPTIONS, coerceNutritionGoal } from "@/utils/nutritionGoal";
import { PREFERRED_LANGUAGE_OPTIONS } from "@/utils/preferredLanguage";

const SettingsPage = observer(function SettingsPage() {
  useRequireAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { session, profile } = useRootStore();

  const darkMode = theme === "dark";

  const [dailyGoal, setDailyGoal] = useState(2000);
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>("en");
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal>("maintain");

  useEffect(() => {
    void profile.read.load();
  }, [profile.read]);

  useEffect(() => {
    const p = profile.read.profile;
    if (!p) return;
    setDailyGoal(p.dailyCalorieGoal);
    setWeight(p.weightKg != null ? String(p.weightKg) : "");
    setHeight(p.heightCm != null ? String(p.heightCm) : "");
    setPreferredLanguage(p.preferredLanguage);
    setNutritionGoal(coerceNutritionGoal(p.nutritionGoal));
  }, [profile.read.profile]);

  const handleSaveProfile = () => {
    const w = weight.trim() === "" ? undefined : Number(weight);
    const h = height.trim() === "" ? undefined : Number(height);
    const body: UpdateProfileRequest = {
      dailyCalorieGoal: dailyGoal,
      preferredLanguage,
      nutritionGoal,
    };
    if (w != null && !Number.isNaN(w) && w > 0) body.weightKg = w;
    if (h != null && !Number.isNaN(h) && h > 0) body.heightCm = h;
    void profile.patch.save(body);
  };

  const handleLogout = () => {
    session.clear();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="p-2 -ml-2 rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl">{t("settings.title")}</h1>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-4">
          <h3 className="mb-4">{t("settings.language")}</h3>
          <label className="text-sm" htmlFor="settings-language">
            {t("settings.languageLabel")}
          </label>
          <select
            id="settings-language"
            className="mt-2 w-full border border-border rounded-[var(--radius)] bg-background text-foreground py-2 px-3 text-sm"
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value as PreferredLanguage)}
          >
            {PREFERRED_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-2">{t("settings.languageHint")}</p>
        </Card>

        <Card className="p-4">
          <h3 className="mb-4">{t("settings.goal")}</h3>
          <label className="text-sm" htmlFor="settings-nutrition-goal">
            {t("settings.goalLabel")}
          </label>
          <select
            id="settings-nutrition-goal"
            className="mt-2 w-full border border-border rounded-[var(--radius)] bg-background text-foreground py-2 px-3 text-sm"
            value={nutritionGoal}
            onChange={(e) => setNutritionGoal(e.target.value as NutritionGoal)}
          >
            {NUTRITION_GOAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-2">{t("settings.goalHint")}</p>
        </Card>

        <Card className="p-4">
          <h3 className="mb-4">{t("settings.appearance")}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? (
                <Moon className="h-5 w-5 text-primary" />
              ) : (
                <Sun className="h-5 w-5 text-primary" />
              )}
              <div>
                <p>{t("settings.darkMode")}</p>
                <p className="text-sm text-muted-foreground">
                  {darkMode ? t("settings.enabled") : t("settings.disabled")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                darkMode ? "bg-primary" : "bg-secondary"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  darkMode ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </Card>

        <AsyncSection
          fetchState={profile.read.fetchState}
          errorKey={profile.read.errorKey}
          onRetry={() => void profile.read.load()}
        >
          <Card className="p-4">
            <h3 className="mb-4">{t("settings.dailyGoals")}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm" htmlFor="settings-calorie-goal">
                  {t("settings.calorieGoal")}
                </label>
                <Input
                  id="settings-calorie-goal"
                  type="number"
                  min={1}
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Number(e.target.value))}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">{t("settings.recommendedCalories")}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-4">{t("settings.profile")}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm" htmlFor="settings-weight">
                  {t("settings.weight")}
                </label>
                <Input
                  id="settings-weight"
                  type="number"
                  min={0}
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="mt-2"
                  placeholder="—"
                />
              </div>
              <div>
                <label className="text-sm" htmlFor="settings-height">
                  {t("settings.height")}
                </label>
                <Input
                  id="settings-height"
                  type="number"
                  min={0}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="mt-2"
                  placeholder="—"
                />
              </div>
              {profile.patch.fetchState === "error" && profile.patch.errorKey ? (
                <p className="text-sm text-destructive" role="alert">
                  {t(profile.patch.errorKey)}
                </p>
              ) : null}
              <Button
                type="button"
                className="w-full"
                onClick={handleSaveProfile}
                loading={profile.patch.fetchState === "loading"}
                disabled={profile.patch.fetchState === "loading"}
              >
                {t("settings.save")}
              </Button>
            </div>
          </Card>
        </AsyncSection>

        <Card className="p-4">
          <h3 className="mb-4">{t("settings.account")}</h3>
          <Button variant="destructive" className="w-full" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {t("settings.signOut")}
          </Button>
        </Card>

        <Card className="p-4">
          <h3 className="mb-2">{t("settings.about")}</h3>
          <p className="text-sm text-muted-foreground">{t("settings.version")}</p>
          <p className="text-sm text-muted-foreground mt-2">{t("settings.aboutBody")}</p>
        </Card>
      </div>
    </div>
  );
});

export default SettingsPage;
