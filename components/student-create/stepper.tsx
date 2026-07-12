"use client";

import { cn } from "@/lib/utils";

export function Stepper({
  steps,
  currentIndex,
  maxCompletedIndex,
  onStepClick,
}: {
  steps: { id: string; label: string }[];
  currentIndex: number;
  maxCompletedIndex: number;
  onStepClick: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex;
        const isDone = i < currentIndex;
        const isClickable = i <= maxCompletedIndex && i !== currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(i)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                isDone && !isCurrent && "border-primary text-primary hover:bg-muted",
                !isDone && !isCurrent && "border-muted-foreground/30 text-muted-foreground",
                !isClickable && "cursor-not-allowed"
              )}
            >
              {i + 1}
            </button>
            <span
              className={cn(
                "hidden text-xs sm:inline",
                isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && <div className="h-px w-4 bg-border sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
}
