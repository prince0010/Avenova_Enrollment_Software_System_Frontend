"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  listFees,
  createFee,
  updateFee,
  deleteFee,
  getFeeHistory,
  ApiClientError,
} from "@/lib/api-client";
import type { Fee, FeeVersion } from "@/lib/types";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeso } from "@/lib/format";

export default function FeesPage() {
  const [fees, setFees] = useState<Fee[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One dialog handles both add and edit; `editing` decides which.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Fee | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleting, setDeleting] = useState<Fee | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [historyFee, setHistoryFee] = useState<Fee | null>(null);
  const [history, setHistory] = useState<FeeVersion[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFees()
      .then(({ fees }) => {
        if (!cancelled) setFees(fees);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : "Failed to load fees.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = (fees ?? []).reduce((sum, f) => sum + Number(f.amount), 0);

  function openAdd() {
    setEditing(null);
    setName("");
    setAmount("");
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(fee: Fee) {
    setEditing(fee);
    setName(fee.name);
    setAmount(fee.amount);
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const parsedAmount = Number(amount);
    if (!trimmedName) {
      setFormError("Fee name is required.");
      return;
    }
    if (!amount.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    setFormError(null);
    setIsSaving(true);
    try {
      if (editing) {
        const { fee } = await updateFee(editing.id, { name: trimmedName, amount: parsedAmount });
        setFees((list) => (list ?? []).map((f) => (f.id === fee.id ? fee : f)));
      } else {
        const { fee } = await createFee({ name: trimmedName, amount: parsedAmount });
        setFees((list) => [...(list ?? []), fee]);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openHistory(fee: Fee) {
    setHistoryFee(fee);
    setHistory(null);
    setHistoryError(null);
    getFeeHistory(fee.id)
      .then(({ versions }) => setHistory(versions))
      .catch((err) =>
        setHistoryError(
          err instanceof ApiClientError ? err.message : "Failed to load fee history."
        )
      );
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteFee(deleting.id);
      setFees((list) => (list ?? []).filter((f) => f.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      setDeleteError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Fees</CardTitle>
            <CardDescription>
              Fee items applied to every enrolled student&apos;s account. Adding a fee charges
              current and future students; updating one changes future enrollments only
              (already-enrolled students keep their original amounts); deleting one removes it
              from every student&apos;s record.
            </CardDescription>
          </div>
          <Button onClick={openAdd}>
            <Plus /> Add fee
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              {fees === null ? (
                <TableSkeletonBody columns={4} />
              ) : (
                <TableBody>
                  {fees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No fees yet. Add tuition, miscellaneous, curriculum, and other fees here.
                      </TableCell>
                    </TableRow>
                  )}
                  {fees.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell className="font-medium">{fee.name}</TableCell>
                      <TableCell className="tabular-nums">{formatPeso(fee.amount)}</TableCell>
                      <TableCell>{new Date(fee.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${fee.name}`}
                              >
                                <MoreHorizontal />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(fee)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openHistory(fee)}>
                              History
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleting(fee);
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
              )}
            </Table>
            {fees !== null && fees.length > 0 && (
              <p className="text-sm">
                <span className="text-muted-foreground">Total per enrolled student: </span>
                <span className="font-medium tabular-nums">{formatPeso(total)}</span>
              </p>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit fee" : "Add fee"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this fee — the change applies to future enrollments; already-enrolled students keep their original amounts."
                : "New fees are charged to currently enrolled students and all future enrollments."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fee-name">Name</Label>
              <Input
                id="fee-name"
                placeholder="e.g. Tuition, Miscellaneous, Curriculum"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fee-amount">Amount (PHP)</Label>
              <Input
                id="fee-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 15000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editing ? "Save changes" : "Add fee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyFee !== null} onOpenChange={(open) => !open && setHistoryFee(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fee history</DialogTitle>
            <DialogDescription>
              Every change to <span className="font-medium">{historyFee?.name}</span> — newest
              first. Already-enrolled students keep the amount from when they enrolled.
            </DialogDescription>
          </DialogHeader>
          {historyError && <p className="text-sm text-destructive">{historyError}</p>}
          {!historyError && history === null && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {history !== null && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Changed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((v, i) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      v{v.version}
                      {i === 0 && <span className="text-muted-foreground"> (current)</span>}
                    </TableCell>
                    <TableCell>{v.name}</TableCell>
                    <TableCell className="tabular-nums">{formatPeso(v.amount)}</TableCell>
                    <TableCell>{new Date(v.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete fee</DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium">{deleting?.name}</span> (
              {deleting ? formatPeso(deleting.amount) : ""})? It will be removed from every
              enrolled student&apos;s record and their totals will update. Price changes are
              versioned, but deletion is permanent — records and reports lose this fee.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
