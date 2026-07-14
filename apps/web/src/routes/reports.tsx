import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DownloadIcon, FilePlus2Icon, PlayIcon } from "lucide-react";
import { useState } from "react";

import { appMessage, reportsAPI } from "@/api";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

const statusVariant: Record<
    Reports.Job["status"],
    "default" | "secondary" | "destructive" | "outline"
> = {
    queued: "outline",
    running: "default",
    succeeded: "secondary",
    failed: "destructive",
};

function ReportsPage() {
    const { data: templates = [] } = useQuery({
        queryKey: ["reports", "templates"],
        queryFn: reportsAPI.templates,
    });
    const { data: jobs = [], isFetching } = useQuery({
        queryKey: ["reports", "jobs"],
        queryFn: reportsAPI.jobs,
        refetchInterval: (query) =>
            query.state.data?.some((job) => job.status === "queued" || job.status === "running")
                ? 2_000
                : false,
    });

    return (
        <PageCard
            title="Reports"
            description="Define HTML templates and generate downloadable reports manually."
            actions={
                <AuthWrap code="reports:manage">
                    <div className="flex gap-2">
                        <TemplateDialog />
                        <RunReportDialog templates={templates} />
                    </div>
                </AuthWrap>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Job</TableHead>
                            <TableHead>Template</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead className="text-right">Output</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {jobs.length ? (
                            jobs.map((job) => (
                                <TableRow key={job.id}>
                                    <TableCell className="font-mono text-xs">{job.id}</TableCell>
                                    <TableCell>
                                        {templates.find(
                                            (template) => template.id === job.templateId,
                                        )?.name ?? job.templateId}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant[job.status]}>
                                            {job.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatDate(job.createdAt)}</TableCell>
                                    <TableCell>{formatDate(job.expiresAt)}</TableCell>
                                    <TableCell className="max-w-64 truncate text-muted-foreground">
                                        {job.error || "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={job.status !== "succeeded"}
                                            aria-label="Download report"
                                            onClick={() => void reportsAPI.download(job.id)}
                                        >
                                            <DownloadIcon />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-40 text-center">
                                    {isFetching
                                        ? "Loading reports..."
                                        : "No report jobs generated."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}

function TemplateDialog() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [content, setContent] = useState("<h1>{{title}}</h1>\n<p>{{summary}}</p>");
    const mutation = useMutation({
        mutationFn: reportsAPI.saveTemplate,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["reports", "templates"] });
            appMessage.success("Report template saved");
            setOpen(false);
        },
    });
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <FilePlus2Icon /> Template
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>New report template</DialogTitle>
                    <DialogDescription>
                        Use placeholders such as {"{{title}}"} for scalar input values.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="report-template-name">Name</Label>
                        <Input
                            id="report-template-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="report-template-content">HTML template</Label>
                        <Textarea
                            id="report-template-content"
                            className="min-h-64 font-mono"
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        disabled={!name.trim() || !content.trim() || mutation.isPending}
                        onClick={() => mutation.mutate({ name: name.trim(), content })}
                    >
                        Save template
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RunReportDialog({ templates }: { templates: Reports.Template[] }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [templateId, setTemplateId] = useState("");
    const [input, setInput] = useState(
        '{\n  "title": "RustZen Report",\n  "summary": "Generated locally"\n}',
    );
    const mutation = useMutation({
        mutationFn: reportsAPI.createJob,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["reports", "jobs"] });
            appMessage.success("Report generated");
            setOpen(false);
        },
    });
    const run = () => {
        try {
            const data = JSON.parse(input) as Record<string, unknown>;
            mutation.mutate({ templateId, data });
        } catch {
            appMessage.error("Report input must be a JSON object");
        }
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={!templates.length}>
                    <PlayIcon /> Generate
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Generate report</DialogTitle>
                    <DialogDescription>Runs once in the isolated Reports worker.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>Template</Label>
                        <Select value={templateId} onValueChange={setTemplateId}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                            <SelectContent>
                                {templates.map((template) => (
                                    <SelectItem key={template.id} value={template.id}>
                                        {template.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="report-input">Input JSON</Label>
                        <Textarea
                            id="report-input"
                            className="min-h-48 font-mono"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button disabled={!templateId || mutation.isPending} onClick={run}>
                        Generate report
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function formatDate(value: string) {
    return new Date(value).toLocaleString();
}
