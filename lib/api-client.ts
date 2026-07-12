import type {
  ApiErrorBody,
  Enrollment,
  EnrollmentStatPoint,
  Fee,
  FeeVersion,
  PublicUser,
  Receipt,
  StatsGroupBy,
  Student,
  StudentCreateInput,
  StudentEnrollment,
  StudentUpdateInput,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001/api";

let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

let forceLogoutCallback: (() => void) | null = null;

export function onForceLogout(cb: () => void) {
  forceLogoutCallback = cb;
}

export class ApiClientError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.errors = body.errors;
  }
}

async function parseErrorBody(res: Response): Promise<ApiErrorBody> {
  try {
    const data = await res.json();
    if (data && typeof data.message === "string") return data as ApiErrorBody;
  } catch {
    // response had no JSON body
  }
  return { message: `Request failed with status ${res.status}` };
}

// De-dupes concurrent refresh attempts so parallel 401s trigger one network call.
let refreshPromise: Promise<string | null> | null = null;

async function rawRefresh(): Promise<string | null> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string };
  setAccessToken(data.accessToken);
  return data.accessToken;
}

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = rawRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Auth endpoints must never trigger a refresh-retry on their own 401s.
const NO_RETRY_PATHS = ["/auth/login", "/auth/refresh"];

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { headers, ...rest } = options;
  const noRetry = NO_RETRY_PATHS.some((p) => path.startsWith(p));

  const buildHeaders = () => {
    const h = new Headers(headers);
    if (rest.body && !(rest.body instanceof FormData)) h.set("Content-Type", "application/json");
    if (accessToken) h.set("Authorization", `Bearer ${accessToken}`);
    return h;
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: buildHeaders(),
  });

  if (res.status !== 401 || noRetry) {
    return res;
  }

  const newToken = await refreshOnce();
  if (!newToken) {
    forceLogoutCallback?.();
    return res;
  }

  return fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: buildHeaders(),
  });
}

async function apiFetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    throw new ApiClientError(res.status, await parseErrorBody(res));
  }
  return (await res.json()) as T;
}

export async function login(email: string, password: string) {
  const data = await apiFetchJson<{ user: PublicUser; accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function logout() {
  try {
    return await apiFetchJson<{ message: string }>("/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
  }
}

export async function refresh(): Promise<string | null> {
  return rawRefresh();
}

export async function getMe() {
  return apiFetchJson<{ user: PublicUser }>("/users/me");
}

export async function updateMe(data: { firstName?: string; lastName?: string }) {
  return apiFetchJson<{ user: PublicUser }>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getEnrollmentStats(groupBy: StatsGroupBy) {
  return apiFetchJson<{ groupBy: StatsGroupBy; data: EnrollmentStatPoint[] }>(
    `/stats/enrollments?groupBy=${groupBy}`
  );
}

export async function getActiveUserCount() {
  return apiFetchJson<{ totalActiveUsers: number }>("/stats/users/active-count");
}

// Sum of fee snapshots across confirmed enrollments (a Decimal string).
export async function getFeeStats() {
  return apiFetchJson<{ totalEnrollmentFees: string }>("/stats/fees");
}

export async function createStudent(data: StudentCreateInput) {
  return apiFetchJson<{ student: Student }>("/students", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function uploadEscortIdImage(studentId: string, escortId: string, file: File) {
  const formData = new FormData();
  formData.append("image", file);
  return apiFetchJson<{ student: Student }>(
    `/students/${studentId}/escorts/${escortId}/id-image`,
    {
      method: "POST",
      body: formData,
    }
  );
}

export async function uploadBirthCertificate(studentId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetchJson<{ student: Student }>(`/students/${studentId}/birth-certificate`, {
    method: "POST",
    body: formData,
  });
}

export async function uploadStudentPhoto(studentId: string, file: File) {
  const formData = new FormData();
  formData.append("image", file);
  return apiFetchJson<{ student: Student }>(`/students/${studentId}/photo`, {
    method: "POST",
    body: formData,
  });
}

// Stored files require the Authorization header, so a plain <img src> can't
// load them — fetch the bytes and hand back a Blob for an object URL instead.
// contentType distinguishes PDFs from images (birth certificates allow both).
async function apiFetchBlob(path: string): Promise<{ blob: Blob; contentType: string }> {
  const res = await apiFetch(path);
  if (!res.ok) {
    throw new ApiClientError(res.status, await parseErrorBody(res));
  }
  const blob = await res.blob();
  return { blob, contentType: res.headers.get("Content-Type") ?? blob.type };
}

export function fetchStudentPhoto(studentId: string) {
  return apiFetchBlob(`/students/${studentId}/photo`);
}

export function fetchBirthCertificate(studentId: string) {
  return apiFetchBlob(`/students/${studentId}/birth-certificate`);
}

export function fetchEscortIdImage(studentId: string, escortId: string) {
  return apiFetchBlob(`/students/${studentId}/escorts/${escortId}/id-image`);
}

// Escort / diagnosis editing on an existing student (1-4 enforced server-side).
// Each returns the refreshed student record.
export async function addEscort(studentId: string, data: { name: string; phoneNumber?: string }) {
  return apiFetchJson<{ student: Student }>(`/students/${studentId}/escorts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEscort(
  studentId: string,
  escortId: string,
  data: { name?: string; phoneNumber?: string | null }
) {
  return apiFetchJson<{ student: Student }>(`/students/${studentId}/escorts/${escortId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteEscort(studentId: string, escortId: string) {
  return apiFetchJson<{ student: Student }>(`/students/${studentId}/escorts/${escortId}`, {
    method: "DELETE",
  });
}

export async function addDiagnosis(
  studentId: string,
  data: { officialDiagnosis: string; dateOfDiagnosis?: string }
) {
  return apiFetchJson<{ student: Student }>(`/students/${studentId}/diagnoses`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDiagnosis(
  studentId: string,
  diagnosisId: string,
  data: { officialDiagnosis?: string; dateOfDiagnosis?: string | null }
) {
  return apiFetchJson<{ student: Student }>(`/students/${studentId}/diagnoses/${diagnosisId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteDiagnosis(studentId: string, diagnosisId: string) {
  return apiFetchJson<{ student: Student }>(`/students/${studentId}/diagnoses/${diagnosisId}`, {
    method: "DELETE",
  });
}

// Documents as they were at an enrollment's confirmation (snapshot copies —
// replaced files are kept on disk so these keep working forever).
export function fetchSnapshotPhoto(enrollmentId: string) {
  return apiFetchBlob(`/enrollments/${enrollmentId}/snapshot/photo`);
}

export function fetchSnapshotBirthCertificate(enrollmentId: string) {
  return apiFetchBlob(`/enrollments/${enrollmentId}/snapshot/birth-certificate`);
}

export async function listStudents() {
  return apiFetchJson<{ students: Student[] }>("/students");
}

export async function getStudent(id: string) {
  return apiFetchJson<{ student: Student }>(`/students/${id}`);
}

export async function listArchivedStudents() {
  return apiFetchJson<{ students: Student[] }>("/students/archived");
}

export async function updateStudent(id: string, data: StudentUpdateInput) {
  return apiFetchJson<{ student: Student }>(`/students/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteStudent(id: string) {
  return apiFetchJson<{ message: string }>(`/students/${id}`, {
    method: "DELETE",
  });
}

export async function restoreStudent(id: string) {
  return apiFetchJson<{ student: Student }>(`/students/${id}/restore`, {
    method: "POST",
  });
}

export async function listFees() {
  return apiFetchJson<{ fees: Fee[] }>("/fees");
}

export async function getFeeHistory(id: string) {
  return apiFetchJson<{ versions: FeeVersion[] }>(`/fees/${id}/history`);
}

export async function createFee(data: { name: string; amount: number }) {
  return apiFetchJson<{ fee: Fee }>("/fees", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateFee(id: string, data: { name?: string; amount?: number }) {
  return apiFetchJson<{ fee: Fee }>(`/fees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteFee(id: string) {
  return apiFetchJson<{ message: string }>(`/fees/${id}`, {
    method: "DELETE",
  });
}

// All enrollment periods of one student, each with its frozen fee snapshot.
export async function listStudentEnrollments(studentId: string) {
  return apiFetchJson<{ enrollments: StudentEnrollment[] }>(`/students/${studentId}/enrollments`);
}

// Re-enrolls an existing student for a new period. The backend snapshots the
// current fee catalog and applies the usual review rule (ADMIN auto-confirms,
// STAFF-created starts PENDING).
export async function createEnrollmentForStudent(
  studentId: string,
  data: {
    schoolYear: string;
    emergencyMedicalConsent: boolean;
    therapyAssessmentConsent: boolean;
    policyAcknowledgement: boolean;
    photoVideoRelease: boolean;
  }
) {
  return apiFetchJson<{ enrollment: Enrollment }>(`/students/${studentId}/enrollments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Issues an official receipt; the sequential OR number is generated
// server-side and returned in the created record.
export async function createReceipt(
  studentId: string,
  data: { receivedFrom: string; amount: number; paymentFor: string; paymentMethod: string }
) {
  return apiFetchJson<{ receipt: Receipt }>(`/students/${studentId}/receipts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listEnrollments() {
  return apiFetchJson<{ enrollments: Enrollment[] }>("/enrollments");
}

export async function listPendingEnrollments() {
  return apiFetchJson<{ enrollments: Enrollment[] }>("/enrollments/pending");
}

export async function confirmEnrollment(id: string) {
  return apiFetchJson<{ enrollment: Enrollment }>(`/enrollments/${id}/confirm`, {
    method: "POST",
  });
}

export async function rejectEnrollment(id: string, reason?: string) {
  return apiFetchJson<{ enrollment: Enrollment }>(`/enrollments/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
