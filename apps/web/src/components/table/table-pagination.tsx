import { Button } from "@/components/ui/button";

interface TablePaginationProps {
    currentPage: number;
    totalPages: number;
    total: number;
    disabled?: boolean;
    onPageChange: (page: number) => void;
}

export function TablePagination({
    currentPage,
    totalPages,
    total,
    disabled = false,
    onPageChange,
}: TablePaginationProps) {
    return (
        <nav
            className="flex min-h-9 flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
            aria-label="表格分页"
        >
            <span className="tabular-nums">
                第 {currentPage} / {totalPages} 页 · 共 {total} 条
            </span>
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={currentPage <= 1 || disabled}
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                >
                    上一页
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={currentPage >= totalPages || disabled}
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                >
                    下一页
                </Button>
            </div>
        </nav>
    );
}
