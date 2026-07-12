"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { listEnrollments, getStudent, ApiClientError } from "@/lib/api-client";
import type { Enrollment, Student } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { buildStatementOfAccountHtml, openPrintWindow } from "@/lib/print-documents";
import { EnrollmentViewDialog } from "@/components/enrollment-view-dialog";
import { EnrollmentSnapshotDialog } from "@/components/enrollment-snapshot-dialog";
import { OfficialReceiptDialog } from "@/components/official-receipt-dialog";
import { TablePagination } from "@/components/table-pagination";
import { TableSkeletonBody } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [viewing, setViewing] = useState<Enrollment | null>(null);
  const [snapshotViewing, setSnapshotViewing] = useState<Enrollment | null>(null);
  const [receiptFor, setReceiptFor] = useState<Student | null>(null);

  // This page's rows ARE enrollment periods, so the statement prints exactly
  // this row's school year and frozen fee snapshot — no year picker needed.
  function printStatement(e: Enrollment) {
    openPrintWindow(
      `Statement of Account — ${e.student.studentName}`,
      buildStatementOfAccountHtml(
        e.student,
        { schoolYear: e.schoolYear, fees: e.fees },
        user ? `${user.firstName} ${user.lastName}` : ""
      )
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

  const total = enrollments?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = (enrollments ?? []).slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">Enrolled</h1>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment periods</CardTitle>
          <CardDescription>
            Every enrollment record across all school years, one row per
            enrollment period.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
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
          {enrollments !== null && enrollments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No enrollment records yet.
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
