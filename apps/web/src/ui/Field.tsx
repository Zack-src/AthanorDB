import type { InputHTMLAttributes, ReactNode } from "react";
import { INPUT_CLASS } from "./inputStyles.js";

/** Vertically-stacked label + input, used on auth screens and settings forms. */
export function Field(props: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const { label, className = "", ...rest } = props;
  return (
    <label className="mb-3.5 flex flex-col gap-1 text-[12.5px] text-text-muted">
      {label}
      <input className={`${INPUT_CLASS} ${className}`.trim()} {...rest} />
    </label>
  );
}
