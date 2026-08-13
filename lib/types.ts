export type Role = "USER" | "STAFF" | "ADMIN";

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string[]>;
}

export interface EnrollmentStatPoint {
  period: string;
  count: number;
}

export interface YearlyFeeBreakdownItem {
  name: string;
  total: string;
}

// One school year's frozen fee total — powers the dashboard's "this school
// year" tile (resets at year rollover) and the per-year breakdown chart.
// `items` and `enrollmentCount` power the chart's click-through summary modal.
export interface YearlyFeeTotal {
  year: string;
  total: string;
  enrollmentCount: number;
  items: YearlyFeeBreakdownItem[];
}

export type StatsGroupBy = "day" | "week" | "month" | "year";

export type Gender = "MALE" | "FEMALE";

export type EnrollmentStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export interface StudentSummary {
  id: string;
  studentNumber: string;
  studentName: string;
  nickname: string | null;
  gender: Gender;
}

export interface EscortSummary {
  id: string;
  name: string;
  phoneNumber: string | null;
  hasIdImage: boolean;
}

export interface DiagnosisSummary {
  id: string;
  officialDiagnosis: string;
  dateOfDiagnosis: string | null;
}

// Where a snapshot line came from: copied off the enrollment's fee package, or
// added by hand to this one period. Catalog writes only ever touch PACKAGE rows,
// so an ad-hoc charge survives every fee edit and delete.
export type EnrollmentFeeSource = "PACKAGE" | "ADHOC";

// Immutable copy of a fee frozen onto an enrollment at confirmation time —
// catalog edits/deletes never change these.
export interface EnrollmentFeeSummary {
  id: string;
  name: string;
  amount: string;
  source: EnrollmentFeeSource;
  // Which package this line was copied from, frozen so it still knows its
  // group after the catalog moves on. Null for a hand-typed one-off charge.
  packageName: string | null;
}

// "The student's data as of this school year" — a full copy of the record
// frozen onto the enrollment at confirmation. Document bytes come from the
// /enrollments/:id/snapshot/* endpoints (paths are never exposed).
export interface StudentDataSnapshot {
  snapshotAt: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  studentName: string;
  nickname: string | null;
  dateOfBirth: string;
  gender: Gender;
  primaryLanguage: string;
  motherName: string | null;
  fatherName: string | null;
  guardianName: string | null;
  contactNumber: string;
  email: string;
  homeAddress: string;
  emergencyContact: string;
  allergyDietaryRestrictions: string | null;
  medications: string | null;
  medicalCondition: string | null;
  currentPastTherapies: string | null;
  recommendedTherapist: string | null;
  previousSchoolingSped: string | null;
  sensorySensitivities: string | null;
  triggersAndMeltdownSigns: string | null;
  soothingTechniques: string | null;
  communicationStyle: string | null;
  selfRegulationSkills: string | null;
  parentGoals: string | null;
  strengthsAndInterests: string | null;
  escorts: { name: string; phoneNumber: string | null }[];
  diagnoses: { officialDiagnosis: string; dateOfDiagnosis: string | null }[];
  hasPhoto: boolean;
  hasBirthCertificate: boolean;
}

// One enrollment period of a student with its frozen fee snapshot — used to
// pick which school year a Statement of Account covers.
export interface StudentEnrollment {
  id: string;
  schoolYear: string;
  status: EnrollmentStatus;
  createdAt: string;
  fees: EnrollmentFeeSummary[];
  // Which package this period is billed under. feePackageName is the value
  // frozen at confirmation — null while PENDING/REJECTED.
  feePackageId: string | null;
  feePackageName: string | null;
  studentSnapshot: StudentDataSnapshot | null;
}

export interface LatestEnrollmentSummary {
  id: string;
  schoolYear: string;
  createdAt: string;
  status: EnrollmentStatus;
  // Empty while PENDING/REJECTED; snapshotted at confirmation.
  fees: EnrollmentFeeSummary[];
  feePackageId: string | null;
  feePackageName: string | null;
}

export interface Student {
  id: string;
  // Human-readable ID, e.g. 0726001 — generated server-side, never edited.
  studentNumber: string;
  hasBirthCertificate: boolean;
  hasPhoto: boolean;
  // Section 1: Student Data — structured parts + the server-composed
  // display name (studentName is never written directly by the client).
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  studentName: string;
  nickname: string | null;
  dateOfBirth: string;
  gender: Gender;
  primaryLanguage: string;
  // Section 2: Parent/Guardian's Details
  motherName: string | null;
  fatherName: string | null;
  guardianName: string | null;
  contactNumber: string;
  email: string;
  homeAddress: string;
  emergencyContact: string;
  // Section 3: Escort/Custody Information
  escorts: EscortSummary[];
  // Section 4: Medical Background and Safety
  diagnoses: DiagnosisSummary[];
  allergyDietaryRestrictions: string | null;
  medications: string | null;
  medicalCondition: string | null;
  // Section 5: Developmental Intervention
  currentPastTherapies: string | null;
  recommendedTherapist: string | null;
  previousSchoolingSped: string | null;
  // Section 6: Behavioral and Sensory Profile
  sensorySensitivities: string | null;
  triggersAndMeltdownSigns: string | null;
  soothingTechniques: string | null;
  communicationStyle: string | null;
  selfRegulationSkills: string | null;
  // Section 7: Goals and Expectations
  parentGoals: string | null;
  strengthsAndInterests: string | null;

  latestEnrollment: LatestEnrollmentSummary | null;
  createdById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// A named bundle of fee line items ("Package A", "Whole Day"). Each package
// owns its own items with its own amounts, so "Tuition" costs a different
// amount in each one. An enrollment is billed under exactly one package.
export interface FeePackage {
  id: string;
  name: string;
  description: string | null;
  // The fallback used when an enrollment is created without naming a package.
  // Exactly one package holds this at a time.
  isDefault: boolean;
  fees: Fee[];
  // How many students this package currently bills — the exact population a
  // rename, fee edit, or delete would reach. Only the list endpoint computes
  // it, so it's absent on create/update responses (the page carries the
  // previous value forward, since neither changes who's on the package).
  currentStudentCount?: number;
  createdAt: string;
  updatedAt: string;
}

// One line item inside a package (tuition, miscellaneous, curriculum, ...).
// Names are unique per package, not globally. Prisma Decimal serializes as a
// string.
export interface Fee {
  id: string;
  name: string;
  amount: string;
  packageId: string;
  createdAt: string;
  updatedAt: string;
}

// A stored issued official receipt — receiptNumber is server-generated,
// sequential, and never reused.
export interface Receipt {
  id: string;
  receiptNumber: number;
  studentId: string;
  receivedFrom: string;
  amount: string;
  paymentFor: string;
  paymentMethod: string;
  issuedById: string;
  createdAt: string;
}

// Audit trail of catalog changes: v1 at creation, +1 per update.
export interface FeeVersion {
  id: string;
  feeId: string;
  version: number;
  name: string;
  amount: string;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  schoolYear: string;
  // Section 8: Consents
  emergencyMedicalConsent: boolean;
  therapyAssessmentConsent: boolean;
  policyAcknowledgement: boolean;
  photoVideoRelease: boolean;

  status: EnrollmentStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;

  createdById: string;
  createdAt: string;
  updatedAt: string;
  student: StudentSummary;
  createdBy: { id: string; firstName: string; lastName: string };
  // Frozen fee snapshot; empty while PENDING/REJECTED.
  fees: EnrollmentFeeSummary[];
  // Which package this period is billed under. feePackageName is the value
  // frozen at confirmation — null while PENDING/REJECTED.
  feePackageId: string | null;
  feePackageName: string | null;
  // Frozen student-data snapshot; null while PENDING/REJECTED.
  studentSnapshot: StudentDataSnapshot | null;
}

export type StudentUpdateInput = Partial<{
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  nickname: string;
  dateOfBirth: string;
  gender: Gender;
  primaryLanguage: string;
  motherName: string;
  fatherName: string;
  guardianName: string;
  contactNumber: string;
  email: string;
  homeAddress: string;
  emergencyContact: string;
  // Sections 4-7 (escorts and diagnoses stay create-only on the backend)
  allergyDietaryRestrictions: string;
  medications: string;
  medicalCondition: string;
  currentPastTherapies: string;
  recommendedTherapist: string;
  previousSchoolingSped: string;
  sensorySensitivities: string;
  triggersAndMeltdownSigns: string;
  soothingTechniques: string;
  communicationStyle: string;
  selfRegulationSkills: string;
  parentGoals: string;
  strengthsAndInterests: string;
}>;

export type StudentCreateInput = {
  // Section 1: Student Data — the display name is composed server-side.
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  nickname?: string;
  dateOfBirth: string;
  gender: Gender;
  primaryLanguage: string;
  // Section 2: Parent/Guardian's Details
  motherName?: string;
  fatherName?: string;
  guardianName?: string;
  contactNumber: string;
  email: string;
  homeAddress: string;
  emergencyContact: string;
  // Section 3: Escort/Custody Information — 1 to 4 escorts, each with a name;
  // ID images are uploaded separately per-escort after creation.
  escorts: { name: string; phoneNumber?: string }[];
  // Section 4: Medical Background and Safety — 1 to 4 diagnoses, each with a
  // required name and an optional date.
  diagnoses: { officialDiagnosis: string; dateOfDiagnosis?: string }[];
  allergyDietaryRestrictions?: string;
  medications?: string;
  medicalCondition?: string;
  // Section 5: Developmental Intervention
  currentPastTherapies?: string;
  recommendedTherapist?: string;
  previousSchoolingSped?: string;
  // Section 6: Behavioral and Sensory Profile
  sensorySensitivities?: string;
  triggersAndMeltdownSigns?: string;
  soothingTechniques?: string;
  communicationStyle?: string;
  selfRegulationSkills?: string;
  // Section 7: Goals and Expectations
  parentGoals?: string;
  strengthsAndInterests?: string;
  // Initial enrollment period
  schoolYear: string;
  // Which fee package the period is billed under. Optional — omitting it bills
  // the period under whichever package is marked default.
  feePackageId?: string;
  // Extra packages picked alongside the primary one — their fees land as
  // ADHOC lines, same effect as Edit Fees' "Add a whole package" done in the
  // same request. A duplicate of feePackageId is filtered out server-side.
  additionalFeePackageIds?: string[];
  // Section 8: Consents
  emergencyMedicalConsent: boolean;
  therapyAssessmentConsent: boolean;
  policyAcknowledgement: boolean;
  photoVideoRelease: boolean;
};
