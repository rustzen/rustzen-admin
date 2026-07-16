import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/monitoring")({
    beforeLoad: ({ location }) => {
        if (location.pathname === "/monitoring") {
            throw redirect({ to: "/monitoring/overview" });
        }
    },
    component: Outlet,
});
