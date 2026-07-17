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
    1: { label: "启用", variant: "secondary" },
    2: { label: "禁用", variant: "outline" },
    3: { label: "待审核", variant: "default" },
    4: { label: "已锁定", variant: "destructive" },
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
            title="用户列表"
            description="管理账号、角色和账号状态。"
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
                        placeholder="用户名"
                        onChange={(event) => setUsername(event.target.value)}
                    />
                    <Input
                        value={email}
                        placeholder="邮箱"
                        onChange={(event) => setEmail(event.target.value)}
                    />
                    <Input
                        value={realName}
                        placeholder="真实姓名"
                        onChange={(event) => setRealName(event.target.value)}
                    />
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="状态" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="all">全部状态</SelectItem>
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
                            <TableHead className="w-20">头像</TableHead>
                            <TableHead className="min-w-36">用户名</TableHead>
                            <TableHead className="min-w-48">邮箱</TableHead>
                            <TableHead className="min-w-36">真实姓名</TableHead>
                            <TableHead className="min-w-28">状态</TableHead>
                            <TableHead className="min-w-48">角色</TableHead>
                            <TableHead className="min-w-44">最后登录</TableHead>
                            <TableHead className="min-w-44">更新时间</TableHead>
                            <TableHead className="w-20 text-right">操作</TableHead>
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
                                    {isFetching ? "正在加载用户..." : "未找到用户。"}
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
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="编辑用户">
                        <EditIcon />
                    </Button>
                </UserDialog>
            </AuthWrap>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="更多用户操作">
                        <MoreHorizontalIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <AuthWrap code="system:user:status">
                        <UserActionDialog
                            title={record.status === 1 ? "禁用用户" : "启用用户"}
                            description={`Are you sure you want to ${
                                record.status === 1 ? "disable" : "enable"
                            } ${record.username}?`}
                            actionLabel={record.status === 1 ? "禁用" : "启用"}
                            onConfirm={async () => {
                                await systemAPI.user.status(record.id, record.status === 1 ? 2 : 1);
                                onSuccess();
                            }}
                        />
                    </AuthWrap>
                    <AuthWrap code="system:user:password">
                        <UserActionDialog
                            title="重置密码"
                            description={`Reset password for ${record.username}?`}
                            actionLabel="重置密码"
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
                            title="删除用户"
                            description={`Are you sure you want to delete ${record.username}?`}
                            actionLabel="删除用户"
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
            appMessage.error("用户名至少需要 3 个字符");
            return;
        }
        if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            appMessage.error("请输入有效的邮箱");
            return;
        }
        if (!trimmedRealName) {
            appMessage.error("请输入真实姓名");
            return;
        }
        if (mode === "create" && trimmedPassword.length < 6) {
            appMessage.error("密码至少需要 6 个字符");
            return;
        }
        if (roleIds.length === 0) {
            appMessage.error("请至少选择一个角色");
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
                appMessage.success("用户已创建");
            } else if (initialValues?.id) {
                await systemAPI.user.update(initialValues.id, {
                    email: trimmedEmail,
                    realName: trimmedRealName,
                    roleIds,
                });
                appMessage.success("用户已更新");
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
                    <DialogTitle>{mode === "create" ? "创建用户" : "编辑用户"}</DialogTitle>
                    <DialogDescription>
                        {mode === "create" ? "创建账号并分配角色。" : "更新账号信息和角色。"}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextField
                        id="user-username"
                        label="用户名"
                        value={username}
                        placeholder="请输入用户名"
                        disabled={mode === "edit"}
                        onChange={setUsername}
                    />
                    <TextField
                        id="user-email"
                        label="邮箱"
                        value={email}
                        placeholder="请输入邮箱"
                        onChange={setEmail}
                    />
                    <TextField
                        id="user-real-name"
                        label="真实姓名"
                        value={realName}
                        placeholder="请输入真实姓名"
                        onChange={setRealName}
                    />
                    {mode === "create" && (
                        <TextField
                            id="user-password"
                            label="密码"
                            value={password}
                            type="password"
                            placeholder="请输入密码"
                            onChange={setPassword}
                        />
                    )}
                    {mode === "create" && (
                        <div className="grid gap-2">
                            <Label htmlFor="user-status">状态</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger id="user-status" className="w-full">
                                    <SelectValue placeholder="请选择状态" />
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
                            {mode === "create" ? "创建" : "保存"}
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
            <Label>角色</Label>
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
                    <div className="text-sm text-muted-foreground">暂无可用角色。</div>
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
    const meta = statusMeta[status] ?? { label: "未知", variant: "outline" as const };
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
