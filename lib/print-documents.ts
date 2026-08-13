import type { Student } from "./types";
import { formatPeso } from "./format";

// Print-ready documents (Statement of Account, Official Receipt) are built as
// self-contained HTML and opened in a new window that prints itself — no CSS
// coupling with the app, works the same in the browser and the Electron shell.
// The print dialog's "Save as PDF" covers PDF export.

const SCHOOL_NAME = "Avenova Early Intervention and SPED Learning Center";

// Both the Statement of Account's "Prepared by" and the Official Receipt's
// "Authorized Representative" lines show the logged-in staff/admin's name
// alongside this fixed second signatory, per product decision.
const SECOND_AUTHORIZED_SIGNATORY = "Ellevera, Chrislly Anne Lou";

function withSecondSignatory(name: string): string {
  return name ? `${name} / ${SECOND_AUTHORIZED_SIGNATORY}` : SECOND_AUTHORIZED_SIGNATORY;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function threeDigitsInWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest >= 20) {
    const tens = TENS[Math.floor(rest / 10)];
    const ones = ONES[rest % 10];
    parts.push(ones ? `${tens} ${ones}` : tens);
  } else if (rest > 0) {
    parts.push(ONES[rest]);
  }
  return parts.join(" ");
}

// "Eighteen Thousand Pesos Only" / "... Pesos and Fifty Centavos Only".
// Covers up to the millions — far beyond any school fee total here.
export function pesoInWords(amount: number): string {
  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  const groups: string[] = [];
  const millions = Math.floor(pesos / 1_000_000);
  const thousands = Math.floor((pesos % 1_000_000) / 1_000);
  const units = pesos % 1_000;
  if (millions > 0) groups.push(`${threeDigitsInWords(millions)} Million`);
  if (thousands > 0) groups.push(`${threeDigitsInWords(thousands)} Thousand`);
  if (units > 0) groups.push(threeDigitsInWords(units));
  const pesoPart = `${groups.length > 0 ? groups.join(" ") : "Zero"} Peso${pesos === 1 ? "" : "s"}`;
  const centavoPart =
    centavos > 0 ? ` and ${threeDigitsInWords(centavos)} Centavo${centavos === 1 ? "" : "s"}` : "";
  return `${pesoPart}${centavoPart} Only`;
}

const DOCUMENT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; padding: 48px; }
  .doc { max-width: 640px; margin: 0 auto; }
  .school { text-align: center; }
  .school img { height: 72px; margin-bottom: 8px; }
  .school h1 { font-size: 20px; letter-spacing: 1px; text-transform: uppercase; }
  .school p { font-size: 12px; color: #444; margin-top: 2px; }
  .doc-title { text-align: center; font-size: 15px; font-weight: bold; letter-spacing: 3px;
    text-transform: uppercase; margin: 24px 0 20px; border-top: 2px solid #111;
    border-bottom: 2px solid #111; padding: 8px 0; }
  .doc-title.or { color: #c00000; }
  .sentence { font-size: 13.5px; line-height: 2.1; margin: 20px 0; text-align: justify; }
  .sentence b { border-bottom: 1px solid #111; padding: 0 4px 1px; }
  .sentence b.sum { text-transform: uppercase; }
  .sig-name { font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
  .footnote { text-align: center; font-size: 10.5px; color: #333; margin-top: 32px;
    letter-spacing: 0.4px; text-transform: uppercase; }
  .footnote p { margin: 3px 0; }
  .meta { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; margin-bottom: 16px; }
  .meta div p { margin: 2px 0; }
  .meta .label { color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0; }
  th, td { border: 1px solid #999; padding: 7px 10px; text-align: left; }
  th { background: #f2f2f2; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
  td.amount, th.amount { text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td { font-weight: bold; border-top: 2px solid #111; }
  tr.group-header td { background: #f2f2f2; font-weight: bold; text-transform: uppercase;
    font-size: 11px; letter-spacing: 0.5px; }
  tr.subtotal td { font-weight: bold; border-top: 1px solid #999; }
  .field { font-size: 13px; margin: 10px 0; }
  .field .label { color: #555; }
  .field .value { font-weight: bold; border-bottom: 1px solid #111; padding: 0 6px 2px; }
  .note { font-size: 11px; color: #555; margin-top: 20px; }
  /* Bottom-align so a printed name above one line never pushes the
     signature rules/labels out of alignment with each other. */
  .signatures { display: flex; align-items: flex-end; justify-content: space-between; gap: 48px; margin-top: 56px; }
  .signature { flex: 1; text-align: center; font-size: 12px; }
  .signature .line { border-top: 1px solid #111; padding-top: 4px; }
  @media print { body { padding: 24px; } }
`;

export function openPrintWindow(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) return false;
  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${DOCUMENT_STYLES}</style>
</head>
<body>
  <div class="doc">${bodyHtml}</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  win.document.close();
  win.focus();
  return true;
}

function schoolHeader() {
  // Absolute URL so the image resolves inside the about:blank print window;
  // the window prints on `load`, which waits for the image to finish loading.
  const logoUrl = `${window.location.origin}/images/Avenova_logo.png`;
  return `
    <div class="school">
      <img src="${logoUrl}" alt="" />
      <h1>${escapeHtml(SCHOOL_NAME)}</h1>
    </div>`;
}

export interface StatementFeeGroup {
  label: string;
  fees: { name: string; amount: string }[];
}

// One group renders as a flat table (no group-header/subtotal rows, matching
// the pre-packages layout exactly) — the common case, a student on one
// package. Two or more groups get a header row per package plus a subtotal,
// so "Both" reads as clearly separated sections rather than an ambiguous
// merged pile, mirroring the on-screen View dialog and Edit fees dialog.
function feeRows(groups: StatementFeeGroup[]) {
  const showGroups = groups.length > 1;
  let grandTotal = 0;
  const rows = groups
    .map((g) => {
      const subtotal = g.fees.reduce((sum, f) => sum + Number(f.amount), 0);
      grandTotal += subtotal;
      const header = showGroups
        ? `<tr class="group-header"><td colspan="2">${escapeHtml(g.label)}</td></tr>`
        : "";
      const itemRows = g.fees
        .map(
          (f) => `
        <tr>
          <td>${escapeHtml(f.name)}</td>
          <td class="amount">${formatPeso(f.amount)}</td>
        </tr>`
        )
        .join("");
      const subtotalRow = showGroups
        ? `<tr class="subtotal"><td>Subtotal</td><td class="amount">${formatPeso(subtotal)}</td></tr>`
        : "";
      return header + itemRows + subtotalRow;
    })
    .join("");
  return { rows, total: grandTotal, totalLabel: showGroups ? "Grand Total" : "Total" };
}

// The statement covers ONE enrollment period (school year) and its frozen fee
// snapshot — so a years-old statement reprints with that year's fees, not
// today's catalog. `groups` is whatever the caller has already filtered down
// to (every package the student has fees under, or just one) — this module
// doesn't know about the filtering choice, it just renders what it's given.
// `packageLabel` is purely the meta-line description of that choice
// ("All packages" / a specific package name).
export interface StatementEnrollment {
  schoolYear: string;
  groups: StatementFeeGroup[];
  packageLabel?: string;
  // True when the caller narrowed this printout to fewer than all of the
  // student's package groups, rather than showing everything on the account —
  // only used to add the "other charges not included" caveat below the table.
  isFiltered?: boolean;
}

export function buildStatementOfAccountHtml(
  student: Pick<Student, "studentName" | "studentNumber">,
  enrollment: StatementEnrollment,
  preparedBy: string
): string {
  const { rows, total, totalLabel } = feeRows(enrollment.groups);
  const issued = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `
    ${schoolHeader()}
    <div class="doc-title">Statement of Account</div>
    <div class="meta">
      <div>
        <p><span class="label">Student:</span> <strong>${escapeHtml(student.studentName)}</strong></p>
        <p><span class="label">Student ID:</span> ${escapeHtml(student.studentNumber)}</p>
      </div>
      <div style="text-align:right">
        <p><span class="label">Date issued:</span> ${issued}</p>
        <p><span class="label">School year:</span> ${new Date(enrollment.schoolYear).getFullYear()}</p>
        <p><span class="label">Enrolled:</span> ${new Date(enrollment.schoolYear).toLocaleDateString()}</p>
      </div>
    </div>
    ${
      enrollment.packageLabel
        ? `<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid #999;">
      <span>Package</span>
      <span>${escapeHtml(enrollment.packageLabel)}</span>
    </div>`
        : ""
    }
    <table>
      <thead>
        <tr><th>Description</th><th class="amount">Amount</th></tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="2">No fees recorded for this enrollment.</td></tr>`}
        <tr class="total"><td>${totalLabel}</td><td class="amount">${formatPeso(total)}</td></tr>
      </tbody>
    </table>
    <p class="note">
      This statement reflects the fees recorded at enrollment confirmation.
      Amounts are frozen per enrollment period and are not affected by later fee changes.
      ${
        enrollment.isFiltered && enrollment.packageLabel
          ? ` This copy shows ${escapeHtml(enrollment.packageLabel)} only — other charges on this account are not included.`
          : ""
      }
    </p>
    <div class="signatures">
      <div class="signature">
        <div class="sig-name">${escapeHtml(withSecondSignatory(preparedBy))}</div>
        <div class="line">Prepared by</div>
      </div>
      <div class="signature"><div class="line">Received by (Parent / Guardian)</div></div>
    </div>`;
}

export interface ReceiptDetails {
  // Server-generated sequential number, already formatted (e.g. "0001").
  receiptNumber: string;
  receivedFrom: string;
  amount: number;
  paymentFor: string;
  paymentMethod: string;
  receivedBy: string;
}

export function buildOfficialReceiptHtml(student: Student, details: ReceiptDetails): string {
  const issued = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `
    ${schoolHeader()}
    <div class="doc-title or">Official Receipt</div>
    <div class="meta">
      <div>
        <p><span class="label">Student:</span> <strong>${escapeHtml(student.studentName)}</strong></p>
        <p><span class="label">Student ID:</span> ${escapeHtml(student.studentNumber)}</p>
      </div>
      <div style="text-align:right">
        <p><span class="label">OR Number:</span> <strong>${escapeHtml(details.receiptNumber)}</strong></p>
        <p><span class="label">Date:</span> ${issued}</p>
      </div>
    </div>
    <p class="sentence">
      Received from <b>${escapeHtml(details.receivedFrom)}</b> the sum of
      <b class="sum">${escapeHtml(pesoInWords(details.amount))}</b> in payment of
      <b>${escapeHtml(details.paymentFor)}</b> for the account of
      <b>${escapeHtml(student.studentName)}</b> (${escapeHtml(student.studentNumber)}),
      paid via <b>${escapeHtml(details.paymentMethod)}</b>.
    </p>
    <div class="signatures" style="justify-content: flex-end">
      <div class="signature" style="flex: 0 0 260px">
        <div class="sig-name">${escapeHtml(withSecondSignatory(details.receivedBy))}</div>
        <div class="line">Authorized Representative</div>
      </div>
    </div>
    <div class="footnote">
      <p>This document is not valid for claim of input taxes.</p>
      <p><strong>THIS OFFICIAL RECEIPT SHALL BE VALID FOR FIVE (5) YEARS FROM THE DATE OF ATP</strong></p>
    </div>`;
}
