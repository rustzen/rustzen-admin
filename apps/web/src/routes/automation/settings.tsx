import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { appMessage, reportsAPI } from "@/api";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/automation/settings")({ component: SettingsPage });
function SettingsPage() {
    const client = useQueryClient();
    const { data } = useQuery({ queryKey: ["reports", "settings"], queryFn: reportsAPI.settings });
    const [values, setValues] = useState({
        runRetentionDays: "30",
        artifactRetentionDays: "30",
        defaultStepTimeoutSeconds: "30",
        maxRunTimeoutSeconds: "600",
    });
    useEffect(() => {
        if (data)
            setValues({
                runRetentionDays: String(data.runRetentionDays),
                artifactRetentionDays: String(data.artifactRetentionDays),
                defaultStepTimeoutSeconds: String(data.defaultStepTimeoutSeconds),
                maxRunTimeoutSeconds: String(data.maxRunTimeoutSeconds),
            });
    }, [data]);
    const mutation = useMutation({
        mutationFn: reportsAPI.updateSettings,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["reports", "settings"] });
            appMessage.success("Automation settings saved");
        },
    });
    const field = (key: keyof typeof values, label: string) => (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <Input
                type="number"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
        </div>
    );
    return (
        <PageCard
            title="Automation settings"
            description="Retention and execution limits are persisted in the Automation database."
        >
            <div className="grid max-w-3xl gap-6">
                <div className="grid gap-4 rounded-lg border p-5 sm:grid-cols-2">
                    {field("runRetentionDays", "Run retention (days)")}
                    {field("artifactRetentionDays", "Artifact retention (days)")}
                    {field("defaultStepTimeoutSeconds", "Step timeout (seconds)")}
                    {field("maxRunTimeoutSeconds", "Run timeout (seconds)")}
                    <AuthWrap code="reports:settings:manage">
                        <Button
                            className="sm:col-span-2"
                            disabled={!data || mutation.isPending}
                            onClick={() =>
                                mutation.mutate(
                                    Object.fromEntries(
                                        Object.entries(values).map(([k, v]) => [k, Number(v)]),
                                    ) as unknown as Reports.UpdateSettings,
                                )
                            }
                        >
                            Save settings
                        </Button>
                    </AuthWrap>
                </div>
                {data && (
                    <div className="rounded-lg border p-5">
                        <h3 className="mb-3 font-medium">Runtime</h3>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">Concurrency {data.maxConcurrency}</Badge>
                            <Badge variant="outline">
                                {data.headless ? "Headless" : "Visible browser"}
                            </Badge>
                            <Badge variant={data.browserConfigured ? "secondary" : "destructive"}>
                                {data.browserConfigured
                                    ? "Browser configured"
                                    : "Browser auto-detect"}
                            </Badge>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                            Secrets and executable paths are deployment configuration and are never
                            returned.
                        </p>
                    </div>
                )}
            </div>
        </PageCard>
    );
}
