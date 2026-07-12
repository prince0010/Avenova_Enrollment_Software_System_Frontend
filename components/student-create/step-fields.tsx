"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldConfig } from "./steps-config";

export function StepFields({
  fields,
  values,
  onChange,
  errors,
  columns = 2,
}: {
  fields: FieldConfig[];
  values: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
  errors: Record<string, string>;
  columns?: 1 | 2;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", columns === 2 && "sm:grid-cols-2")}>
      {fields.map((f) => (
        <div
          key={f.key}
          className={cn(
            "flex flex-col gap-2",
            columns === 2 && f.type === "textarea" && "sm:col-span-2"
          )}
        >
          {f.type !== "checkbox" && (
            <Label htmlFor={f.key}>
              {f.label}
              {f.required && <span className="text-destructive"> *</span>}
            </Label>
          )}
          {f.type === "text" && (
            <Input
              id={f.key}
              placeholder={f.placeholder}
              value={(values[f.key] as string) ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          )}
          {f.type === "tel" && (
            <Input
              id={f.key}
              type="tel"
              placeholder={f.placeholder}
              value={(values[f.key] as string) ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          )}
          {f.type === "date" && (
            <Input
              id={f.key}
              type="date"
              value={(values[f.key] as string) ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          )}
          {f.type === "textarea" && (
            <Textarea
              id={f.key}
              placeholder={f.placeholder}
              value={(values[f.key] as string) ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          )}
          {f.type === "select" && (
            <Select
              items={f.options?.map((o) => ({ value: o.value, label: o.label }))}
              value={(values[f.key] as string) ?? ""}
              onValueChange={(v) => v && onChange(f.key, v)}
            >
              <SelectTrigger id={f.key}>
                <SelectValue placeholder={`Select ${f.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {f.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {f.type === "checkbox" && (
            <div className="flex items-start gap-2">
              <Checkbox
                id={f.key}
                checked={!!values[f.key]}
                onCheckedChange={(c) => onChange(f.key, !!c)}
              />
              <Label htmlFor={f.key} className="text-sm font-normal leading-snug">
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
            </div>
          )}
          {errors[f.key] && <p className="text-sm text-destructive">{errors[f.key]}</p>}
        </div>
      ))}
    </div>
  );
}
