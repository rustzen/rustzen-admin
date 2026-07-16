import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { appMessage, insightsAPI } from "@/api";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/analytics/settings")({ component: AnalyticsSettingsPage });

function AnalyticsSettingsPage() {
    const queryClient = useQueryClient();
    const { data } = useQuery({
        queryKey: ["insights", "settings"],
        queryFn: insightsAPI.settings,
    });
    const [form, setForm] = useState<Insights.UpdateSettings>({
        eventRetentionDays: 30,
        defaultQueryDays: 7,
        maxQueryDays: 90,
    });
    useEffect(() => {
        if (data)
            setForm({
                eventRetentionDays: data.eventRetentionDays,
                defaultQueryDays: data.defaultQueryDays,
                maxQueryDays: data.maxQueryDays,
            });
    }, [data]);
    const mutation = useMutation({
        mutationFn: insightsAPI.updateSettings,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["insights", "settings"] });
            appMessage.success("Analytics settings saved");
        },
    });
    const field = (key: keyof Insights.UpdateSettings, label: string, hint: string) => (
        <div className="grid gap-2">
            <Label htmlFor={`analytics-${key}`}>{label}</Label>
            <Input
                id={`analytics-${key}`}
                type="number"
                value={form[key]}
                onChange={(event) =>
                    setForm((value) => ({ ...value, [key]: Number(event.target.value) }))
                }
            />
            <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
    );
    return (
        <PageCard
            title="Analytics settings"
            description="Persistent retention and query boundaries. Runtime collection limits are read only."
        >
            <div className="grid max-w-4xl gap-5 md:grid-cols-3">
                {field("eventRetentionDays", "Event retention", "1–3650 days")}
                {field("defaultQueryDays", "Default query range", "1–90 days")}
                {field("maxQueryDays", "Maximum query range", "1–365 days")}
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Batch limit: {data?.maxBatchEvents ?? 100} events · Business timezone:{" "}
                {data?.businessTimezone ?? "UTC"}
            </div>
            <AuthWrap code="insights:settings:manage">
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate(form)}>
                    Save settings
                </Button>
            </AuthWrap>
        </PageCard>
    );
}
