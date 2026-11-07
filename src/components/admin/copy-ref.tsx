"use client";

import { useState } from "react";
import { Icon } from "@/components/admin/icons";

/** Monospace booking reference with a one-click copy action. */
export function CopyRef({
  value,
  copyLabel,
  copiedLabel,
}: {
  value: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="ltr-token rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-700">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        title={copied ? copiedLabel : copyLabel}
        aria-label={copied ? copiedLabel : copyLabel}
        className={`grid h-6 w-6 place-items-center rounded-md transition active:scale-90 ${
          copied ? "text-emerald-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        <Icon name={copied ? "check" : "copy"} width={14} height={14} />
      </button>
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </span>
  );
}

