import { queryOptions } from "@tanstack/react-query";

import { menuAPI } from "./api";

export const menuQueryKeys = {
    options: () => ["system", "menus", "options"] as const,
};

export const menuQueryOptions = {
    options: () =>
        queryOptions({
            queryKey: menuQueryKeys.options(),
            queryFn: menuAPI.options,
        }),
};
