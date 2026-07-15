"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  createStudent,
  listStudents,
  listArchivedStudents,
  uploadEscortIdImage,
  uploadBirthCertificate,
  uploadStudentPhoto,
  ApiClientError,
} from "@/lib/api-client";
import type { StudentCreateInput, Student } from "@/lib/types";
import { BIRTH_CERT_MAX_BYTES, IMAGE_MAX_BYTES, fileSizeError } from "@/lib/upload-limits";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { StudentViewDialog } from "@/components/student-view-dialog";
import { Stepper } from "./stepper";
import { StepFields } from "./step-fields";
import { ReviewStep } from "./review-step";
import { CameraCapture } from "./camera-capture";
import {
  STEP_ORDER,
  STEP_TITLES,
  STEP_FIELDS,
  STEP_SCHEMAS,
  escortsSchema,
  diagnosesSchema,
  COMMON_ALLERGIES,
  buildInitialValues,
} from "./steps-config";

const MAX_ESCORTS = 4;
const MAX_DIAGNOSES = 4;

interface EscortEntry {
  name: string;
  phoneNumber: string;
  image: File | null;
  imageError: string | null;
}

interface DiagnosisEntry {
  officialDiagnosis: string;
  dateOfDiagnosis: string;
}

const OPTIONAL_TEXT_KEYS = [
  "middleName",
  "suffix",
  "nickname",
  "motherName",
  "fatherName",
  "guardianName",
  "medications",
  "medicalCondition",
  "currentPastTherapies",
  "recommendedTherapist",
  "previousSchoolingSped",
  "sensorySensitivities",
  "triggersAndMeltdownSigns",
  "soothingTechniques",
  "communicationStyle",
  "selfRegulationSkills",
  "parentGoals",
  "strengthsAndInterests",
] as const;

function buildPayload(
  values: Record<string, string | boolean>,
  escorts: EscortEntry[],
  diagnoses: DiagnosisEntry[],
  allergies: string[]
): StudentCreateInput {
  const emergencyContactName = (values.emergencyContactName as string).trim();
  const emergencyContactNumber = (values.emergencyContact as string).trim();
  const payload: Record<string, unknown> = {
    firstName: (values.firstName as string).trim(),
    lastName: (values.lastName as string).trim(),
    dateOfBirth: values.dateOfBirth,
    gender: values.gender,
    primaryLanguage: (values.primaryLanguage as string).trim(),
    contactNumber: (values.contactNumber as string).trim(),
    email: (values.email as string).trim(),
    homeAddress: (values.homeAddress as string).trim(),
    // Backend has one emergencyContact string field; the wizard splits it into
    // a name + phone number for a friendlier form and recombines it here.
    emergencyContact: `${emergencyContactName} - ${emergencyContactNumber}`,
    escorts: escorts.map((e) => ({ name: e.name.trim(), phoneNumber: e.phoneNumber.trim() || undefined })),
    diagnoses: diagnoses.map((d) => ({
      officialDiagnosis: d.officialDiagnosis.trim(),
      dateOfDiagnosis: d.dateOfDiagnosis || undefined,
    })),
    schoolYear: (values.schoolYear as string).trim(),
    emergencyMedicalConsent: Boolean(values.emergencyMedicalConsent),
    therapyAssessmentConsent: Boolean(values.therapyAssessmentConsent),
    policyAcknowledgement: Boolean(values.policyAcknowledgement),
    photoVideoRelease: Boolean(values.photoVideoRelease),
  };
  // The allergy selector's picks collapse into the backend's single
  // allergyDietaryRestrictions string field.
  if (allergies.length > 0) payload.allergyDietaryRestrictions = allergies.join(", ");
  for (const key of OPTIONAL_TEXT_KEYS) {
    const v = (values[key] as string | undefined)?.trim();
    if (v) payload[key] = v;
  }
  return payload as StudentCreateInput;
}

export function StudentCreateWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [maxCompletedIndex, setMaxCompletedIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string | boolean>>(buildInitialValues);
  const [escorts, setEscorts] = useState<EscortEntry[]>([
    { name: "", phoneNumber: "", image: null, imageError: null },
  ]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([
    { officialDiagnosis: "", dateOfDiagnosis: "" },
  ]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState("");
  const [birthCertificate, setBirthCertificate] = useState<File | null>(null);
  const [birthCertificateError, setBirthCertificateError] = useState<string | null>(null);
  const [studentPhoto, setStudentPhoto] = useState<File | null>(null);
  const [studentPhotoError, setStudentPhotoError] = useState<string | null>(null);

  function handleBirthCertificateChange(file: File | null) {
    const error = file ? fileSizeError(file, BIRTH_CERT_MAX_BYTES) : null;
    setBirthCertificateError(error);
    setBirthCertificate(error ? null : file);
  }

  function handleStudentPhotoChange(file: File | null) {
    const error = file ? fileSizeError(file, IMAGE_MAX_BYTES) : null;
    setStudentPhotoError(error);
    setStudentPhoto(error ? null : file);
  }

  // Thumbnail preview for the captured/selected photo; revoked when replaced.
  const photoPreviewUrl = useMemo(
    () => (studentPhoto ? URL.createObjectURL(studentPhoto) : null),
    [studentPhoto]
  );
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Duplicate guard: intake must never create a second record for a returning
  // student (re-enrollment reuses the permanent record instead). Both active
  // and archived students are checked; failures just disable the warning.
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([listStudents(), listArchivedStudents()]).then((results) => {
      if (cancelled) return;
      setExistingStudents(
        results.flatMap((r) => (r.status === "fulfilled" ? r.value.students : []))
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The duplicate modal interrupts "Next" on the student step; acknowledging
  // a specific match (by id) lets staff proceed for a genuinely different
  // child without being re-blocked by the same record.
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [viewingDuplicate, setViewingDuplicate] = useState(false);
  const [ackDuplicateId, setAckDuplicateId] = useState<string | null>(null);

  const duplicateMatch = useMemo(() => {
    const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const first = norm(values.firstName);
    const last = norm(values.lastName);
    const dob = (values.dateOfBirth as string) ?? "";
    if (!first && !last) return null;
    return (
      existingStudents.find((s) => {
        const sFirst = norm(s.firstName);
        const sLast = norm(s.lastName);
        // Exact first + last name match, or — a strong "returning student"
        // signal even with a differently-spelled first name — same birthdate
        // plus the same last name.
        if (first && last && sFirst === first && sLast === last) return true;
        if (dob && last && s.dateOfBirth.slice(0, 10) === dob && sLast === last) return true;
        return false;
      }) ?? null
    );
  }, [existingStudents, values.firstName, values.lastName, values.dateOfBirth]);
  const [escortError, setEscortError] = useState<string | null>(null);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageWarnings, setImageWarnings] = useState<string[] | null>(null);
  const [createdStudent, setCreatedStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepId = STEP_ORDER[stepIndex];

  function setField(key: string, value: string | boolean) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addEscort() {
    setEscorts((list) =>
      list.length < MAX_ESCORTS
        ? [...list, { name: "", phoneNumber: "", image: null, imageError: null }]
        : list
    );
  }

  function removeEscort(index: number) {
    setEscorts((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  function updateEscortName(index: number, name: string) {
    setEscorts((list) => list.map((e, i) => (i === index ? { ...e, name } : e)));
  }

  function updateEscortPhoneNumber(index: number, phoneNumber: string) {
    setEscorts((list) => list.map((e, i) => (i === index ? { ...e, phoneNumber } : e)));
  }

  function updateEscortImage(index: number, file: File | null) {
    const error = file ? fileSizeError(file, IMAGE_MAX_BYTES) : null;
    setEscorts((list) =>
      list.map((e, i) =>
        i === index ? { ...e, image: error ? null : file, imageError: error } : e
      )
    );
  }

  function addDiagnosis() {
    setDiagnoses((list) =>
      list.length < MAX_DIAGNOSES ? [...list, { officialDiagnosis: "", dateOfDiagnosis: "" }] : list
    );
  }

  function removeDiagnosis(index: number) {
    setDiagnoses((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  function updateDiagnosisText(index: number, officialDiagnosis: string) {
    setDiagnoses((list) => list.map((d, i) => (i === index ? { ...d, officialDiagnosis } : d)));
  }

  function updateDiagnosisDate(index: number, dateOfDiagnosis: string) {
    setDiagnoses((list) => list.map((d, i) => (i === index ? { ...d, dateOfDiagnosis } : d)));
  }

  function toggleAllergy(name: string) {
    setAllergies((list) =>
      list.includes(name) ? list.filter((a) => a !== name) : [...list, name]
    );
  }

  function removeAllergy(name: string) {
    setAllergies((list) => list.filter((a) => a !== name));
  }

  function addCustomAllergy() {
    const name = customAllergy.trim();
    if (!name) return;
    setAllergies((list) =>
      list.some((a) => a.toLowerCase() === name.toLowerCase()) ? list : [...list, name]
    );
    setCustomAllergy("");
  }

  function advanceStep() {
    setStepIndex((i) => {
      const next = i + 1;
      setMaxCompletedIndex((m) => Math.max(m, next));
      return next;
    });
  }

  function handleNext() {
    if (currentStepId === "escort") {
      const result = escortsSchema.safeParse(escorts.map((e) => ({ name: e.name })));
      if (!result.success) {
        setEscortError(result.error.issues[0]?.message ?? "Check the escort names.");
        return;
      }
      const missingImageIndex = escorts.findIndex((e) => !e.image);
      if (missingImageIndex !== -1) {
        setEscortError(`Escort ${missingImageIndex + 1} needs an ID image.`);
        return;
      }
      setEscortError(null);
      setStepIndex((i) => {
        const next = i + 1;
        setMaxCompletedIndex((m) => Math.max(m, next));
        return next;
      });
      return;
    }

    if (currentStepId === "medical") {
      const result = diagnosesSchema.safeParse(
        diagnoses.map((d) => ({ officialDiagnosis: d.officialDiagnosis.trim() }))
      );
      if (!result.success) {
        setDiagnosisError(result.error.issues[0]?.message ?? "Check the diagnoses.");
        return;
      }
      setDiagnosisError(null);
      // Fall through to the generic path for the remaining medical fields.
    }

    const schema = STEP_SCHEMAS[currentStepId];
    if (schema) {
      const result = schema.safeParse(values);
      if (!result.success) {
        const errors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          errors[String(issue.path[0])] = issue.message;
        }
        setFieldErrors(errors);
        return;
      }
    }
    setFieldErrors({});

    // Duplicate gate: a matching existing/archived student interrupts the
    // student step with a modal instead of silently creating a second record.
    if (
      currentStepId === "student" &&
      duplicateMatch &&
      duplicateMatch.id !== ackDuplicateId
    ) {
      setDuplicateModalOpen(true);
      return;
    }

    advanceStep();
  }

  function handleBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function handleSubmit() {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const { student } = await createStudent(buildPayload(values, escorts, diagnoses, allergies));
      setCreatedStudent(student);

      const failures: string[] = [];

      if (birthCertificate) {
        try {
          await uploadBirthCertificate(student.id, birthCertificate);
        } catch (err) {
          failures.push(
            `Birth certificate: ${err instanceof ApiClientError ? err.message : "upload failed"}`
          );
        }
      }

      if (studentPhoto) {
        try {
          await uploadStudentPhoto(student.id, studentPhoto);
        } catch (err) {
          failures.push(
            `Student photo: ${err instanceof ApiClientError ? err.message : "upload failed"}`
          );
        }
      }

      for (let i = 0; i < escorts.length; i++) {
        const image = escorts[i].image;
        const createdEscort = student.escorts[i];
        if (!image || !createdEscort) continue;
        try {
          await uploadEscortIdImage(student.id, createdEscort.id, image);
        } catch (err) {
          failures.push(
            `${createdEscort.name}: ${
              err instanceof ApiClientError ? err.message : "upload failed"
            }`
          );
        }
      }

      if (failures.length > 0) {
        setImageWarnings(failures);
      } else {
        router.push("/dashboard/students");
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdStudent && imageWarnings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Student created</CardTitle>
          <CardDescription>{createdStudent.studentName}&apos;s record was saved.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-destructive">
            <p>However, some files failed to upload:</p>
            <ul className="ml-4 list-disc">
              {imageWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <Button onClick={() => router.push("/dashboard/students")}>
            Continue to Students
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{STEP_TITLES[currentStepId]}</CardTitle>
        <CardDescription>
          Step {stepIndex + 1} of {STEP_ORDER.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Stepper
          steps={STEP_ORDER.map((id) => ({ id, label: STEP_TITLES[id] }))}
          currentIndex={stepIndex}
          maxCompletedIndex={maxCompletedIndex}
          onStepClick={setStepIndex}
        />

        {currentStepId === "medical" && (
          <div className="flex flex-col gap-4">
            {diagnoses.map((diagnosis, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Diagnosis {i + 1}</span>
                  {diagnoses.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove diagnosis ${i + 1}`}
                      onClick={() => removeDiagnosis(i)}
                    >
                      <X />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`diagnosis-text-${i}`}>
                      Official diagnosis <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id={`diagnosis-text-${i}`}
                      placeholder="e.g. Autism Spectrum Disorder"
                      value={diagnosis.officialDiagnosis}
                      onChange={(e) => updateDiagnosisText(i, e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`diagnosis-date-${i}`}>Date of diagnosis</Label>
                    <Input
                      id={`diagnosis-date-${i}`}
                      type="date"
                      value={diagnosis.dateOfDiagnosis}
                      onChange={(e) => updateDiagnosisDate(i, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            {diagnoses.length < MAX_DIAGNOSES && (
              <Button type="button" variant="outline" onClick={addDiagnosis} className="self-start">
                <Plus /> Add diagnosis
              </Button>
            )}
            {diagnosisError && <p className="text-sm text-destructive">{diagnosisError}</p>}

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
                        onClick={() => removeAllergy(name)}
                        className="cursor-pointer rounded-full hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="custom-allergy">Others / specific allergy</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="custom-allergy"
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
          </div>
        )}

        {currentStepId !== "review" && currentStepId !== "escort" && (
          <StepFields
            fields={STEP_FIELDS[currentStepId]}
            values={values}
            onChange={setField}
            errors={fieldErrors}
            columns={currentStepId === "enrollment" ? 1 : 2}
          />
        )}

        {currentStepId === "student" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="birthCertificate">Birth certificate (optional)</Label>
              <Input
                id="birthCertificate"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                aria-invalid={birthCertificateError ? true : undefined}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  handleBirthCertificateChange(file);
                  if (file && fileSizeError(file, BIRTH_CERT_MAX_BYTES)) e.target.value = "";
                }}
              />
              {/* Read from state, not the native input — its display resets
                  when this step unmounts/remounts on navigation. */}
              {birthCertificateError ? (
                <p className="text-xs text-destructive">{birthCertificateError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {birthCertificate
                    ? `Selected: ${birthCertificate.name}`
                    : "No file selected. JPEG, PNG, WEBP, or PDF, up to 10MB."}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Student photo (optional)</Label>
              <div className="flex items-center gap-3">
                <CameraCapture onCapture={handleStudentPhotoChange} />
                {photoPreviewUrl && (
                  // Blob object URL — next/image adds nothing here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreviewUrl}
                    alt="Student photo preview"
                    className="h-16 w-16 rounded-lg border object-cover"
                  />
                )}
              </div>
              <Input
                id="studentPhotoFile"
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
                    : "Take a photo with the camera, or choose an image file instead. JPEG, PNG, or WEBP, up to 5MB."}
                </p>
              )}
            </div>
          </div>
        )}

        {currentStepId === "escort" && (
          <div className="flex flex-col gap-4">
            {escorts.map((escort, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Escort {i + 1}</span>
                  {escorts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove escort ${i + 1}`}
                      onClick={() => removeEscort(i)}
                    >
                      <X />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`escort-name-${i}`}>
                      Escort name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`escort-name-${i}`}
                      placeholder="e.g. Ana Santos"
                      value={escort.name}
                      onChange={(e) => updateEscortName(i, e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`escort-phone-${i}`}>Phone number</Label>
                    <Input
                      id={`escort-phone-${i}`}
                      type="tel"
                      placeholder="e.g. 0917 123 4567"
                      value={escort.phoneNumber}
                      onChange={(e) => updateEscortPhoneNumber(i, e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor={`escort-image-${i}`}>
                      Escort ID image <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`escort-image-${i}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-invalid={escort.imageError ? true : undefined}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        updateEscortImage(i, file);
                        if (file && fileSizeError(file, IMAGE_MAX_BYTES)) e.target.value = "";
                      }}
                    />
                    {/* Sourced from state, not the native input's own display —
                        the native file input can't show a remembered filename
                        after this JSX unmounts/remounts on step navigation. */}
                    {escort.imageError ? (
                      <p className="text-xs text-destructive">{escort.imageError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {escort.image ? `Selected: ${escort.image.name}` : "No file selected"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {escorts.length < MAX_ESCORTS && (
              <Button type="button" variant="outline" onClick={addEscort} className="self-start">
                <Plus /> Add escort
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WEBP, up to 5MB each. Uploaded after the student record is created.
            </p>
            {escortError && <p className="text-sm text-destructive">{escortError}</p>}
          </div>
        )}

        {currentStepId === "review" && (
          <ReviewStep
            values={values}
            escorts={escorts}
            diagnoses={diagnoses}
            allergies={allergies}
            birthCertificate={birthCertificate}
            studentPhoto={studentPhoto}
            photoPreviewUrl={photoPreviewUrl}
          />
        )}

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <Dialog open={duplicateModalOpen} onOpenChange={setDuplicateModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Duplicate student detected</DialogTitle>
              <DialogDescription>
                {duplicateMatch ? (
                  <>
                    <span className="font-medium text-foreground">
                      {duplicateMatch.studentName}
                    </span>{" "}
                    is already in the system. Creating a second record would split their
                    history — check first.
                  </>
                ) : (
                  "A student with a matching name is already in the system."
                )}
              </DialogDescription>
            </DialogHeader>
            {duplicateMatch && (
              <>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-base font-semibold">
                    {duplicateMatch.studentName}
                    {duplicateMatch.deletedAt && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        (archived)
                      </span>
                    )}
                  </p>
                  <dl className="mt-1 grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-muted-foreground">Student ID</dt>
                    <dd className="tabular-nums">{duplicateMatch.studentNumber}</dd>
                    <dt className="text-muted-foreground">Date of birth</dt>
                    <dd>{new Date(duplicateMatch.dateOfBirth).toLocaleDateString()}</dd>
                    <dt className="text-muted-foreground">Enrolled</dt>
                    <dd>
                      {duplicateMatch.latestEnrollment
                        ? `${new Date(duplicateMatch.latestEnrollment.schoolYear).toLocaleDateString()} (${duplicateMatch.latestEnrollment.status.toLowerCase()})`
                        : "No enrollment on record"}
                    </dd>
                  </dl>
                </div>
                <p className="text-xs text-muted-foreground">
                  If this is the same child returning, manage them from their existing record —
                  Re-enroll for the new period and Edit anything that changed. Their past school
                  years, fees, and statements stay frozen on the record and remain printable.
                </p>
                <DialogFooter className="sm:flex-col sm:items-stretch">
                  <Button variant="outline" onClick={() => setViewingDuplicate(true)}>
                    View full record
                  </Button>
                  <Button
                    onClick={() =>
                      router.push(
                        `/dashboard/students?search=${encodeURIComponent(duplicateMatch.studentNumber)}`
                      )
                    }
                  >
                    Same student — open in Students
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAckDuplicateId(duplicateMatch.id);
                      setDuplicateModalOpen(false);
                      advanceStep();
                    }}
                  >
                    Different student — continue enrolling
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <StudentViewDialog
          student={viewingDuplicate ? duplicateMatch : null}
          open={viewingDuplicate}
          onOpenChange={(open) => !open && setViewingDuplicate(false)}
        />

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={stepIndex === 0 || isSubmitting}
          >
            Back
          </Button>
          {currentStepId !== "review" ? (
            <Button type="button" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create student"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
