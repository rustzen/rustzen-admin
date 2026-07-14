import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TextFieldProps extends Omit<ComponentProps<typeof Input>, "onChange"> {
    label: string;
    onChange: (value: string) => void;
}

export function TextField({ id, label, value, onChange, ...props }: TextFieldProps) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
        </div>
    );
}
