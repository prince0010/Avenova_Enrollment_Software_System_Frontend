import { z } from "zod";

export type FieldType = "text" | "tel" | "textarea" | "date" | "select" | "checkbox";

export interface FieldConfig {
  // Not strictly keyof StudentCreateInput — a few fields (e.g. emergencyContactName)
  // are wizard-only and get combined into a single backend field at submit time.
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export const STEP_ORDER = [
  "student",
  "parent",
  "escort",
  "medical",
  "developmental",
  "behavioral",
  "goals",
  "enrollment",
  "review",
] as const;

export type StepId = (typeof STEP_ORDER)[number];

export const STEP_TITLES: Record<StepId, string> = {
  student: "Student Data",
  parent: "Parent / Guardian's Details",
  escort: "Escort / Custody Information",
  medical: "Medical Background and Safety",
  developmental: "Developmental Intervention",
  behavioral: "Behavioral and Sensory Profile",
  goals: "Goals and Expectations",
  enrollment: "Enrollment & Consents",
  review: "Review",
};

export const STEP_FIELDS: Record<Exclude<StepId, "review">, FieldConfig[]> = {
  student: [
    {
      key: "firstName",
      label: "First name",
      type: "text",
      required: true,
      placeholder: "e.g. Juan",
    },
    {
      key: "middleName",
      label: "Middle name",
      type: "text",
      placeholder: "e.g. Santos",
    },
    {
      key: "lastName",
      label: "Last name",
      type: "text",
      required: true,
      placeholder: "e.g. Dela Cruz",
    },
    { key: "suffix", label: "Suffix", type: "text", placeholder: "e.g. Jr., III" },
    { key: "nickname", label: "Nickname", type: "text", placeholder: "e.g. Jojo" },
    { key: "dateOfBirth", label: "Date of birth", type: "date", required: true },
    {
      key: "gender",
      label: "Gender",
      type: "select",
      required: true,
      options: [
        { value: "MALE", label: "Male" },
        { value: "FEMALE", label: "Female" },
      ],
    },
    {
      key: "primaryLanguage",
      label: "Primary language",
      type: "text",
      required: true,
      placeholder: "e.g. English",
    },
  ],
  parent: [
    {
      key: "motherName",
      label: "Mother's name",
      type: "text",
      placeholder: "e.g. Maria Dela Cruz",
    },
    {
      key: "fatherName",
      label: "Father's name",
      type: "text",
      placeholder: "e.g. Jose Dela Cruz",
    },
    {
      key: "guardianName",
      label: "Guardian's name",
      type: "text",
      placeholder: "e.g. Ana Santos",
    },
    {
      key: "contactNumber",
      label: "Contact number",
      type: "tel",
      required: true,
      placeholder: "e.g. 0917 123 4567",
    },
    {
      key: "email",
      label: "Email",
      type: "text",
      required: true,
      placeholder: "e.g. parent@example.com",
    },
    {
      key: "homeAddress",
      label: "Home address",
      type: "textarea",
      required: true,
      placeholder: "e.g. 123 Rizal St., Quezon City",
    },
    {
      key: "emergencyContactName",
      label: "Emergency contact name",
      type: "text",
      required: true,
      placeholder: "e.g. Ana Santos",
    },
    {
      key: "emergencyContact",
      label: "Emergency contact number",
      type: "tel",
      required: true,
      placeholder: "e.g. 0917 987 6543",
    },
  ],
  // Escorts (1-4, each with a name + own ID image) are rendered with bespoke
  // JSX in the wizard, not the generic StepFields config-driven renderer —
  // this step intentionally has no flat fields here.
  escort: [],
  // Diagnoses (1-4, each with a name + optional date) and the allergy selector
  // (common-allergy toggle buttons + custom input, joined into the backend's
  // single allergyDietaryRestrictions string) are rendered with bespoke JSX in
  // the wizard, like escorts — only the flat medical fields live here.
  medical: [
    {
      key: "medications",
      label: "Medications",
      type: "textarea",
      placeholder: "e.g. Ritalin 10mg, twice daily",
    },
    {
      key: "medicalCondition",
      label: "Medical condition",
      type: "textarea",
      placeholder: "e.g. Asthma",
    },
  ],
  developmental: [
    {
      key: "currentPastTherapies",
      label: "Current / Past Therapies (If any)",
      type: "textarea",
      placeholder: "e.g. Speech therapy, occupational therapy",
    },
    {
      key: "recommendedTherapist",
      label: "Recommended Therapist (If any)",
      type: "textarea",
      placeholder: "e.g. Dr. Maria Santos – Speech Therapist",
    },
    {
      key: "previousSchoolingSped",
      label: "Previous Schooling / SPED (If any)",
      type: "textarea",
      placeholder: "e.g. Attended SPED program at ABC School",
    },
  ],
  behavioral: [
    {
      key: "sensorySensitivities",
      label: "Sensory sensitivities",
      type: "textarea",
      placeholder: "e.g. Sensitive to loud noises",
    },
    {
      key: "triggersAndMeltdownSigns",
      label: "Triggers / meltdown signs",
      type: "textarea",
      placeholder: "e.g. Becomes upset with sudden changes in routine",
    },
    {
      key: "soothingTechniques",
      label: "Soothing techniques",
      type: "textarea",
      placeholder: "e.g. Deep breathing, favorite toy",
    },
    {
      key: "communicationStyle",
      label: "Communication style",
      type: "textarea",
      placeholder: "e.g. Uses short phrases, prefers visual cues",
    },
    {
      key: "selfRegulationSkills",
      label: "Self-regulation skills",
      type: "textarea",
      placeholder: "e.g. Can take breaks when overwhelmed",
    },
  ],
  goals: [
    {
      key: "parentGoals",
      label: "Parent goals",
      type: "textarea",
      placeholder: "e.g. Improve communication skills",
    },
    {
      key: "strengthsAndInterests",
      label: "Strengths / interests",
      type: "textarea",
      placeholder: "e.g. Enjoys drawing and music",
    },
  ],
  enrollment: [
    {
      key: "schoolYear",
      label: "Date of Enrollment",
      type: "date",
      required: true,
    },
    {
      key: "emergencyMedicalConsent",
      label: "I consent to emergency medical treatment if needed.",
      type: "checkbox",
      required: true,
    },
    {
      key: "therapyAssessmentConsent",
      label: "I consent to therapy assessment.",
      type: "checkbox",
      required: true,
    },
    {
      key: "policyAcknowledgement",
      label: "I acknowledge the center's policies.",
      type: "checkbox",
      required: true,
    },
    {
      key: "photoVideoRelease",
      label: "I consent to photo / video release.",
      type: "checkbox",
      required: true,
    },
  ],
};

// Every field starts at its type's empty value (not undefined) so zod's
// string/enum checks reach the custom .min()/message validators instead of
// failing on "expected string, received undefined" first.
export function buildInitialValues(): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const stepId of Object.keys(STEP_FIELDS) as Exclude<StepId, "review">[]) {
    for (const field of STEP_FIELDS[stepId]) {
      values[field.key] = field.type === "checkbox" ? false : "";
    }
  }
  return values;
}

export const STEP_SCHEMAS: Partial<Record<StepId, z.ZodTypeAny>> = {
  student: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.enum(["MALE", "FEMALE"], { message: "Select a gender" }),
    primaryLanguage: z.string().min(1, "Primary language is required"),
  }),
  parent: z
    .object({
      motherName: z.string().optional(),
      fatherName: z.string().optional(),
      guardianName: z.string().optional(),
      contactNumber: z.string().min(1, "Contact number is required"),
      email: z.string().min(1, "Email is required").email("Enter a valid email"),
      homeAddress: z.string().min(1, "Home address is required"),
      emergencyContactName: z.string().min(1, "Emergency contact name is required"),
      emergencyContact: z.string().min(1, "Emergency contact number is required"),
    })
    .refine(
      (d) =>
        Boolean(d.motherName?.trim() || d.fatherName?.trim() || d.guardianName?.trim()),
      {
        message: "Provide at least one of mother's, father's, or guardian's name",
        path: ["guardianName"],
      }
    ),
  enrollment: z.object({
    schoolYear: z.string().min(1, "School year is required"),
    emergencyMedicalConsent: z.boolean(),
    therapyAssessmentConsent: z.boolean(),
    policyAcknowledgement: z.boolean(),
    photoVideoRelease: z.boolean(),
  }),
};

// 1 to 4 escorts, each needing a name — validated separately from
// STEP_SCHEMAS since escort state (with File objects) isn't part of the
// generic `values` map the other steps validate against.
export const escortsSchema = z
  .array(z.object({ name: z.string().min(1, "Escort name is required") }))
  .min(1)
  .max(4);

// 1 to 4 diagnoses, each needing a name — same bespoke-state pattern as escorts.
export const diagnosesSchema = z
  .array(z.object({ officialDiagnosis: z.string().min(1, "Diagnosis is required") }))
  .min(1)
  .max(4);

// Quick-pick options for the allergy selector — common food allergies and
// dietary restrictions in the Philippines. Anything not covered goes in the
// "Others / specific allergy" free-text input on the same step.
export const COMMON_ALLERGIES = [
  "Shrimp",
  "Crab",
  "Shellfish",
  "Fish",
  "Squid",
  "Egg",
  "Peanuts",
  "Milk / Dairy",
  "Soy",
  "Wheat / Gluten",
  "Chicken",
  "Chocolate",
  "No pork (Halal)",
  "Vegetarian",
] as const;
