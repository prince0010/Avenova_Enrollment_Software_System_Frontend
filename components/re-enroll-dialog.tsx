"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Enrollment, FeePackage, Gender, Student, StudentUpdateInput } from "@/lib/types";
import { BIRTH_CERT_MAX_BYTES, IMAGE_MAX_BYTES, fileSizeError } from "@/lib/upload-limits";
import { formatPeso } from "@/lib/format";
import {
  createEnrollmentForStudent,
  listFeePackages,
  updateStudent,
  uploadStudentPhoto,
  uploadBirthCertificate,
  uploadEscortIdImage,
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
import { Checkbox } from "@/components/ui/checkbox";
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

// Same section order as the intake wizard, so re-enrollment reviews the
// record the way it was first captured.
const STEPS = [
  { id: "student", label: "Student" },
  { id: "parent", label: "Parent / Guardian" },
  { id: "escort", label: "Escorts" },
  { id: "medical", label: "Medical" },
  { id: "developmental", label: "Developmental" },
  { id: "behavioral", label: "Behavioral" },
  { id: "goals", label: "Goals" },
  { id: "enrollment", label: "Enrollment" },
  { id: "review", label: "Review" },
];

const CONSENTS = [
  { key: "emergencyMedicalConsent", label: "I consent to emergency medical treatment if needed." },
  { key: "therapyAssessmentConsent", label: "I consent to therapy assessment." },
  { key: "policyAcknowledgement", label: "I acknowledge the center's policies." },
  { key: "photoVideoRelease", label: "I consent to photo / video release." },
] as const;

type ConsentKey = (typeof CONSENTS)[number]["key"];

type TextFieldKey = keyof StudentUpdateInput & string;

const STUDENT_FIELDS: { key: TextFieldKey; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "middleName", label: "Middle name" },
  { key: "lastName", label: "Last name" },
  { key: "suffix", label: "Suffix" },
  { key: "nickname", label: "Nickname" },
  { key: "primaryLanguage", label: "Primary language" },
];

// Emergency contact is split into name + number like the wizard and
// recombined into the backend's single string at submit.
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
          <Label htmlFor={`re-enroll-${f.key}`}>{f.label}</Label>
          {textarea ? (
            <Textarea
              id={`re-enroll-${f.key}`}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          ) : (
            <Input
              id={`re-enroll-${f.key}`}
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

// The full returning-student flow, mirroring the intake wizard section by
// section: every field editable and prefilled, escorts and diagnoses fully
// editable (1-4), documents replaceable, fresh consents — then a review step.
// Changes save on final submit only; past years' snapshots are untouched.
function ReEnrollForm({
  student,
  onEnrolled,
}: {
  student: Student;
  onEnrolled: (enrollment: Enrollment, updatedStudent: Student | null) => void;
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
  const [schoolYear, setSchoolYear] = useState("");

  // Which fee package this new period is billed under. Re-enrollment
  // deliberately starts from the default rather than last year's package —
  // the current price list wins unless the admin says otherwise.
  const [feePackages, setFeePackages] = useState<FeePackage[]>([]);
  const [feePackageId, setFeePackageId] = useState("");
  useEffect(() => {
    let cancelled = false;
    listFeePackages()
      .then((res) => {
        if (cancelled) return;
        setFeePackages(res.feePackages);
        // Preselect the default so the dropdown never starts blank and the
        // submitted value matches what the backend would have picked anyway.
        setFeePackageId((cur) => cur || res.feePackages.find((p) => p.isDefault)?.id || "");
      })
      .catch(() => {
        if (!cancelled) setFeePackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const feePackageItems = useMemo(
    () => feePackages.map((p) => ({ value: p.id, label: p.name })),
    [feePackages]
  );
  const selectedPackage = feePackages.find((p) => p.id === feePackageId) ?? null;

  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({
    emergencyMedicalConsent: false,
    therapyAssessmentConsent: false,
    policyAcknowledgement: false,
    photoVideoRelease: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);

  function goToStep(index: number) {
    setFormError(null);
    setStep(index);
    setMaxVisitedStep((m) => Math.max(m, index));
  }

  function handleNext() {
    const stepId = STEPS[step].id;
    if (stepId === "escort") {
      if (escorts.some((e) => !e.name.trim())) {
        setFormError("Every escort needs a name.");
        return;
      }
    }
    if (stepId === "medical") {
      if (diagnoses.some((d) => !d.officialDiagnosis.trim())) {
        setFormError("Every diagnosis needs a name.");
        return;
      }
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
    if (!schoolYear) {
      setFormError("Date of enrollment is required.");
      goToStep(STEPS.findIndex((s) => s.id === "enrollment"));
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      let updatedStudent: Student | null = null;

      // 1. Plain-field changes (only changed, non-empty values — the backend
      // rejects empty strings).
      const changes: StudentUpdateInput = {};
      for (const f of ALL_DIFFED_FIELDS) {
        const current = (student[f.key as keyof Student] as string | null) ?? "";
        const next = values[f.key]?.trim() ?? "";
        if (next !== "" && next !== current) {
          changes[f.key] = next as never;
        }
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
      const joinedAllergies = allergies.join(", ");
      if (joinedAllergies && joinedAllergies !== (student.allergyDietaryRestrictions ?? "")) {
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
          const phoneChanged = original && entry.phoneNumber.trim() !== (original.phoneNumber ?? "");
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
              await uploadEscortIdImage(student.id, entry.id, entry.newImage, schoolYear)
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
              await uploadEscortIdImage(student.id, created.id, entry.newImage, schoolYear)
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
          const textChanged = original && entry.officialDiagnosis.trim() !== original.officialDiagnosis;
          const originalDate = original?.dateOfDiagnosis ? original.dateOfDiagnosis.slice(0, 10) : "";
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

      // 4. Replacement documents (old files are kept for past snapshots).
      if (studentPhoto) {
        updatedStudent = (await uploadStudentPhoto(student.id, studentPhoto, schoolYear)).student;
      }
      if (birthCertificate) {
        updatedStudent = (
          await uploadBirthCertificate(student.id, birthCertificate, schoolYear)
        ).student;
      }

      // 5. The new enrollment period — snapshots the chosen package's fees +
      // student data.
      const { enrollment } = await createEnrollmentForStudent(student.id, {
        schoolYear,
        ...(feePackageId ? { feePackageId } : {}),
        ...consents,
      });
      onEnrolled(enrollment, updatedStudent);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? err.status === 409
            ? "This student already has an enrollment for that school year."
            : err.message
          : "Something went wrong. Please try again."
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
      <Stepper
        steps={STEPS}
        currentIndex={step}
        maxCompletedIndex={maxVisitedStep}
        onStepClick={goToStep}
      />

      {/* Fixed-height scroll area so the dialog doesn't resize per step. */}
      <div className="-mr-2 flex-1 overflow-y-auto pr-2">
        {stepId === "student" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Verify with the family and correct anything that changed while the student was
              away — updates save to the permanent record on the final step. Past years&apos;
              statements, fees, and snapshots stay frozen regardless.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextFieldGrid fields={STUDENT_FIELDS} values={values} onChange={setField} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="re-enroll-dob">Date of birth</Label>
                <Input
                  id="re-enroll-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="re-enroll-gender">Gender</Label>
                <Select
                  items={GENDER_ITEMS}
                  value={gender}
                  onValueChange={(v) => v && setGender(v as Gender)}
                >
                  <SelectTrigger id="re-enroll-gender">
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
                <Label>New student photo</Label>
                <div className="flex items-center gap-3">
                  <CameraCapture onCapture={handleStudentPhotoChange} />
                  {photoPreviewUrl && (
                    // Blob object URL — next/image adds nothing here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreviewUrl}
                      alt="New student photo preview"
                      className="h-16 w-16 rounded-lg border object-cover"
                    />
                  )}
                </div>
                <Input
                  id="re-enroll-photo"
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
                <Label htmlFor="re-enroll-birth-cert">New birth certificate</Label>
                <Input
                  id="re-enroll-birth-cert"
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
              <Label htmlFor="re-enroll-ec-name">Emergency contact name</Label>
              <Input
                id="re-enroll-ec-name"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-enroll-ec-number">Emergency contact number</Label>
              <Input
                id="re-enroll-ec-number"
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
              <div key={escort.id ?? `new-${i}`} className="flex flex-col gap-3 rounded-lg border p-4">
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
                    <Label htmlFor={`re-escort-name-${i}`}>
                      Escort name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`re-escort-name-${i}`}
                      value={escort.name}
                      onChange={(e) =>
                        setEscorts((list) =>
                          list.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`re-escort-phone-${i}`}>Phone number</Label>
                    <Input
                      id={`re-escort-phone-${i}`}
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
                    <Label htmlFor={`re-escort-image-${i}`}>Escort ID image</Label>
                    <Input
                      id={`re-escort-image-${i}`}
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
              <div key={diagnosis.id ?? `new-${i}`} className="flex flex-col gap-3 rounded-lg border p-4">
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
                    <Label htmlFor={`re-diagnosis-text-${i}`}>
                      Official diagnosis <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id={`re-diagnosis-text-${i}`}
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
                    <Label htmlFor={`re-diagnosis-date-${i}`}>Date of diagnosis</Label>
                    <Input
                      id={`re-diagnosis-date-${i}`}
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
                <Label htmlFor="re-enroll-custom-allergy">Others / specific allergy</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="re-enroll-custom-allergy"
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
            <TextFieldGrid fields={DEVELOPMENTAL_FIELDS} values={values} onChange={setField} textarea />
          </div>
        )}

        {stepId === "behavioral" && (
          <div className="grid grid-cols-1 gap-3">
            <TextFieldGrid fields={BEHAVIORAL_FIELDS} values={values} onChange={setField} textarea />
          </div>
        )}

        {stepId === "goals" && (
          <div className="grid grid-cols-1 gap-3">
            <TextFieldGrid fields={GOAL_FIELDS} values={values} onChange={setField} textarea />
          </div>
        )}

        {stepId === "enrollment" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-enroll-date">
                Date of enrollment <span className="text-destructive">*</span>
              </Label>
              <Input
                id="re-enroll-date"
                type="date"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-enroll-fee-package">Fee package</Label>
              <Select
                items={feePackageItems}
                value={feePackageId}
                onValueChange={(v) => v && setFeePackageId(v)}
              >
                <SelectTrigger id="re-enroll-fee-package">
                  <SelectValue placeholder="Select a fee package" />
                </SelectTrigger>
                <SelectContent>
                  {feePackages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                These amounts freeze onto this school year at confirmation — later catalog
                changes won&apos;t alter them.
              </p>
              {selectedPackage && selectedPackage.fees.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 rounded-lg border p-3 text-xs">
                  {selectedPackage.fees.map((f) => (
                    <div key={f.id} className="flex justify-between text-muted-foreground">
                      <span>{f.name}</span>
                      <span className="tabular-nums">{formatPeso(f.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between border-t pt-1 font-medium">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {formatPeso(
                        selectedPackage.fees.reduce((sum, f) => sum + Number(f.amount), 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
              {selectedPackage && selectedPackage.fees.length === 0 && (
                <p className="text-xs text-destructive">
                  This package has no fees — the student would be charged nothing.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Consents are recaptured every enrollment period — earlier answers don&apos;t
                carry over.
              </p>
              {CONSENTS.map((c) => (
                <div key={c.key} className="flex items-start gap-2">
                  <Checkbox
                    id={`re-enroll-${c.key}`}
                    checked={consents[c.key]}
                    onCheckedChange={(checked) =>
                      setConsents((prev) => ({ ...prev, [c.key]: !!checked }))
                    }
                  />
                  <Label
                    htmlFor={`re-enroll-${c.key}`}
                    className="text-sm font-normal leading-snug"
                  >
                    {c.label}
                  </Label>
                </div>
              ))}
            </div>
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
              <ReviewRow
                label="Date of enrollment"
                value={schoolYear ? new Date(schoolYear).toLocaleDateString() : "— required"}
              />
              <ReviewRow label="Fee package" value={selectedPackage?.name ?? null} />
              <ReviewRow
                label="Consents"
                value={`${CONSENTS.filter((c) => consents[c.key]).length}/4 given`}
              />
            </dl>
            <p className="text-xs text-muted-foreground">
              Submitting saves any changed details to the permanent record, replaces documents
              where new ones were provided, and creates the new enrollment period with
              today&apos;s fees and a frozen snapshot of the data above.
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
            {isSubmitting ? "Enrolling..." : "Save changes & re-enroll"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

export function ReEnrollDialog({
  student,
  open,
  onOpenChange,
  onEnrolled,
}: {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: (enrollment: Enrollment, updatedStudent: Student | null) => void;
}) {
  return (
    // disablePointerDismissal: this is a long multi-step review form — an
    // accidental click outside (or on the backdrop) shouldn't discard it.
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      {/* Fixed height: the step area scrolls internally instead of the
          dialog growing/shrinking per step. */}
      <DialogContent className="flex h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Re-enroll {student?.studentName}</DialogTitle>
          <DialogDescription>
            {student
              ? `Creates a new enrollment period for ${student.studentNumber} — the permanent record, past school years, and their statements all stay intact. Current fees are frozen onto the new period at confirmation.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {student && <ReEnrollForm student={student} onEnrolled={onEnrolled} />}
      </DialogContent>
    </Dialog>
  );
}
