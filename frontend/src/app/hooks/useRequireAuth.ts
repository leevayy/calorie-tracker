import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useRootStore } from "@/stores/StoreContext";
import { useSyncPreferredLanguageFromProfile } from "./useSyncPreferredLanguageFromProfile";

export function useRequireAuth(): void {
  const navigate = useNavigate();
  const { session } = useRootStore();

  useSyncPreferredLanguageFromProfile();

  useEffect(() => {
    if (!session.isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [session.isAuthenticated, navigate]);
}
