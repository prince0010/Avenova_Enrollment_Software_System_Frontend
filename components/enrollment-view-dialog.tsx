"use client";

import type { Enrollment } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Section({
  title,
  rows,
}: {
  title: string;
  rows: [string, string | null | undefined][];
}) {
  const visible = rows.filter(([, v]) => v != null && v !== "");
  if (visible.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <dl className="grid grid-cols-[minmax(10rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
        {visible.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function yesNo(v: boolean) {
  return v ? "Yes" : "No";
}

export function EnrollmentViewDialog({
  enrollment,
  open,
  onOpenChange,
}: {
  enrollment: Enrollment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {enrollment && (
          <>
            <DialogHeader>
              <DialogTitle>{enrollment.student.studentName}</DialogTitle>
              <DialogDescription>
                School year {new Date(enrollment.schoolYear).toLocaleDateString()} · enrolled{" "}
                {new Date(enrollment.createdAt).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <Section
                title="Consents"
                rows={[
                  ["Emergency medical", yesNo(enrollment.emergencyMedicalConsent)],
                  ["Therapy assessment", yesNo(enrollment.therapyAssessmentConsent)],
                  ["Policy acknowledgement", yesNo(enrollment.policyAcknowledgement)],
                  ["Photo / video release", yesNo(enrollment.photoVideoRelease)],
                ]}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
