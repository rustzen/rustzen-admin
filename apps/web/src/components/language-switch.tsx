import { LanguagesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setLocale, t, useLocale } from "@/lib/i18n";

export function LanguageSwitch() {
    const locale = useLocale();
    const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("切换为英文", "Switch to Chinese")}
            title={nextLocale === "en-US" ? "English" : "简体中文"}
            onClick={() => setLocale(nextLocale)}
        >
            <LanguagesIcon />
        </Button>
    );
}
