import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PageCardProps {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    toolbar?: ReactNode;
    children: ReactNode;
}

export function PageCard({ title, description, actions, toolbar, children }: PageCardProps) {
    return (
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        {description ? <CardDescription>{description}</CardDescription> : null}
                    </div>
                    {actions}
                </div>
                {toolbar}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">{children}</CardContent>
        </Card>
    );
}
