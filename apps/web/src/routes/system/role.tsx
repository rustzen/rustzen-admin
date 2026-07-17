import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { appMessage, systemAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { TablePagination } from "@/components/app/table-pagination";
import { AuthWrap } from "@/components/base-auth";
import { TextField } from "@/components/form/text-field";
import { TextareaField } from "@/components/form/textarea-field";
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

const OWNER_ROLE_CODE = "owner";
const BUILTIN_ROLE_CODES = new Set([OWNER_ROLE_CODE, "admin", "viewer"]);
const PAGE_SIZE = 20;

export const Route = createFileRoute("/system/role")({
    component: RolePage,
});

const statusMeta: Record<number, { label: string; variant: "secondary" | "outline" }> = {
    1: { label: "启用", variant: "secondary" },
    2: { label: "禁用", variant: "outline" },
};

function RolePage() {
    const [currentPage, setCurrentPage] = useState(1);
    const [roleName, setRoleName] = useState("");
    const [roleCode, setRoleCode] = useState("");
    const [status, setStatus] = useState("all");
    const [filters, setFilters] = useState({
        roleName: "",
        roleCode: "",
        status: "all",
    });
    const params = useMemo<Role.QueryParams>(
        () => ({
            current: currentPage,
            pageSize: PAGE_SIZE,
            roleName: filters.roleName || undefined,
            roleCode: filters.roleCode || undefined,
            status: filters.status,
        }),
        [currentPage, filters],
    );
    const { data, isFetching, refetch } = useQuery({
        queryKey: ["system", "role", params],
        queryFn: () => systemAPI.role.list(params),
    });
    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const search = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCurrentPage(1);
        setFilters({
            roleName: roleName.trim(),
            roleCode: roleCode.trim(),
            status,
        });
    };

    const reset = () => {
        setRoleName("");
        setRoleCode("");
        setStatus("all");
        setCurrentPage(1);
        setFilters({ roleName: "", roleCode: "", status: "all" });
    };

    const refresh = () => {
        void refetch();
    };

    return (
        <PageCard
            title="角色管理"
            description="管理角色定义和权限分配。"
            actions={
                <AuthWrap code="system:role:create">
                    <RoleDialog mode="create" onSuccess={refresh}>
                        <Button>
                            <PlusIcon data-icon="inline-start" />
                            Create Role
                        </Button>
                    </RoleDialog>
                </AuthWrap>
            }
            toolbar={
                <form className="grid gap-3 md:grid-cols-4" onSubmit={search}>
                    <Input
                        value={roleName}
                        placeholder="角色名称"
                        onChange={(event) => setRoleName(event.target.value)}
                    />
                    <Input
                        value={roleCode}
                        placeholder="角色编码"
                        onChange={(event) => setRoleCode(event.target.value)}
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
                            <TableHead className="min-w-48">角色名称</TableHead>
                            <TableHead className="min-w-48">角色编码</TableHead>
                            <TableHead className="min-w-64">描述</TableHead>
                            <TableHead className="min-w-28">状态</TableHead>
                            <TableHead className="min-w-40">权限</TableHead>
                            <TableHead className="min-w-44">更新时间</TableHead>
                            <TableHead className="w-24 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium">{record.id}</TableCell>
                                    <TableCell>{record.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{record.code}</Badge>
                                    </TableCell>
                                    <TableCell className="max-w-72 truncate">
                                        {record.description || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <RoleStatusBadge status={record.status} />
                                    </TableCell>
                                    <TableCell>
                                        {record.menus?.length ? (
                                            <span
                                                title={record.menus
                                                    .map((menu) => menu.label)
                                                    .join(", ")}
                                            >
                                                {record.menus.length} permission(s)
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                No permissions
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>{formatDateTime(record.updatedAt)}</TableCell>
                                    <TableCell>
                                        <RoleActions record={record} onSuccess={refresh} />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={8} className="h-40 text-center">
                                    {isFetching ? "正在加载角色..." : "未找到角色。"}
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

function RoleActions({ record, onSuccess }: { record: Role.Item; onSuccess: () => void }) {
    if (isBuiltInRoleCode(record.code)) {
        return null;
    }

    return (
        <div className="flex justify-end gap-2">
            <AuthWrap code="system:role:update">
                <RoleDialog mode="edit" record={record} onSuccess={onSuccess}>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="编辑角色">
                        <EditIcon />
                    </Button>
                </RoleDialog>
            </AuthWrap>
            <AuthWrap code="system:role:delete">
                <DeleteRoleDialog record={record} onSuccess={onSuccess} />
            </AuthWrap>
        </div>
    );
}

interface RoleDialogProps {
    record?: Partial<Role.Item>;
    mode?: "create" | "edit";
    children: ReactNode;
    onSuccess?: () => void;
}

const RoleDialog = ({ children, record, mode = "create", onSuccess }: RoleDialogProps) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [status, setStatus] = useState("1");
    const [description, setDescription] = useState("");
    const [menuIds, setMenuIds] = useState<number[]>([]);
    const [permissionSearch, setPermissionSearch] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { data: menuOptions = [] } = useQuery({
        queryKey: ["system", "menus", "options"],
        queryFn: systemAPI.menu.options,
        enabled: open,
    });
    const permissionOptions = useMemo(
        () =>
            menuOptions
                .filter((option) => option.value !== 0 && isAssignableRolePermission(option.code))
                .map((option) => ({
                    key: option.value,
                    title: option.label,
                    code: option.code,
                })),
        [menuOptions],
    );
    const filteredPermissions = useMemo(() => {
        const query = permissionSearch.trim().toLowerCase();
        if (!query) {
            return permissionOptions;
        }
        return permissionOptions.filter(
            (option) =>
                option.title.toLowerCase().includes(query) ||
                option.code.toLowerCase().includes(query),
        );
    }, [permissionOptions, permissionSearch]);

    useEffect(() => {
        if (open) {
            setName(record?.name ?? "");
            setCode(record?.code ?? "");
            setStatus(String(record?.status ?? 1));
            setDescription(record?.description ?? "");
            setMenuIds(record?.menus?.map((menu) => menu.value) ?? []);
            setPermissionSearch("");
        }
    }, [record, open]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const payload = {
            name: name.trim(),
            code: code.trim(),
            status: Number(status),
            description: description.trim() || undefined,
            menuIds,
        };

        if (payload.name.length < 2 || payload.name.length > 50) {
            appMessage.error("角色名称必须为 2-50 个字符");
            return;
        }
        if (payload.code.length < 2 || payload.code.length > 50) {
            appMessage.error("角色编码必须为 2-50 个字符");
            return;
        }
        if (!/^[a-zA-Z_]+$/.test(payload.code)) {
            appMessage.error("角色编码只能包含字母和下划线");
            return;
        }
        if (payload.menuIds.length === 0) {
            appMessage.error("请至少选择一个权限");
            return;
        }

        setSubmitting(true);
        try {
            if (mode === "create") {
                await systemAPI.role.create(payload);
                appMessage.success("角色已创建");
            } else if (record?.id) {
                await systemAPI.role.update(record.id, payload);
                appMessage.success("角色已更新");
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
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{mode === "create" ? "创建角色" : "编辑角色"}</DialogTitle>
                    <DialogDescription>
                        Configure role identity, status, and allowed permissions.
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <TextField
                            id="role-name"
                            label="角色名称"
                            value={name}
                            placeholder="请输入角色名称"
                            onChange={setName}
                        />
                        <TextField
                            id="role-code"
                            label="角色编码"
                            value={code}
                            placeholder="请输入角色编码"
                            onChange={setCode}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="role-status">状态</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger id="role-status" className="w-full">
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
                    <PermissionPicker
                        options={filteredPermissions}
                        selectedCount={menuIds.length}
                        search={permissionSearch}
                        value={menuIds}
                        onSearchChange={setPermissionSearch}
                        onChange={setMenuIds}
                    />
                    <div className="grid gap-1">
                        <TextareaField
                            id="role-description"
                            label="描述"
                            value={description}
                            maxLength={200}
                            placeholder="请输入角色描述"
                            onChange={setDescription}
                        />
                        <div className="text-xs text-muted-foreground">
                            {description.length}/200
                        </div>
                    </div>
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

function PermissionPicker({
    options,
    selectedCount,
    search,
    value,
    onSearchChange,
    onChange,
}: {
    options: { key: number; title: string; code: string }[];
    selectedCount: number;
    search: string;
    value: number[];
    onSearchChange: (value: string) => void;
    onChange: (value: number[]) => void;
}) {
    const togglePermission = (permissionId: number, checked: boolean) => {
        if (checked) {
            onChange([...value, permissionId]);
            return;
        }
        onChange(value.filter((item) => item !== permissionId));
    };

    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Label>权限</Label>
                <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
            </div>
            <Input
                value={search}
                placeholder="搜索权限"
                onChange={(event) => onSearchChange(event.target.value)}
            />
            <div className="max-h-72 overflow-auto rounded-md border p-3">
                {options.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {options.map((option) => (
                            <Label key={option.key} className="items-start justify-start">
                                <Checkbox
                                    checked={value.includes(option.key)}
                                    onCheckedChange={(checked) =>
                                        togglePermission(option.key, checked === true)
                                    }
                                />
                                <span className="grid gap-1">
                                    <span>{option.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {option.code}
                                    </span>
                                </span>
                            </Label>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground">
                        No assignable permissions found.
                    </div>
                )}
            </div>
        </div>
    );
}

function DeleteRoleDialog({ record, onSuccess }: { record: Role.Item; onSuccess: () => void }) {
    const submit = async () => {
        await systemAPI.role.delete(record.id);
        appMessage.success("角色已删除");
        onSuccess();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost-destructive"
                    size="icon-sm"
                    aria-label="删除角色"
                >
                    <TrashIcon />
                </Button>
            }
            title="删除角色"
            description={`This action cannot be undone. Delete ${record.name}?`}
            confirmLabel="删除"
            destructive
            onConfirm={submit}
        />
    );
}

function RoleStatusBadge({ status }: { status: number }) {
    const meta = statusMeta[status] ?? { label: "未知", variant: "outline" as const };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function isBuiltInRoleCode(code: string) {
    return BUILTIN_ROLE_CODES.has(code);
}

function isAssignableRolePermission(code: string) {
    return code !== "*" && !isDeployPermission(code) && !wildcardCoversDeploy(code);
}

function isDeployPermission(code: string) {
    return code === "manage:deploy:*" || code.startsWith("manage:deploy:");
}

function wildcardCoversDeploy(code: string) {
    if (!code.endsWith(":*")) {
        return false;
    }

    return "manage:deploy:".startsWith(code.slice(0, -1));
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleString();
}
