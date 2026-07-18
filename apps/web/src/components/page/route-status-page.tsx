import { useNavigate, useRouter } from "@tanstack/react-router";

import { DataState } from "@/components/feedback/data-state";
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
            <DataState
                kind={code === "403" ? "permission" : "error"}
                title={title}
                description={description}
                action={
                    <>
                        <Button variant="outline" onClick={() => history.go(-1)}>
                            返回上一页
                        </Button>
                        <Button onClick={() => void navigate({ to: "/" })}>返回首页</Button>
                    </>
                }
                compact
                className="min-h-0"
            />
        </section>
    );
}
