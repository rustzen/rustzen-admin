import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TextFieldProps extends Omit<ComponentProps<typeof Input>, "onChange"> {
    label: string;
    onChange: (value: string) => void;
    containerClassName?: string;
}

export function TextField({
    id,
    label,
    value,
    onChange,
    containerClassName,
    ...props
}: TextFieldProps) {
    return (
        <div className={cn("grid gap-2", containerClassName)}>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                {...props}
            />
        </div>
    );
}
