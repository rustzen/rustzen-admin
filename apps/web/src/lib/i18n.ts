export type Locale = "zh-CN" | "en-US";

const LOCALE_STORAGE_KEY = "rustzen-admin-locale";

export const getLocale = (): Locale => {
    if (typeof window === "undefined") {
        return "zh-CN";
    }
    return localStorage.getItem(LOCALE_STORAGE_KEY) === "en-US" ? "en-US" : "zh-CN";
};

export const setLocale = (locale: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    window.location.reload();
};

export const t = (chinese: string, english: string): string =>
    getLocale() === "en-US" ? english : chinese;
