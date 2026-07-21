import { useNavigate, useRouter } from "@tanstack/react-router";

import { DataState } from "@/components/feedback/data-state";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

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
                            {t("返回上一页", "Go back")}
                        </Button>
                        <Button onClick={() => void navigate({ to: "/" })}>
                            {t("返回首页", "Back to home")}
                        </Button>
                    </>
                }
                compact
                className="min-h-0"
            />
        </section>
    );
}
