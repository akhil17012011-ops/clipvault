import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "cliptic.theme";

/** Current theme, read from the DOM (set pre-paint by the inline head script). */
function readTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Persist + apply a theme without waiting for React. */
function persistTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

/**
 * Sun/moon switcher shared by the landing nav and the dashboard top bar.
 * The `<head>` script applies the saved theme before first paint; this
 * component only flips and remembers the choice.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">(readTheme);

  useEffect(() => {
    persistTheme(theme);
  }, [theme]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      className={`h-9 w-9 shrink-0 rounded-full border border-black/10 text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand dark:border-white/15 ${className}`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
