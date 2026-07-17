import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EditIcon, PlusIcon, StopCircleIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { appMessage, systemAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
import { TextField } from "@/components/form/text-field";
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
import { ENABLE_OPTIONS, MENU_TYPE_OPTIONS } from "@/constant/options";

export const Route = createFileRoute("/system/menu")({
    component: MenuPage,
});

const menuTypeMeta: Record<
    number,
    { label: string; variant: "default" | "secondary" | "outline" }
> = {
    1: { label: "目录", variant: "secondary" },
    2: { label: "菜单", variant: "default" },
    3: { label: "按钮", variant: "outline" },
};

const statusMeta: Record<number, { label: string; variant: "secondary" | "outline" }> = {
    1: { label: "启用", variant: "secondary" },
    2: { label: "禁用", variant: "outline" },
};

const MODULE_ICON_OPTIONS = [
    { label: "监控", value: "monitor" },
    { label: "分析", value: "chart-no-axes-combined" },
    { label: "报表", value: "file-text" },
] as const;

type FlatMenuItem = Menu.Item & {
    depth: number;
};

function MenuPage() {
    const { data, isFetching, refetch } = useQuery({
        queryKey: ["system", "menu"],
        queryFn: () => systemAPI.menu.list({}),
    });
    const rows = useMemo(() => flattenMenuTree(data?.data ?? []), [data?.data]);

    const refresh = () => {
        void refetch();
    };

    return (
        <PageCard
            title="菜单管理"
            description="管理路由菜单、权限编码和按钮操作。"
            actions={
                <AuthWrap code="system:menu:create">
                    <MenuDialog mode="create" onSuccess={refresh}>
                        <Button>
                            <PlusIcon data-icon="inline-start" />
                            Create Menu
                        </Button>
                    </MenuDialog>
                </AuthWrap>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-64">名称</TableHead>
                            <TableHead className="min-w-64">编码</TableHead>
                            <TableHead className="min-w-32">菜单类型</TableHead>
                            <TableHead className="min-w-28">状态</TableHead>
                            <TableHead className="min-w-28">排序</TableHead>
                            <TableHead className="min-w-44">更新时间</TableHead>
                            <TableHead className="w-24 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium">
                                        <span
                                            className="inline-flex items-center"
                                            style={{ paddingLeft: `${record.depth * 24}px` }}
                                        >
                                            {record.depth > 0 ? (
                                                <span className="mr-2 text-muted-foreground">
                                                    └
                                                </span>
                                            ) : null}
                                            {record.name}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{record.code}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <MenuTypeBadge menuType={record.menuType} />
                                    </TableCell>
                                    <TableCell>
                                        <MenuStatusBadge status={record.status} />
                                    </TableCell>
                                    <TableCell>{record.sortOrder}</TableCell>
                                    <TableCell>{formatDateTime(record.updatedAt)}</TableCell>
                                    <TableCell>
                                        <MenuActions record={record} onSuccess={refresh} />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-40 text-center">
                                    {isFetching ? "正在加载菜单..." : "未找到菜单。"}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}

function MenuActions({ record, onSuccess }: { record: Menu.Item; onSuccess: () => void }) {
    const canEdit = !record.moduleId || Boolean(record.moduleMenuCode);

    return (
        <div className="flex justify-end gap-2">
            {canEdit ? (
                <AuthWrap code="system:menu:update">
                    <MenuDialog mode="edit" initialValues={record} onSuccess={onSuccess}>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="编辑菜单">
                            <EditIcon />
                        </Button>
                    </MenuDialog>
                </AuthWrap>
            ) : null}
            {!record.isSystem && !record.moduleId ? (
                <AuthWrap code="system:menu:delete">
                    <DisableMenuDialog record={record} onSuccess={onSuccess} />
                </AuthWrap>
            ) : null}
        </div>
    );
}

interface MenuDialogProps {
    initialValues?: Partial<Menu.Item>;
    mode?: "create" | "edit";
    children: ReactNode;
    onSuccess?: () => void;
}

const MenuDialog = ({ children, initialValues, mode = "create", onSuccess }: MenuDialogProps) => {
    const queryClient = useQueryClient();
    const isModuleOwned = Boolean(initialValues?.moduleId);
    const [open, setOpen] = useState(false);
    const [parentId, setParentId] = useState("0");
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [menuType, setMenuType] = useState("1");
    const [status, setStatus] = useState("1");
    const [sortOrder, setSortOrder] = useState("0");
    const [icon, setIcon] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { data: menuOptions = [] } = useQuery({
        queryKey: ["system", "menus", "options"],
        queryFn: systemAPI.menu.options,
        enabled: open && !isModuleOwned,
    });
    const selectableParents = useMemo(
        () => menuOptions.filter((option) => option.value !== initialValues?.id),
        [initialValues?.id, menuOptions],
    );

    useEffect(() => {
        if (open) {
            setParentId(String(initialValues?.parentId ?? 0));
            setName(initialValues?.name ?? "");
            setCode(initialValues?.code ?? "");
            setMenuType(String(initialValues?.menuType ?? 1));
            setStatus(String(initialValues?.status ?? 1));
            setSortOrder(String(initialValues?.sortOrder ?? 0));
            setIcon(initialValues?.icon ?? "");
        }
    }, [initialValues, open]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = name.trim();
        const trimmedCode = code.trim();
        const parsedSortOrder = Number(sortOrder);

        if (!trimmedName) {
            appMessage.error("请输入菜单名称");
            return;
        }
        if (!trimmedCode) {
            appMessage.error("请输入权限编码");
            return;
        }
        if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
            appMessage.error("排序必须是非负整数");
            return;
        }

        const payload = {
            parentId: Number(parentId),
            name: trimmedName,
            code: trimmedCode,
            menuType: Number(menuType),
            sortOrder: parsedSortOrder,
            status: Number(status),
            icon: icon || null,
        };

        setSubmitting(true);
        try {
            if (mode === "create") {
                await systemAPI.menu.create(payload);
                appMessage.success("菜单已创建");
            } else if (initialValues?.id) {
                await systemAPI.menu.update(initialValues.id, payload);
                appMessage.success("菜单已更新");
            }
            if (isModuleOwned) {
                await queryClient.invalidateQueries({
                    queryKey: ["system", "modules", "navigation"],
                });
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
                    <DialogTitle>{mode === "create" ? "创建菜单" : "编辑菜单"}</DialogTitle>
                    <DialogDescription>
                        {isModuleOwned
                            ? "覆盖标题、图标、排序和可见性。模块标识仍与清单保持同步。"
                            : "配置菜单层级、权限编码和显示顺序。"}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <div className="grid gap-2">
                        <Label htmlFor="menu-parent">上级菜单</Label>
                        <Select
                            value={parentId}
                            onValueChange={setParentId}
                            disabled={isModuleOwned}
                        >
                            <SelectTrigger id="menu-parent" className="w-full">
                                <SelectValue placeholder="请选择上级菜单" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {selectableParents.map((item) => (
                                        <SelectItem key={item.value} value={String(item.value)}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <TextField
                        id="menu-name"
                        label={isModuleOwned ? "菜单标题" : "菜单名称"}
                        value={name}
                        placeholder="请输入菜单名称"
                        onChange={setName}
                    />
                    <TextField
                        id="menu-code"
                        label="权限编码"
                        value={code}
                        placeholder="请输入权限编码（如 system:menu:list）"
                        onChange={setCode}
                        disabled={isModuleOwned}
                    />
                    {isModuleOwned && initialValues?.path ? (
                        <div className="grid gap-2">
                            <Label htmlFor="menu-path">路由路径</Label>
                            <Input id="menu-path" value={initialValues.path} disabled />
                        </div>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="menu-type">类型</Label>
                            <Select
                                value={menuType}
                                onValueChange={setMenuType}
                                disabled={isModuleOwned}
                            >
                                <SelectTrigger id="menu-type" className="w-full">
                                    <SelectValue placeholder="请选择菜单类型" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {MENU_TYPE_OPTIONS.map((item) => (
                                            <SelectItem key={item.value} value={String(item.value)}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="menu-status">状态</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger id="menu-status" className="w-full">
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
                    </div>
                    {isModuleOwned ? (
                        <div className="grid gap-2">
                            <Label htmlFor="menu-icon">图标</Label>
                            <Select value={icon || undefined} onValueChange={setIcon}>
                                <SelectTrigger id="menu-icon" className="w-full">
                                    <SelectValue placeholder="请选择图标" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {MODULE_ICON_OPTIONS.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}
                    <TextField
                        id="menu-sort-order"
                        label="排序"
                        value={sortOrder}
                        type="number"
                        min={0}
                        step={1}
                        placeholder="请输入排序"
                        onChange={setSortOrder}
                    />
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

function DisableMenuDialog({ record, onSuccess }: { record: Menu.Item; onSuccess: () => void }) {
    const submit = async () => {
        await systemAPI.menu.delete(record.id);
        appMessage.success("菜单已禁用");
        onSuccess();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost-destructive"
                    size="icon-sm"
                    aria-label="禁用菜单"
                >
                    <StopCircleIcon />
                </Button>
            }
            title="禁用菜单"
            description={`This menu will be disabled. Disable ${record.name}?`}
            confirmLabel="禁用"
            destructive
            onConfirm={submit}
        />
    );
}

function MenuTypeBadge({ menuType }: { menuType: number }) {
    const meta = menuTypeMeta[menuType] ?? { label: "未知", variant: "outline" as const };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function MenuStatusBadge({ status }: { status: number }) {
    const meta = statusMeta[status] ?? { label: "未知", variant: "outline" as const };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function flattenMenuTree(items: Menu.Item[], depth = 0): FlatMenuItem[] {
    return items.flatMap((item) => [
        { ...item, depth },
        ...flattenMenuTree(item.children ?? [], depth + 1),
    ]);
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleString();
}
