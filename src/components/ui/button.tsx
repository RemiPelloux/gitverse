import { clsx } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "ok" | "danger";
type Size = "sm" | "md" | "lg";

/* Tactile buttons: a solid bottom edge that the button sinks into when pressed. */
const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-[background-color,color,border-color,box-shadow,transform] duration-100 disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-[0_3px_0_var(--accent-deep)] hover:bg-[#b53a1c] active:translate-y-[3px] active:shadow-none",
  secondary:
    "bg-elevated text-fg border border-line shadow-[0_2px_0_var(--edge)] hover:bg-surface hover:border-line-strong active:translate-y-[2px] active:shadow-none",
  ghost: "text-fg-2 hover:text-fg hover:bg-surface-2 active:translate-y-px",
  ok: "bg-ok text-[var(--on-ok)] shadow-[0_3px_0_color-mix(in_oklab,var(--ok)_60%,black)] hover:brightness-110 active:translate-y-[3px] active:shadow-none",
  danger: "bg-bad-soft text-bad hover:bg-bad hover:text-white active:translate-y-px",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return clsx(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  href,
  children,
  ...rest
}: { variant?: Variant; size?: Size; className?: string; href: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function IconButton({ label, className, ...props }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex size-8 pointer-coarse:size-11 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">{children}</kbd>
  );
}
