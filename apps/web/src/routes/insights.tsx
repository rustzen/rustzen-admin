import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3Icon, KeyRoundIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { appMessage, insightsAPI } from "@/api";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/insights")({ component: InsightsPage });

function InsightsPage() {
    const { data: projects = [] } = useQuery({
        queryKey: ["insights", "projects"],
        queryFn: insightsAPI.projects,
    });
    const [projectId, setProjectId] = useState("");

    useEffect(() => {
        if (!projectId && projects[0]) setProjectId(projects[0].id);
    }, [projectId, projects]);

    const { data: overview } = useQuery({
        queryKey: ["insights", "overview", projectId],
        queryFn: () => insightsAPI.overview({ projectId }),
        enabled: Boolean(projectId),
        refetchInterval: 30_000,
    });

    return (
        <PageCard
            title="Insights"
            description="Privacy-focused page views and API request telemetry."
            actions={
                <AuthWrap code="insights:manage">
                    <CreateProjectDialog />
                </AuthWrap>
            }
        >
            <div className="mb-5 flex max-w-sm flex-col gap-2">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                        {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                                {project.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {projectId ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <InsightMetric label="Page views" value={overview?.pv ?? 0} />
                    <InsightMetric label="Unique visitors" value={overview?.uv ?? 0} />
                    <InsightMetric label="API requests" value={overview?.requestCount ?? 0} />
                    <InsightMetric label="Errors" value={overview?.errorCount ?? 0} />
                    <InsightMetric
                        label="Average duration"
                        value={`${Math.round(overview?.averageDurationMs ?? 0)} ms`}
                    />
                    <InsightMetric
                        label="P95 duration"
                        value={`${overview?.p95DurationMs ?? 0} ms`}
                    />
                </div>
            ) : (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground">
                    <BarChart3Icon className="mb-3 size-8" />
                    <p>Create a project to start collecting Insights events.</p>
                    <p className="mt-1 text-xs">No analytics compatibility endpoint is enabled.</p>
                </div>
            )}
        </PageCard>
    );
}

function InsightMetric({ label, value }: { label: string; value: number | string }) {
    return (
        <Card className="gap-3 py-4">
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">{value}</CardContent>
        </Card>
    );
}

function CreateProjectDialog() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [origins, setOrigins] = useState("");
    const [projectKey, setProjectKey] = useState("");
    const mutation = useMutation({
        mutationFn: insightsAPI.createProject,
        onSuccess: async (project) => {
            setProjectKey(project.projectKey);
            await queryClient.invalidateQueries({ queryKey: ["insights", "projects"] });
            appMessage.success("Insights project created");
        },
    });

    const submit = () => {
        if (!name.trim()) return;
        mutation.mutate({
            name: name.trim(),
            allowedOrigins: origins
                .split("\n")
                .map((value) => value.trim())
                .filter(Boolean),
        });
    };

    const reset = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setName("");
            setOrigins("");
            setProjectKey("");
            mutation.reset();
        }
    };

    return (
        <Dialog open={open} onOpenChange={reset}>
            <DialogTrigger asChild>
                <Button>
                    <PlusIcon /> New project
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Insights project</DialogTitle>
                    <DialogDescription>
                        The project key is shown once. Tracking uses only /api/insights/track.
                    </DialogDescription>
                </DialogHeader>
                {projectKey ? (
                    <div className="rounded-lg border bg-muted/40 p-4">
                        <div className="mb-2 flex items-center gap-2 font-medium">
                            <KeyRoundIcon /> Project key
                        </div>
                        <code className="block break-all rounded bg-background p-3 text-sm">
                            {projectKey}
                        </code>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="insights-name">Name</Label>
                            <Input
                                id="insights-name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="insights-origins">Allowed origins</Label>
                            <Textarea
                                id="insights-origins"
                                className="min-h-24"
                                placeholder="https://example.com\nhttps://app.example.com"
                                value={origins}
                                onChange={(event) => setOrigins(event.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                One exact origin per line.
                            </p>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    {projectKey ? (
                        <Button onClick={() => reset(false)}>Done</Button>
                    ) : (
                        <Button disabled={!name.trim() || mutation.isPending} onClick={submit}>
                            Create project
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
