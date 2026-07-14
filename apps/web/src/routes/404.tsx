import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/404")({
    component: RouteComponent,
});

function RouteComponent() {
    const navigate = useNavigate();
    const { history } = useRouter();

    return (
        <div className="flex h-full min-h-0 items-center justify-center">
            <div className="flex w-full flex-col items-center justify-center gap-2 px-4 text-center">
                <h1 className="text-8xl font-bold leading-tight">404</h1>
                <span className="font-medium">Oops! Page Not Found!</span>
                <p className="text-muted-foreground">
                    It seems like the page you are looking for
                    <br />
                    does not exist or might have been removed.
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
