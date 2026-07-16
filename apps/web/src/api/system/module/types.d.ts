declare namespace SystemModule {
    type Id = "monitor" | "insights" | "reports";
    type RoutePath =
        | "/monitoring/overview"
        | "/monitoring/nodes"
        | "/monitoring/checks"
        | "/monitoring/incidents"
        | "/monitoring/settings"
        | "/analytics/overview"
        | "/analytics/projects"
        | "/analytics/pages"
        | "/analytics/apis"
        | "/analytics/events"
        | "/analytics/users"
        | "/analytics/settings"
        | "/automation/runs"
        | "/automation/systems"
        | "/automation/flows"
        | "/automation/schedules"
        | "/automation/settings";
    type Icon = "monitor" | "chart-no-axes-combined" | "file-text";

    interface Item {
        id: Id;
        name: string;
        enabled: boolean;
        available: boolean;
        compatible: boolean;
        releaseVersion: string | null;
        lastSeenAt: string | null;
        error: string | null;
    }

    interface NavigationItem {
        module: Id;
        moduleName: string;
        code: string;
        title: string;
        path: RoutePath;
        icon: Icon;
        sortOrder: number;
        permission: string;
    }

    interface UpdateRequest {
        enabled: boolean;
    }
}
