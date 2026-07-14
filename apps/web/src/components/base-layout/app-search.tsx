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
                className="h-9 w-45 justify-start gap-2 px-3 text-muted-foreground"
                onClick={() => setOpen(true)}
                aria-label="Open page search"
            >
                <SearchIcon data-icon="inline-start" />
                <span className="min-w-0 flex-1 truncate text-left">Search</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs leading-none text-muted-foreground">
                    ⌘ K
                </kbd>
            </Button>

            <CommandDialog
                open={open}
                onOpenChange={setOpen}
                title="Search pages"
                description="Type a page name or path to navigate."
            >
                <CommandInput placeholder="Type a page name or path..." />
                <CommandList>
                    <CommandEmpty>No pages found.</CommandEmpty>
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
