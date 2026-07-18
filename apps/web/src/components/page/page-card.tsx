import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PageCardProps {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    toolbar?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
}

export function PageCard({
    title,
    description,
    actions,
    toolbar,
    children,
    className,
    contentClassName,
}: PageCardProps) {
    return (
        <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
            <CardHeader className="flex flex-col gap-4 border-b pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <CardTitle className="text-base">{title}</CardTitle>
                        {description ? (
                            <CardDescription className="mt-1">{description}</CardDescription>
                        ) : null}
                    </div>
                    {actions ? (
                        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
                    ) : null}
                </div>
                {toolbar ? (
                    <div className="rounded-lg border bg-muted/35 p-3">{toolbar}</div>
                ) : null}
            </CardHeader>
            <CardContent
                className={cn("flex min-h-0 flex-1 flex-col gap-4 pt-4", contentClassName)}
            >
                {children}
            </CardContent>
        </Card>
    );
}
