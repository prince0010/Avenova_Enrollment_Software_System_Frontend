"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { EscortSummary, Student } from "@/lib/types";
import {
  ApiClientError,
  fetchBirthCertificate,
  fetchEscortIdImage,
  fetchStudentPhoto,
} from "@/lib/api-client";
import { formatPeso } from "@/lib/format";
import { TruncatedText } from "@/components/truncated-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EscortDetailDialog, type EscortImageState } from "@/components/escort-detail-dialog";
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

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiClientError ? err.message : fallback;
}

const linkClass =
  "cursor-pointer text-left underline underline-offset-2 hover:text-muted-foreground";

export function StudentViewDialog({
  student,
  open,
  onOpenChange,
}: {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Stored files need an authenticated fetch → blob object URL; a plain
  // <img src> can't carry the Authorization header.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [escortDetail, setEscortDetail] = useState<EscortSummary | null>(null);
  const [escortImage, setEscortImage] = useState<EscortImageState>({ status: "none" });
  const [certOpen, setCertOpen] = useState(false);
  const [cert, setCert] = useState<DocumentPreviewState>({ status: "loading" });

  // The fee snapshot frozen at enrollment confirmation, delivered with the
  // student record — deliberately NOT the live catalog, so later catalog
  // edits/deletes never rewrite what this student was actually charged.
  const enrollmentFees =
    student?.latestEnrollment?.status === "CONFIRMED" ? student.latestEnrollment.fees : [];

  useEffect(() => {
    if (!open || !student?.hasPhoto) return;
    let cancelled = false;
    let url: string | null = null;
    fetchStudentPhoto(student.id)
      .then(({ blob }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPhotoUrl(url);
      })
      .catch(() => {
        // Photo is a supplementary thumbnail here — the "Photo: On file" row
        // still communicates its existence if the fetch fails.
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setPhotoUrl(null);
    };
  }, [open, student?.id, student?.hasPhoto]);

  function openEscortDetail(escort: EscortSummary) {
    setEscortDetail(escort);
    if (!escort.hasIdImage || !student) {
      setEscortImage({ status: "none" });
      return;
    }
    setEscortImage({ status: "loading" });
    fetchEscortIdImage(student.id, escort.id)
      .then(({ blob }) => setEscortImage({ status: "ready", url: URL.createObjectURL(blob) }))
      .catch((err) =>
        setEscortImage({ status: "error", message: errorMessage(err, "Failed to load the ID image.") })
      );
  }

  function handleEscortDetailOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (escortImage.status === "ready") URL.revokeObjectURL(escortImage.url);
      setEscortDetail(null);
      setEscortImage({ status: "none" });
    }
  }

  function openBirthCertificate() {
    if (!student) return;
    setCertOpen(true);
    setCert({ status: "loading" });
    fetchBirthCertificate(student.id)
      .then(({ blob, contentType }) =>
        setCert({
          status: "ready",
          url: URL.createObjectURL(blob),
          isPdf: contentType.includes("pdf"),
        })
      )
      .catch((err) =>
        setCert({ status: "error", message: errorMessage(err, "Failed to load the birth certificate.") })
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
          {student && (
            <>
              <DialogHeader>
                <DialogTitle>{student.studentName}</DialogTitle>
                <DialogDescription>
                  {student.latestEnrollment
                    ? `Enrolled ${new Date(student.latestEnrollment.schoolYear).toLocaleDateString()}`
                    : "Not currently enrolled"}
                  {student.deletedAt &&
                    ` · archived ${new Date(student.deletedAt).toLocaleDateString()}`}
                </DialogDescription>
              </DialogHeader>
              <div className="relative flex flex-col gap-4">
                {photoUrl && (
                  // Blob object URL — next/image adds nothing here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={`${student.studentName} photo`}
                    className="absolute right-0 top-0 h-24 w-24 rounded-lg border object-cover"
                  />
                )}
                <Section
                  className={photoUrl ? "pr-28" : undefined}
                  title="Student"
                  rows={[
                    ["Student ID", student.studentNumber],
                    ["Name", student.studentName],
                    ["Nickname", student.nickname],
                    ["Date of birth", fmtDate(student.dateOfBirth)],
                    ["Gender", student.gender === "MALE" ? "Male" : "Female"],
                    ["Primary language", student.primaryLanguage],
                    [
                      "Birth certificate",
                      student.hasBirthCertificate ? (
                        <button type="button" onClick={openBirthCertificate} className={linkClass}>
                          View file
                        </button>
                      ) : null,
                    ],
                    ["Photo", student.hasPhoto ? "On file" : null],
                  ]}
                />
                <Section
                  title="Parent / Guardian"
                  rows={[
                    ["Mother", student.motherName],
                    ["Father", student.fatherName],
                    ["Guardian", student.guardianName],
                    ["Contact number", student.contactNumber],
                    ["Email", student.email],
                    ["Home address", student.homeAddress],
                    ["Emergency contact", student.emergencyContact],
                  ]}
                />
                <Section
                  title="Escort / Custody"
                  rows={student.escorts.map((e, i) => [
                    `Escort ${i + 1}`,
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => openEscortDetail(e)}
                      className={linkClass}
                    >
                      {e.name}
                    </button>,
                  ])}
                />
                <Section
                  title="Medical"
                  rows={[
                    ...student.diagnoses.map((d, i): [string, string] => [
                      `Diagnosis ${i + 1}`,
                      `${d.officialDiagnosis}${d.dateOfDiagnosis ? ` · ${fmtDate(d.dateOfDiagnosis)}` : ""}`,
                    ]),
                    [
                      "Allergies / dietary",
                      // Stored as one comma-separated string; shown as badges
                      // to match the wizard's allergy selector.
                      student.allergyDietaryRestrictions ? (
                        <span className="flex flex-wrap gap-1">
                          {student.allergyDietaryRestrictions
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
                    ["Medications", student.medications],
                    ["Medical condition", student.medicalCondition],
                  ]}
                />
                <Section
                  title="Developmental Intervention"
                  rows={[
                    ["Current / Past Therapies (If any)", student.currentPastTherapies],
                    ["Recommended Therapist", student.recommendedTherapist],
                    ["Previous Schooling / SPED (If any)", student.previousSchoolingSped],
                  ]}
                />
                <Section
                  title="Behavioral / Sensory"
                  rows={[
                    ["Sensory sensitivities", student.sensorySensitivities],
                    ["Triggers / meltdown signs", student.triggersAndMeltdownSigns],
                    ["Soothing techniques", student.soothingTechniques],
                    ["Communication style", student.communicationStyle],
                    ["Self-regulation skills", student.selfRegulationSkills],
                  ]}
                />
                <Section
                  title="Goals"
                  rows={[
                    ["Parent goals", student.parentGoals],
                    ["Strengths / interests", student.strengthsAndInterests],
                  ]}
                />
                {enrollmentFees.length > 0 && (
                  <Section
                    title="Fees (as of enrollment)"
                    rows={[
                      ...enrollmentFees.map((f): [string, ReactNode] => [
                        f.name,
                        <span key={f.id} className="tabular-nums">
                          {formatPeso(f.amount)}
                        </span>,
                      ]),
                      [
                        "Total",
                        <span key="total" className="font-medium tabular-nums">
                          {formatPeso(enrollmentFees.reduce((sum, f) => sum + Number(f.amount), 0))}
                        </span>,
                      ],
                    ]}
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <EscortDetailDialog
        open={escortDetail !== null}
        onOpenChange={handleEscortDetailOpenChange}
        name={escortDetail?.name ?? ""}
        phoneNumber={escortDetail?.phoneNumber ?? null}
        image={escortImage}
      />
      <DocumentPreviewDialog
        open={certOpen}
        onOpenChange={handleCertOpenChange}
        title="Birth certificate"
        description={student ? student.studentName : undefined}
        document={cert}
      />
    </>
  );
}
