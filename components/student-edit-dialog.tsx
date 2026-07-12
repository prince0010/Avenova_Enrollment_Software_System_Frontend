"use client";

import { useState, type FormEvent } from "react";
import { updateStudent, ApiClientError } from "@/lib/api-client";
import type { Student, StudentUpdateInput, Gender } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FieldKey = keyof StudentUpdateInput;

const NAME_KEYS: FieldKey[] = ["firstName", "middleName", "lastName", "suffix", "nickname"];

const TEXT_FIELDS: { key: FieldKey; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "middleName", label: "Middle name" },
  { key: "lastName", label: "Last name" },
  { key: "suffix", label: "Suffix" },
  { key: "nickname", label: "Nickname" },
  { key: "primaryLanguage", label: "Primary language" },
  { key: "motherName", label: "Mother's name" },
  { key: "fatherName", label: "Father's name" },
  { key: "guardianName", label: "Guardian's name" },
  { key: "contactNumber", label: "Contact number" },
  { key: "email", label: "Email" },
  { key: "homeAddress", label: "Home address" },
  { key: "emergencyContact", label: "Emergency contact" },
];

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

// The form mounts fresh each open (Base UI unmounts dialog content when
// closed), so state initializes straight from the student prop — no reset
// effect needed.
function EditForm({
  student,
  onSaved,
  onOpenChange,
}: {
  student: Student;
  onSaved: (updated: Student) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const f of TEXT_FIELDS) {
      next[f.key] = (student[f.key as keyof Student] as string | null) ?? "";
    }
    return next;
  });
  const [gender, setGender] = useState<Gender>(student.gender);
  const [dateOfBirth, setDateOfBirth] = useState(toDateInputValue(student.dateOfBirth));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Send only changed, non-empty fields — the backend rejects empty strings.
    const payload: StudentUpdateInput = {};
    for (const f of TEXT_FIELDS) {
      const current = (student[f.key as keyof Student] as string | null) ?? "";
      const next = values[f.key]?.trim() ?? "";
      if (next !== "" && next !== current) {
        payload[f.key] = next as never;
      }
    }
    if (gender !== student.gender) payload.gender = gender;
    if (dateOfBirth && dateOfBirth !== toDateInputValue(student.dateOfBirth)) {
      payload.dateOfBirth = dateOfBirth;
    }

    if (Object.keys(payload).length === 0) {
      setError("No changes to save.");
      return;
    }

    setIsSaving(true);
    try {
      const { student: updated } = await updateStudent(student.id, payload);
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.filter((f) => NAME_KEYS.includes(f.key)).map((f) => (
          <div key={f.key} className="flex flex-col gap-2">
            <Label htmlFor={`edit-${f.key}`}>{f.label}</Label>
            <Input
              id={`edit-${f.key}`}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-dob">Date of birth</Label>
          <Input
            id="edit-dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-gender">Gender</Label>
          <Select
            items={[
              { value: "MALE", label: "Male" },
              { value: "FEMALE", label: "Female" },
            ]}
            value={gender}
            onValueChange={(v) => v && setGender(v as Gender)}
          >
            <SelectTrigger id="edit-gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {TEXT_FIELDS.filter((f) => !NAME_KEYS.includes(f.key)).map((f) => (
          <div key={f.key} className="flex flex-col gap-2">
            <Label htmlFor={`edit-${f.key}`}>{f.label}</Label>
            <Input
              id={`edit-${f.key}`}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function StudentEditDialog({
  student,
  open,
  onOpenChange,
  onSaved,
}: {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Student) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit student</DialogTitle>
          <DialogDescription>
            Update {student?.studentName}&apos;s record.
          </DialogDescription>
        </DialogHeader>
        {student && (
          <EditForm student={student} onSaved={onSaved} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}
