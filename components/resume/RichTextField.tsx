"use client";

import { useRef, useCallback } from "react";
import { wrapRichSelection } from "@/lib/shared/rich-text";

type Props = {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  mono?: boolean;
};

export function RichTextField({ label, value, onChange, rows = 3, className, mono }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const applyWrap = useCallback(
    (open: string, close: string) => {
      const el = ref.current;
      if (!el) return;
      const { selectionStart, selectionEnd } = el;
      const next = wrapRichSelection(value, selectionStart, selectionEnd, { open, close });
      onChange(next.value);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.selectionStart, next.selectionEnd);
      });
    },
    [value, onChange],
  );

  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 flex flex-wrap items-center justify-between gap-2 font-medium">
        {label}
        <span className="flex flex-wrap gap-1">
          <button
            type="button"
            className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            title="Wrap selection in **bold**"
            onClick={() => applyWrap("**", "**")}
          >
            B
          </button>
          <button
            type="button"
            className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs italic text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            title="Wrap selection in *italic*"
            onClick={() => applyWrap("*", "*")}
          >
            I
          </button>
          <button
            type="button"
            className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            title="Smaller text in PDF"
            onClick={() => applyWrap("{{small}}", "{{/small}}")}
          >
            Small
          </button>
        </span>
      </span>
      <textarea
        ref={ref}
        className={`input-field min-h-[48px] ${mono ? "font-mono text-xs leading-relaxed" : ""}`}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-1 text-[11px] text-zinc-500">
        Formatting: <code className="text-[10px]">**bold**</code>,{" "}
        <code className="text-[10px]">*italic*</code>,{" "}
        <code className="text-[10px]">{"{{small}}…{{/small}}"}</code> (PDF only)
      </p>
    </label>
  );
}
