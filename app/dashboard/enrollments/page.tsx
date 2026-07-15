"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import {
  listEnrollments,
  getStudent,
  emailStatementOfAccount,
  ApiClientError,
} from "@/lib/api-client";
import type { Enrollment, Student } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { buildStatementOfAccountHtml, openPrintWindow } from "@/lib/print-documents";
import { EnrollmentViewDialog } from "@/components/enrollment-view-dialog";
import { EnrollmentSnapshotDialog } from "@/components/enrollment-snapshot-dialog";
import { OfficialReceiptDialog } from "@/components/official-receipt-dialog";
import { TablePagination } from "@/components/table-pagination";
import { TableSkeletonBody } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALL_SCHOOL_YEARS = "__all__";

function schoolYearLabel(schoolYear: string) {
  return String(new Date(schoolYear).getFullYear());
}

function consentCount(e: Enrollment) {
  return [
    e.emergencyMedicalConsent,
    e.therapyAssessmentConsent,
    e.policyAcknowledgement,
    e.photoVideoRelease,
  ].filter(Boolean).length;
}

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters — search matches gender, Student ID, and any substring of the
  // composed full name (which already covers first/first+middle/first+middle
  // +last/last since it's all one "First Middle Last Suffix" string); school
  // year narrows to one enrollment period's year via a dropdown of the years
  // actually present in the data, same UI shape as the Students page's date filter.
  const [search, setSearch] = useState("");
  const [schoolYearFilter, setSchoolYearFilter] = useState(ALL_SCHOOL_YEARS);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [viewing, setViewing] = useState<Enrollment | null>(null);
  const [snapshotViewing, setSnapshotViewing] = useState<Enrollment | null>(null);
  const [receiptFor, setReceiptFor] = useState<Student | null>(null);
  // Transient status for the "Statement of Account" menu item's email side
  // effect, separate from actionError (which covers other row actions).
  const [emailNotice, setEmailNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // This page's rows ARE enrollment periods, so the statement prints exactly
  // this row's school year and frozen fee snapshot — no year picker needed.
  // Also emails the same fee snapshot to the student's own email as a backup
  // copy for the parent, same as the Students page's Generate button.
  function printStatement(e: Enrollment) {
    openPrintWindow(
      `Statement of Account — ${e.student.studentName}`,
      buildStatementOfAccountHtml(
        e.student,
        { schoolYear: e.schoolYear, fees: e.fees },
        user ? `${user.firstName} ${user.lastName}` : ""
      )
    );
    emailStatementOfAccount(e.id)
      .then(({ message }) => setEmailNotice({ type: "success", message }))
      .catch((err) =>
        setEmailNotice({
          type: "error",
          message:
            err instanceof ApiClientError
              ? err.message
              : "Failed to email the statement of account.",
        })
      );
  }

  // The receipt dialog needs the full student record (parent names, latest
  // fees); rows only carry a summary, so fetch it on demand.
  async function handleReceipt(e: Enrollment) {
    setActionError(null);
    try {
      const { student } = await getStudent(e.student.id);
      setReceiptFor(student);
    } catch (err) {
      setActionError(
        err instanceof ApiClientError ? err.message : "Failed to load the student record."
      );
    }
  }

  useEffect(() => {
    if (!emailNotice) return;
    const t = setTimeout(() => setEmailNotice(null), 6000);
    return () => clearTimeout(t);
  }, [emailNotice]);

  useEffect(() => {
    let cancelled = false;
    listEnrollments()
      .then(({ enrollments: list }) => {
        if (!cancelled) setEnrollments(list);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load enrollments. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Distinct school years present in the data, newest first, for the filter dropdown.
  const schoolYears = useMemo(() => {
    if (!enrollments) return [];
    const years = new Set(enrollments.map((e) => schoolYearLabel(e.schoolYear)));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [enrollments]);

  const filtered = useMemo(() => {
    if (!enrollments) return [];
    const q = search.trim().toLowerCase();
    return enrollments.filter((e) => {
      if (q) {
        const genderLabel = e.student.gender === "MALE" ? "male" : "female";
        const haystack =
          `${e.student.studentNumber} ${e.student.studentName} ${e.student.nickname ?? ""} ${genderLabel}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (schoolYearFilter !== ALL_SCHOOL_YEARS && schoolYearLabel(e.schoolYear) !== schoolYearFilter) {
        return false;
      }
      return true;
    });
  }, [enrollments, search, schoolYearFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function resetToFirstPage() {
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">Enrolled</h1>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment periods</CardTitle>
          <CardDescription>
            {enrollments
              ? `${filtered.length.toLocaleString()} of ${enrollments.length.toLocaleString()} enrollment period${enrollments.length === 1 ? "" : "s"}`
              : "Every enrollment record across all school years, one row per enrollment period."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search gender, Student ID, or name..."
                className="pl-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetToFirstPage();
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="school-year-filter" className="text-xs text-muted-foreground">
                School year
              </Label>
              {/* Base UI's SelectValue renders the raw value unless the root
                  gets an `items` map for value→label display. */}
              <Select
                items={[
                  { value: ALL_SCHOOL_YEARS, label: "All school years" },
                  ...schoolYears.map((y) => ({ value: y, label: y })),
                ]}
                value={schoolYearFilter}
                onValueChange={(v) => {
                  if (v) {
                    setSchoolYearFilter(v);
                    resetToFirstPage();
                  }
                }}
              >
                <SelectTrigger id="school-year-filter" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SCHOOL_YEARS}>All school years</SelectItem>
                  {schoolYears.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(search || schoolYearFilter !== ALL_SCHOOL_YEARS) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSchoolYearFilter(ALL_SCHOOL_YEARS);
                  resetToFirstPage();
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          {emailNotice && (
            <p
              className={
                emailNotice.type === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {emailNotice.message}
            </p>
          )}
          {!error && enrollments === null && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>School year</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Consents</TableHead>
                    <TableHead className="w-12 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableSkeletonBody columns={6} rows={5} />
              </Table>
            </div>
          )}
          {enrollments !== null && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {enrollments.length === 0
                ? "No enrollment records yet."
                : "No enrollment periods match the current filters."}
            </p>
          )}

          {total > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>School year</TableHead>
                      <TableHead>Enrolled</TableHead>
                      <TableHead>Consents</TableHead>
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="tabular-nums">{e.student.studentNumber}</TableCell>
                        <TableCell className="font-medium">
                          {e.student.studentName}
                          {e.student.nickname && (
                            <span className="ml-1 text-muted-foreground">
                              ({e.student.nickname})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{new Date(e.schoolYear).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {new Date(e.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{consentCount(e)}/4</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${e.student.studentName}`}
                                >
                                  <MoreHorizontal />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewing(e)}>
                                View
                              </DropdownMenuItem>
                              {e.studentSnapshot && (
                                <DropdownMenuItem onClick={() => setSnapshotViewing(e)}>
                                  Student data (this year)
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => printStatement(e)}>
                                Statement of Account
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReceipt(e)}>
                                Official Receipt
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={currentPage}
                pageSize={pageSize}
                totalItems={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      <EnrollmentViewDialog
        enrollment={viewing}
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
      />
      <EnrollmentSnapshotDialog
        enrollment={snapshotViewing}
        open={snapshotViewing !== null}
        onOpenChange={(open) => !open && setSnapshotViewing(null)}
      />
      <OfficialReceiptDialog
        student={receiptFor}
        open={receiptFor !== null}
        onOpenChange={(open) => !open && setReceiptFor(null)}
      />
    </div>
  );
}
