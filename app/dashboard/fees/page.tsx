"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, Plus, Star } from "lucide-react";
import {
  listFeePackages,
  createFeePackage,
  updateFeePackage,
  deleteFeePackage,
  createFee,
  updateFee,
  deleteFee,
  getFeeHistory,
  ApiClientError,
} from "@/lib/api-client";
import type { Fee, FeePackage, FeeVersion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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

function packageTotal(pkg: FeePackage) {
  return pkg.fees.reduce((sum, f) => sum + Number(f.amount), 0);
}

export default function FeesPage() {
  const [packages, setPackages] = useState<FeePackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One dialog handles both add and edit for packages; `editingPackage`
  // decides which, and `null` with the dialog open means "add".
  const [packageFormOpen, setPackageFormOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<FeePackage | null>(null);
  const [packageName, setPackageName] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageIsDefault, setPackageIsDefault] = useState(false);
  const [packageFormError, setPackageFormError] = useState<string | null>(null);
  const [isSavingPackage, setIsSavingPackage] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState<FeePackage | null>(null);
  const [packageDeleteError, setPackageDeleteError] = useState<string | null>(null);
  const [isDeletingPackage, setIsDeletingPackage] = useState(false);

  // Same add/edit pattern for the line items inside a package. `feeTargetPackage`
  // is which package a newly added fee lands in.
  const [feeFormOpen, setFeeFormOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [feeTargetPackage, setFeeTargetPackage] = useState<FeePackage | null>(null);
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
    listFeePackages()
      .then(({ feePackages }) => {
        if (!cancelled) setPackages(feePackages);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : "Failed to load fee packages.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The API returns the whole package (with fees) on every package write, so
  // replacing the row wholesale keeps local state honest without a refetch.
  function replacePackage(updated: FeePackage) {
    setPackages((list) =>
      (list ?? []).map((p) =>
        p.id === updated.id
          ? // Neither a rename nor a default change moves students between
            // packages, so carry the previously-fetched count forward rather
            // than losing it (update responses don't compute one).
            { ...updated, currentStudentCount: p.currentStudentCount }
          : // Only one package can be default at a time — the backend demoted
            // the previous holder, so mirror that locally.
            updated.isDefault && p.isDefault
            ? { ...p, isDefault: false }
            : p
      )
    );
  }

  function openAddPackage() {
    setEditingPackage(null);
    setPackageName("");
    setPackageDescription("");
    setPackageIsDefault(false);
    setPackageFormError(null);
    setPackageFormOpen(true);
  }

  function openEditPackage(pkg: FeePackage) {
    setEditingPackage(pkg);
    setPackageName(pkg.name);
    setPackageDescription(pkg.description ?? "");
    setPackageIsDefault(pkg.isDefault);
    setPackageFormError(null);
    setPackageFormOpen(true);
  }

  async function handleSavePackage() {
    const trimmedName = packageName.trim();
    if (!trimmedName) {
      setPackageFormError("Package name is required.");
      return;
    }
    setPackageFormError(null);
    setIsSavingPackage(true);
    try {
      const description = packageDescription.trim();
      if (editingPackage) {
        const { feePackage } = await updateFeePackage(editingPackage.id, {
          name: trimmedName,
          ...(description ? { description } : {}),
          isDefault: packageIsDefault,
        });
        replacePackage(feePackage);
      } else {
        const { feePackage } = await createFeePackage({
          name: trimmedName,
          ...(description ? { description } : {}),
          isDefault: packageIsDefault,
        });
        setPackages((list) => [
          // A new default demotes the old one server-side; reflect that here.
          ...(list ?? []).map((p) =>
            feePackage.isDefault && p.isDefault ? { ...p, isDefault: false } : p
          ),
          feePackage,
        ]);
      }
      setPackageFormOpen(false);
    } catch (err) {
      setPackageFormError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSavingPackage(false);
    }
  }

  async function handleMakeDefault(pkg: FeePackage) {
    setError(null);
    try {
      const { feePackage } = await updateFeePackage(pkg.id, { isDefault: true });
      replacePackage(feePackage);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to change the default package."
      );
    }
  }

  async function handleDeletePackage() {
    if (!deletingPackage) return;
    setPackageDeleteError(null);
    setIsDeletingPackage(true);
    try {
      await deleteFeePackage(deletingPackage.id);
      setPackages((list) => (list ?? []).filter((p) => p.id !== deletingPackage.id));
      setDeletingPackage(null);
    } catch (err) {
      setPackageDeleteError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsDeletingPackage(false);
    }
  }

  function openAddFee(pkg: FeePackage) {
    setEditingFee(null);
    setFeeTargetPackage(pkg);
    setName("");
    setAmount("");
    setFormError(null);
    setFeeFormOpen(true);
  }

  function openEditFee(fee: Fee, pkg: FeePackage) {
    setEditingFee(fee);
    setFeeTargetPackage(pkg);
    setName(fee.name);
    setAmount(fee.amount);
    setFormError(null);
    setFeeFormOpen(true);
  }

  // Fee writes return the bare fee, not its package, so the package's `fees`
  // array is patched in place rather than replaced.
  function upsertFeeInPackage(fee: Fee, replaceExisting: boolean) {
    setPackages((list) =>
      (list ?? []).map((p) =>
        p.id === fee.packageId
          ? {
              ...p,
              fees: replaceExisting
                ? p.fees.map((f) => (f.id === fee.id ? fee : f))
                : [...p.fees, fee],
            }
          : p
      )
    );
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
      if (editingFee) {
        const { fee } = await updateFee(editingFee.id, { name: trimmedName, amount: parsedAmount });
        upsertFeeInPackage(fee, true);
      } else if (feeTargetPackage) {
        const { fee } = await createFee({
          name: trimmedName,
          amount: parsedAmount,
          packageId: feeTargetPackage.id,
        });
        upsertFeeInPackage(fee, false);
      }
      setFeeFormOpen(false);
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
      setPackages((list) =>
        (list ?? []).map((p) =>
          p.id === deleting.packageId
            ? { ...p, fees: p.fees.filter((f) => f.id !== deleting.id) }
            : p
        )
      );
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Fee packages</CardTitle>
              <CardDescription>
                Each package is a named bundle of fee items with its own amounts, so the same
                item can cost a different amount in each — a student is billed under exactly one
                package, chosen when they enrol. Adding a fee charges the students currently on
                that package; updating one changes future enrollments only (already-enrolled
                students keep their original amounts); deleting one removes it from the records
                of students on that package.
              </CardDescription>
            </div>
            <Button onClick={openAddPackage}>
              <Plus /> Add package
            </Button>
          </div>
        </CardHeader>
        {error && (
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        )}
      </Card>

      {packages === null && !error && (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-4 w-64" />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {packages !== null && packages.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No fee packages yet. Create one — for example &quot;Half Day&quot; or &quot;Whole
            Day&quot; — then add its tuition, miscellaneous, and other fees.
          </CardContent>
        </Card>
      )}

      {(packages ?? []).map((pkg) => (
        <Card key={pkg.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <CardTitle className="flex items-center gap-2">
                  {pkg.name}
                  {pkg.isDefault && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="size-3" /> Default
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {pkg.description ??
                    (pkg.isDefault
                      ? "Used when an enrollment doesn't name a package."
                      : "No description.")}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => openAddFee(pkg)}>
                  <Plus /> Add fee
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${pkg.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditPackage(pkg)}>
                      Edit package
                    </DropdownMenuItem>
                    {!pkg.isDefault && (
                      <DropdownMenuItem onClick={() => handleMakeDefault(pkg)}>
                        Make default
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={pkg.isDefault}
                      onClick={() => {
                        setPackageDeleteError(null);
                        setDeletingPackage(pkg);
                      }}
                    >
                      Delete package
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pkg.fees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No fees in this package yet. Students enrolled under it are charged nothing.
                    </TableCell>
                  </TableRow>
                )}
                {pkg.fees.map((fee) => (
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
                          <DropdownMenuItem onClick={() => openEditFee(fee, pkg)}>
                            Edit
                          </DropdownMenuItem>
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
            </Table>
            {pkg.fees.length > 0 && (
              <p className="text-sm">
                <span className="text-muted-foreground">
                  Total per student on this package:{" "}
                </span>
                <span className="font-medium tabular-nums">{formatPeso(packageTotal(pkg))}</span>
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={packageFormOpen} onOpenChange={setPackageFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPackage ? "Edit package" : "Add package"}</DialogTitle>
            <DialogDescription>
              {editingPackage
                ? "Renaming a package doesn't change what any student was already billed — confirmed periods keep the name they were billed under."
                : "A package starts empty. Add its fee items afterwards, then pick it when enrolling a student."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="package-name">Name</Label>
              <Input
                id="package-name"
                placeholder="e.g. Half Day, Whole Day, SPED Program"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="package-description">Description (optional)</Label>
              <Input
                id="package-description"
                placeholder="e.g. Morning session, 3 days a week"
                value={packageDescription}
                onChange={(e) => setPackageDescription(e.target.value)}
              />
            </div>
            {/* Renaming rewrites the package name shown on the records of
                students currently on it (past school years keep the name they
                were billed under) — state that before it happens, the same way
                the delete dialogs state their blast radius. */}
            {editingPackage &&
              packageName.trim() !== "" &&
              packageName.trim() !== editingPackage.name &&
              (editingPackage.currentStudentCount ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  This renames the package on{" "}
                  <span className="font-medium text-foreground">
                    {editingPackage.currentStudentCount} student
                    {editingPackage.currentStudentCount === 1 ? "'s" : "s'"} record
                    {editingPackage.currentStudentCount === 1 ? "" : "s"}
                  </span>
                  . Past school years keep the name they were billed under.
                </p>
              )}
            <div className="flex items-start gap-2">
              <Checkbox
                id="package-default"
                checked={packageIsDefault}
                onCheckedChange={(checked) => setPackageIsDefault(!!checked)}
              />
              <Label htmlFor="package-default" className="text-sm font-normal leading-snug">
                Make this the default package — used when an enrollment doesn&apos;t name one.
                Only one package can be the default.
              </Label>
            </div>
            {packageFormError && <p className="text-sm text-destructive">{packageFormError}</p>}
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={handleSavePackage} disabled={isSavingPackage}>
              {isSavingPackage ? "Saving..." : editingPackage ? "Save changes" : "Add package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingPackage !== null}
        onOpenChange={(open) => !open && setDeletingPackage(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete package</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium">{deletingPackage?.name}</span> and its{" "}
              {deletingPackage?.fees.length ?? 0} fee item
              {(deletingPackage?.fees.length ?? 0) === 1 ? "" : "s"}? Those fees are removed from
              the records of the{" "}
              <span className="font-medium">
                {deletingPackage?.currentStudentCount ?? 0} student
                {(deletingPackage?.currentStudentCount ?? 0) === 1 ? "" : "s"}
              </span>{" "}
              currently on this package, and their totals update. One-off charges added directly
              to a student stay. This is permanent.
            </DialogDescription>
          </DialogHeader>
          {packageDeleteError && <p className="text-sm text-destructive">{packageDeleteError}</p>}
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              onClick={handleDeletePackage}
              disabled={isDeletingPackage}
            >
              {isDeletingPackage ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feeFormOpen} onOpenChange={setFeeFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFee ? "Edit fee" : "Add fee"}</DialogTitle>
            <DialogDescription>
              {editingFee
                ? "Update this fee — the change reaches students currently on this package; past school years keep their original amounts."
                : `New fees in ${feeTargetPackage?.name ?? "this package"} are charged to the students currently on it and to future enrollments under it. Students on other packages are unaffected.`}
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
              {isSaving ? "Saving..." : editingFee ? "Save changes" : "Add fee"}
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
              {deleting ? formatPeso(deleting.amount) : ""})? It will be removed from the record
              of every student currently on this package and their totals will update. Price
              changes are versioned, but deletion is permanent — records and reports lose this
              fee.
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
    </div>
  );
}
