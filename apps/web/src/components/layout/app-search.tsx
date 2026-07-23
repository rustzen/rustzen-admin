import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { t } from "@/lib/i18n";

import type { AppRoutePath, SearchRouteItem } from "./routes";

interface AppSearchProps {
    routes: SearchRouteItem[];
    onSelect: (path: AppRoutePath) => void;
}

export const AppSearch = ({ routes, onSelect }: AppSearchProps) => {
    const [open, setOpen] = useState(false);
    const groupedRoutes = useMemo(() => {
        return routes.reduce<Record<string, SearchRouteItem[]>>((groups, route) => {
            groups[route.groupLabel] = groups[route.groupLabel] ?? [];
            groups[route.groupLabel].push(route);
            return groups;
        }, {});
    }, [routes]);

    useEffect(() => {
        const handleShortcut = (event: globalThis.KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen(true);
            }
        };

        window.addEventListener("keydown", handleShortcut);
        return () => window.removeEventListener("keydown", handleShortcut);
    }, []);

    const selectRoute = (route: SearchRouteItem) => {
        setOpen(false);
        onSelect(route.path);
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                className="size-9 shrink-0 justify-center px-0 text-muted-foreground sm:w-45 sm:justify-start sm:gap-2 sm:px-3 xl:w-90"
                onClick={() => setOpen(true)}
                aria-label={t("打开页面搜索", "Open page search")}
            >
                <SearchIcon data-icon="inline-start" />
                <span className="hidden min-w-0 flex-1 truncate text-left sm:inline">
                    {t("搜索", "Search")}
                </span>
                <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-xs leading-none text-muted-foreground sm:inline">
                    ⌘ K
                </kbd>
            </Button>

            <CommandDialog
                open={open}
                onOpenChange={setOpen}
                title={t("搜索页面", "Search pages")}
                description={t(
                    "输入页面名称或路径进行跳转。",
                    "Type a page name or path to navigate.",
                )}
            >
                <CommandInput
                    placeholder={t("输入页面名称或路径...", "Type a page name or path...")}
                />
                <CommandList>
                    <CommandEmpty>{t("未找到页面。", "No pages found.")}</CommandEmpty>
                    {Object.entries(groupedRoutes).map(([groupLabel, groupRoutes]) => (
                        <CommandGroup key={groupLabel} heading={groupLabel}>
                            {groupRoutes.map((route) => (
                                <CommandItem
                                    key={route.path}
                                    value={route.searchText}
                                    onSelect={() => selectRoute(route)}
                                >
                                    {route.icon}
                                    <span className="min-w-0 flex-1 truncate">{route.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {route.path}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
                </CommandList>
            </CommandDialog>
        </>
    );
};
