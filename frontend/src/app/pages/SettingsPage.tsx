import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ArrowLeft, Moon, Sun, LogOut } from "lucide-react";
import { AsyncSection } from "../components/AsyncSection";
import { Card } from "../components/ds/Card";
import { Button } from "../components/ds/Button";
import { Input } from "../components/ds/Input";
import { Text } from "../components/ds/Text";
import { useTheme } from "../components/ThemeProvider";
import { useRequireAuth } from "../hooks/useRequireAuth";
import type { AiModelPreference, NutritionGoal, PreferredLanguage } from "@contracts/common";
import type { UpdateProfileRequest } from "@contracts/profile";
import { useRootStore } from "@/stores/StoreContext";
import { AI_MODEL_PREFERENCE_OPTIONS, coerceAiModelPreference } from "@/utils/aiModelPreference";
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
  const [aiModelPreference, setAiModelPreference] = useState<AiModelPreference>("qwen3");

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
    setAiModelPreference(coerceAiModelPreference(p.aiModelPreference));
  }, [profile.read.profile]);

  const handleSaveProfile = () => {
    const w = weight.trim() === "" ? undefined : Number(weight);
    const h = height.trim() === "" ? undefined : Number(height);
    const body: UpdateProfileRequest = {
      dailyCalorieGoal: dailyGoal,
      preferredLanguage,
      nutritionGoal,
      aiModelPreference,
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
        <Text as="h1" size="xl" weight="medium">
          {t("settings.title")}
        </Text>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-4">
          <Text as="h3" weight="medium" className="mb-4">
            {t("settings.language")}
          </Text>
          <Text as="label" htmlFor="settings-language">
            {t("settings.languageLabel")}
          </Text>
          <select
            id="settings-language"
            className="mt-2 w-full border border-border rounded-[var(--radius)] bg-background text-foreground py-2 px-3 text-base"
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value as PreferredLanguage)}
          >
            {PREFERRED_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          <Text variant="muted" className="mt-2">
            {t("settings.languageHint")}
          </Text>
        </Card>

        <Card className="p-4">
          <Text as="h3" weight="medium" className="mb-4">
            {t("settings.goal")}
          </Text>
          <Text as="label" htmlFor="settings-nutrition-goal">
            {t("settings.goalLabel")}
          </Text>
          <select
            id="settings-nutrition-goal"
            className="mt-2 w-full border border-border rounded-[var(--radius)] bg-background text-foreground py-2 px-3 text-base"
            value={nutritionGoal}
            onChange={(e) => setNutritionGoal(e.target.value as NutritionGoal)}
          >
            {NUTRITION_GOAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          <Text variant="muted" className="mt-2">
            {t("settings.goalHint")}
          </Text>
        </Card>

        <Card className="p-4">
          <Text as="h3" weight="medium" className="mb-4">
            {t("settings.aiModel")}
          </Text>
          <Text as="label" htmlFor="settings-ai-model">
            {t("settings.aiModelLabel")}
          </Text>
          <select
            id="settings-ai-model"
            className="mt-2 w-full border border-border rounded-[var(--radius)] bg-background text-foreground py-2 px-3 text-base"
            value={aiModelPreference}
            onChange={(e) => setAiModelPreference(e.target.value as AiModelPreference)}
          >
            {AI_MODEL_PREFERENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          <Text variant="muted" className="mt-2">
            {t("settings.aiModelHint")}
          </Text>
        </Card>

        <Card className="p-4">
          <Text as="h3" weight="medium" className="mb-4">
            {t("settings.appearance")}
          </Text>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? (
                <Moon className="h-5 w-5 text-primary" />
              ) : (
                <Sun className="h-5 w-5 text-primary" />
              )}
              <div>
                <Text>{t("settings.darkMode")}</Text>
                <Text variant="muted">{darkMode ? t("settings.enabled") : t("settings.disabled")}</Text>
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
            <Text as="h3" weight="medium" className="mb-4">
              {t("settings.dailyGoals")}
            </Text>
            <div className="space-y-4">
              <div>
                <Text as="label" htmlFor="settings-calorie-goal">
                  {t("settings.calorieGoal")}
                </Text>
                <Input
                  id="settings-calorie-goal"
                  type="number"
                  min={1}
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Number(e.target.value))}
                  className="mt-2"
                />
                <Text variant="muted" className="mt-1">
                  {t("settings.recommendedCalories")}
                </Text>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <Text as="h3" weight="medium" className="mb-4">
              {t("settings.profile")}
            </Text>
            <div className="space-y-4">
              <div>
                <Text as="label" htmlFor="settings-weight">
                  {t("settings.weight")}
                </Text>
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
                <Text as="label" htmlFor="settings-height">
                  {t("settings.height")}
                </Text>
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
                <Text variant="error" role="alert">
                  {t(profile.patch.errorKey)}
                </Text>
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
          <Text as="h3" weight="medium" className="mb-4">
            {t("settings.account")}
          </Text>
          <Button variant="destructive" className="w-full" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {t("settings.signOut")}
          </Button>
        </Card>

        <Card className="p-4">
          <Text as="h3" weight="medium" className="mb-2">
            {t("settings.about")}
          </Text>
          <Text variant="muted">{t("settings.version")}</Text>
          <Text variant="muted" className="mt-2">
            {t("settings.aboutBody")}
          </Text>
        </Card>
      </div>
    </div>
  );
});

export default SettingsPage;
