import { MoonIcon, SunIcon } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "rustzen-admin-theme";

function readStoredTheme(): Theme {
    if (typeof window === "undefined") {
        return "light";
    }

    try {
        return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch {
        return "light";
    }
}

const ThemeContext = createContext<{
    theme: Theme;
    setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(readStoredTheme);

    useEffect(() => {
        document.documentElement.classList.remove("white");
        document.documentElement.classList.toggle("dark", theme === "dark");
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // The selected theme still applies when storage is unavailable.
        }
    }, [theme]);

    return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function ThemeSwitch() {
    const context = useTheme();
    const nextTheme: Theme = context.theme === "light" ? "dark" : "light";
    const labels: Record<Theme, string> = {
        light: t("亮色", "Light"),
        dark: t("暗色", "Dark"),
    };
    const icon = context.theme === "light" ? <MoonIcon /> : <SunIcon />;

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t(
                `当前主题：${labels[context.theme]}。切换到${labels[nextTheme]}主题`,
                `Current theme: ${labels[context.theme]}. Switch to ${labels[nextTheme]} theme`,
            )}
            onClick={() => context.setTheme(nextTheme)}
        >
            {icon}
        </Button>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used inside ThemeProvider");
    }
    return context;
}
