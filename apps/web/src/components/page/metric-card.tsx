import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
    label: ReactNode;
    value: ReactNode;
    icon?: ReactNode;
    hint?: ReactNode;
}

export function MetricCard({ label, value, icon, hint }: MetricCardProps) {
    return (
        <Card className="gap-0 py-0">
            <CardContent className="flex min-h-24 items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                    {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
                </div>
                {icon ? (
                    <div
                        className="shrink-0 text-muted-foreground [&_svg]:size-5"
                        aria-hidden="true"
                    >
                        {icon}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
