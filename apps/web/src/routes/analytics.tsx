import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/analytics")({
    beforeLoad: ({ location }) => {
        if (location.pathname === "/analytics") {
            throw redirect({ to: "/analytics/overview" });
        }
    },
    component: Outlet,
});
