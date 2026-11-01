import { clsx } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "mint" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-violet text-white shadow-[0_8px_24px_-8px_var(--violet)] hover:brightness-110 hover:shadow-[0_10px_30px_-8px_var(--violet)]",
  secondary: "bg-surface-2 text-fg border border-line hover:border-line-strong hover:bg-elevated",
  ghost: "text-fg-2 hover:text-fg hover:bg-surface-2",
  mint: "bg-mint text-[#04261a] shadow-[0_8px_24px_-10px_var(--mint)] hover:brightness-110",
  danger: "bg-coral-soft text-coral hover:bg-coral hover:text-white",
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
        "inline-flex size-8 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40",
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
