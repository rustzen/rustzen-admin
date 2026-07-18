import { AlertTriangleIcon, InboxIcon, LoaderCircleIcon, LockKeyholeIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Progress } from "@/components/ui/progress";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataStateKind = "loading" | "empty" | "error" | "permission" | "processing";

interface DataStateProps {
    kind: DataStateKind;
    title: string;
    description?: string;
    action?: ReactNode;
    progress?: number;
    compact?: boolean;
    className?: string;
}

const icons = {
    loading: LoaderCircleIcon,
    empty: InboxIcon,
    error: AlertTriangleIcon,
    permission: LockKeyholeIcon,
    processing: LoaderCircleIcon,
};

export function DataState({
    kind,
    title,
    description,
    action,
    progress,
    compact = false,
    className,
}: DataStateProps) {
    const Icon = icons[kind];
    const busy = kind === "loading" || kind === "processing";

    return (
        <div
            className={cn(
                "flex w-full flex-col items-center justify-center text-center",
                compact
                    ? "min-h-28 gap-2 px-4 py-6"
                    : "min-h-64 gap-3 rounded-lg border border-dashed px-6 py-10",
                kind === "error" && "border-destructive/40 bg-destructive/5",
                kind === "permission" && "border-amber-500/40 bg-amber-500/5",
                className,
            )}
            role={kind === "error" || kind === "permission" ? "alert" : "status"}
            aria-live={busy ? "polite" : undefined}
            aria-busy={busy || undefined}
        >
            <Icon
                className={cn(
                    "size-8 text-muted-foreground",
                    busy && "animate-spin",
                    kind === "error" && "text-destructive",
                    kind === "permission" && "text-amber-600 dark:text-amber-400",
                )}
                aria-hidden="true"
            />
            <div className="space-y-1">
                <p className="font-medium">{title}</p>
                {description ? (
                    <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
                ) : null}
            </div>
            {kind === "processing" && progress !== undefined ? (
                <div className="w-full max-w-sm space-y-1">
                    <Progress value={progress} />
                    <p className="text-xs tabular-nums text-muted-foreground">
                        {Math.round(progress)}%
                    </p>
                </div>
            ) : null}
            {action ? (
                <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>
            ) : null}
        </div>
    );
}

interface DataTableStateProps extends Omit<DataStateProps, "compact"> {
    colSpan: number;
}

export function DataTableState({ colSpan, ...props }: DataTableStateProps) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan} className="p-0">
                <DataState {...props} compact />
            </TableCell>
        </TableRow>
    );
}
