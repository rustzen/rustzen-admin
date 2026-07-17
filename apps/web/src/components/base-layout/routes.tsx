import {
    BookOpenIcon,
    BoxesIcon,
    ChartNoAxesCombinedIcon,
    ClockIcon,
    CloudUploadIcon,
    GaugeIcon,
    HistoryIcon,
    LayoutDashboardIcon,
    MenuIcon,
    MonitorIcon,
    FileTextIcon,
    SettingsIcon,
    ShieldAlertIcon,
    UserIcon,
    UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type AppRoutePath =
    | "/"
    | "/profile"
    | SystemModule.RoutePath
    | "/403"
    | "/404"
    | "/system/user"
    | "/system/role"
    | "/system/menu"
    | "/system/module"
    | "/system/status"
    | "/manage/dict"
    | "/manage/log"
    | "/manage/task"
    | "/manage/deploy";

type AppRouteGroupPath =
    | "/monitoring"
    | "/analytics"
    | "/reports"
    | "/system"
    | "/manage"
    | "/demo";

export type AppRouteItem = {
    name: string;
    icon?: ReactNode;
    path?: AppRoutePath | AppRouteGroupPath;
    children?: AppRouteItem[];
    requiresPermission?: boolean;
};

export type SearchRouteItem = {
    path: AppRoutePath;
    label: string;
    groupLabel: string;
    icon?: ReactNode;
    searchText: string;
};

const dashboardRoute: AppRouteItem = {
    path: "/",
    name: "Dashboard",
    icon: <LayoutDashboardIcon />,
};

const profileRoute: AppRouteItem = {
    path: "/profile",
    name: "Profile",
    icon: <UserIcon />,
    requiresPermission: false,
};

const moduleGroupPaths: Record<SystemModule.Id, AppRouteGroupPath> = {
    monitor: "/monitoring",
    insights: "/analytics",
    reports: "/reports",
};

const moduleIcons: Record<SystemModule.Icon, ReactNode> = {
    monitor: <MonitorIcon />,
    "chart-no-axes-combined": <ChartNoAxesCombinedIcon />,
    "file-text": <FileTextIcon />,
};

const getModuleRoutes = (navigation: SystemModule.NavigationItem[]): AppRouteItem[] => {
    const groups = new Map<SystemModule.Id, AppRouteItem>();
    navigation.forEach((item) => {
        const icon = moduleIcons[item.icon];
        if (!registeredModuleRoutePaths.has(item.path) || !icon) {
            return;
        }
        const group = groups.get(item.module) ?? {
            path: moduleGroupPaths[item.module],
            name: item.moduleName,
            icon,
            children: [],
        };
        group.children?.push({
            path: item.path,
            name: item.title,
            icon,
            requiresPermission: false,
        });
        groups.set(item.module, group);
    });
    return Array.from(groups.values());
};

const systemRoutes: AppRouteItem = {
    name: "System",
    icon: <SettingsIcon />,
    path: "/system",
    children: [
        {
            path: "/system/user",
            name: "User",
            icon: <UserIcon />,
        },
        {
            path: "/system/role",
            name: "Role",
            icon: <UsersIcon />,
        },
        {
            path: "/system/menu",
            name: "Menu",
            icon: <MenuIcon />,
        },
        {
            path: "/manage/dict",
            name: "Dictionary",
            icon: <BookOpenIcon />,
        },
        {
            path: "/manage/log",
            name: "Log",
            icon: <HistoryIcon />,
        },
    ],
};

const manageRoutes: AppRouteItem = {
    name: "Manage",
    icon: <CloudUploadIcon />,
    path: "/manage",
    children: [
        {
            path: "/system/module",
            name: "System Modules",
            icon: <BoxesIcon />,
        },
        {
            path: "/system/status",
            name: "System Status",
            icon: <MonitorIcon />,
        },
        {
            path: "/manage/task",
            name: "Scheduled Task",
            icon: <ClockIcon />,
        },
        {
            path: "/manage/deploy",
            name: "Deploy Versions",
            icon: <CloudUploadIcon />,
        },
    ],
};

const demoRoutes: AppRouteItem = {
    name: "Demo",
    icon: <GaugeIcon />,
    path: "/demo",
    children: [
        {
            path: "/403",
            name: "403",
            icon: <ShieldAlertIcon />,
            requiresPermission: false,
        },
        {
            path: "/404",
            name: "404",
            icon: <ShieldAlertIcon />,
            requiresPermission: false,
        },
    ],
};

const appRoutePaths = new Set<string>([
    "/",
    "/profile",
    "/monitoring/overview",
    "/monitoring/nodes",
    "/monitoring/checks",
    "/analytics/overview",
    "/analytics/details",
    "/reports/templates",
    "/reports/runs",
    "/403",
    "/404",
    "/system/user",
    "/system/role",
    "/system/menu",
    "/system/module",
    "/system/status",
    "/manage/dict",
    "/manage/log",
    "/manage/task",
    "/manage/deploy",
]);

const registeredModuleRoutePaths = new Set<SystemModule.RoutePath>([
    "/monitoring/overview",
    "/monitoring/nodes",
    "/monitoring/checks",
    "/analytics/overview",
    "/analytics/details",
    "/reports/templates",
    "/reports/runs",
]);

export const getMenuData = (
    checkMenuPermissions: (path: string) => boolean,
    moduleNavigation: SystemModule.NavigationItem[],
): AppRouteItem[] => {
    const layoutMenuRoutes: AppRouteItem[] = [
        dashboardRoute,
        ...getModuleRoutes(moduleNavigation),
        systemRoutes,
        manageRoutes,
        demoRoutes,
    ];
    const getMenuList = (menuList: AppRouteItem[]): AppRouteItem[] => {
        return menuList
            .filter((item) => {
                if (!item.path) return false;
                if (item.requiresPermission === false) return true;
                if (item.children) return true;
                return checkMenuPermissions(item.path);
            })
            .map((item) => ({
                ...item,
                children: item.children ? getMenuList(item.children) : undefined,
            }))
            .filter((item) => {
                if (item.children?.length === 0) {
                    return false;
                }
                return true;
            });
    };

    return getMenuList(layoutMenuRoutes);
};

export const getSearchRouteItems = (
    checkMenuPermissions: (path: string) => boolean,
    moduleNavigation: SystemModule.NavigationItem[],
): SearchRouteItem[] => {
    const layoutSearchRoutes: AppRouteItem[] = [
        dashboardRoute,
        profileRoute,
        ...getModuleRoutes(moduleNavigation),
        systemRoutes,
        manageRoutes,
        demoRoutes,
    ];
    const flattenRoutes = (routes: AppRouteItem[], groupLabel = "General"): SearchRouteItem[] => {
        return routes.flatMap((route) => {
            if (route.children) {
                return flattenRoutes(route.children, route.name);
            }

            if (!isAppRoutePath(route.path)) {
                return [];
            }

            if (route.requiresPermission !== false && !checkMenuPermissions(route.path)) {
                return [];
            }

            return [
                {
                    path: route.path,
                    label: route.name,
                    groupLabel,
                    icon: route.icon,
                    searchText: [route.name, route.path, groupLabel].join(" ").toLowerCase(),
                },
            ];
        });
    };

    return flattenRoutes(layoutSearchRoutes);
};

const isAppRoutePath = (path: AppRouteItem["path"]): path is AppRoutePath => {
    return Boolean(path && appRoutePaths.has(path));
};
