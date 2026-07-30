import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "default" | "primary" | "ghost" | "danger" | "danger-ghost";
type Size = "md" | "sm" | "icon" | "icon-sm";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-[13px] font-medium " +
  "transition-colors duration-100 ease-out active:translate-y-[0.5px] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-border " +
  "disabled:cursor-default disabled:opacity-50";

const VARIANT: Record<Variant, string> = {
  default:
    "border border-border bg-surface text-text-secondary enabled:hover:border-border-strong enabled:hover:bg-surface-hover enabled:hover:text-text",
  primary: "border border-primary bg-primary text-white enabled:hover:border-primary-hover enabled:hover:bg-primary-hover",
  ghost:
    "border border-transparent bg-transparent text-text-secondary enabled:hover:bg-surface-hover enabled:hover:text-text",
  danger: "border border-border bg-surface text-danger enabled:hover:border-danger enabled:hover:bg-danger-light",
  "danger-ghost": "border border-transparent bg-transparent text-danger enabled:hover:bg-danger-light",
};

const SIZE: Record<Size, string> = {
  md: "px-3 py-1.5",
  sm: "px-[9px] py-1 text-xs",
  icon: "h-[30px] w-[30px] p-1.5",
  "icon-sm": "h-6 w-6 p-1",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Toggle-pressed visual state (e.g. the active detail-level button). */
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", active, className = "", type = "button", ...rest },
  ref,
) {
  const activeCls = active ? "!border-primary-border !bg-primary-light !text-primary" : "";
  return (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${activeCls} ${className}`.trim()}
      {...rest}
    />
  );
});
