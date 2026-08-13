"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Gender, Student, StudentUpdateInput } from "@/lib/types";
import { BIRTH_CERT_MAX_BYTES, IMAGE_MAX_BYTES, fileSizeError } from "@/lib/upload-limits";
import {
  updateStudent,
  uploadStudentPhoto,
  uploadBirthCertificate,
  uploadEscortIdImage,
  fetchStudentPhoto,
  fetchBirthCertificate,
  fetchEscortIdImage,
  addEscort,
  updateEscort,
  deleteEscort,
  addDiagnosis,
  updateDiagnosis,
  deleteDiagnosis,
  ApiClientError,
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { CameraCapture } from "@/components/student-create/camera-capture";
import { Stepper } from "@/components/student-create/stepper";
import { COMMON_ALLERGIES } from "@/components/student-create/steps-config";
import {
  DocumentPreviewDialog,
  type DocumentPreviewState,
} from "@/components/document-preview-dialog";

// Stored files need an authenticated fetch -> blob object URL; a plain
// <img src> can't carry the Authorization header (same as the View dialog).
const linkClass =
  "cursor-pointer text-left underline underline-offset-2 hover:text-foreground";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiClientError ? err.message : fallback;
}

// The same section order as the intake wizard and the re-enroll dialog, minus
// Enrollment/Consents — those live on Enrollment (per school year), not on the
// student's permanent record, so they have no place in a profile edit.
const STEPS = [
  { id: "student", label: "Student" },
  { id: "parent", label: "Parent / Guardian" },
  { id: "escort", label: "Escorts" },
  { id: "medical", label: "Medical" },
  { id: "developmental", label: "Developmental" },
  { id: "behavioral", label: "Behavioral" },
  { id: "goals", label: "Goals" },
  { id: "review", label: "Review" },
];

type TextFieldKey = keyof StudentUpdateInput & string;

const STUDENT_FIELDS: { key: TextFieldKey; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "middleName", label: "Middle name" },
  { key: "lastName", label: "Last name" },
  { key: "suffix", label: "Suffix" },
  { key: "nickname", label: "Nickname" },
  { key: "primaryLanguage", label: "Primary language" },
];

// Emergency contact is split into name + number here exactly as the wizard
// does, and recombined into the backend's single string at submit.
const PARENT_FIELDS: { key: TextFieldKey; label: string }[] = [
  { key: "motherName", label: "Mother's name" },
  { key: "fatherName", label: "Father's name" },
  { key: "guardianName", label: "Guardian's name" },
  { key: "contactNumber", label: "Contact number" },
  { key: "email", label: "Email" },
  { key: "homeAddress", label: "Home address" },
];

const MEDICAL_FIELDS: { key: TextFieldKey; label: string }[] = [
  { key: "medications", label: "Medications" },
  { key: "medicalCondition", label: "Medical condition" },
];

const DEVELOPMENTAL_FIELDS: { key: TextFieldKey; label: string }[] = [
  { key: "currentPastTherapies", label: "Current / Past Therapies (If any)" },
  { key: "recommendedTherapist", label: "Recommended Therapist (If any)" },
  { key: "previousSchoolingSped", label: "Previous Schooling / SPED (If any)" },
];

const BEHAVIORAL_FIELDS: { key: TextFieldKey; label: string }[] = [
  { key: "sensorySensitivities", label: "Sensory sensitivities" },
  { key: "triggersAndMeltdownSigns", label: "Triggers / meltdown signs" },
  { key: "soothingTechniques", label: "Soothing techniques" },
  { key: "communicationStyle", label: "Communication style" },
  { key: "selfRegulationSkills", label: "Self-regulation skills" },
];

const GOAL_FIELDS: { key: TextFieldKey; label: string }[] = [
  { key: "parentGoals", label: "Parent goals" },
  { key: "strengthsAndInterests", label: "Strengths / interests" },
];

const ALL_TEXTAREA_FIELDS = [
  ...MEDICAL_FIELDS,
  ...DEVELOPMENTAL_FIELDS,
  ...BEHAVIORAL_FIELDS,
  ...GOAL_FIELDS,
];

const ALL_DIFFED_FIELDS = [...STUDENT_FIELDS, ...PARENT_FIELDS, ...ALL_TEXTAREA_FIELDS];

// Fields the backend types as plain `z.string()` rather than `.min(1)`, so they
// accept "" and can genuinely be blanked out — everything in sections 4-7 plus
// the allergy string. The identity/parent fields are `.min(1)` and would 400 on
// an empty value, so a blank there is treated as "leave unchanged" instead.
const CLEARABLE_KEYS = new Set<string>([
  ...ALL_TEXTAREA_FIELDS.map((f) => f.key),
  "allergyDietaryRestrictions",
]);

const GENDER_ITEMS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

interface EscortEntry {
  id: string | null; // null = newly added, not yet saved
  name: string;
  phoneNumber: string;
  hasIdImage: boolean;
  newImage: File | null;
  newImageError: string | null;
}

interface DiagnosisEntry {
  id: string | null;
  officialDiagnosis: string;
  dateOfDiagnosis: string; // yyyy-mm-dd or ""
}

function splitEmergencyContact(value: string): [string, string] {
  const idx = value.indexOf(" - ");
  if (idx === -1) return [value, ""];
  return [value.slice(0, idx), value.slice(idx + 3)];
}

function TextFieldGrid({
  fields,
  values,
  onChange,
  textarea = false,
}: {
  fields: { key: TextFieldKey; label: string }[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  textarea?: boolean;
}) {
  return (
    <>
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <Label htmlFor={`edit-${f.key}`}>{f.label}</Label>
          {textarea ? (
            <Textarea
              id={`edit-${f.key}`}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          ) : (
            <Input
              id={`edit-${f.key}`}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </>
  );
}

function ReviewRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

// The full profile edit, mirroring the intake wizard section by section so the
// form staff fill in at enrolment is the same one they correct afterwards.
// Everything saves on the final step only; nothing is written as you page
// through. Past school years' snapshots are untouched by any of it — those were
// frozen at confirmation and never re-read from the live record.
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
    for (const f of ALL_DIFFED_FIELDS) {
      next[f.key] = (student[f.key as keyof Student] as string | null) ?? "";
    }
    return next;
  });
  const [gender, setGender] = useState<Gender>(student.gender);
  const [dateOfBirth, setDateOfBirth] = useState(student.dateOfBirth.slice(0, 10));
  const initialEmergency = splitEmergencyContact(student.emergencyContact);
  const [emergencyName, setEmergencyName] = useState(initialEmergency[0]);
  const [emergencyNumber, setEmergencyNumber] = useState(initialEmergency[1]);

  const [escorts, setEscorts] = useState<EscortEntry[]>(() =>
    student.escorts.map((e) => ({
      id: e.id,
      name: e.name,
      phoneNumber: e.phoneNumber ?? "",
      hasIdImage: e.hasIdImage,
      newImage: null,
      newImageError: null,
    }))
  );
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>(() =>
    student.diagnoses.map((d) => ({
      id: d.id,
      officialDiagnosis: d.officialDiagnosis,
      dateOfDiagnosis: d.dateOfDiagnosis ? d.dateOfDiagnosis.slice(0, 10) : "",
    }))
  );
  const [allergies, setAllergies] = useState<string[]>(() =>
    (student.allergyDietaryRestrictions ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const [customAllergy, setCustomAllergy] = useState("");

  const [studentPhoto, setStudentPhoto] = useState<File | null>(null);
  const [studentPhotoError, setStudentPhotoError] = useState<string | null>(null);
  const [birthCertificate, setBirthCertificate] = useState<File | null>(null);
  const [birthCertificateError, setBirthCertificateError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  // The photo already on file, shown next to the replace controls so staff can
  // see what they're about to overwrite. Fetched authenticated, like the View
  // dialog does — a plain <img src> can't carry the Authorization header.
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!student.hasPhoto) return;
    let cancelled = false;
    let url: string | null = null;
    fetchStudentPhoto(student.id)
      .then(({ blob }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCurrentPhotoUrl(url);
      })
      .catch(() => {
        // Supplementary thumbnail — the "A photo is on file" line below still
        // communicates that one exists if this fetch fails.
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setCurrentPhotoUrl(null);
    };
  }, [student.id, student.hasPhoto]);

  // One reusable preview for the birth certificate and each escort's ID image;
  // DocumentPreviewDialog renders images inline and PDFs in an iframe.
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPreviewState>({ status: "loading" });

  function openPreview(title: string, load: () => Promise<{ blob: Blob; contentType: string }>) {
    setPreviewTitle(title);
    setPreview({ status: "loading" });
    load()
      .then(({ blob, contentType }) =>
        setPreview({
          status: "ready",
          url: URL.createObjectURL(blob),
          isPdf: contentType.includes("pdf"),
        })
      )
      .catch((err) =>
        setPreview({ status: "error", message: errorMessage(err, "Failed to load the file.") })
      );
  }

  function handlePreviewOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (preview.status === "ready") URL.revokeObjectURL(preview.url);
      setPreviewTitle(null);
      setPreview({ status: "loading" });
    }
  }

  // Replacement documents are filed under the student's current school year,
  // the same bucket the re-enroll dialog uses; omitted if they've never been
  // enrolled (the backend treats schoolYear as optional).
  const currentSchoolYear = student.latestEnrollment?.schoolYear;

  function handleStudentPhotoChange(file: File | null) {
    const error = file ? fileSizeError(file, IMAGE_MAX_BYTES) : null;
    setStudentPhotoError(error);
    setStudentPhoto(error ? null : file);
  }

  function handleBirthCertificateChange(file: File | null) {
    const error = file ? fileSizeError(file, BIRTH_CERT_MAX_BYTES) : null;
    setBirthCertificateError(error);
    setBirthCertificate(error ? null : file);
  }

  function updateEscortNewImage(index: number, file: File | null) {
    const error = file ? fileSizeError(file, IMAGE_MAX_BYTES) : null;
    setEscorts((list) =>
      list.map((x, idx) =>
        idx === index ? { ...x, newImage: error ? null : file, newImageError: error } : x
      )
    );
  }

  function goToStep(index: number) {
    setFormError(null);
    setStep(index);
  }

  // The rules for one step, shared by Next and by submit. Because any step can
  // be jumped to directly, Next alone can't be the only gate — submit re-checks
  // every step so a section that was never visited can't push invalid data.
  function validateStep(stepId: string): string | null {
    if (stepId === "student" && (!values.firstName?.trim() || !values.lastName?.trim())) {
      return "First and last name are required.";
    }
    if (
      stepId === "parent" &&
      !values.motherName?.trim() &&
      !values.fatherName?.trim() &&
      !values.guardianName?.trim()
    ) {
      return "At least one of mother, father, or guardian is required.";
    }
    if (stepId === "escort" && escorts.some((e) => !e.name.trim())) {
      return "Every escort needs a name.";
    }
    if (stepId === "medical" && diagnoses.some((d) => !d.officialDiagnosis.trim())) {
      return "Every diagnosis needs a name.";
    }
    return null;
  }

  function firstInvalidStep(): { index: number; message: string } | null {
    for (let i = 0; i < STEPS.length; i++) {
      const message = validateStep(STEPS[i].id);
      if (message) return { index: i, message };
    }
    return null;
  }

  function handleNext() {
    const message = validateStep(STEPS[step].id);
    if (message) {
      setFormError(message);
      return;
    }
    goToStep(step + 1);
  }

  function setField(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const photoPreviewUrl = useMemo(
    () => (studentPhoto ? URL.createObjectURL(studentPhoto) : null),
    [studentPhoto]
  );
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  function toggleAllergy(name: string) {
    setAllergies((list) =>
      list.includes(name) ? list.filter((a) => a !== name) : [...list, name]
    );
  }

  function addCustomAllergy() {
    const name = customAllergy.trim();
    if (!name) return;
    setAllergies((list) =>
      list.some((a) => a.toLowerCase() === name.toLowerCase()) ? list : [...list, name]
    );
    setCustomAllergy("");
  }

  async function handleSubmit() {
    // Any step can be reached directly, so re-check them all here and drop the
    // user on the offending one rather than letting the backend 400.
    const invalid = firstInvalidStep();
    if (invalid) {
      goToStep(invalid.index);
      setFormError(invalid.message);
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      // Tracks the freshest server copy across the sequence below — each
      // granular endpoint returns the whole refreshed student.
      let updatedStudent: Student | null = null;

      // 1. Plain-field changes: only what actually changed. Emptying an
      // optional section 4-7 field really does clear it; emptying a required
      // one is ignored rather than sent, since the backend's .min(1) would 400.
      const changes: StudentUpdateInput = {};
      for (const f of ALL_DIFFED_FIELDS) {
        const current = (student[f.key as keyof Student] as string | null) ?? "";
        const next = values[f.key]?.trim() ?? "";
        if (next === current) continue;
        if (next === "" && !CLEARABLE_KEYS.has(f.key)) continue;
        changes[f.key] = next as never;
      }
      if (gender !== student.gender) changes.gender = gender;
      if (dateOfBirth && dateOfBirth !== student.dateOfBirth.slice(0, 10)) {
        changes.dateOfBirth = dateOfBirth;
      }
      const combinedEmergency = [emergencyName.trim(), emergencyNumber.trim()]
        .filter(Boolean)
        .join(" - ");
      if (combinedEmergency && combinedEmergency !== student.emergencyContact) {
        changes.emergencyContact = combinedEmergency;
      }
      // Clearing every allergy chip is a real change worth sending — unlike the
      // re-enroll dialog, this form can blank the field back out.
      const joinedAllergies = allergies.join(", ");
      if (joinedAllergies !== (student.allergyDietaryRestrictions ?? "")) {
        changes.allergyDietaryRestrictions = joinedAllergies;
      }
      if (Object.keys(changes).length > 0) {
        updatedStudent = (await updateStudent(student.id, changes)).student;
      }

      // 2. Escort diffs: remove, update, add (+ new ID images).
      for (const original of student.escorts) {
        if (!escorts.some((e) => e.id === original.id)) {
          updatedStudent = (await deleteEscort(student.id, original.id)).student;
        }
      }
      for (const entry of escorts) {
        if (entry.id) {
          const original = student.escorts.find((e) => e.id === entry.id);
          const nameChanged = original && entry.name.trim() !== original.name;
          const phoneChanged =
            original && entry.phoneNumber.trim() !== (original.phoneNumber ?? "");
          if (nameChanged || phoneChanged) {
            updatedStudent = (
              await updateEscort(student.id, entry.id, {
                ...(nameChanged ? { name: entry.name.trim() } : {}),
                ...(phoneChanged ? { phoneNumber: entry.phoneNumber.trim() || null } : {}),
              })
            ).student;
          }
          if (entry.newImage) {
            updatedStudent = (
              await uploadEscortIdImage(student.id, entry.id, entry.newImage, currentSchoolYear)
            ).student;
          }
        } else {
          const res = await addEscort(student.id, {
            name: entry.name.trim(),
            phoneNumber: entry.phoneNumber.trim() || undefined,
          });
          updatedStudent = res.student;
          // Escorts come back ordered by createdAt asc — the new one is last.
          const created = res.student.escorts[res.student.escorts.length - 1];
          if (entry.newImage && created) {
            updatedStudent = (
              await uploadEscortIdImage(student.id, created.id, entry.newImage, currentSchoolYear)
            ).student;
          }
        }
      }

      // 3. Diagnosis diffs.
      for (const original of student.diagnoses) {
        if (!diagnoses.some((d) => d.id === original.id)) {
          updatedStudent = (await deleteDiagnosis(student.id, original.id)).student;
        }
      }
      for (const entry of diagnoses) {
        if (entry.id) {
          const original = student.diagnoses.find((d) => d.id === entry.id);
          const textChanged =
            original && entry.officialDiagnosis.trim() !== original.officialDiagnosis;
          const originalDate = original?.dateOfDiagnosis
            ? original.dateOfDiagnosis.slice(0, 10)
            : "";
          const dateChanged = original && entry.dateOfDiagnosis !== originalDate;
          if (textChanged || dateChanged) {
            updatedStudent = (
              await updateDiagnosis(student.id, entry.id, {
                ...(textChanged ? { officialDiagnosis: entry.officialDiagnosis.trim() } : {}),
                ...(dateChanged ? { dateOfDiagnosis: entry.dateOfDiagnosis || null } : {}),
              })
            ).student;
          }
        } else {
          updatedStudent = (
            await addDiagnosis(student.id, {
              officialDiagnosis: entry.officialDiagnosis.trim(),
              dateOfDiagnosis: entry.dateOfDiagnosis || undefined,
            })
          ).student;
        }
      }

      // 4. Replacement documents (old files stay on disk for past snapshots).
      if (studentPhoto) {
        updatedStudent = (
          await uploadStudentPhoto(student.id, studentPhoto, currentSchoolYear)
        ).student;
      }
      if (birthCertificate) {
        updatedStudent = (
          await uploadBirthCertificate(student.id, birthCertificate, currentSchoolYear)
        ).student;
      }

      if (!updatedStudent) {
        setFormError("No changes to save.");
        setIsSubmitting(false);
        return;
      }

      onSaved(updatedStudent);
      onOpenChange(false);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const stepId = STEPS[step].id;
  const composedName = [values.firstName, values.middleName, values.lastName, values.suffix]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Every step is reachable immediately, unlike the create wizard: this
          record already exists and every section already holds valid data, so
          there's nothing to progressively unlock — jumping straight to the one
          field you came to fix beats clicking Next six times. validateAll()
          below is what keeps a skipped-past step from submitting junk. */}
      <Stepper
        steps={STEPS}
        currentIndex={step}
        maxCompletedIndex={STEPS.length - 1}
        onStepClick={goToStep}
      />

      {/* Fixed-height scroll area so the dialog doesn't resize per step. */}
      <div className="-mr-2 flex-1 overflow-y-auto pr-2">
        {stepId === "student" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Corrections here update the permanent record. Past school years&apos; statements,
              fees, and frozen snapshots are unaffected.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextFieldGrid fields={STUDENT_FIELDS} values={values} onChange={setField} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-dob">Date of birth</Label>
                <Input
                  id="edit-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-gender">Gender</Label>
                <Select
                  items={GENDER_ITEMS}
                  value={gender}
                  onValueChange={(v) => v && setGender(v as Gender)}
                >
                  <SelectTrigger id="edit-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_ITEMS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Student photo</Label>
                {/* The photo on file sits next to the new one so it's obvious
                    what's being replaced — and obvious when nothing is. */}
                <div className="flex items-center gap-3">
                  {currentPhotoUrl ? (
                    <figure className="flex flex-col items-center gap-1">
                      {/* Blob object URL — next/image adds nothing here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentPhotoUrl}
                        alt={`${student.studentName}'s current photo`}
                        className="h-16 w-16 rounded-lg border object-cover"
                      />
                      <figcaption className="text-[10px] text-muted-foreground">
                        Current
                      </figcaption>
                    </figure>
                  ) : student.hasPhoto ? (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border text-[10px] text-muted-foreground">
                      Loading
                    </div>
                  ) : null}
                  {photoPreviewUrl && (
                    <figure className="flex flex-col items-center gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreviewUrl}
                        alt="New student photo preview"
                        className="h-16 w-16 rounded-lg border object-cover"
                      />
                      <figcaption className="text-[10px] font-medium">New</figcaption>
                    </figure>
                  )}
                  <CameraCapture onCapture={handleStudentPhotoChange} />
                </div>
                <Input
                  id="edit-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-invalid={studentPhotoError ? true : undefined}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    handleStudentPhotoChange(file);
                    if (file && fileSizeError(file, IMAGE_MAX_BYTES)) e.target.value = "";
                  }}
                />
                {studentPhotoError ? (
                  <p className="text-xs text-destructive">{studentPhotoError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {studentPhoto
                      ? `Selected: ${studentPhoto.name}`
                      : student.hasPhoto
                        ? "A photo is on file — leave empty to keep it."
                        : "No photo on file yet."}{" "}
                    JPEG, PNG, or WEBP, up to 5MB.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-birth-cert">Birth certificate</Label>
                {student.hasBirthCertificate && (
                  <button
                    type="button"
                    className={`${linkClass} self-start text-sm text-muted-foreground`}
                    onClick={() =>
                      openPreview("Birth certificate", () => fetchBirthCertificate(student.id))
                    }
                  >
                    View current file
                  </button>
                )}
                <Input
                  id="edit-birth-cert"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  aria-invalid={birthCertificateError ? true : undefined}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    handleBirthCertificateChange(file);
                    if (file && fileSizeError(file, BIRTH_CERT_MAX_BYTES)) e.target.value = "";
                  }}
                />
                {birthCertificateError ? (
                  <p className="text-xs text-destructive">{birthCertificateError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {birthCertificate
                      ? `Selected: ${birthCertificate.name}`
                      : student.hasBirthCertificate
                        ? "A birth certificate is on file — leave empty to keep it."
                        : "No birth certificate on file yet."}{" "}
                    JPEG, PNG, WEBP, or PDF, up to 10MB.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {stepId === "parent" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextFieldGrid fields={PARENT_FIELDS} values={values} onChange={setField} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-ec-name">Emergency contact name</Label>
              <Input
                id="edit-ec-name"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-ec-number">Emergency contact number</Label>
              <Input
                id="edit-ec-number"
                type="tel"
                value={emergencyNumber}
                onChange={(e) => setEmergencyNumber(e.target.value)}
              />
            </div>
          </div>
        )}

        {stepId === "escort" && (
          <div className="flex flex-col gap-4">
            {escorts.map((escort, i) => (
              <div
                key={escort.id ?? `new-${i}`}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Escort {i + 1}
                    {!escort.id && <span className="ml-1 text-muted-foreground">(new)</span>}
                  </span>
                  {escorts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove escort ${i + 1}`}
                      onClick={() => setEscorts((list) => list.filter((_, idx) => idx !== i))}
                    >
                      <X />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`edit-escort-name-${i}`}>
                      Escort name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`edit-escort-name-${i}`}
                      value={escort.name}
                      onChange={(e) =>
                        setEscorts((list) =>
                          list.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`edit-escort-phone-${i}`}>Phone number</Label>
                    <Input
                      id={`edit-escort-phone-${i}`}
                      type="tel"
                      value={escort.phoneNumber}
                      onChange={(e) =>
                        setEscorts((list) =>
                          list.map((x, idx) =>
                            idx === i ? { ...x, phoneNumber: e.target.value } : x
                          )
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor={`edit-escort-image-${i}`}>Escort ID image</Label>
                    {escort.id && escort.hasIdImage && (
                      <button
                        type="button"
                        className={`${linkClass} self-start text-sm text-muted-foreground`}
                        onClick={() =>
                          openPreview(`${escort.name || "Escort"} — ID image`, () =>
                            fetchEscortIdImage(student.id, escort.id as string)
                          )
                        }
                      >
                        View current ID
                      </button>
                    )}
                    <Input
                      id={`edit-escort-image-${i}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-invalid={escort.newImageError ? true : undefined}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        updateEscortNewImage(i, file);
                        if (file && fileSizeError(file, IMAGE_MAX_BYTES)) e.target.value = "";
                      }}
                    />
                    {escort.newImageError ? (
                      <p className="text-xs text-destructive">{escort.newImageError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {escort.newImage
                          ? `Selected: ${escort.newImage.name}`
                          : escort.hasIdImage
                            ? "An ID image is on file — leave empty to keep it."
                            : "No ID image yet."}{" "}
                        JPEG, PNG, or WEBP, up to 5MB.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {escorts.length < 4 && (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() =>
                  setEscorts((list) => [
                    ...list,
                    {
                      id: null,
                      name: "",
                      phoneNumber: "",
                      hasIdImage: false,
                      newImage: null,
                      newImageError: null,
                    },
                  ])
                }
              >
                <Plus /> Add escort
              </Button>
            )}
          </div>
        )}

        {stepId === "medical" && (
          <div className="flex flex-col gap-4">
            {diagnoses.map((diagnosis, i) => (
              <div
                key={diagnosis.id ?? `new-${i}`}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Diagnosis {i + 1}
                    {!diagnosis.id && <span className="ml-1 text-muted-foreground">(new)</span>}
                  </span>
                  {diagnoses.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove diagnosis ${i + 1}`}
                      onClick={() => setDiagnoses((list) => list.filter((_, idx) => idx !== i))}
                    >
                      <X />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`edit-diagnosis-text-${i}`}>
                      Official diagnosis <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id={`edit-diagnosis-text-${i}`}
                      value={diagnosis.officialDiagnosis}
                      onChange={(e) =>
                        setDiagnoses((list) =>
                          list.map((x, idx) =>
                            idx === i ? { ...x, officialDiagnosis: e.target.value } : x
                          )
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`edit-diagnosis-date-${i}`}>Date of diagnosis</Label>
                    <Input
                      id={`edit-diagnosis-date-${i}`}
                      type="date"
                      value={diagnosis.dateOfDiagnosis}
                      onChange={(e) =>
                        setDiagnoses((list) =>
                          list.map((x, idx) =>
                            idx === i ? { ...x, dateOfDiagnosis: e.target.value } : x
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            {diagnoses.length < 4 && (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() =>
                  setDiagnoses((list) => [
                    ...list,
                    { id: null, officialDiagnosis: "", dateOfDiagnosis: "" },
                  ])
                }
              >
                <Plus /> Add diagnosis
              </Button>
            )}

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Allergies / dietary restrictions</span>
                <p className="text-xs text-muted-foreground">
                  Tap the ones that apply, or add a specific allergy below.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGIES.map((name) => {
                  const selected = allergies.includes(name);
                  return (
                    <Button
                      key={name}
                      type="button"
                      size="sm"
                      variant={selected ? "secondary" : "outline"}
                      aria-pressed={selected}
                      onClick={() => toggleAllergy(name)}
                    >
                      {name}
                    </Button>
                  );
                })}
              </div>
              {allergies.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Selected:</span>
                  {allergies.map((name) => (
                    <Badge key={name} variant="secondary" className="h-6 gap-1 pr-1">
                      {name}
                      <button
                        type="button"
                        aria-label={`Remove ${name}`}
                        onClick={() => setAllergies((list) => list.filter((a) => a !== name))}
                        className="cursor-pointer rounded-full hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-custom-allergy">Others / specific allergy</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-custom-allergy"
                    placeholder="e.g. Lactose intolerant, mango"
                    value={customAllergy}
                    onChange={(e) => setCustomAllergy(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomAllergy();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomAllergy}
                    disabled={!customAllergy.trim()}
                  >
                    <Plus /> Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <TextFieldGrid fields={MEDICAL_FIELDS} values={values} onChange={setField} textarea />
            </div>
          </div>
        )}

        {stepId === "developmental" && (
          <div className="grid grid-cols-1 gap-3">
            <TextFieldGrid
              fields={DEVELOPMENTAL_FIELDS}
              values={values}
              onChange={setField}
              textarea
            />
          </div>
        )}

        {stepId === "behavioral" && (
          <div className="grid grid-cols-1 gap-3">
            <TextFieldGrid
              fields={BEHAVIORAL_FIELDS}
              values={values}
              onChange={setField}
              textarea
            />
          </div>
        )}

        {stepId === "goals" && (
          <div className="grid grid-cols-1 gap-3">
            <TextFieldGrid fields={GOAL_FIELDS} values={values} onChange={setField} textarea />
          </div>
        )}

        {stepId === "review" && (
          <div className="flex flex-col gap-4 text-sm">
            <dl className="grid grid-cols-[minmax(10rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-1">
              <ReviewRow label="Name" value={composedName || null} />
              <ReviewRow label="Date of birth" value={dateOfBirth} />
              <ReviewRow label="Gender" value={gender === "MALE" ? "Male" : "Female"} />
              <ReviewRow label="New photo" value={studentPhoto?.name ?? null} />
              <ReviewRow label="New birth certificate" value={birthCertificate?.name ?? null} />
              <ReviewRow
                label="Emergency contact"
                value={[emergencyName, emergencyNumber].filter(Boolean).join(" - ") || null}
              />
              <ReviewRow
                label="Escorts"
                value={escorts
                  .map((e) => `${e.name}${e.id ? "" : " (new)"}${e.newImage ? " (new ID)" : ""}`)
                  .join(", ")}
              />
              <ReviewRow
                label="Diagnoses"
                value={diagnoses
                  .map((d) => `${d.officialDiagnosis}${d.id ? "" : " (new)"}`)
                  .join(", ")}
              />
              <ReviewRow label="Allergies / dietary" value={allergies.join(", ") || null} />
            </dl>
            <p className="text-xs text-muted-foreground">
              Saving updates the permanent record and replaces any documents you provided.
              Clearing a medical, developmental, behavioral, or goals field really does blank it;
              clearing a name, contact, or address field is ignored, since those are required.
            </p>
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <DialogFooter className="sm:justify-between">
        <Button
          variant="outline"
          onClick={() => goToStep(Math.max(0, step - 1))}
          disabled={step === 0 || isSubmitting}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext}>Next</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        )}
      </DialogFooter>

      <DocumentPreviewDialog
        open={previewTitle !== null}
        onOpenChange={handlePreviewOpenChange}
        title={previewTitle ?? ""}
        description={student.studentName}
        document={preview}
      />
    </>
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
    // disablePointerDismissal: this is a long multi-step form — an accidental
    // click outside shouldn't discard it (same reasoning as the re-enroll dialog).
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      {/* Fixed height: the step area scrolls internally instead of the dialog
          growing/shrinking per step. */}
      <DialogContent className="flex h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit {student?.studentName}</DialogTitle>
          <DialogDescription>
            {student
              ? `Update ${student.studentNumber}'s permanent record. Past school years' statements, fees, and frozen snapshots stay intact.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {student && (
          <EditForm student={student} onSaved={onSaved} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}
