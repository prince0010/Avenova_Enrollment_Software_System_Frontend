"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Enrollment } from "@/lib/types";
import {
  ApiClientError,
  fetchSnapshotPhoto,
  fetchSnapshotBirthCertificate,
} from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/truncated-text";
import {
  DocumentPreviewDialog,
  type DocumentPreviewState,
} from "@/components/document-preview-dialog";

function Section({
  title,
  rows,
  className,
}: {
  title: string;
  rows: [string, ReactNode][];
  className?: string;
}) {
  const visible = rows.filter(([, v]) => v != null && v !== "");
  if (visible.length === 0) return null;
  return (
    <div className={className}>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <dl className="grid grid-cols-[minmax(10rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        {visible.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{typeof value === "string" ? <TruncatedText text={value} /> : value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString() : null;
}

const linkClass =
  "cursor-pointer text-left underline underline-offset-2 hover:text-muted-foreground";

// Read-only view of an enrollment's frozen student-data snapshot — "the
// student's record as it was that school year," including that year's photo
// and birth certificate, unaffected by any edits made since.
export function EnrollmentSnapshotDialog({
  enrollment,
  open,
  onOpenChange,
}: {
  enrollment: Enrollment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const snapshot = enrollment?.studentSnapshot ?? null;
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const [cert, setCert] = useState<DocumentPreviewState>({ status: "loading" });

  useEffect(() => {
    if (!open || !enrollment || !enrollment.studentSnapshot?.hasPhoto) return;
    let cancelled = false;
    let url: string | null = null;
    fetchSnapshotPhoto(enrollment.id)
      .then(({ blob }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPhotoUrl(url);
      })
      .catch(() => {
        // The photo is supplementary; the dialog still shows the data.
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setPhotoUrl(null);
    };
  }, [open, enrollment]);

  function openBirthCertificate() {
    if (!enrollment) return;
    setCertOpen(true);
    setCert({ status: "loading" });
    fetchSnapshotBirthCertificate(enrollment.id)
      .then(({ blob, contentType }) =>
        setCert({
          status: "ready",
          url: URL.createObjectURL(blob),
          isPdf: contentType.includes("pdf"),
        })
      )
      .catch((err) =>
        setCert({
          status: "error",
          message:
            err instanceof ApiClientError ? err.message : "Failed to load the birth certificate.",
        })
      );
  }

  function handleCertOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (cert.status === "ready") URL.revokeObjectURL(cert.url);
      setCertOpen(false);
      setCert({ status: "loading" });
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          {enrollment && snapshot && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {snapshot.studentName} — School Year{" "}
                  {new Date(enrollment.schoolYear).getFullYear()}
                </DialogTitle>
                <DialogDescription>
                  The record as frozen at enrollment confirmation
                  {snapshot.snapshotAt
                    ? ` on ${new Date(snapshot.snapshotAt).toLocaleDateString()}`
                    : ""}{" "}
                  — later edits to the live record don&apos;t change this.
                </DialogDescription>
              </DialogHeader>
              <div className="relative flex flex-col gap-4">
                {photoUrl && (
                  // Blob object URL — next/image adds nothing here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={`${snapshot.studentName} photo (this school year)`}
                    className="absolute right-0 top-0 h-24 w-24 rounded-lg border object-cover"
                  />
                )}
                <Section
                  className={photoUrl ? "pr-28" : undefined}
                  title="Student"
                  rows={[
                    ["Name", snapshot.studentName],
                    ["Nickname", snapshot.nickname],
                    ["Date of birth", fmtDate(snapshot.dateOfBirth)],
                    ["Gender", snapshot.gender === "MALE" ? "Male" : "Female"],
                    ["Primary language", snapshot.primaryLanguage],
                    [
                      "Birth certificate",
                      snapshot.hasBirthCertificate ? (
                        <button type="button" onClick={openBirthCertificate} className={linkClass}>
                          View file (as of this year)
                        </button>
                      ) : null,
                    ],
                  ]}
                />
                <Section
                  title="Parent / Guardian"
                  rows={[
                    ["Mother", snapshot.motherName],
                    ["Father", snapshot.fatherName],
                    ["Guardian", snapshot.guardianName],
                    ["Contact number", snapshot.contactNumber],
                    ["Email", snapshot.email],
                    ["Home address", snapshot.homeAddress],
                    ["Emergency contact", snapshot.emergencyContact],
                  ]}
                />
                <Section
                  title="Escort / Custody"
                  rows={snapshot.escorts.map((e, i) => [
                    `Escort ${i + 1}`,
                    `${e.name}${e.phoneNumber ? ` · ${e.phoneNumber}` : ""}`,
                  ])}
                />
                <Section
                  title="Medical"
                  rows={[
                    ...snapshot.diagnoses.map((d, i): [string, string] => [
                      `Diagnosis ${i + 1}`,
                      `${d.officialDiagnosis}${d.dateOfDiagnosis ? ` · ${fmtDate(d.dateOfDiagnosis)}` : ""}`,
                    ]),
                    [
                      "Allergies / dietary",
                      snapshot.allergyDietaryRestrictions ? (
                        <span className="flex flex-wrap gap-1">
                          {snapshot.allergyDietaryRestrictions
                            .split(",")
                            .map((n) => n.trim())
                            .filter(Boolean)
                            .map((n) => (
                              <Badge key={n} variant="secondary">
                                {n}
                              </Badge>
                            ))}
                        </span>
                      ) : null,
                    ],
                    ["Medications", snapshot.medications],
                    ["Medical condition", snapshot.medicalCondition],
                  ]}
                />
                <Section
                  title="Developmental Intervention"
                  rows={[
                    ["Current / Past Therapies (If any)", snapshot.currentPastTherapies],
                    ["Recommended Therapist", snapshot.recommendedTherapist],
                    ["Previous Schooling / SPED (If any)", snapshot.previousSchoolingSped],
                  ]}
                />
                <Section
                  title="Behavioral / Sensory"
                  rows={[
                    ["Sensory sensitivities", snapshot.sensorySensitivities],
                    ["Triggers / meltdown signs", snapshot.triggersAndMeltdownSigns],
                    ["Soothing techniques", snapshot.soothingTechniques],
                    ["Communication style", snapshot.communicationStyle],
                    ["Self-regulation skills", snapshot.selfRegulationSkills],
                  ]}
                />
                <Section
                  title="Goals"
                  rows={[
                    ["Parent goals", snapshot.parentGoals],
                    ["Strengths / interests", snapshot.strengthsAndInterests],
                  ]}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <DocumentPreviewDialog
        open={certOpen}
        onOpenChange={handleCertOpenChange}
        title="Birth certificate (as of this school year)"
        description={snapshot?.studentName}
        document={cert}
      />
    </>
  );
}
