import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
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
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
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
