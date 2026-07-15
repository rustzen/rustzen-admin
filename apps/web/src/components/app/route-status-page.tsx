import { useNavigate, useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

interface RouteStatusPageProps {
    code: string;
    title: string;
    description: string;
}

export function RouteStatusPage({ code, title, description }: RouteStatusPageProps) {
    const navigate = useNavigate();
    const { history } = useRouter();

    return (
        <section className="flex h-full min-h-0 flex-col items-center justify-center gap-2 px-4 text-center">
            <h1 className="text-8xl font-bold leading-tight">{code}</h1>
            <h2 className="font-medium">{title}</h2>
            <p className="max-w-md text-muted-foreground">{description}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Button variant="outline" onClick={() => history.go(-1)}>
                    Go Back
                </Button>
                <Button onClick={() => void navigate({ to: "/" })}>Back to Home</Button>
            </div>
        </section>
    );
}
