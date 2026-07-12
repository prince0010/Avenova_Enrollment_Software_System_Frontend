import type { Student } from "@/lib/types";

export function EnrolledCell({ student }: { student: Student }) {
  const latest = student.latestEnrollment;
  if (!latest) return <>—</>;
  if (latest.status === "PENDING") {
    return <span className="text-muted-foreground">Pending</span>;
  }
  if (latest.status === "REJECTED") {
    return <span className="text-muted-foreground">Rejected</span>;
  }
  return <>{new Date(latest.createdAt).toLocaleDateString()}</>;
}
