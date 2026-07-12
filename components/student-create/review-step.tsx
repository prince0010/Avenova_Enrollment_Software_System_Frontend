"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { EscortDetailDialog } from "@/components/escort-detail-dialog";
import { DocumentPreviewDialog } from "@/components/document-preview-dialog";

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
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground">
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

const linkClass =
  "cursor-pointer text-left underline underline-offset-2 hover:text-muted-foreground";

export function ReviewStep({
  values,
  escorts,
  diagnoses,
  allergies,
  birthCertificate,
  studentPhoto,
  photoPreviewUrl,
}: {
  values: Record<string, string | boolean>;
  escorts: { name: string; phoneNumber: string; image: File | null }[];
  diagnoses: { officialDiagnosis: string; dateOfDiagnosis: string }[];
  allergies: string[];
  birthCertificate: File | null;
  studentPhoto: File | null;
  photoPreviewUrl: string | null;
}) {
  const s = (k: string) => (values[k] as string) ?? null;
  const b = (k: string) => Boolean(values[k]);
  const genderRaw = s("gender");
  const genderLabel = genderRaw === "MALE" ? "Male" : genderRaw === "FEMALE" ? "Female" : null;

  // Everything here is still a local File (nothing uploaded yet), so previews
  // are plain object URLs — no authenticated fetch like the post-create views.
  const [escortIndex, setEscortIndex] = useState<number | null>(null);
  const [certOpen, setCertOpen] = useState(false);

  const selectedEscort = escortIndex != null ? escorts[escortIndex] : null;
  const selectedEscortImage = selectedEscort?.image ?? null;
  const escortImageUrl = useMemo(
    () => (selectedEscortImage ? URL.createObjectURL(selectedEscortImage) : null),
    [selectedEscortImage]
  );
  useEffect(() => {
    return () => {
      if (escortImageUrl) URL.revokeObjectURL(escortImageUrl);
    };
  }, [escortImageUrl]);

  const certUrl = useMemo(
    () => (birthCertificate ? URL.createObjectURL(birthCertificate) : null),
    [birthCertificate]
  );
  useEffect(() => {
    return () => {
      if (certUrl) URL.revokeObjectURL(certUrl);
    };
  }, [certUrl]);

  return (
    <div className="relative flex flex-col gap-4">
      {photoPreviewUrl && (
        // Blob object URL — next/image adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoPreviewUrl}
          alt="Student photo"
          className="absolute right-0 top-0 h-32 w-32 rounded-lg border object-cover"
        />
      )}
      <Section
        className={photoPreviewUrl ? "pr-36" : undefined}
        title="Student"
        rows={[
          [
            "Name",
            [s("firstName"), s("middleName"), s("lastName"), s("suffix")]
              .filter(Boolean)
              .join(" ") || null,
          ],
          ["Nickname", s("nickname")],
          ["Date of birth", s("dateOfBirth")],
          ["Gender", genderLabel],
          ["Primary language", s("primaryLanguage")],
          [
            "Birth certificate",
            birthCertificate ? (
              <button type="button" onClick={() => setCertOpen(true)} className={linkClass}>
                {birthCertificate.name}
              </button>
            ) : null,
          ],
          ["Student photo", studentPhoto?.name ?? null],
        ]}
      />
      <Section
        title="Parent / Guardian"
        rows={[
          ["Mother", s("motherName")],
          ["Father", s("fatherName")],
          ["Guardian", s("guardianName")],
          ["Contact number", s("contactNumber")],
          ["Email", s("email")],
          ["Home address", s("homeAddress")],
          ["Emergency contact name", s("emergencyContactName")],
          ["Emergency contact number", s("emergencyContact")],
        ]}
      />
      <Section
        title="Escort / Custody"
        rows={escorts.map((e, i) => [
          `Escort ${i + 1}`,
          <span key={i}>
            <button type="button" onClick={() => setEscortIndex(i)} className={linkClass}>
              {e.name || "—"}
            </button>
            {e.phoneNumber ? ` · ${e.phoneNumber}` : ""}
            {` — ${e.image ? e.image.name : "no image selected"}`}
          </span>,
        ])}
      />
      <Section
        title="Medical"
        rows={[
          ...diagnoses.map((d, i): [string, string] => [
            `Diagnosis ${i + 1}`,
            `${d.officialDiagnosis || "—"}${d.dateOfDiagnosis ? ` · ${new Date(d.dateOfDiagnosis).toLocaleDateString()}` : ""}`,
          ]),
          [
            "Allergies / dietary",
            allergies.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {allergies.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </span>
            ) : null,
          ],
          ["Medications", s("medications")],
          ["Medical condition", s("medicalCondition")],
        ]}
      />
      <Section
        title="Developmental Intervention"
        rows={[
          ["Current / past therapies", s("currentPastTherapies")],
          ["Recommended therapist", s("recommendedTherapist")],
          ["Previous schooling / SPED", s("previousSchoolingSped")],
        ]}
      />
      <Section
        title="Behavioral / Sensory"
        rows={[
          ["Sensory sensitivities", s("sensorySensitivities")],
          ["Triggers / meltdown signs", s("triggersAndMeltdownSigns")],
          ["Soothing techniques", s("soothingTechniques")],
          ["Communication style", s("communicationStyle")],
          ["Self-regulation skills", s("selfRegulationSkills")],
        ]}
      />
      <Section
        title="Goals"
        rows={[
          ["Parent goals", s("parentGoals")],
          ["Strengths / interests", s("strengthsAndInterests")],
        ]}
      />
      <Section title="Enrollment" rows={[["Date of Enrollment", s("schoolYear") ? new Date(s("schoolYear")!).toLocaleDateString() : null]]} />
      <Section
        title="Consents"
        rows={[
          ["Emergency medical", yesNo(b("emergencyMedicalConsent"))],
          ["Therapy assessment", yesNo(b("therapyAssessmentConsent"))],
          ["Policy acknowledgement", yesNo(b("policyAcknowledgement"))],
          ["Photo / video release", yesNo(b("photoVideoRelease"))],
        ]}
      />
      <EscortDetailDialog
        open={escortIndex !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEscortIndex(null);
        }}
        name={selectedEscort?.name || "Escort"}
        phoneNumber={selectedEscort?.phoneNumber || null}
        image={
          selectedEscort?.image && escortImageUrl
            ? { status: "ready", url: escortImageUrl }
            : { status: "none" }
        }
      />
      <DocumentPreviewDialog
        open={certOpen}
        onOpenChange={setCertOpen}
        title="Birth certificate"
        description={birthCertificate?.name}
        document={
          certUrl && birthCertificate
            ? {
                status: "ready",
                url: certUrl,
                isPdf: birthCertificate.type === "application/pdf",
              }
            : { status: "error", message: "No file selected." }
        }
      />
    </div>
  );
}
