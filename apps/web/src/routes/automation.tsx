import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/automation")({
    beforeLoad: ({ location }) => {
        if (location.pathname === "/automation") {
            throw redirect({ to: "/automation/runs" });
        }
    },
    component: Outlet,
});
