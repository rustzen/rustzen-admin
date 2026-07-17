import { MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export type Theme = "light" | "white" | "dark";

const ThemeContext = createContext<{
    theme: Theme;
    setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === "undefined") {
            return "light";
        }
        if (document.documentElement.classList.contains("dark")) {
            return "dark";
        }
        return document.documentElement.classList.contains("white") ? "white" : "light";
    });

    useEffect(() => {
        document.documentElement.classList.toggle("white", theme === "white");
        document.documentElement.classList.toggle("dark", theme === "dark");
        localStorage.setItem("rustzen-admin-theme", theme);
    }, [theme]);

    return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function ThemeSwitch() {
    const context = useTheme();
    const nextTheme: Theme =
        context.theme === "light" ? "white" : context.theme === "white" ? "dark" : "light";
    const labels: Record<Theme, string> = {
        light: "color glass",
        white: "white",
        dark: "dark",
    };
    const icon =
        context.theme === "light" ? (
            <PaletteIcon />
        ) : context.theme === "white" ? (
            <SunIcon />
        ) : (
            <MoonIcon />
        );

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Current theme: ${labels[context.theme]}. Switch to ${labels[nextTheme]} theme`}
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
