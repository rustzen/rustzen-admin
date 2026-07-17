import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({
    beforeLoad: ({ location }) => {
        if (location.pathname === "/reports") {
            throw redirect({ to: "/reports/templates" });
        }
    },
    component: Outlet,
});
