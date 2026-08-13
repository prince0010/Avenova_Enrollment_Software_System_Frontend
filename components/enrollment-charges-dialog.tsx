"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { EnrollmentFeeSummary, FeePackage } from "@/lib/types";
import {
  addEnrollmentFee,
  deleteEnrollmentFee,
  unassignEnrollmentFeePackage,
  listFeePackages,
  ApiClientError,
} from "@/lib/api-client";
import { formatPeso } from "@/lib/format";
import { groupEnrollmentFees } from "@/lib/fee-groups";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// The minimum an enrollment period needs to expose for its charges to be
// edited. Kept to primitives rather than a full `Enrollment` so both entry
// points can build it — the Enrolled page from an Enrollment row, the Students
// page from a student's `latestEnrollment` summary.
export interface ChargesTarget {
  enrollmentId: string;
  studentName: string;
  schoolYear: string;
  feePackageName: string | null;
  fees: EnrollmentFeeSummary[];
}

export function EnrollmentChargesDialog({
  target,
  open,
  onOpenChange,
  onFeesChanged,
  onPackageUnassigned,
}: {
  target: ChargesTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Lets the parent list keep its row (and any totals) in sync without refetching.
  onFeesChanged: (enrollmentId: string, fees: EnrollmentFeeSummary[]) => void;
  // Fired when the whole current package is removed — separate from
  // onFeesChanged because it changes more than the fee list: the enrollment's
  // feePackageId/feePackageName go to null too, so the parent's row (and its
  // "Billed under X" display elsewhere) needs to clear that field as well.
  onPackageUnassigned: (enrollmentId: string) => void;
}) {
  const [fees, setFees] = useState<EnrollmentFeeSummary[]>([]);
  // Own local copy so the dialog's grouping/description update immediately on
  // unassign, without waiting for the parent to re-render with a new `target`.
  const [currentPackageName, setCurrentPackageName] = useState<string | null>(null);
  const [packages, setPackages] = useState<FeePackage[]>([]);
  const [packageId, setPackageId] = useState("");
  const [feeId, setFeeId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingGroup, setRemovingGroup] = useState<string | null>(null);

  // Reset to the enrollment's own snapshot every time the dialog is opened for
  // a (possibly different) row.
  useEffect(() => {
    if (open && target) {
      setFees(target.fees);
      setCurrentPackageName(target.feePackageName);
      setPackageId("");
      setFeeId("");
      setFormError(null);
    }
  }, [open, target]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listFeePackages()
      .then((res) => {
        if (!cancelled) setPackages(res.feePackages);
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const packageItems = useMemo(
    () =>
      packages.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.fees.length} item${p.fees.length === 1 ? "" : "s"})`,
      })),
    [packages]
  );

  // Every line item across every package, labelled with its package and price
  // so two identically-named fees are still tellable apart.
  const allFees = useMemo(
    () => packages.flatMap((p) => p.fees.map((f) => ({ fee: f, pkg: p }))),
    [packages]
  );
  const feeItems = useMemo(
    () =>
      allFees.map(({ fee, pkg }) => ({
        value: fee.id,
        label: `${fee.name} — ${pkg.name} — ${formatPeso(fee.amount)}`,
      })),
    [allFees]
  );

  function commit(next: EnrollmentFeeSummary[]) {
    setFees(next);
    if (target) onFeesChanged(target.enrollmentId, next);
  }

  // Everything added here lands as source=ADHOC, which is what keeps it safe
  // from later catalog writes — but also means it won't track future price
  // changes to the fee it was copied from. That's the tradeoff, stated in the
  // dialog copy below.
  async function addLines(lines: { name: string; amount: number; packageName?: string }[]) {
    if (!target || lines.length === 0) return;
    setFormError(null);
    setIsSaving(true);
    try {
      const added: EnrollmentFeeSummary[] = [];
      for (const line of lines) {
        const { fee } = await addEnrollmentFee(target.enrollmentId, line);
        added.push(fee);
      }
      commit([...fees, ...added]);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddPackage() {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) {
      setFormError("Pick a package to add.");
      return;
    }
    if (pkg.fees.length === 0) {
      setFormError(`${pkg.name} has no fee items to add.`);
      return;
    }
    await addLines(
      pkg.fees.map((f) => ({ name: f.name, amount: Number(f.amount), packageName: pkg.name }))
    );
    setPackageId("");
  }

  async function handleAddFee() {
    const found = allFees.find(({ fee }) => fee.id === feeId);
    if (!found) {
      setFormError("Pick a fee to add.");
      return;
    }
    await addLines([
      { name: found.fee.name, amount: Number(found.fee.amount), packageName: found.pkg.name },
    ]);
    setFeeId("");
  }

  async function handleRemove(fee: EnrollmentFeeSummary) {
    if (!target) return;
    setFormError(null);
    setRemovingId(fee.id);
    try {
      await deleteEnrollmentFee(target.enrollmentId, fee.id);
      commit(fees.filter((f) => f.id !== fee.id));
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setRemovingId(null);
    }
  }

  // Removes every ADHOC line in one group in a single click, instead of
  // one-by-one. Used for a group that ISN'T the student's own current
  // package — a second package added via "Add a whole package", or a fully
  // hand-typed "Other charges" group. The current-package group goes through
  // handleRemoveCurrentPackage instead (see below), since its PACKAGE rows
  // 400 on this per-fee DELETE.
  async function handleRemoveGroup(group: { label: string; fees: EnrollmentFeeSummary[] }) {
    if (!target) return;
    setFormError(null);
    setRemovingGroup(group.label);
    try {
      for (const fee of group.fees) {
        await deleteEnrollmentFee(target.enrollmentId, fee.id);
      }
      const removedIds = new Set(group.fees.map((f) => f.id));
      commit(fees.filter((f) => !removedIds.has(f.id)));
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setRemovingGroup(null);
    }
  }

  // The current-package group is made of PACKAGE rows, which the per-fee
  // DELETE always refuses (they're managed through the fee catalog). Removing
  // the whole package instead goes through its own endpoint, which deletes
  // every PACKAGE line AND clears the enrollment's package assignment in one
  // atomic call — "the student is no longer on this package at all," not
  // "remove some charges." Any ADHOC lines that happen to share the same
  // packageName (e.g. the admin re-added the same package by hand) are left
  // alone; they were added as separate charges, independent of the assignment.
  async function handleRemoveCurrentPackage() {
    if (!target || !currentPackageName) return;
    setFormError(null);
    setRemovingGroup(currentPackageName);
    try {
      const { enrollment } = await unassignEnrollmentFeePackage(target.enrollmentId);
      setCurrentPackageName(null);
      commit(enrollment.fees);
      onPackageUnassigned(target.enrollmentId);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setRemovingGroup(null);
    }
  }

  const total = fees.reduce((sum, f) => sum + Number(f.amount), 0);

  // Group by the package each line was copied from, so a student billed under
  // two packages sees them as two sections instead of one merged list — this
  // is the whole point of packageName existing. Shared with the student View
  // dialog and the Statement of Account package picker via lib/fee-groups.ts.
  const groups = useMemo(() => {
    return groupEnrollmentFees(fees, currentPackageName).map((g) => ({
      ...g,
      subtotal: g.fees.reduce((sum, f) => sum + Number(f.amount), 0),
    }));
  }, [fees, currentPackageName]);

  // Two lines sharing a name within the SAME group is legal but reads oddly on
  // a statement (e.g. two "Tuition" rows both labelled Package A), so flag it.
  // Across different groups it's expected — that's the point of grouping — so
  // it isn't flagged there.
  const duplicateNamesByGroup = useMemo(() => {
    return groups
      .map((g) => {
        const seen = new Map<string, number>();
        for (const f of g.fees) seen.set(f.name, (seen.get(f.name) ?? 0) + 1);
        const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([n]) => n);
        return { label: g.label, dupes };
      })
      .filter((g) => g.dupes.length > 0);
  }, [groups]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit fees — {target?.studentName}</DialogTitle>
          <DialogDescription>
            {target &&
              (currentPackageName
                ? `Billed under ${currentPackageName} for ${new Date(target.schoolYear).getFullYear()}. `
                : "No package assigned. ")}
            Add another package, or a single fee from the catalog. Anything added here belongs
            to this school year only and won&apos;t change if the catalog price changes later.
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 flex-1 overflow-y-auto pr-2">
          {fees.length === 0 && (
            <p className="rounded-lg border py-6 text-center text-sm text-muted-foreground">
              No charges on this period yet.
            </p>
          )}

          {groups.map((group) => {
            // The enrollment's own current package group is always removable —
            // its trash icon goes through handleRemoveCurrentPackage, which
            // unassigns the package as well as clearing its fee lines. Any
            // OTHER group needs to be entirely ADHOC to be removable, since
            // handleRemoveGroup deletes per-line and PACKAGE rows 400 on that.
            const isCurrentPackageGroup =
              currentPackageName !== null && group.label === currentPackageName;
            const groupRemovable =
              isCurrentPackageGroup || group.fees.every((f) => f.source === "ADHOC");
            return (
              <div key={group.label} className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <h3 className="text-sm font-medium">{group.label}</h3>
                    {groupRemovable && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer"
                        aria-label={`Remove all of ${group.label}`}
                        disabled={removingGroup === group.label}
                        onClick={() =>
                          isCurrentPackageGroup
                            ? handleRemoveCurrentPackage()
                            : handleRemoveGroup(group)
                        }
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Subtotal:{" "}
                    <span className="tabular-nums text-foreground">
                      {formatPeso(group.subtotal)}
                    </span>
                  </span>
                </div>
                <Table>
                  <TableBody>
                    {group.fees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell>
                          <span className="font-medium">{fee.name}</span>
                          {fee.source === "ADHOC" && (
                            <Badge variant="secondary" className="ml-2">
                              Added
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">{formatPeso(fee.amount)}</TableCell>
                        <TableCell className="w-10">
                          {fee.source === "ADHOC" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${fee.name}`}
                              disabled={removingId === fee.id}
                              onClick={() => handleRemove(fee)}
                            >
                              <X />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {duplicateNamesByGroup
                  .filter((g) => g.label === group.label)
                  .map((g) => (
                    <p key={g.label} className="mt-1 text-xs text-muted-foreground">
                      Charged twice under the same name in this group: {g.dupes.join(", ")}. That&apos;s
                      allowed — remove one if it wasn&apos;t intended.
                    </p>
                  ))}
              </div>
            );
          })}

          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">Grand total: </span>
            <span className="font-medium tabular-nums">{formatPeso(total)}</span>
          </p>

          <div className="mt-4 flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="charges-package">Add a whole package</Label>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    items={packageItems}
                    value={packageId}
                    onValueChange={(v) => v && setPackageId(v)}
                  >
                    <SelectTrigger id="charges-package">
                      <SelectValue placeholder="Select a package" />
                    </SelectTrigger>
                    {/* SelectContent defaults to matching the trigger's own
                        width, which clips these longer labels — let it size to
                        its content instead, capped so it can't run off-screen. */}
                    <SelectContent className="w-max max-w-[90vw]">
                      {packages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.fees.length} item{p.fees.length === 1 ? "" : "s"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={handleAddPackage} disabled={isSaving}>
                  <Plus /> Add all
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copies every fee in that package onto this student, on top of what&apos;s already
                here.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="charges-fee">Add a single fee</Label>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select items={feeItems} value={feeId} onValueChange={(v) => v && setFeeId(v)}>
                    <SelectTrigger id="charges-fee">
                      <SelectValue placeholder="Select a fee" />
                    </SelectTrigger>
                    {/* Same width fix as the package Select above — these
                        "name — package — amount" labels are the longest in
                        the dialog and were getting clipped without it. */}
                    <SelectContent className="w-max max-w-[90vw]">
                      {allFees.map(({ fee, pkg }) => (
                        <SelectItem key={fee.id} value={fee.id}>
                          {fee.name} — {pkg.name} — {formatPeso(fee.amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={handleAddFee} disabled={isSaving}>
                  <Plus /> Add
                </Button>
              </div>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
