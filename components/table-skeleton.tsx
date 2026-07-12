"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

// Skeleton rows shown while table data is loading. Rendered inside an
// existing <Table> so the real header stays visible and the layout
// doesn't jump when data arrives.
export function TableSkeletonBody({
  columns,
  rows = 5,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton
                className="h-4"
                style={{ width: `${[85, 55, 70, 60, 90, 65, 40][c % 7]}%` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
