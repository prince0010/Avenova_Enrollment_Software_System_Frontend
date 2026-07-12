"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  listArchivedStudents,
  restoreStudent,
  ApiClientError,
} from "@/lib/api-client";
import type { Student } from "@/lib/types";
import { StudentViewDialog } from "@/components/student-view-dialog";
import { EnrolledCell } from "@/components/enrolled-cell";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ArchivePage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [viewing, setViewing] = useState<Student | null>(null);
  const [restoring, setRestoring] = useState<Student | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listArchivedStudents()
      .then(({ students: list }) => {
        if (!cancelled) setStudents(list);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load archive. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = students?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = (students ?? []).slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  async function handleRestore() {
    if (!restoring) return;
    setRestoreError(null);
    setIsRestoring(true);
    try {
      await restoreStudent(restoring.id);
      setStudents((list) =>
        list ? list.filter((s) => s.id !== restoring.id) : list
      );
      setRestoring(null);
    } catch (err) {
      setRestoreError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">Archive</h1>

      <Card>
        <CardHeader>
          <CardTitle>Archived students</CardTitle>
          <CardDescription>
            Deleted students are kept here and can be restored.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && students === null && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Archived</TableHead>
                    <TableHead className="w-12 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableSkeletonBody columns={7} rows={5} />
              </Table>
            </div>
          )}
          {students !== null && students.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              The archive is empty.
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
                      <TableHead>Gender</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enrolled</TableHead>
                      <TableHead>Archived</TableHead>
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
                        <TableCell>{s.email}</TableCell>
                        <TableCell>
                          <EnrolledCell student={s} />
                        </TableCell>
                        <TableCell>
                          {s.deletedAt
                            ? new Date(s.deletedAt).toLocaleDateString()
                            : "—"}
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
                              <DropdownMenuItem
                                onClick={() => {
                                  setRestoreError(null);
                                  setRestoring(s);
                                }}
                              >
                                Restore
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

      <StudentViewDialog
        student={viewing}
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
      />

      <Dialog
        open={restoring !== null}
        onOpenChange={(open) => !open && !isRestoring && setRestoring(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore student?</DialogTitle>
            <DialogDescription>
              {restoring?.studentName}&apos;s record will move back to the
              Students list.
            </DialogDescription>
          </DialogHeader>
          {restoreError && (
            <p className="text-sm text-destructive">{restoreError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoring(null)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? "Restoring..." : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
