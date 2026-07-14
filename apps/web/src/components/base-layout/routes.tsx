import {
    BookOpenIcon,
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
    | "/monitor"
    | "/insights"
    | "/reports"
    | "/403"
    | "/404"
    | "/system/user"
    | "/system/role"
    | "/system/menu"
    | "/system/status"
    | "/manage/dict"
    | "/manage/log"
    | "/manage/task"
    | "/manage/deploy";

type AppRouteGroupPath = "/system" | "/manage" | "/demo";

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

const moduleRoutes: AppRouteItem[] = [
    { path: "/monitor", name: "Monitor", icon: <MonitorIcon /> },
    { path: "/insights", name: "Insights", icon: <ChartNoAxesCombinedIcon /> },
    { path: "/reports", name: "Reports", icon: <FileTextIcon /> },
];

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
            path: "/system/status",
            name: "System Status",
            icon: <MonitorIcon />,
        },
    ],
};

const manageRoutes: AppRouteItem = {
    name: "Manage",
    icon: <CloudUploadIcon />,
    path: "/manage",
    children: [
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
    "/monitor",
    "/insights",
    "/reports",
    "/403",
    "/404",
    "/system/user",
    "/system/role",
    "/system/menu",
    "/system/status",
    "/manage/dict",
    "/manage/log",
    "/manage/task",
    "/manage/deploy",
]);

export const layoutMenuRoutes: AppRouteItem[] = [
    dashboardRoute,
    ...moduleRoutes,
    systemRoutes,
    manageRoutes,
    demoRoutes,
];

export const layoutSearchRoutes: AppRouteItem[] = [
    dashboardRoute,
    profileRoute,
    ...moduleRoutes,
    systemRoutes,
    manageRoutes,
    demoRoutes,
];

export const getMenuData = (checkMenuPermissions: (path: string) => boolean): AppRouteItem[] => {
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
): SearchRouteItem[] => {
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
