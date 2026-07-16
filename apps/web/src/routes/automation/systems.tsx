import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRoundIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { appMessage, reportsAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/automation/systems")({ component: SystemsPage });

function SystemsPage() {
    const client = useQueryClient();
    const { data: systems = [], isFetching } = useQuery({
        queryKey: ["reports", "systems"],
        queryFn: reportsAPI.systems,
    });
    const { data: accounts = [] } = useQuery({
        queryKey: ["reports", "accounts"],
        queryFn: () => reportsAPI.accounts(),
    });
    const refresh = async () => {
        await Promise.all([
            client.invalidateQueries({ queryKey: ["reports", "systems"] }),
            client.invalidateQueries({ queryKey: ["reports", "accounts"] }),
        ]);
    };
    return (
        <PageCard
            title="Target systems"
            description="Manage trusted browser origins and encrypted login accounts."
            actions={
                <AuthWrap code="reports:system:manage">
                    <SystemDialog onSaved={refresh} />
                </AuthWrap>
            }
        >
            {systems.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                    {systems.map((system) => (
                        <Card key={system.id}>
                            <CardHeader className="flex-row items-center justify-between">
                                <div>
                                    <CardTitle>{system.name}</CardTitle>
                                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                                        {system.baseUrl}
                                    </p>
                                </div>
                                <Badge variant={system.enabled ? "secondary" : "outline"}>
                                    {system.enabled ? "enabled" : "disabled"}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    {system.notes || "No notes"}
                                </p>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium">Accounts</h3>
                                        <AuthWrap code="reports:system:manage">
                                            <AccountDialog system={system} onSaved={refresh} />
                                        </AuthWrap>
                                    </div>
                                    {accounts
                                        .filter((a) => a.systemId === system.id)
                                        .map((account) => (
                                            <div
                                                key={account.id}
                                                className="flex items-center justify-between rounded-md border p-3 text-sm"
                                            >
                                                <div>
                                                    <div className="font-medium">
                                                        {account.name}
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                        {account.username} · secret configured
                                                    </div>
                                                </div>
                                                <AuthWrap code="reports:system:manage">
                                                    <div className="flex gap-1">
                                                        <AccountDialog
                                                            system={system}
                                                            account={account}
                                                            onSaved={refresh}
                                                        />
                                                        <DeleteButton
                                                            label="Delete account"
                                                            onConfirm={() =>
                                                                reportsAPI
                                                                    .deleteAccount(account.id)
                                                                    .then(refresh)
                                                            }
                                                        />
                                                    </div>
                                                </AuthWrap>
                                            </div>
                                        ))}
                                </div>
                                <AuthWrap code="reports:system:manage">
                                    <div className="flex gap-2 border-t pt-4">
                                        <SystemDialog system={system} onSaved={refresh} />
                                        <DeleteButton
                                            label="Delete system"
                                            onConfirm={() =>
                                                reportsAPI.deleteSystem(system.id).then(refresh)
                                            }
                                        />
                                    </div>
                                </AuthWrap>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Empty loading={isFetching} />
            )}
        </PageCard>
    );
}

function SystemDialog({
    system,
    onSaved,
}: {
    system?: Reports.System;
    onSaved: () => Promise<unknown>;
}) {
    const [open, setOpen] = useState(false),
        [name, setName] = useState(""),
        [baseUrl, setBaseUrl] = useState(""),
        [notes, setNotes] = useState(""),
        [enabled, setEnabled] = useState(true);
    useEffect(() => {
        if (open) {
            setName(system?.name ?? "");
            setBaseUrl(system?.baseUrl ?? "");
            setNotes(system?.notes ?? "");
            setEnabled(system?.enabled ?? true);
        }
    }, [open, system]);
    const mutation = useMutation({
        mutationFn: (input: Reports.SaveSystem) =>
            system ? reportsAPI.updateSystem(system.id, input) : reportsAPI.createSystem(input),
        onSuccess: async () => {
            await onSaved();
            appMessage.success(system ? "System updated" : "System created");
            setOpen(false);
        },
    });
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant={system ? "outline" : "default"} size={system ? "sm" : "default"}>
                    {system ? <PencilIcon /> : <PlusIcon />}
                    {system ? "Edit" : "New system"}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{system ? "Edit system" : "New target system"}</DialogTitle>
                    <DialogDescription>
                        Only this exact HTTP/HTTPS origin can be visited by its flows.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <Field label="Name" value={name} onChange={setName} />
                    <Field
                        label="Base URL"
                        value={baseUrl}
                        onChange={setBaseUrl}
                        placeholder="https://portal.example.com"
                    />
                    <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="system-enabled"
                            checked={enabled}
                            onCheckedChange={(checked) => setEnabled(checked === true)}
                        />
                        <Label htmlFor="system-enabled">Enabled</Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        disabled={!name.trim() || !baseUrl.trim() || mutation.isPending}
                        onClick={() =>
                            mutation.mutate({
                                name,
                                baseUrl,
                                notes,
                                enabled,
                            })
                        }
                    >
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
function AccountDialog({
    system,
    account,
    onSaved,
}: {
    system: Reports.System;
    account?: Reports.Account;
    onSaved: () => Promise<unknown>;
}) {
    const [open, setOpen] = useState(false),
        [name, setName] = useState(""),
        [username, setUsername] = useState(""),
        [secret, setSecret] = useState("");
    useEffect(() => {
        if (open) {
            setName(account?.name ?? "");
            setUsername(account?.username ?? "");
            setSecret("");
        }
    }, [open, account]);
    const mutation = useMutation({
        mutationFn: (input: Reports.SaveAccount) =>
            account ? reportsAPI.updateAccount(account.id, input) : reportsAPI.createAccount(input),
        onSuccess: async () => {
            await onSaved();
            appMessage.success(account ? "Account updated" : "Account created");
            setOpen(false);
        },
    });
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    {account ? <PencilIcon /> : <KeyRoundIcon />}
                    {account ? "Edit" : "Add account"}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{account ? "Edit account" : "Add encrypted account"}</DialogTitle>
                    <DialogDescription>
                        The secret is write-only and never returned by the API.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <Field label="Name" value={name} onChange={setName} />
                    <Field label="Username" value={username} onChange={setUsername} />
                    <Field
                        label={account ? "Replace secret (optional)" : "Secret"}
                        value={secret}
                        onChange={setSecret}
                        type="password"
                    />
                </div>
                <DialogFooter>
                    <Button
                        disabled={!name || !username || (!account && !secret) || mutation.isPending}
                        onClick={() =>
                            mutation.mutate({
                                systemId: system.id,
                                name,
                                username,
                                ...(secret ? { secret } : {}),
                            })
                        }
                    >
                        Save account
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
function Field({
    label,
    value,
    onChange,
    placeholder,
    type,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <Input
                value={value}
                placeholder={placeholder}
                type={type}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}
function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => Promise<unknown> }) {
    return (
        <ConfirmDialog
            trigger={
                <Button variant="ghost-destructive" size="sm">
                    <Trash2Icon />
                    {label}
                </Button>
            }
            title={`${label}?`}
            description="Referenced records must be removed first."
            confirmLabel="Delete"
            destructive
            onConfirm={() => onConfirm().then(() => {})}
        />
    );
}
function Empty({ loading }: { loading: boolean }) {
    return (
        <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            {loading ? "Loading systems..." : "No target systems configured."}
        </div>
    );
}
