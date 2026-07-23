import { queryOptions } from "@tanstack/react-query";

import { reportsAPI } from "./api";

export const reportsQueryKeys = {
    systems: () => ["reports", "systems"] as const,
    flows: () => ["reports", "flows"] as const,
};

export const reportsQueryOptions = {
    systems: () =>
        queryOptions({
            queryKey: reportsQueryKeys.systems(),
            queryFn: reportsAPI.systems,
        }),
    flows: () =>
        queryOptions({
            queryKey: reportsQueryKeys.flows(),
            queryFn: () => reportsAPI.flows(),
        }),
};
