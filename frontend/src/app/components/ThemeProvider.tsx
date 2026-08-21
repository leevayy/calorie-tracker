import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
export type Appearance = "standard" | "aero";

const APPEARANCE_STORAGE_KEY = "appearance";

function readStoredAppearance(): Appearance {
  try {
    return localStorage.getItem(APPEARANCE_STORAGE_KEY) === "aero" ? "aero" : "standard";
  } catch {
    return "standard";
  }
}

function applyAppearanceToRoot(appearance: Appearance) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.appearance = appearance;
  }
}

// Apply the local appearance as soon as this entry module executes, before the
// provider's first React render.
if (typeof document !== "undefined") {
  applyAppearanceToRoot(readStoredAppearance());
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  toggleAppearance: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [hasUserPreferredTheme, setHasUserPreferredTheme] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("theme");
      return stored === "dark" || stored === "light";
    } catch {
      return false;
    }
  });

  const [theme, setTheme] = useState<Theme>(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      // Ignore storage failures; fall back to system preference.
    }

    if (stored === "dark" || stored === "light") return stored;

    const prefersDark =
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    return prefersDark ? "dark" : "light";
  });

  const [appearance, setAppearanceState] = useState<Appearance>(readStoredAppearance);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.style.colorScheme = theme;
    if (hasUserPreferredTheme) {
      try {
        localStorage.setItem("theme", theme);
      } catch {
        // Ignore storage failures.
      }
    }
  }, [theme, hasUserPreferredTheme]);

  const toggleTheme = () => {
    setHasUserPreferredTheme(true);
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setAppearance = (nextAppearance: Appearance) => {
    setAppearanceState(nextAppearance);
  };

  const toggleAppearance = () => {
    setAppearanceState((current) => (current === "aero" ? "standard" : "aero"));
  };

  useEffect(() => {
    applyAppearanceToRoot(appearance);
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
    } catch {
      // Keep the in-memory appearance usable when storage is unavailable.
    }
  }, [appearance]);

  useEffect(() => {
    if (hasUserPreferredTheme) return;

    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mql) return;

    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };

    // Safari < 14 uses addListener/removeListener.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    } else {
      // @ts-expect-error - Safari legacy API
      mql.addListener(handler);
      // @ts-expect-error - Safari legacy API
      return () => mql.removeListener(handler);
    }
  }, [hasUserPreferredTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, appearance, setAppearance, toggleAppearance }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
