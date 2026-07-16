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
    1: { label: "Directory", variant: "secondary" },
    2: { label: "Menu", variant: "default" },
    3: { label: "Button", variant: "outline" },
};

const statusMeta: Record<number, { label: string; variant: "secondary" | "outline" }> = {
    1: { label: "Enabled", variant: "secondary" },
    2: { label: "Disabled", variant: "outline" },
};

const MODULE_ICON_OPTIONS = [
    { label: "Monitor", value: "monitor" },
    { label: "Insights", value: "chart-no-axes-combined" },
    { label: "Reports", value: "file-text" },
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
            title="Menu Management"
            description="Manage route menus, permission codes, and button actions."
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
                            <TableHead className="min-w-64">Name</TableHead>
                            <TableHead className="min-w-64">Code</TableHead>
                            <TableHead className="min-w-32">Menu Type</TableHead>
                            <TableHead className="min-w-28">Status</TableHead>
                            <TableHead className="min-w-28">Sort Order</TableHead>
                            <TableHead className="min-w-44">Updated At</TableHead>
                            <TableHead className="w-24 text-right">Actions</TableHead>
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
                                    {isFetching ? "Loading menus..." : "No menus found."}
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
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit menu">
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
            appMessage.error("Please enter menu name");
            return;
        }
        if (!trimmedCode) {
            appMessage.error("Please enter permission code");
            return;
        }
        if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
            appMessage.error("Sort order must be a non-negative integer");
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
                appMessage.success("Menu created");
            } else if (initialValues?.id) {
                await systemAPI.menu.update(initialValues.id, payload);
                appMessage.success("Menu updated");
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
                    <DialogTitle>{mode === "create" ? "Create Menu" : "Edit Menu"}</DialogTitle>
                    <DialogDescription>
                        {isModuleOwned
                            ? "Override title, icon, sort order, and visibility. Module identity stays synchronized from its Manifest."
                            : "Configure menu hierarchy, permission code, and display order."}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <div className="grid gap-2">
                        <Label htmlFor="menu-parent">Parent Menu</Label>
                        <Select
                            value={parentId}
                            onValueChange={setParentId}
                            disabled={isModuleOwned}
                        >
                            <SelectTrigger id="menu-parent" className="w-full">
                                <SelectValue placeholder="Select parent menu" />
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
                        label={isModuleOwned ? "Menu Title" : "Menu Name"}
                        value={name}
                        placeholder="Enter menu name"
                        onChange={setName}
                    />
                    <TextField
                        id="menu-code"
                        label="Permission Code"
                        value={code}
                        placeholder="Enter permission code (e.g., system:menu:list)"
                        onChange={setCode}
                        disabled={isModuleOwned}
                    />
                    {isModuleOwned && initialValues?.path ? (
                        <div className="grid gap-2">
                            <Label htmlFor="menu-path">Route Path</Label>
                            <Input id="menu-path" value={initialValues.path} disabled />
                        </div>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="menu-type">Type</Label>
                            <Select
                                value={menuType}
                                onValueChange={setMenuType}
                                disabled={isModuleOwned}
                            >
                                <SelectTrigger id="menu-type" className="w-full">
                                    <SelectValue placeholder="Select menu type" />
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
                            <Label htmlFor="menu-status">Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger id="menu-status" className="w-full">
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
                    </div>
                    {isModuleOwned ? (
                        <div className="grid gap-2">
                            <Label htmlFor="menu-icon">Icon</Label>
                            <Select value={icon || undefined} onValueChange={setIcon}>
                                <SelectTrigger id="menu-icon" className="w-full">
                                    <SelectValue placeholder="Select icon" />
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
                        label="Sort Order"
                        value={sortOrder}
                        type="number"
                        min={0}
                        step={1}
                        placeholder="Enter sort order"
                        onChange={setSortOrder}
                    />
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

function DisableMenuDialog({ record, onSuccess }: { record: Menu.Item; onSuccess: () => void }) {
    const submit = async () => {
        await systemAPI.menu.delete(record.id);
        appMessage.success("Menu disabled");
        onSuccess();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost-destructive"
                    size="icon-sm"
                    aria-label="Disable menu"
                >
                    <StopCircleIcon />
                </Button>
            }
            title="Disable Menu"
            description={`This menu will be disabled. Disable ${record.name}?`}
            confirmLabel="Disable"
            destructive
            onConfirm={submit}
        />
    );
}

function MenuTypeBadge({ menuType }: { menuType: number }) {
    const meta = menuTypeMeta[menuType] ?? { label: "Unknown", variant: "outline" as const };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function MenuStatusBadge({ status }: { status: number }) {
    const meta = statusMeta[status] ?? { label: "Unknown", variant: "outline" as const };
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
