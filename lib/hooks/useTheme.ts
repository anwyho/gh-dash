"use client";

import { useState, useEffect, useCallback } from "react";

export type ThemePreference = "light" | "dark" | "system";
const LS_KEY = "gh-dash:theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(LS_KEY) as ThemePreference) ?? "system";
  });

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    localStorage.setItem(LS_KEY, t);
    const root = document.documentElement;
    if (t === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.dataset.theme = t;
    }
  }, []);

  // Apply on mount (handles SSR mismatch)
  useEffect(() => {
    const stored = (localStorage.getItem(LS_KEY) as ThemePreference) ?? "system";
    if (stored !== "system") document.documentElement.dataset.theme = stored;
  }, []);

  return { theme, setTheme };
}
