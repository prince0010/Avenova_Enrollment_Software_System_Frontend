"use client";

import { useState } from "react";
import type { Student } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { createReceipt, ApiClientError } from "@/lib/api-client";
import { buildOfficialReceiptHtml, openPrintWindow } from "@/lib/print-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const PAYMENT_METHODS = ["Cash", "GCash", "Bank transfer", "Check"];

const OTHER_PAYER = "__other__";
const ALL_FEES = "Enrollment fees";
const OTHER_PAYMENT = "__other_payment__";

// The form lives in its own component rendered inside DialogContent, which
// Base UI unmounts on close — so every open starts with fresh prop-derived
// state, no reset effect needed.
function ReceiptForm({
  student,
  onDone,
}: {
  student: Student;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const feeTotal = (student.latestEnrollment?.fees ?? []).reduce(
    (sum, f) => sum + Number(f.amount),
    0
  );
  // "Received from" options come from the student's own parent/guardian
  // records; "Other" reveals a free-text input for anyone not on file.
  const payerOptions = [
    student.guardianName && { value: student.guardianName, label: `${student.guardianName} (Guardian)` },
    student.motherName && { value: student.motherName, label: `${student.motherName} (Mother)` },
    student.fatherName && { value: student.fatherName, label: `${student.fatherName} (Father)` },
  ].filter((o): o is { value: string; label: string } => Boolean(o));
  const [payerChoice, setPayerChoice] = useState(payerOptions[0]?.value ?? OTHER_PAYER);
  const [customPayer, setCustomPayer] = useState("");
  const receivedFrom = payerChoice === OTHER_PAYER ? customPayer : payerChoice;
  const [amount, setAmount] = useState(feeTotal > 0 ? String(feeTotal) : "");
  // "In payment of" options come from the student's fee snapshot; picking a
  // fee auto-fills its amount ("Enrollment fees" = the whole total, "Other"
  // reveals a free-text input). The amount stays editable for partial payments.
  const enrollmentFees = student.latestEnrollment?.fees ?? [];
  const [paymentChoice, setPaymentChoice] = useState(ALL_FEES);
  const [customPaymentFor, setCustomPaymentFor] = useState("");
  const paymentFor = paymentChoice === OTHER_PAYMENT ? customPaymentFor : paymentChoice;
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  function handlePaymentChoice(choice: string) {
    setPaymentChoice(choice);
    if (choice === ALL_FEES) {
      setAmount(feeTotal > 0 ? String(feeTotal) : "");
    } else if (choice !== OTHER_PAYMENT) {
      const fee = enrollmentFees.find((f) => f.name === choice);
      if (fee) setAmount(String(Number(fee.amount)));
    }
  }
  const [formError, setFormError] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  async function handlePrint() {
    const parsedAmount = Number(amount);
    if (!receivedFrom.trim()) {
      setFormError("Received from is required.");
      return;
    }
    if (!amount.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (!paymentFor.trim()) {
      setFormError("In payment of is required.");
      return;
    }
    setFormError(null);
    setIsIssuing(true);
    try {
      // The OR Number is generated server-side (sequential, never reused);
      // the receipt is stored before anything is printed.
      const { receipt } = await createReceipt(student.id, {
        receivedFrom: receivedFrom.trim(),
        amount: parsedAmount,
        paymentFor: paymentFor.trim(),
        paymentMethod,
      });
      const opened = openPrintWindow(
        `Official Receipt — ${student.studentName}`,
        buildOfficialReceiptHtml(student, {
          receiptNumber: String(receipt.receiptNumber).padStart(4, "0"),
          receivedFrom: receivedFrom.trim(),
          amount: parsedAmount,
          paymentFor: paymentFor.trim(),
          paymentMethod,
          receivedBy: user ? `${user.firstName} ${user.lastName}` : "",
        })
      );
      if (!opened) {
        setFormError(
          `Receipt No. ${String(receipt.receiptNumber).padStart(4, "0")} was recorded, but the print window was blocked. Allow pop-ups and try again.`
        );
        return;
      }
      onDone();
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsIssuing(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="or-received-from">
            Received from <span className="text-destructive">*</span>
          </Label>
          <Select
            items={[
              ...payerOptions,
              { value: OTHER_PAYER, label: "Other..." },
            ]}
            value={payerChoice}
            onValueChange={(v) => v && setPayerChoice(v)}
          >
            <SelectTrigger id="or-received-from">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {payerOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_PAYER}>Other...</SelectItem>
            </SelectContent>
          </Select>
          {payerChoice === OTHER_PAYER && (
            <Input
              id="or-received-from-other"
              placeholder="Payer's full name"
              value={customPayer}
              onChange={(e) => setCustomPayer(e.target.value)}
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="or-amount">
            Amount (PHP) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="or-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="or-payment-for">
            In payment of <span className="text-destructive">*</span>
          </Label>
          <Select
            items={[
              { value: ALL_FEES, label: "Enrollment fees (all)" },
              ...enrollmentFees.map((f) => ({ value: f.name, label: f.name })),
              { value: OTHER_PAYMENT, label: "Other..." },
            ]}
            value={paymentChoice}
            onValueChange={(v) => v && handlePaymentChoice(v)}
          >
            <SelectTrigger id="or-payment-for">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FEES}>Enrollment fees (all)</SelectItem>
              {enrollmentFees.map((f) => (
                <SelectItem key={f.id} value={f.name}>
                  {f.name}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_PAYMENT}>Other...</SelectItem>
            </SelectContent>
          </Select>
          {paymentChoice === OTHER_PAYMENT && (
            <Input
              id="or-payment-for-other"
              placeholder="e.g. Assessment fee"
              value={customPaymentFor}
              onChange={(e) => setCustomPaymentFor(e.target.value)}
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="or-method">Payment method</Label>
          <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
            <SelectTrigger id="or-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </div>
      <DialogFooter showCloseButton>
        <Button onClick={handlePrint} disabled={isIssuing}>
          {isIssuing ? "Issuing..." : "Issue & print receipt"}
        </Button>
      </DialogFooter>
    </>
  );
}

// Collects the receipt details (there's no payments feature yet, so nothing is
// stored — this generates a print-ready OR for school records) and opens the
// print window. Fields are prefilled from the student's record.
export function OfficialReceiptDialog({
  student,
  open,
  onOpenChange,
}: {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Official receipt</DialogTitle>
          <DialogDescription>
            {student
              ? `Issue a receipt for ${student.studentName}. The OR Number is generated automatically and the receipt is recorded before printing.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {student && <ReceiptForm student={student} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
