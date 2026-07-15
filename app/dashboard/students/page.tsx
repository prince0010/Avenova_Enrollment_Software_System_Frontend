"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MoreHorizontal, Search } from "lucide-react";
import {
  deleteStudent,
  listStudents,
  listStudentEnrollments,
  emailStatementOfAccount,
  ApiClientError,
} from "@/lib/api-client";
import type { Enrollment, Student, StudentEnrollment } from "@/lib/types";
import { StudentViewDialog } from "@/components/student-view-dialog";
import { StudentEditDialog } from "@/components/student-edit-dialog";
import { OfficialReceiptDialog } from "@/components/official-receipt-dialog";
import { ReEnrollDialog } from "@/components/re-enroll-dialog";
import { buildStatementOfAccountHtml, openPrintWindow } from "@/lib/print-documents";
import { useAuth } from "@/lib/auth-context";
import { EnrolledCell } from "@/components/enrolled-cell";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function toLocalDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function StudentsPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters — `?search=` deep-links a pre-filtered view (used by the intake
  // wizard's duplicate modal to jump straight to the matched student).
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialogs
  const [viewing, setViewing] = useState<Student | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [receiptFor, setReceiptFor] = useState<Student | null>(null);
  const [reEnrolling, setReEnrolling] = useState<Student | null>(null);
  const [statementPicker, setStatementPicker] = useState<{
    student: Student;
    enrollments: StudentEnrollment[];
  } | null>(null);
  const [statementYearId, setStatementYearId] = useState<string>("");
  // Transient status for the "Generate" button's email side effect — the
  // dialog closes immediately for printing, so this surfaces on the page
  // itself and clears on its own after a few seconds.
  const [statementEmailNotice, setStatementEmailNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!statementEmailNotice) return;
    const t = setTimeout(() => setStatementEmailNotice(null), 6000);
    return () => clearTimeout(t);
  }, [statementEmailNotice]);

  useEffect(() => {
    let cancelled = false;
    listStudents()
      .then(({ students: list }) => {
        if (!cancelled) setStudents(list);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load students. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q) {
        const haystack =
          `${s.studentNumber} ${s.studentName} ${s.nickname ?? ""} ${s.email} ${s.contactNumber}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      const enrolled = toLocalDateString(
        new Date(s.latestEnrollment?.createdAt ?? s.createdAt)
      );
      if (dateFrom && enrolled < dateFrom) return false;
      if (dateTo && enrolled > dateTo) return false;
      return true;
    });
  }, [students, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function resetToFirstPage() {
    setPage(1);
  }

  function handleSaved(updated: Student) {
    setStudents((list) =>
      list ? list.map((s) => (s.id === updated.id ? updated : s)) : list
    );
  }

  // A new period becomes the student's latest enrollment; any student-data
  // edits made in the re-enroll dialog land on the row at the same time.
  function handleReEnrolled(enrollment: Enrollment, updatedStudent: Student | null) {
    setReEnrolling(null);
    setStudents((list) =>
      list
        ? list.map((s) =>
            s.id === enrollment.studentId
              ? {
                  ...(updatedStudent ?? s),
                  latestEnrollment: {
                    id: enrollment.id,
                    schoolYear: enrollment.schoolYear,
                    createdAt: enrollment.createdAt,
                    status: enrollment.status,
                    fees: enrollment.fees,
                  },
                }
              : s
          )
        : list
    );
  }

  function printStatement(
    student: Student,
    enrollment: { schoolYear: string; fees: { name: string; amount: string }[] }
  ) {
    openPrintWindow(
      `Statement of Account — ${student.studentName}`,
      buildStatementOfAccountHtml(
        student,
        enrollment,
        user ? `${user.firstName} ${user.lastName}` : ""
      )
    );
  }

  // Fires alongside the print — the backend renders the same fee snapshot as
  // an emailed backup copy for the parent's own records.
  async function emailStatementCopy(enrollmentId: string) {
    try {
      const { message } = await emailStatementOfAccount(enrollmentId);
      setStatementEmailNotice({ type: "success", message });
    } catch (err) {
      setStatementEmailNotice({
        type: "error",
        message:
          err instanceof ApiClientError
            ? err.message
            : "Failed to email the statement of account.",
      });
    }
  }

  // A statement covers one school year's frozen fee snapshot. The admin
  // always picks the school year explicitly — even when there's only one —
  // so what's being printed is never ambiguous.
  async function handleStatement(student: Student) {
    try {
      const { enrollments } = await listStudentEnrollments(student.id);
      const confirmed = enrollments.filter((e) => e.status === "CONFIRMED");
      if (confirmed.length > 0) {
        // Newest year preselected; enrollments arrive newest-first.
        setStatementYearId(confirmed[0].id);
        setStatementPicker({ student, enrollments: confirmed });
      } else if (student.latestEnrollment) {
        printStatement(student, student.latestEnrollment);
      }
    } catch {
      // Network hiccup: fall back to the latest snapshot already on hand.
      if (student.latestEnrollment) printStatement(student, student.latestEnrollment);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteStudent(deleting.id);
      setStudents((list) =>
        list ? list.filter((s) => s.id !== deleting.id) : list
      );
      setDeleting(null);
    } catch (err) {
      setDeleteError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Students</h1>
        <Button render={<Link href="/dashboard/students/new" />} nativeButton={false}>
          Add student
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enrolled students</CardTitle>
          <CardDescription>
            {students
              ? `${filtered.length.toLocaleString()} of ${students.length.toLocaleString()} student${students.length === 1 ? "" : "s"}`
              : "All student records"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ID, name, nickname, email, contact..."
                className="pl-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetToFirstPage();
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="date-from" className="text-xs text-muted-foreground">
                Enrolled from
              </Label>
              <Input
                id="date-from"
                type="date"
                className="w-36"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  resetToFirstPage();
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="date-to" className="text-xs text-muted-foreground">
                Enrolled to
              </Label>
              <Input
                id="date-to"
                type="date"
                className="w-36"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  resetToFirstPage();
                }}
              />
            </div>
            {(search || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                  resetToFirstPage();
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {statementEmailNotice && (
            <p
              className={
                statementEmailNotice.type === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {statementEmailNotice.message}
            </p>
          )}
          {!error && students === null && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Date of birth</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="w-12 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableSkeletonBody columns={8} rows={5} />
              </Table>
            </div>
          )}
          {students !== null && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {students.length === 0
                ? "No students enrolled yet."
                : "No students match the current filters."}
            </p>
          )}

          {filtered.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Date of birth</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enrolled</TableHead>
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="tabular-nums">{s.studentNumber}</TableCell>
                        <TableCell className="font-medium">
                          {s.studentName}
                          {s.nickname && (
                            <span className="ml-1 text-muted-foreground">
                              ({s.nickname})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.gender === "MALE" ? "Male" : "Female"}
                        </TableCell>
                        <TableCell>
                          {new Date(s.dateOfBirth).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{s.contactNumber}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell>
                          <EnrolledCell student={s} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${s.studentName}`}
                                >
                                  <MoreHorizontal />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewing(s)}>
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditing(s)}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setReEnrolling(s)}>
                                Re-enroll
                              </DropdownMenuItem>
                              {s.latestEnrollment?.status === "CONFIRMED" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleStatement(s)}>
                                    Statement of Account
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setReceiptFor(s)}>
                                    Official Receipt
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleting(s);
                                }}
                              >
                                Delete
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
                totalItems={filtered.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  resetToFirstPage();
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      <StudentViewDialog
        student={viewing}
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
      />
      <StudentEditDialog
        student={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={handleSaved}
      />
      <OfficialReceiptDialog
        student={receiptFor}
        open={receiptFor !== null}
        onOpenChange={(open) => !open && setReceiptFor(null)}
      />
      <ReEnrollDialog
        student={reEnrolling}
        open={reEnrolling !== null}
        onOpenChange={(open) => !open && setReEnrolling(null)}
        onEnrolled={handleReEnrolled}
      />

      <Dialog
        open={statementPicker !== null}
        onOpenChange={(open) => !open && setStatementPicker(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Statement of Account</DialogTitle>
            <DialogDescription>
              Choose which of {statementPicker?.student.studentName}&apos;s school years to
              print — each statement shows the fees as they were that year.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="statement-year">School year</Label>
            {/* Base UI's SelectValue renders the raw value (an enrollment id)
                unless the root gets an `items` map for value→label display. */}
            <Select
              items={(statementPicker?.enrollments ?? []).map((e) => ({
                value: e.id,
                label: `School Year ${new Date(e.schoolYear).getFullYear()} — Enrolled ${new Date(e.schoolYear).toLocaleDateString()}`,
              }))}
              value={statementYearId}
              onValueChange={(v) => v && setStatementYearId(v)}
            >
              <SelectTrigger id="statement-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statementPicker?.enrollments.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    School Year {new Date(e.schoolYear).getFullYear()} — Enrolled{" "}
                    {new Date(e.schoolYear).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter showCloseButton>
            <Button
              onClick={() => {
                const enrollment = statementPicker?.enrollments.find(
                  (e) => e.id === statementYearId
                );
                if (statementPicker && enrollment) {
                  printStatement(statementPicker.student, enrollment);
                  void emailStatementCopy(enrollment.id);
                  setStatementPicker(null);
                }
              }}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !isDeleting && setDeleting(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete student?</DialogTitle>
            <DialogDescription>
              {deleting?.studentName}&apos;s record will be moved to the
              Archive. You can restore it from there later.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// useSearchParams requires a Suspense boundary around the consuming component.
export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <StudentsPageInner />
    </Suspense>
  );
}
