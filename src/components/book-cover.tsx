"use client";

import { useState, type CSSProperties } from "react";

type BookCoverProps = {
  title: string;
  author?: string;
  src?: string | null;
  /** Thumbnails too small for a typeset title show the initial instead. */
  compact?: boolean;
  className?: string;
};

function toneFor(title: string) {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 5) + 1;
}

export default function BookCover({
  title,
  author,
  src,
  compact = false,
  className = "",
}: BookCoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  const tone = toneFor(title);

  return (
    <div
      className={`@container relative aspect-[2/3] overflow-hidden rounded-cover bg-paper-3 shadow-cover ring-1 ring-ink/8 ${className}`}
    >
      {showImage ? (
        // Remote Gutenberg covers; next/image would need every host allow-listed.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src ?? null)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="cover-art flex h-full w-full flex-col"
          style={
            {
              "--cover-bg": `var(--cover-${tone}-bg)`,
              "--cover-ink": `var(--cover-${tone}-ink)`,
            } as CSSProperties
          }
        >
          {compact ? (
            <span className="m-auto font-serif text-[48cqw] font-semibold leading-none">
              {title.trim().charAt(0).toUpperCase() || "·"}
            </span>
          ) : (
            <>
              <span className="line-clamp-5 font-serif text-[11.5cqw] font-semibold leading-[1.12] tracking-[-0.01em] [overflow-wrap:anywhere]">
                {title}
              </span>
              {author ? (
                <span className="mt-auto line-clamp-2 text-[7cqw] font-semibold uppercase tracking-[0.08em] opacity-75">
                  {author}
                </span>
              ) : null}
            </>
          )}
          <span aria-hidden="true" className="cover-fold" />
        </div>
      )}
    </div>
  );
}
