import type { EnrollmentFeeSummary } from "./types";

export interface FeeGroup {
  label: string;
  fees: EnrollmentFeeSummary[];
}

// Groups a frozen fee snapshot by the package each line was copied from
// (`EnrollmentFee.packageName`), so a student billed under two packages (their
// own plus one added via the Enrolled/Students page's "Edit fees" dialog)
// reads as separate sections rather than one merged list. Order: the
// enrollment's own current package first, then any other package that
// contributed lines (in the order they appear), then a trailing
// "Other charges" group for hand-typed one-offs with no packageName.
// Shared by the student View dialog, the Edit fees dialog, and the Statement
// of Account package picker — one grouping rule, used everywhere fees are
// shown broken down by package.
export function groupEnrollmentFees(
  fees: EnrollmentFeeSummary[],
  ownPackageName: string | null
): FeeGroup[] {
  const byName = new Map<string, EnrollmentFeeSummary[]>();
  for (const f of fees) {
    const key = f.packageName ?? "";
    byName.set(key, [...(byName.get(key) ?? []), f]);
  }
  const order = [...byName.keys()].sort((a, b) => {
    if (a === (ownPackageName ?? "")) return -1;
    if (b === (ownPackageName ?? "")) return 1;
    if (a === "") return 1;
    if (b === "") return -1;
    return 0;
  });
  return order.map((key) => ({ label: key || "Other charges", fees: byName.get(key)! }));
}
