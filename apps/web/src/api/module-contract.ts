export type ModuleApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ModuleApiRoute {
    method: ModuleApiMethod;
    path: string;
}

export function routePath(route: ModuleApiRoute, params: Record<string, string> = {}) {
    return route.path.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name: string) => {
        const value = params[name];
        if (!value) {
            throw new Error(`Missing API route parameter: ${name}`);
        }
        return encodeURIComponent(value);
    });
}
