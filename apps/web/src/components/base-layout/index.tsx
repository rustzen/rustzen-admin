import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { LogOutIcon, UserIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { appMessage, authAPI } from "@/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ThemeSwitch } from "@/components/theme-provider";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { APP_BRAND_NAME } from "@/constant/brand";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

import { AppSearch } from "./app-search";
import { getMenuData, getSearchRouteItems, type AppRouteItem, type AppRoutePath } from "./routes";

interface BaseLayoutProps {
    children: ReactNode;
    hidden?: boolean;
}

export const BaseLayout = ({ children, hidden = false }: BaseLayoutProps) => {
    const userInfo = useAuthStore((state) => state.userInfo);
    const clearAuth = useAuthStore((state) => state.clearAuth);
    const checkMenuPermissions = useAuthStore((state) => state.checkMenuPermissions);
    const menuPermissionSignature = useAuthStore(
        (state) => state.userInfo?.permissions?.join("|") || "",
    );
    const router = useRouter();
    const currentPath = useLocation().pathname;

    const menuData = useMemo(
        () => getMenuData(checkMenuPermissions),
        [checkMenuPermissions, menuPermissionSignature],
    );

    const searchRoutes = useMemo(
        () => getSearchRouteItems(checkMenuPermissions),
        [checkMenuPermissions, menuPermissionSignature],
    );

    const handleSearchSelect = (path: AppRoutePath) => {
        void router.navigate({ to: path });
    };

    const handleLogout = async () => {
        await authAPI.logout();
        clearAuth();
        appMessage.success("Logout successful");
        void router.navigate({ to: "/login" });
    };

    if (hidden) {
        return children;
    }

    return (
        <SidebarProvider>
            <Sidebar variant="inset" collapsible="icon">
                <SidebarHeader>
                    <Link
                        to="/"
                        className="flex h-12 items-center gap-2 rounded-md px-2 text-sidebar-foreground"
                    >
                        <img src="/rustzen.png" alt="" className="size-8 rounded-md" />
                        <div className="grid min-w-0 text-left leading-tight group-data-[collapsible=icon]:hidden">
                            <span className="truncate text-sm font-semibold">{APP_BRAND_NAME}</span>
                            <span className="truncate text-xs text-muted-foreground">
                                Admin Console
                            </span>
                        </div>
                    </Link>
                </SidebarHeader>

                <SidebarContent>
                    <AppSidebarMenu items={menuData} currentPath={currentPath} />
                </SidebarContent>

                <SidebarFooter>
                    <UserMenu userInfo={userInfo} onLogout={handleLogout} />
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>

            <SidebarInset className="h-screen overflow-hidden">
                <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4">
                    <SidebarTrigger variant="outline" />
                    <Separator orientation="vertical" className="h-6" />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                            {currentPageTitle(menuData, currentPath) ?? APP_BRAND_NAME}
                        </div>
                    </div>
                    <AppSearch routes={searchRoutes} onSelect={handleSearchSelect} />
                    <ThemeSwitch />
                    <UserMenuTrigger userInfo={userInfo} onLogout={handleLogout} />
                </header>

                <main className="min-h-0 flex-1 overflow-hidden bg-muted/30 p-4">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
};

const AppSidebarMenu = ({
    items,
    currentPath,
}: {
    items: AppRouteItem[];
    currentPath: string;
}) => (
    <>
        {items.map((group) => {
            if (!group.children?.length) {
                return (
                    <SidebarGroup key={group.path ?? group.name}>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={group.path === currentPath}
                                        tooltip={group.name}
                                    >
                                        <Link to={group.path as AppRoutePath}>
                                            {group.icon}
                                            <span>{group.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                );
            }

            return (
                <SidebarGroup key={group.name}>
                    <SidebarGroupLabel className="gap-2">
                        {group.icon}
                        <span>{group.name}</span>
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuSub>
                                    {group.children.map((item) => (
                                        <SidebarMenuSubItem key={item.path ?? item.name}>
                                            <SidebarMenuSubButton
                                                asChild
                                                isActive={item.path === currentPath}
                                            >
                                                <Link to={item.path as AppRoutePath}>
                                                    {item.icon}
                                                    <span>{item.name}</span>
                                                </Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                    ))}
                                </SidebarMenuSub>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            );
        })}
    </>
);

const UserMenu = ({
    userInfo,
    onLogout,
}: {
    userInfo: Auth.UserInfoResponse | null;
    onLogout: () => void;
}) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                        <UserAvatar userInfo={userInfo} />
                        <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium">
                                {userInfo?.realName || userInfo?.username || "Account"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                                {userInfo?.username || "Profile"}
                            </span>
                        </div>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </DropdownMenuTrigger>
        <UserMenuContent userInfo={userInfo} onLogout={onLogout} />
    </DropdownMenu>
);

const UserMenuTrigger = ({
    userInfo,
    onLogout,
}: {
    userInfo: Auth.UserInfoResponse | null;
    onLogout: () => void;
}) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-9 rounded-full p-0">
                <UserAvatar userInfo={userInfo} />
                <span className="sr-only">Open account menu</span>
            </Button>
        </DropdownMenuTrigger>
        <UserMenuContent userInfo={userInfo} onLogout={onLogout} />
    </DropdownMenu>
);

const UserMenuContent = ({
    userInfo,
    onLogout,
}: {
    userInfo: Auth.UserInfoResponse | null;
    onLogout: () => void;
}) => (
    <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
                <p className="text-sm font-medium leading-none">
                    {userInfo?.realName || userInfo?.username || "Account"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                    {userInfo?.username || "Profile"}
                </p>
            </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
            <DropdownMenuItem asChild>
                <Link to="/profile">
                    <UserIcon />
                    Profile
                </Link>
            </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} variant="destructive">
            <LogOutIcon />
            Logout
        </DropdownMenuItem>
    </DropdownMenuContent>
);

const UserAvatar = ({
    userInfo,
    className,
}: {
    userInfo: Auth.UserInfoResponse | null;
    className?: string;
}) => (
    <Avatar className={cn("size-8 rounded-lg", className)}>
        <AvatarImage
            src={userInfo?.avatarUrl ?? undefined}
            alt={userInfo?.realName || userInfo?.username || ""}
        />
        <AvatarFallback className="rounded-lg">{avatarFallback(userInfo)}</AvatarFallback>
    </Avatar>
);

const avatarFallback = (userInfo: Auth.UserInfoResponse | null) => {
    const displayName = userInfo?.realName || userInfo?.username || "RA";
    return displayName.slice(0, 2).toUpperCase();
};

const currentPageTitle = (items: AppRouteItem[], currentPath: string): string | undefined => {
    for (const item of items) {
        if (item.path === currentPath) {
            return item.name;
        }
        if (item.children) {
            const childTitle = currentPageTitle(item.children, currentPath);
            if (childTitle) {
                return childTitle;
            }
        }
    }
    return undefined;
};
