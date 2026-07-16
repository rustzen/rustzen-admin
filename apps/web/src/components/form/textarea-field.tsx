import type { ComponentProps } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TextareaFieldProps extends Omit<ComponentProps<typeof Textarea>, "onChange"> {
    label: string;
    onChange: (value: string) => void;
}

export function TextareaField({ id, label, value, onChange, ...props }: TextareaFieldProps) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Textarea
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                {...props}
            />
        </div>
    );
}
