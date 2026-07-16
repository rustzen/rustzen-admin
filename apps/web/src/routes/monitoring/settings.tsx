import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { appMessage, monitorAPI } from "@/api";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/monitoring/settings")({
    component: MonitoringSettingsPage,
});

const fields: Array<{
    key: keyof Monitor.UpdateSettings;
    label: string;
    hint: string;
}> = [
    { key: "offlineAfterSeconds", label: "Offline after", hint: "30–3600 seconds" },
    { key: "metricsRetentionDays", label: "Metric retention", hint: "1–365 days" },
    {
        key: "checkResultRetentionDays",
        label: "Check-result retention",
        hint: "1–365 days",
    },
    {
        key: "defaultCheckIntervalSeconds",
        label: "Default check interval",
        hint: "30–86400 seconds",
    },
    { key: "defaultCheckTimeoutMs", label: "Default check timeout", hint: "100–30000 ms" },
    { key: "failureThreshold", label: "Failure threshold", hint: "1–20 samples" },
    { key: "cpuThresholdPercent", label: "CPU threshold", hint: "1–100%" },
    { key: "memoryThresholdPercent", label: "Memory threshold", hint: "1–100%" },
    { key: "diskThresholdPercent", label: "Disk threshold", hint: "1–100%" },
];

function MonitoringSettingsPage() {
    const queryClient = useQueryClient();
    const { data } = useQuery({
        queryKey: ["monitor", "settings"],
        queryFn: monitorAPI.settings,
    });
    const [values, setValues] = useState<Monitor.UpdateSettings | null>(null);
    useEffect(() => {
        if (data) {
            const { updatedAt: _, ...settings } = data;
            setValues(settings);
        }
    }, [data]);
    const mutation = useMutation({
        mutationFn: monitorAPI.updateSettings,
        onSuccess: async (settings) => {
            await queryClient.invalidateQueries({ queryKey: ["monitor"] });
            const { updatedAt: _, ...nextValues } = settings;
            setValues(nextValues);
            appMessage.success("Monitoring settings saved");
        },
    });

    return (
        <PageCard
            title="Monitoring settings"
            description="Persistent thresholds and retention settings used by the controller."
        >
            {values ? (
                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto">
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {fields.map((field) => (
                            <div key={field.key} className="grid gap-2">
                                <Label htmlFor={field.key}>{field.label}</Label>
                                <Input
                                    id={field.key}
                                    type="number"
                                    value={values[field.key]}
                                    onChange={(event) =>
                                        setValues({
                                            ...values,
                                            [field.key]: Number(event.target.value),
                                        })
                                    }
                                />
                                <p className="text-xs text-muted-foreground">{field.hint}</p>
                            </div>
                        ))}
                    </div>
                    <AuthWrap code="monitor:settings:manage">
                        <div>
                            <Button
                                disabled={mutation.isPending}
                                onClick={() => mutation.mutate(values)}
                            >
                                Save settings
                            </Button>
                        </div>
                    </AuthWrap>
                </div>
            ) : (
                <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                    Loading settings...
                </div>
            )}
        </PageCard>
    );
}
