import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { insightsAPI } from "@/api";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function ProjectSelect({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const { data: projects = [] } = useQuery({
        queryKey: ["insights", "projects"],
        queryFn: insightsAPI.projects,
    });
    const active = projects.filter((project) => !project.archivedAt);
    useEffect(() => {
        if (!value && active[0]) onChange(active[0].id);
    }, [active, onChange, value]);
    return (
        <div className="flex min-w-64 flex-col gap-2">
            <Label>Project</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                    {active.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                            {project.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
