"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  listPendingEnrollments,
  listFeePackages,
  confirmEnrollment,
  rejectEnrollment,
  ApiClientError,
} from "@/lib/api-client";
import type { Enrollment, FeePackage } from "@/lib/types";
import { formatPeso } from "@/lib/format";
import { EnrollmentViewDialog } from "@/components/enrollment-view-dialog";
import { TablePagination } from "@/components/table-pagination";
import { TableSkeletonBody } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function PendingPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [viewing, setViewing] = useState<Enrollment | null>(null);

  const [confirming, setConfirming] = useState<Enrollment | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Confirmation is the last moment before the fee snapshot freezes, so the
  // reviewing admin can correct the package the submitter chose.
  const [feePackages, setFeePackages] = useState<FeePackage[]>([]);
  const [confirmPackageId, setConfirmPackageId] = useState("");
  useEffect(() => {
    let cancelled = false;
    listFeePackages()
      .then((res) => {
        if (!cancelled) setFeePackages(res.feePackages);
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
  const confirmPackage = feePackages.find((p) => p.id === confirmPackageId) ?? null;

  const [rejecting, setRejecting] = useState<Enrollment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPendingEnrollments()
      .then(({ enrollments: list }) => {
        if (!cancelled) setEnrollments(list);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load pending enrollments. Please try again.");
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

  async function handleConfirm() {
    if (!confirming) return;
    setConfirmError(null);
    setIsConfirming(true);
    try {
      // Only sent when it differs from what was submitted — otherwise the
      // backend keeps the submission's own choice.
      const override =
        confirmPackageId && confirmPackageId !== confirming.feePackageId
          ? confirmPackageId
          : undefined;
      await confirmEnrollment(confirming.id, override);
      setEnrollments((list) =>
        list ? list.filter((e) => e.id !== confirming.id) : list
      );
      setConfirming(null);
    } catch (err) {
      setConfirmError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleReject() {
    if (!rejecting) return;
    setRejectError(null);
    setIsRejecting(true);
    try {
      await rejectEnrollment(rejecting.id, rejectReason.trim() || undefined);
      setEnrollments((list) =>
        list ? list.filter((e) => e.id !== rejecting.id) : list
      );
      setRejecting(null);
    } catch (err) {
      setRejectError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">Pending</h1>

      <Card>
        <CardHeader>
          <CardTitle>Awaiting confirmation</CardTitle>
          <CardDescription>
            Enrollments submitted by staff wait here until an admin confirms
            or rejects them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && enrollments === null && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>School year</TableHead>
                    <TableHead>Submitted by</TableHead>
                    <TableHead>Submitted</TableHead>
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
              Nothing is waiting for confirmation.
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
                      <TableHead>Submitted by</TableHead>
                      <TableHead>Submitted</TableHead>
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
                          {e.createdBy.firstName} {e.createdBy.lastName}
                        </TableCell>
                        <TableCell>
                          {new Date(e.createdAt).toLocaleDateString()}
                        </TableCell>
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
                              <DropdownMenuItem
                                onClick={() => {
                                  setConfirmError(null);
                                  // Start from what the submitter chose; the
                                  // admin can change it before confirming.
                                  setConfirmPackageId(e.feePackageId ?? "");
                                  setConfirming(e);
                                }}
                              >
                                Confirm
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setRejectError(null);
                                  setRejectReason("");
                                  setRejecting(e);
                                }}
                              >
                                Reject
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

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && !isConfirming && setConfirming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm enrollment?</DialogTitle>
            <DialogDescription>
              {confirming?.student.studentName}&apos;s{" "}
              {confirming ? new Date(confirming.schoolYear).toLocaleDateString() : ""}{" "}
              enrollment will move to the Enrolled list.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-fee-package">Fee package</Label>
            <Select
              items={feePackageItems}
              value={confirmPackageId}
              onValueChange={(v) => v && setConfirmPackageId(v)}
            >
              <SelectTrigger id="confirm-fee-package">
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
              These amounts freeze onto the record the moment you confirm — this is the last
              chance to change them.
            </p>
            {confirmPackage && confirmPackage.fees.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5 rounded-lg border p-3 text-xs">
                {confirmPackage.fees.map((f) => (
                  <div key={f.id} className="flex justify-between text-muted-foreground">
                    <span>{f.name}</span>
                    <span className="tabular-nums">{formatPeso(f.amount)}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t pt-1 font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatPeso(
                      confirmPackage.fees.reduce((sum, f) => sum + Number(f.amount), 0)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
          {confirmError && (
            <p className="text-sm text-destructive">{confirmError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(null)}
              disabled={isConfirming}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isConfirming}>
              {isConfirming ? "Confirming..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && !isRejecting && setRejecting(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject enrollment?</DialogTitle>
            <DialogDescription>
              {rejecting?.student.studentName}&apos;s{" "}
              {rejecting ? new Date(rejecting.schoolYear).toLocaleDateString() : ""}{" "}
              enrollment will be marked rejected. This can&apos;t be undone
              from here.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this being rejected?"
            />
          </div>
          {rejectError && (
            <p className="text-sm text-destructive">{rejectError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejecting(null)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting}
            >
              {isRejecting ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
