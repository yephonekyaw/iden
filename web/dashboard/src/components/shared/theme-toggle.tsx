"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [light, setLight] = React.useState(false);

  React.useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("light");
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("iden-theme", next ? "light" : "dark");
    } catch {}
    setLight(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
