"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Below this, text never visually overflows its cell anyway — no point
// wrapping it in a tooltip trigger.
const PLAIN_TEXT_THRESHOLD = 80;

// Long free-text fields (addresses, medical/behavioral notes, goals, etc.)
// clamp to a few lines with an ellipsis instead of stretching the dialog;
// hovering — or focusing, for keyboard users, since this renders a real
// focusable element — reveals the full text in a tooltip bubble.
export function TruncatedText({ text, lines = 3 }: { text: string; lines?: number }) {
  if (text.length <= PLAIN_TEXT_THRESHOLD) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="block w-full cursor-default overflow-hidden text-left break-words"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: lines,
          WebkitBoxOrient: "vertical",
        }}
      >
        {text}
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-wrap break-words">{text}</TooltipContent>
    </Tooltip>
  );
}
