"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label as RechartsLabel,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  LayoutGrid,
  TableIcon,
  CalendarDays,
  CalendarRange,
  Calendar,
  CalendarClock,
  Users,
  UserCheck,
  Banknote,
  GraduationCap,
  PiggyBank,
} from "lucide-react";
import {
  getActiveUserCount,
  getEnrollmentStats,
  getFeesByYear,
  listEnrollments,
} from "@/lib/api-client";
import type {
  Enrollment,
  EnrollmentStatPoint,
  StatsGroupBy,
  YearlyFeeTotal,
} from "@/lib/types";
import { formatPeso } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Series color from the validated reference palette (blue, slot 1):
// light #2a78d6 / dark #3987e5.
const chartConfig = {
  count: {
    label: "Enrollments",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
} satisfies ChartConfig;

// The validated categorical palette in its fixed CVD-safe order (see the
// dataviz skill's palette reference) — never cycled, never reassigned by rank.
const YEAR_COLOR_SLOTS = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#008300", dark: "#008300" }, // green
  { light: "#4a3aa7", dark: "#9085e9" }, // violet
  { light: "#e34948", dark: "#e66767" }, // red
  { light: "#e87ba4", dark: "#d55181" }, // magenta
  { light: "#eb6834", dark: "#d95926" }, // orange
];
const OTHER_YEARS_COLOR = { light: "#898781", dark: "#898781" };
const MAX_YEAR_SLICES = 7;

// One donut slice — either a single school year or the folded "Other"
// bucket. `years` carries the underlying raw rows so a click can show a real
// summary (itemized fees + enrollment count for a single year; a per-year
// list for the folded bucket).
export interface FeeSliceDatum {
  key: string;
  label: string;
  total: number;
  fill: string;
  theme: { light: string; dark: string };
  years: YearlyFeeTotal[];
}

// Builds the donut's data + ChartConfig from the raw per-year totals — the
// 7 most recent years each get their own fixed slot color; anything older
// folds into one "Other" slice (the categorical series-count ceiling, per
// the dataviz skill: never generate a 9th hue).
function buildYearlyFeeChart(feesByYear: YearlyFeeTotal[]) {
  const sorted = [...feesByYear].sort((a, b) => Number(a.year) - Number(b.year));
  const recent = sorted.slice(-MAX_YEAR_SLICES);
  const older = sorted.slice(0, -MAX_YEAR_SLICES);

  const data: FeeSliceDatum[] = recent.map((y, i) => ({
    key: y.year,
    label: y.year,
    total: Number(y.total),
    fill: `var(--color-${y.year})`,
    theme: YEAR_COLOR_SLOTS[i % YEAR_COLOR_SLOTS.length],
    years: [y],
  }));

  if (older.length > 0) {
    data.unshift({
      key: "other",
      label: `Before ${recent[0]?.year ?? ""}`,
      total: older.reduce((sum, y) => sum + Number(y.total), 0),
      fill: "var(--color-other)",
      theme: OTHER_YEARS_COLOR,
      years: older,
    });
  }

  const config: ChartConfig = {};
  for (const d of data) {
    config[d.key] = { label: d.label, theme: d.theme };
  }

  return { data, config };
}

function toLocalDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(d: Date) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday;
}

// Zero-filled chart windows derived from the per-day series, so gaps in the
// data render as honest zeroes instead of a distorted axis.
function buildChartData(
  dayData: EnrollmentStatPoint[],
  groupBy: StatsGroupBy
): { period: string; count: number }[] {
  const now = new Date();
  const counts = new Map<string, number>();

  const keyFor = (period: string) => {
    if (groupBy === "day") return period;
    if (groupBy === "week") {
      const [y, m, d] = period.split("-").map(Number);
      return toLocalDateString(mondayOf(new Date(y, m - 1, d)));
    }
    if (groupBy === "month") return period.slice(0, 7);
    return period.slice(0, 4);
  };

  for (const point of dayData) {
    const key = keyFor(point.period);
    counts.set(key, (counts.get(key) ?? 0) + point.count);
  }

  const windowKeys: string[] = [];
  if (groupBy === "day") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      windowKeys.push(toLocalDateString(d));
    }
  } else if (groupBy === "week") {
    const currentMonday = mondayOf(now);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() - i * 7);
      windowKeys.push(toLocalDateString(d));
    }
  } else if (groupBy === "month") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      windowKeys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    }
  } else {
    const firstYear = dayData.length
      ? Number(dayData[0].period.slice(0, 4))
      : now.getFullYear();
    for (let y = firstYear; y <= now.getFullYear(); y++) {
      windowKeys.push(String(y));
    }
  }

  return windowKeys.map((period) => ({
    period,
    count: counts.get(period) ?? 0,
  }));
}

function formatPeriodLabel(period: string, groupBy: StatsGroupBy) {
  if (groupBy === "year") return period;
  if (groupBy === "month") {
    const [y, m] = period.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
  }
  const [y, m, d] = period.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Eases a number from 0 to its target once the target arrives — the tiles'
// count-up. setState happens inside rAF callbacks (async), not the effect body.
function useCountUp(target: number | null, duration = 900): number | null {
  const [display, setDisplay] = useState<number | null>(null);
  useEffect(() => {
    if (target === null) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(progress < 1 ? Math.round(target * eased) : target);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return target === null ? null : display;
}

// Staggered entrance: fade + rise, honoring prefers-reduced-motion.
const ENTER =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:fill-mode-backwards";

function enterDelay(ms: number) {
  return { animationDelay: `${ms}ms` };
}

function StatTile({
  label,
  value,
  icon: Icon,
  delay,
}: {
  label: string;
  value: number | null;
  icon: React.ComponentType<{ className?: string }>;
  delay: number;
}) {
  const display = useCountUp(value);
  return (
    <Card
      size="sm"
      className={`${ENTER} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
      style={enterDelay(delay)}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm font-normal text-muted-foreground">
          {label}
          <Icon className="size-4" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className="text-2xl font-semibold tabular-nums">
            {(display ?? 0).toLocaleString()}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

const GROUP_OPTIONS: { value: StatsGroupBy; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

const PREVIOUS_PERIOD_LABEL: Record<StatsGroupBy, string> = {
  day: "yesterday",
  week: "last week",
  month: "last month",
  year: "last year",
};

// Direct-labels only the most recent bar — the one the reader cares about
// most — rather than every bar, per the sparing-labels rule.
function LatestBarLabel(
  props: Record<string, unknown> & { lastIndex: number }
) {
  const { x, y, width, value, index, lastIndex } = props;
  if (
    index !== lastIndex ||
    x == null ||
    y == null ||
    width == null ||
    value == null
  ) {
    return null;
  }
  const nx = Number(x as string | number);
  const ny = Number(y as string | number);
  const nWidth = Number(width as string | number);
  return (
    <text
      x={nx + nWidth / 2}
      y={ny - 6}
      textAnchor="middle"
      className="fill-foreground text-xs font-medium"
    >
      {value as string | number}
    </text>
  );
}

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [dayData, setDayData] = useState<EnrollmentStatPoint[] | null>(null);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [feesByYear, setFeesByYear] = useState<YearlyFeeTotal[] | null>(null);
  const [recentEnrollments, setRecentEnrollments] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<StatsGroupBy>("month");
  const [showTable, setShowTable] = useState(false);
  const [selectedFeeSlice, setSelectedFeeSlice] = useState<FeeSliceDatum | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [stats, users, fees, enrollments] = await Promise.all([
          getEnrollmentStats("day"),
          getActiveUserCount(),
          getFeesByYear(),
          listEnrollments(),
        ]);
        if (!cancelled) {
          setDayData(stats.data);
          setActiveUsers(users.totalActiveUsers);
          setFeesByYear(fees.data);
          setRecentEnrollments(enrollments.enrollments.slice(0, 5));
        }
      } catch {
        if (!cancelled) setError("Failed to load stats. Please try again.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tiles = useMemo(() => {
    if (!dayData) {
      return { today: null, week: null, month: null, year: null, total: null };
    }
    const now = new Date();
    const todayStr = toLocalDateString(now);
    const mondayStr = toLocalDateString(mondayOf(now));
    const monthStr = todayStr.slice(0, 7);
    const yearStr = todayStr.slice(0, 4);

    let today = 0;
    let week = 0;
    let month = 0;
    let year = 0;
    let total = 0;
    for (const point of dayData) {
      total += point.count;
      if (point.period === todayStr) today += point.count;
      if (point.period >= mondayStr && point.period <= todayStr)
        week += point.count;
      if (point.period.slice(0, 7) === monthStr) month += point.count;
      if (point.period.slice(0, 4) === yearStr) year += point.count;
    }
    return { today, week, month, year, total };
  }, [dayData]);

  const chartData = useMemo(
    () => (dayData ? buildChartData(dayData, groupBy) : []),
    [dayData, groupBy]
  );

  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const current = chartData[chartData.length - 1].count;
    const previous = chartData[chartData.length - 2].count;
    const diff = current - previous;
    let percentLabel: string | null = null;
    if (previous > 0) {
      percentLabel = `${diff > 0 ? "+" : ""}${Math.round((diff / previous) * 100)}%`;
    } else if (diff > 0) {
      percentLabel = "New";
    }
    return { current, diff, percentLabel };
  }, [chartData]);

  const currentSchoolYear = String(new Date().getFullYear());

  // Resets to 0 the moment the calendar rolls into a new school year — there's
  // simply no row for that year yet until a fee gets frozen onto a confirmed
  // enrollment. Past years stay fully visible in the donut below, not lost.
  const currentYearFeeTotal =
    feesByYear === null
      ? null
      : (feesByYear.find((y) => y.year === currentSchoolYear)?.total ?? "0");
  const animatedFeeTotal = useCountUp(
    currentYearFeeTotal === null ? null : Number(currentYearFeeTotal)
  );

  const feeChart = useMemo(
    () => (feesByYear ? buildYearlyFeeChart(feesByYear) : null),
    [feesByYear]
  );
  const feeGrandTotal = feesByYear?.reduce((sum, y) => sum + Number(y.total), 0) ?? 0;

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className={ENTER} style={enterDelay(0)}>
        <h1 className="font-heading text-xl font-semibold">
          {user ? `Welcome back, ${user.firstName}` : "Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Enrolled today" value={tiles.today} icon={CalendarDays} delay={50} />
        <StatTile label="This week" value={tiles.week} icon={CalendarRange} delay={110} />
        <StatTile label="This month" value={tiles.month} icon={Calendar} delay={170} />
        <StatTile label="This year" value={tiles.year} icon={CalendarClock} delay={230} />
        <StatTile label="Total students" value={tiles.total} icon={Users} delay={290} />
        <StatTile label="Active users" value={activeUsers} icon={UserCheck} delay={350} />
      </div>

      <Card className={ENTER} style={enterDelay(420)}>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Enrollments over time</CardTitle>
            {trend && (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">
                  {trend.current.toLocaleString()}
                </span>
                <span
                  className={
                    "flex items-center gap-0.5 text-xs font-medium " +
                    (trend.diff > 0
                      ? "text-[#006300] dark:text-[#0ca30c]"
                      : "text-muted-foreground")
                  }
                >
                  {trend.diff > 0 ? (
                    <ArrowUp className="size-3" />
                  ) : trend.diff < 0 ? (
                    <ArrowDown className="size-3" />
                  ) : (
                    <Minus className="size-3" />
                  )}
                  {trend.percentLabel ?? "No change"} vs{" "}
                  {PREVIOUS_PERIOD_LABEL[groupBy]}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {GROUP_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={groupBy === opt.value ? "secondary" : "ghost"}
                  onClick={() => setGroupBy(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={showTable ? "Show chart" : "Show data as table"}
              aria-pressed={showTable}
              onClick={() => setShowTable((v) => !v)}
            >
              {showTable ? <LayoutGrid /> : <TableIcon />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              {dayData === null && !error ? (
                <div className="flex h-72 items-end gap-2 px-2">
                  {[40, 65, 30, 80, 55, 90, 45, 70, 35, 60, 75, 50].map((h, i) => (
                    <Skeleton
                      key={i}
                      className="w-full"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              ) : showTable ? (
                <div className="max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Enrollments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...chartData].reverse().map((row) => (
                        <TableRow key={row.period}>
                          <TableCell>
                            {formatPeriodLabel(row.period, groupBy)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-72 w-full">
                  <BarChart data={chartData} margin={{ top: 20, right: 8 }}>
                    <CartesianGrid vertical={false} strokeWidth={1} />
                    <XAxis
                      dataKey="period"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(v: string) => formatPeriodLabel(v, groupBy)}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) =>
                            typeof label === "string"
                              ? formatPeriodLabel(label, groupBy)
                              : label
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--color-count)"
                      maxBarSize={24}
                      radius={[4, 4, 0, 0]}
                      animationDuration={900}
                      animationEasing="ease-out"
                    >
                      <LabelList
                        dataKey="count"
                        content={(props) => (
                          <LatestBarLabel
                            {...props}
                            lastIndex={chartData.length - 1}
                          />
                        )}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </div>

            {/* Fees by school year — sits beside the enrollments chart in the
                same card. Click a slice (or its legend row) for that year's
                itemized summary. */}
            <div className="flex flex-col gap-2 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <PiggyBank className="size-4" />
                Fees by school year
              </span>
              {feeChart === null ? (
                <div className="flex justify-center py-4">
                  <Skeleton className="size-40 rounded-full" />
                </div>
              ) : feeChart.data.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No confirmed fee snapshots yet.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <ChartContainer
                    config={feeChart.config}
                    className="aspect-square h-44 w-44 shrink-0"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            hideLabel
                            formatter={(value, name) => (
                              <div className="flex w-full items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  {feeChart.config[String(name)]?.label ?? name}
                                </span>
                                <span className="font-mono font-medium text-foreground tabular-nums">
                                  {formatPeso(value as number)}
                                </span>
                              </div>
                            )}
                          />
                        }
                      />
                      <Pie
                        data={feeChart.data}
                        dataKey="total"
                        nameKey="key"
                        innerRadius={50}
                        outerRadius={72}
                        strokeWidth={2}
                        stroke="var(--card)"
                        animationDuration={900}
                        animationEasing="ease-out"
                        cursor="pointer"
                        onClick={(_, index) => setSelectedFeeSlice(feeChart.data[index])}
                      >
                        {feeChart.data.map((d) => (
                          <Cell key={d.key} fill={`var(--color-${d.key})`} />
                        ))}
                        <RechartsLabel
                          content={({ viewBox }) => {
                            if (!viewBox || !("cx" in viewBox) || viewBox.cx == null) {
                              return null;
                            }
                            const { cx, cy } = viewBox;
                            return (
                              <text x={cx} y={cy} textAnchor="middle">
                                <tspan
                                  x={cx}
                                  y={(cy ?? 0) - 4}
                                  className="fill-foreground text-sm font-semibold"
                                >
                                  {formatPeso(feeGrandTotal)}
                                </tspan>
                                <tspan
                                  x={cx}
                                  y={(cy ?? 0) + 13}
                                  className="fill-muted-foreground text-[10px]"
                                >
                                  All years
                                </tspan>
                              </text>
                            );
                          }}
                        />
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  {/* Legend doubles as the table-view twin (every slice's
                      exact peso value is always visible, not gated behind
                      hover) and as a second, easier-to-hit click target. */}
                  <ul className="flex w-full flex-col gap-1.5 text-sm">
                    {[...feeChart.data].reverse().map((d) => (
                      <li key={d.key}>
                        <button
                          type="button"
                          onClick={() => setSelectedFeeSlice(d)}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted"
                        >
                          {/* Raw hex, not var(--color-…) — that CSS variable is
                              only defined within ChartContainer's own DOM
                              subtree, and this legend list renders as its
                              sibling, outside that scope. */}
                          <span
                            className="size-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: d.theme.light }}
                          />
                          <span className="truncate text-muted-foreground">{d.label}</span>
                          <span className="ml-auto shrink-0 font-mono font-medium tabular-nums">
                            {formatPeso(d.total)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className={`${ENTER} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
          style={enterDelay(500)}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm font-normal text-muted-foreground">
              Total fees — {currentSchoolYear} school year
              <Banknote className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {currentYearFeeTotal === null ? (
              <Skeleton className="h-9 w-40" />
            ) : (
              <span className="text-3xl font-semibold tabular-nums">
                {formatPeso(animatedFeeTotal ?? 0)}
              </span>
            )}
            <p className="text-xs text-muted-foreground">
              Fee snapshots frozen onto {currentSchoolYear} confirmed enrollments — resets to
              zero once the next school year starts. Earlier years stay in the chart below.
            </p>
          </CardContent>
        </Card>

        <Card className={ENTER} style={enterDelay(580)}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm font-normal text-muted-foreground">
              Recently enrolled
              <GraduationCap className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentEnrollments === null ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-2/5" />
                      <Skeleton className="h-3 w-1/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentEnrollments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No confirmed enrollments yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {recentEnrollments.map((e, i) => (
                  <li
                    key={e.id}
                    className={`flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0 ${ENTER}`}
                    style={enterDelay(650 + i * 70)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {initialsOf(e.student.studentName)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {e.student.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.student.studentNumber}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={selectedFeeSlice !== null}
        onOpenChange={(open) => !open && setSelectedFeeSlice(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedFeeSlice?.key === "other"
                ? selectedFeeSlice.label
                : `${selectedFeeSlice?.label} school year`}
            </DialogTitle>
            <DialogDescription>
              {selectedFeeSlice && selectedFeeSlice.years.length === 1
                ? `${selectedFeeSlice.years[0].enrollmentCount} confirmed enrollment${selectedFeeSlice.years[0].enrollmentCount === 1 ? "" : "s"} contributed this total.`
                : "Combined total across these earlier school years — each year's own fees stay frozen and printable from its Statement of Account."}
            </DialogDescription>
          </DialogHeader>
          {selectedFeeSlice && (
            <div className="flex flex-col gap-3">
              <span className="text-3xl font-semibold tabular-nums">
                {formatPeso(selectedFeeSlice.total)}
              </span>
              {selectedFeeSlice.years.length === 1 ? (
                <ul className="flex flex-col divide-y text-sm">
                  {selectedFeeSlice.years[0].items.map((item) => (
                    <li
                      key={item.name}
                      className="flex items-center justify-between gap-4 py-1.5 first:pt-0 last:pb-0"
                    >
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-mono font-medium tabular-nums">
                        {formatPeso(item.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="flex flex-col divide-y text-sm">
                  {[...selectedFeeSlice.years]
                    .sort((a, b) => Number(b.year) - Number(a.year))
                    .map((y) => (
                      <li
                        key={y.year}
                        className="flex items-center justify-between gap-4 py-1.5 first:pt-0 last:pb-0"
                      >
                        <span className="text-muted-foreground">{y.year}</span>
                        <span className="font-mono font-medium tabular-nums">
                          {formatPeso(y.total)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
