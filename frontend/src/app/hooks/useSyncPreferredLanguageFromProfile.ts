import { useEffect } from "react";
import i18n from "@/i18n";
import { useRootStore } from "@/stores/StoreContext";

/** After profile loads, align i18n with server-stored `preferredLanguage`. */
export function useSyncPreferredLanguageFromProfile(): void {
  const { profile } = useRootStore();

  useEffect(() => {
    const lng = profile.read.profile?.preferredLanguage;
    if (lng && i18n.language !== lng) {
      void i18n.changeLanguage(lng);
    }
  }, [profile.read.profile?.preferredLanguage]);
}
