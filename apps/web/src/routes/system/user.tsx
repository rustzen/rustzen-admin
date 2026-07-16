import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EditIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { appMessage, systemAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { TablePagination } from "@/components/app/table-pagination";
import { AuthWrap } from "@/components/base-auth";
import { TextField } from "@/components/form/text-field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
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
import { ENABLE_OPTIONS } from "@/constant/options";
import { useAuthStore } from "@/store/useAuthStore";

export const Route = createFileRoute("/system/user")({
    component: UserPage,
});

const PAGE_SIZE = 20;

const statusMeta: Record<
    number,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    1: { label: "Enabled", variant: "secondary" },
    2: { label: "Disabled", variant: "outline" },
    3: { label: "Pending", variant: "default" },
    4: { label: "Locked", variant: "destructive" },
};

const formatResetDateSuffix = (date: Date) => {
    const year = date.getFullYear() % 100;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${String(year).padStart(2, "0")}${String(month).padStart(2, "0")}${String(day).padStart(
        2,
        "0",
    )}`;
};

const buildResetPassword = (username: string, date = new Date()) => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
        return `User@${formatResetDateSuffix(date)}`;
    }
    const normalized = trimmedUsername.charAt(0).toUpperCase() + trimmedUsername.slice(1);
    return `${normalized}@${formatResetDateSuffix(date)}`;
};

function UserPage() {
    const currentUserId = useAuthStore((state) => state.userInfo?.id);
    const [currentPage, setCurrentPage] = useState(1);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [realName, setRealName] = useState("");
    const [status, setStatus] = useState("all");
    const [filters, setFilters] = useState({
        username: "",
        email: "",
        realName: "",
        status: "all",
    });
    const params = useMemo<User.QueryParams>(
        () => ({
            current: currentPage,
            pageSize: PAGE_SIZE,
            username: filters.username || undefined,
            email: filters.email || undefined,
            realName: filters.realName || undefined,
            status: filters.status,
        }),
        [currentPage, filters],
    );
    const { data, isFetching, refetch } = useQuery({
        queryKey: ["system", "user", params],
        queryFn: () => systemAPI.user.list(params),
    });
    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const search = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCurrentPage(1);
        setFilters({
            username: username.trim(),
            email: email.trim(),
            realName: realName.trim(),
            status,
        });
    };

    const reset = () => {
        setUsername("");
        setEmail("");
        setRealName("");
        setStatus("all");
        setCurrentPage(1);
        setFilters({ username: "", email: "", realName: "", status: "all" });
    };

    const refresh = () => {
        void refetch();
    };

    return (
        <PageCard
            title="User List"
            description="Manage accounts, roles, and account state."
            actions={
                <AuthWrap code="system:user:create">
                    <UserDialog mode="create" onSuccess={refresh}>
                        <Button>
                            <PlusIcon data-icon="inline-start" />
                            Create User
                        </Button>
                    </UserDialog>
                </AuthWrap>
            }
            toolbar={
                <form className="grid gap-3 md:grid-cols-5" onSubmit={search}>
                    <Input
                        value={username}
                        placeholder="Username"
                        onChange={(event) => setUsername(event.target.value)}
                    />
                    <Input
                        value={email}
                        placeholder="Email"
                        onChange={(event) => setEmail(event.target.value)}
                    />
                    <Input
                        value={realName}
                        placeholder="Real Name"
                        onChange={(event) => setRealName(event.target.value)}
                    />
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {ENABLE_OPTIONS.map((item) => (
                                    <SelectItem key={item.value} value={String(item.value)}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={isFetching}>
                            Search
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isFetching}
                            onClick={reset}
                        >
                            Reset
                        </Button>
                    </div>
                </form>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16">ID</TableHead>
                            <TableHead className="w-20">Avatar</TableHead>
                            <TableHead className="min-w-36">Username</TableHead>
                            <TableHead className="min-w-48">Email</TableHead>
                            <TableHead className="min-w-36">Real Name</TableHead>
                            <TableHead className="min-w-28">Status</TableHead>
                            <TableHead className="min-w-48">Roles</TableHead>
                            <TableHead className="min-w-44">Last Login</TableHead>
                            <TableHead className="min-w-44">Updated At</TableHead>
                            <TableHead className="w-20 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium">{record.id}</TableCell>
                                    <TableCell>
                                        <Avatar className="size-8">
                                            <AvatarImage
                                                src={record.avatarUrl ?? undefined}
                                                alt={record.username}
                                            />
                                            <AvatarFallback>
                                                {getUserInitial(record)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                    <TableCell>{record.username}</TableCell>
                                    <TableCell>{record.email}</TableCell>
                                    <TableCell>{record.realName || "-"}</TableCell>
                                    <TableCell>
                                        <UserStatusBadge status={record.status} />
                                    </TableCell>
                                    <TableCell className="max-w-64 truncate">
                                        {record.roles.map((role) => role.label).join(", ") || "-"}
                                    </TableCell>
                                    <TableCell>{formatDateTime(record.lastLoginAt)}</TableCell>
                                    <TableCell>{formatDateTime(record.updatedAt)}</TableCell>
                                    <TableCell>
                                        <UserActions
                                            record={record}
                                            currentUserId={currentUserId}
                                            onSuccess={refresh}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={10} className="h-40 text-center">
                                    {isFetching ? "Loading users..." : "No users found."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
            <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                total={total}
                disabled={isFetching}
                onPageChange={setCurrentPage}
            />
        </PageCard>
    );
}

function UserActions({
    record,
    currentUserId,
    onSuccess,
}: {
    record: User.Item;
    currentUserId?: number;
    onSuccess: () => void;
}) {
    if (record.id === currentUserId || record.isSystem) {
        return null;
    }

    return (
        <div className="flex justify-end gap-2">
            <AuthWrap code="system:user:update">
                <UserDialog mode="edit" initialValues={record} onSuccess={onSuccess}>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit user">
                        <EditIcon />
                    </Button>
                </UserDialog>
            </AuthWrap>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="More user actions"
                    >
                        <MoreHorizontalIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <AuthWrap code="system:user:status">
                        <UserActionDialog
                            title={`${record.status === 1 ? "Disable" : "Enable"} User`}
                            description={`Are you sure you want to ${
                                record.status === 1 ? "disable" : "enable"
                            } ${record.username}?`}
                            actionLabel={record.status === 1 ? "Disable" : "Enable"}
                            onConfirm={async () => {
                                await systemAPI.user.status(record.id, record.status === 1 ? 2 : 1);
                                onSuccess();
                            }}
                        />
                    </AuthWrap>
                    <AuthWrap code="system:user:password">
                        <UserActionDialog
                            title="Reset Password"
                            description={`Reset password for ${record.username}?`}
                            actionLabel="Reset Password"
                            onConfirm={async () => {
                                const password = buildResetPassword(record.username);
                                await systemAPI.user.password(record.id, password);
                                appMessage.success(`Password reset to ${password}`);
                                onSuccess();
                            }}
                        />
                    </AuthWrap>
                    <AuthWrap code="system:user:delete">
                        <UserActionDialog
                            title="Delete User"
                            description={`Are you sure you want to delete ${record.username}?`}
                            actionLabel="Delete User"
                            destructive
                            onConfirm={async () => {
                                await systemAPI.user.delete(record.id);
                                onSuccess();
                            }}
                        />
                    </AuthWrap>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

interface UserDialogProps {
    initialValues?: Partial<User.Item>;
    mode?: "create" | "edit";
    children: ReactNode;
    onSuccess?: () => void;
}

const UserDialog = ({ children, initialValues, mode = "create", onSuccess }: UserDialogProps) => {
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [realName, setRealName] = useState("");
    const [password, setPassword] = useState("");
    const [status, setStatus] = useState("1");
    const [roleIds, setRoleIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const { data: roleOptions = [] } = useQuery({
        queryKey: ["system", "roles", "options"],
        queryFn: systemAPI.role.options,
        enabled: open,
    });

    useEffect(() => {
        if (open) {
            setUsername(initialValues?.username ?? "");
            setEmail(initialValues?.email ?? "");
            setRealName(initialValues?.realName ?? "");
            setPassword("");
            setStatus(String(initialValues?.status ?? 1));
            setRoleIds(initialValues?.roles?.map((role) => role.value) ?? []);
        }
    }, [initialValues, open]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedUsername = username.trim();
        const trimmedEmail = email.trim();
        const trimmedRealName = realName.trim();
        const trimmedPassword = password.trim();

        if (mode === "create" && trimmedUsername.length < 3) {
            appMessage.error("Username must be at least 3 characters");
            return;
        }
        if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            appMessage.error("Please enter a valid email");
            return;
        }
        if (!trimmedRealName) {
            appMessage.error("Please enter real name");
            return;
        }
        if (mode === "create" && trimmedPassword.length < 6) {
            appMessage.error("Password must be at least 6 characters");
            return;
        }
        if (roleIds.length === 0) {
            appMessage.error("Please select at least one role");
            return;
        }

        setSubmitting(true);
        try {
            if (mode === "create") {
                await systemAPI.user.create({
                    username: trimmedUsername,
                    email: trimmedEmail,
                    password: trimmedPassword,
                    realName: trimmedRealName,
                    status: Number(status),
                    roleIds,
                });
                appMessage.success("User created");
            } else if (initialValues?.id) {
                await systemAPI.user.update(initialValues.id, {
                    email: trimmedEmail,
                    realName: trimmedRealName,
                    roleIds,
                });
                appMessage.success("User updated");
            }
            onSuccess?.();
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{mode === "create" ? "Create User" : "Edit User"}</DialogTitle>
                    <DialogDescription>
                        {mode === "create"
                            ? "Create an account and assign roles."
                            : "Update account details and roles."}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextField
                        id="user-username"
                        label="Username"
                        value={username}
                        placeholder="Enter username"
                        disabled={mode === "edit"}
                        onChange={setUsername}
                    />
                    <TextField
                        id="user-email"
                        label="Email"
                        value={email}
                        placeholder="Enter email"
                        onChange={setEmail}
                    />
                    <TextField
                        id="user-real-name"
                        label="Real Name"
                        value={realName}
                        placeholder="Enter real name"
                        onChange={setRealName}
                    />
                    {mode === "create" && (
                        <TextField
                            id="user-password"
                            label="Password"
                            value={password}
                            type="password"
                            placeholder="Enter password"
                            onChange={setPassword}
                        />
                    )}
                    {mode === "create" && (
                        <div className="grid gap-2">
                            <Label htmlFor="user-status">Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger id="user-status" className="w-full">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {ENABLE_OPTIONS.map((item) => (
                                            <SelectItem key={item.value} value={String(item.value)}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <RolePicker options={roleOptions} value={roleIds} onChange={setRoleIds} />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {mode === "create" ? "Create" : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

function RolePicker({
    options,
    value,
    onChange,
}: {
    options: Api.OptionItem<number>[];
    value: number[];
    onChange: (value: number[]) => void;
}) {
    const toggleRole = (roleId: number, checked: boolean) => {
        if (checked) {
            onChange([...value, roleId]);
            return;
        }
        onChange(value.filter((item) => item !== roleId));
    };

    return (
        <div className="grid gap-2">
            <Label>Roles</Label>
            <div className="max-h-40 overflow-auto rounded-md border p-3">
                {options.length > 0 ? (
                    <div className="grid gap-3">
                        {options.map((role) => (
                            <Label key={role.value} className="justify-start">
                                <Checkbox
                                    checked={value.includes(role.value)}
                                    onCheckedChange={(checked) =>
                                        toggleRole(role.value, checked === true)
                                    }
                                />
                                {role.label}
                            </Label>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground">No roles available.</div>
                )}
            </div>
        </div>
    );
}

function UserActionDialog({
    title,
    description,
    actionLabel,
    destructive = false,
    onConfirm,
}: {
    title: string;
    description: string;
    actionLabel: string;
    destructive?: boolean;
    onConfirm: () => Promise<void>;
}) {
    return (
        <ConfirmDialog
            trigger={
                <DropdownMenuItem
                    className={destructive ? "text-destructive" : undefined}
                    onSelect={(event) => event.preventDefault()}
                >
                    {actionLabel}
                </DropdownMenuItem>
            }
            title={title}
            description={description}
            confirmLabel={actionLabel}
            destructive={destructive}
            onConfirm={onConfirm}
        />
    );
}

function UserStatusBadge({ status }: { status: number }) {
    const meta = statusMeta[status] ?? { label: "Unknown", variant: "outline" as const };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function getUserInitial(record: User.Item) {
    return (record.realName || record.username).slice(0, 1).toUpperCase();
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleString();
}
