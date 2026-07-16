import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArchiveIcon, KeyRoundIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { appMessage, insightsAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/analytics/projects")({ component: AnalyticsProjectsPage });

function AnalyticsProjectsPage() {
    const { data: projects = [], isFetching } = useQuery({
        queryKey: ["insights", "projects"],
        queryFn: insightsAPI.projects,
    });
    return (
        <PageCard
            title="Projects"
            description="Manage origins, integration keys, and project lifecycle."
            actions={
                <AuthWrap code="insights:project:manage">
                    <ProjectDialog />
                </AuthWrap>
            }
        >
            {projects.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project) => (
                        <Card
                            key={project.id}
                            className={project.archivedAt ? "opacity-60" : undefined}
                        >
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>{project.name}</CardTitle>
                                {project.archivedAt && <Badge variant="outline">Archived</Badge>}
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                <p className="font-mono text-xs text-foreground">{project.id}</p>
                                <p>{project.allowedOrigins.join(", ") || "All origins allowed"}</p>
                                <p>Updated {new Date(project.updatedAt).toLocaleString()}</p>
                                {!project.archivedAt && (
                                    <AuthWrap code="insights:project:manage">
                                        <ProjectActions project={project} />
                                    </AuthWrap>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    {isFetching ? "Loading projects..." : "No analytics projects created."}
                </div>
            )}
        </PageCard>
    );
}

function ProjectActions({ project }: { project: Insights.Project }) {
    const queryClient = useQueryClient();
    const [key, setKey] = useState("");
    const rotate = useMutation({
        mutationFn: () => insightsAPI.rotateKey(project.id),
        onSuccess: (value) => {
            setKey(value.projectKey);
            appMessage.success("Project key rotated");
        },
    });
    const archive = useMutation({
        mutationFn: () => insightsAPI.archiveProject(project.id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["insights", "projects"] });
            appMessage.success("Project archived");
        },
    });
    return (
        <div className="flex flex-wrap gap-2">
            <ProjectDialog project={project} />
            <Button variant="outline" size="sm" onClick={() => rotate.mutate()}>
                <KeyRoundIcon /> Rotate key
            </Button>
            <ConfirmDialog
                trigger={
                    <Button variant="outline" size="sm">
                        <ArchiveIcon /> Archive
                    </Button>
                }
                title="Archive project?"
                description="Archived projects immediately reject tracking events."
                confirmLabel="Archive"
                destructive
                onConfirm={() => archive.mutateAsync().then(() => {})}
            />
            <Dialog open={Boolean(key)} onOpenChange={(open) => !open && setKey("")}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New project key</DialogTitle>
                        <DialogDescription>
                            Copy it now. It will not be shown again.
                        </DialogDescription>
                    </DialogHeader>
                    <code className="break-all rounded bg-muted p-3">{key}</code>
                    <DialogFooter>
                        <Button onClick={() => setKey("")}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ProjectDialog({ project }: { project?: Insights.Project }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(project?.name ?? "");
    const [origins, setOrigins] = useState(project?.allowedOrigins.join("\n") ?? "");
    const [projectKey, setProjectKey] = useState("");
    useEffect(() => {
        if (open) {
            setName(project?.name ?? "");
            setOrigins(project?.allowedOrigins.join("\n") ?? "");
        }
    }, [open, project]);
    const mutation = useMutation({
        mutationFn: (input: Insights.SaveProjectInput) =>
            project
                ? insightsAPI.updateProject(project.id, input)
                : insightsAPI.createProject(input),
        onSuccess: async (value) => {
            if ("projectKey" in value && typeof value.projectKey === "string") {
                setProjectKey(value.projectKey);
            } else setOpen(false);
            await queryClient.invalidateQueries({ queryKey: ["insights", "projects"] });
            appMessage.success(project ? "Project updated" : "Project created");
        },
    });
    const close = (next: boolean) => {
        setOpen(next);
        if (!next) {
            setProjectKey("");
            mutation.reset();
        }
    };
    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogTrigger asChild>
                <Button variant={project ? "outline" : "default"} size={project ? "sm" : "default"}>
                    {project ? (
                        <>
                            <PencilIcon /> Edit
                        </>
                    ) : (
                        <>
                            <PlusIcon /> New project
                        </>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {project ? "Edit project" : "Create analytics project"}
                    </DialogTitle>
                    <DialogDescription>
                        Origins are matched exactly. An empty list permits any origin.
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
                            <Label htmlFor="analytics-project-name">Name</Label>
                            <Input
                                id="analytics-project-name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="analytics-project-origins">Allowed origins</Label>
                            <Textarea
                                id="analytics-project-origins"
                                className="min-h-24"
                                placeholder={"https://example.com\nhttps://app.example.com"}
                                value={origins}
                                onChange={(event) => setOrigins(event.target.value)}
                            />
                        </div>
                    </div>
                )}
                <DialogFooter>
                    {projectKey ? (
                        <Button onClick={() => close(false)}>Done</Button>
                    ) : (
                        <Button
                            disabled={!name.trim() || mutation.isPending}
                            onClick={() =>
                                mutation.mutate({
                                    name: name.trim(),
                                    allowedOrigins: origins
                                        .split("\n")
                                        .map((value) => value.trim())
                                        .filter(Boolean),
                                })
                            }
                        >
                            {project ? "Save" : "Create project"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
