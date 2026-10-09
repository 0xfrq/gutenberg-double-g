"use client";

import { useId, type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
      <div className="min-w-0">
        <h1 className="font-serif text-title font-semibold tracking-[-0.02em] text-ink [overflow-wrap:anywhere]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted md:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Section({
  title,
  description,
  count,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={className}>
      <div className="mb-4 min-w-0">
        <h2
          id={id}
          className="flex items-baseline gap-2 font-serif text-[1.375rem] font-semibold leading-tight tracking-[-0.01em] text-ink"
        >
          {title}
          {count !== undefined ? (
            <span className="font-sans text-sm font-medium tabular-nums text-muted">{count}</span>
          ) : null}
        </h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Horizontal, swipeable shelf on phones; a tidy grid on wide screens. */
export function Rail({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const layout = wide
    ? "*:w-[min(19rem,82vw)] lg:grid lg:grid-cols-3 lg:*:w-auto"
    : "*:w-[8.5rem] sm:*:w-36 lg:grid lg:grid-cols-6 lg:gap-x-5 lg:gap-y-8 lg:*:w-auto";
  return (
    <div className="-mx-4 sm:-mx-6">
      <div
        className={`no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 *:shrink-0 *:snap-start sm:scroll-px-6 sm:px-6 lg:overflow-visible ${layout}`}
      >
        {children}
      </div>
    </div>
  );
}

export function BookGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 min-[30rem]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-x-5">
      {children}
    </div>
  );
}

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div role="status">
      <span className="sr-only">Loading books…</span>
      <div aria-hidden="true" className="grid grid-cols-2 gap-x-4 gap-y-8 min-[30rem]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-x-5">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="animate-pulse">
            <div className="aspect-[2/3] rounded-cover bg-paper-3" />
            <div className="mt-3 h-3.5 w-4/5 rounded-full bg-paper-3" />
            <div className="mt-2 h-3 w-1/2 rounded-full bg-paper-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="-mx-4 sm:-mx-6">
      <div role="group" aria-label={label} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:px-6">
        {children}
      </div>
    </div>
  );
}

export function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-soft active:scale-[0.97] ${
        active ? "bg-ink text-paper" : "bg-paper-3 text-ink-2 hover:bg-rule hover:text-ink"
      }`}
    >
      {label}
      {count !== undefined ? (
        <span className={`text-xs tabular-nums ${active ? "opacity-70" : "text-muted"}`}>{count}</span>
      ) : null}
    </button>
  );
}

export function PillButton({
  children,
  onClick,
  variant = "solid",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "solid" | "outline";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const look =
    variant === "solid"
      ? "bg-accent text-accent-ink hover:bg-accent-hover"
      : "border border-rule-2 text-ink hover:bg-paper-3";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${look}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-card border border-dashed border-rule-2 px-5 py-7 sm:px-7">
      <p className="font-serif text-lg font-semibold text-ink">{title}</p>
      <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted">{body}</p>
      {action && onAction ? (
        <div className="mt-3">
          <PillButton onClick={onAction}>{action}</PillButton>
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-1.5 rounded-card bg-paper-3 px-5 py-7 sm:px-7">
      <p className="font-serif text-lg font-semibold text-ink">{title}</p>
      <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted">{body}</p>
      <div className="mt-3">
        <PillButton variant="outline" onClick={onRetry}>
          Try again
        </PillButton>
      </div>
    </div>
  );
}
