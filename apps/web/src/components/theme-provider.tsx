import { MoonIcon, SunIcon } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
    theme: Theme;
    setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === "undefined") {
            return "light";
        }
        return document.documentElement.classList.contains("dark") ? "dark" : "light";
    });

    useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        localStorage.setItem("rustzen-admin-theme", theme);
    }, [theme]);

    return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function ThemeSwitch() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("ThemeSwitch must be rendered inside ThemeProvider");
    }

    const nextTheme = context.theme === "dark" ? "light" : "dark";

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Switch to ${nextTheme} theme`}
            onClick={() => context.setTheme(nextTheme)}
        >
            {context.theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>
    );
}
