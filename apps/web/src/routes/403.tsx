import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/403")({
    component: RouteComponent,
});

function RouteComponent() {
    const navigate = useNavigate();
    const { history } = useRouter();

    return (
        <div className="flex h-full min-h-0 items-center justify-center">
            <div className="flex w-full flex-col items-center justify-center gap-2 px-4 text-center">
                <h1 className="text-8xl font-bold leading-tight">403</h1>
                <span className="font-medium">Access Forbidden</span>
                <p className="text-muted-foreground">
                    You do not have the necessary permission
                    <br />
                    to view this resource.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-4">
                    <Button variant="outline" onClick={() => history.go(-1)}>
                        Go Back
                    </Button>
                    <Button onClick={() => void navigate({ to: "/" })}>Back to Home</Button>
                </div>
            </div>
        </div>
    );
}
