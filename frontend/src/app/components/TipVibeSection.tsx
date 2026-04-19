import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Emoji } from "react-apple-emojis";
import type { TipVibeSlot } from "@contracts/common";
import { TIP_VIBE_PROMPT_MAX } from "@contracts/common";
import { useRootStore } from "@/stores/StoreContext";
import {
  DEFAULT_TIP_VIBE_PROMPTS,
  TIP_VIBE_TILES,
  activeTipVibeSlot,
  appleEmojiNameFor,
  type PresetTipVibeSlot,
} from "@/utils/tipVibe";
import { Card } from "./ds/Card";
import { Button } from "./ds/Button";
import { Text } from "./ds/Text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const EMOJI_TILE_PX = 36;

function TileEmoji({ slot, emoji, appleName, size = EMOJI_TILE_PX }: {
  slot: TipVibeSlot;
  emoji: string | null;
  appleName: string | null;
  size?: number;
}) {
  if (slot === "custom" && !emoji) {
    return <Plus className="text-foreground" style={{ width: size, height: size }} aria-hidden />;
  }
  if (appleName) {
    return <Emoji name={appleName} width={size} />;
  }
  // Custom (AI-picked) emoji not in the apple data: fall back to the unicode glyph.
  return (
    <span
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

export const TipVibeSection = observer(function TipVibeSection() {
  const { t } = useTranslation();
  const { profile } = useRootStore();
  const p = profile.read.profile;

  const tipVibePrompt = p?.tipVibePrompt ?? "";
  const tipVibeEmoji = p?.tipVibeEmoji ?? null;
  const activeSlot = useMemo(() => activeTipVibeSlot(tipVibeEmoji, tipVibePrompt), [tipVibeEmoji, tipVibePrompt]);

  const [openSlot, setOpenSlot] = useState<TipVibeSlot | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("");

  useEffect(() => {
    if (openSlot == null) return;
    if (openSlot === "custom") {
      setDraftPrompt(activeSlot === "custom" ? tipVibePrompt : "");
    } else {
      setDraftPrompt(activeSlot === openSlot ? tipVibePrompt : DEFAULT_TIP_VIBE_PROMPTS[openSlot]);
    }
  }, [openSlot, activeSlot, tipVibePrompt]);

  const isSaving = profile.setTipVibe.fetchState === "loading";
  const isClearing = profile.patch.fetchState === "loading";

  const handleSubmit = async () => {
    if (openSlot == null) return;
    await profile.setTipVibe.save({ slot: openSlot, prompt: draftPrompt });
    if (profile.setTipVibe.fetchState === "success") {
      setOpenSlot(null);
    }
  };

  const handleClear = async () => {
    await profile.patch.save({ clearTipVibe: true });
    if (profile.patch.fetchState === "success") {
      setOpenSlot(null);
    }
  };

  const dialogTile = openSlot ? TIP_VIBE_TILES.find((tile) => tile.slot === openSlot) : null;
  // For the custom dialog, show the currently saved AI-picked emoji (if any) as a hint.
  const dialogEmoji = openSlot === "custom"
    ? (activeSlot === "custom" ? tipVibeEmoji : null)
    : (dialogTile && "emoji" in dialogTile ? dialogTile.emoji : null);
  const dialogAppleName = openSlot === "custom"
    ? appleEmojiNameFor(dialogEmoji)
    : (dialogTile && "appleName" in dialogTile ? dialogTile.appleName : null);

  return (
    <Card className="p-4">
      <Text as="h3" weight="medium" className="mb-1">
        {t("settings.tipVibe.title")}
      </Text>
      <Text variant="muted" className="mb-4">
        {t("settings.tipVibe.description")}
      </Text>

      <div className="flex items-center justify-between gap-2">
        {TIP_VIBE_TILES.map((tile) => {
          const isActive = activeSlot === tile.slot;
          // For custom tile when active, render the AI-picked emoji from the profile.
          const renderEmoji = tile.slot === "custom" && isActive ? tipVibeEmoji : tile.emoji;
          const renderAppleName =
            tile.slot === "custom" && isActive
              ? appleEmojiNameFor(tipVibeEmoji)
              : tile.appleName;
          return (
            <button
              key={tile.slot}
              type="button"
              onClick={() => setOpenSlot(tile.slot)}
              aria-pressed={isActive}
              aria-label={t(tile.labelKey)}
              title={t(tile.labelKey)}
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary transition-all hover:bg-accent ${
                isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
              }`}
            >
              <TileEmoji
                slot={tile.slot}
                emoji={renderEmoji}
                appleName={renderAppleName}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {activeSlot == null ? (
          <Text variant="muted">{t("settings.tipVibe.none")}</Text>
        ) : (
          <Text variant="muted" className="line-clamp-2">
            {t("settings.tipVibe.activePreview", {
              label: t(TIP_VIBE_TILES.find((tile) => tile.slot === activeSlot)!.labelKey),
            })}
          </Text>
        )}
      </div>

      <Dialog open={openSlot != null} onOpenChange={(open) => !open && setOpenSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center">
                <TileEmoji
                  slot={openSlot ?? "custom"}
                  emoji={dialogEmoji}
                  appleName={dialogAppleName}
                  size={28}
                />
              </span>
              <span>{dialogTile ? t(dialogTile.labelKey) : ""}</span>
            </DialogTitle>
            <DialogDescription>{t("settings.tipVibe.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Text as="label" htmlFor="tip-vibe-prompt">
              {t("settings.tipVibe.promptLabel")}
            </Text>
            <textarea
              id="tip-vibe-prompt"
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value.slice(0, TIP_VIBE_PROMPT_MAX))}
              rows={6}
              maxLength={TIP_VIBE_PROMPT_MAX}
              className="w-full resize-y rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-base text-foreground"
              placeholder={
                openSlot === "custom"
                  ? t("settings.tipVibe.customPlaceholder")
                  : ""
              }
            />
            <Text variant="muted">
              {draftPrompt.length} / {TIP_VIBE_PROMPT_MAX}
            </Text>
            {profile.setTipVibe.fetchState === "error" && profile.setTipVibe.errorKey ? (
              <Text variant="error" role="alert">
                {t(profile.setTipVibe.errorKey)}
              </Text>
            ) : null}
          </div>

          <DialogFooter className="sm:justify-between">
            <div className="flex gap-2">
              {activeSlot != null ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handleClear()}
                  loading={isClearing}
                  disabled={isClearing || isSaving}
                >
                  {t("settings.tipVibe.clear")}
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpenSlot(null)}
                disabled={isSaving || isClearing}
              >
                {t("settings.tipVibe.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                loading={isSaving}
                disabled={isSaving || isClearing || draftPrompt.trim().length === 0}
              >
                {t("settings.tipVibe.submit")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
});

// Re-export for type-safety used by the parent (currently unused externally but kept as a hook point).
export type { PresetTipVibeSlot };
