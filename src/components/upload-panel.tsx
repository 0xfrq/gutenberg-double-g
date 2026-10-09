"use client";

import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Icon, Spinner } from "@/components/icons";

type UploadPanelProps = {
  onUploaded?: () => void;
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isEpub(file: File) {
  return file.type === "application/epub+zip" || file.name.toLowerCase().endsWith(".epub");
}

export default function UploadPanel({ onUploaded }: UploadPanelProps) {
  const fileId = useId();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const pickFile = (next: File | null) => {
    setMessage(null);
    if (next && !isEpub(next)) {
      setFile(null);
      setMessage({ tone: "error", text: `“${next.name}” isn’t an EPUB. Choose a file ending in .epub.` });
      return;
    }
    setFile(next);
  };

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setMessage({ tone: "error", text: "Choose an EPUB file first." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) formData.append("title", title.trim());

      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({
          tone: "error",
          text: data.error || "The upload didn’t finish. Large files can hit the server limit — try a smaller EPUB.",
        });
        return;
      }

      setMessage({ tone: "ok", text: `Added “${data.upload?.title ?? file.name}” to your uploads.` });
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.();
    } catch {
      setMessage({ tone: "error", text: "The upload didn’t finish. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleUpload}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-card border border-dashed p-3 transition-soft sm:p-4 ${
        dragging ? "border-accent bg-accent-soft" : "border-rule-2 bg-paper-2"
      }`}
    >
      <input
        ref={inputRef}
        id={fileId}
        type="file"
        accept=".epub,application/epub+zip"
        onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
        className="peer sr-only"
      />
      <label
        htmlFor={fileId}
        className="flex cursor-pointer items-center gap-4 rounded-2xl px-3 py-4 transition-soft hover:bg-paper-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus) sm:px-4"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="upload" size={22} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-serif text-lg font-semibold text-ink">
            {file ? file.name : "Add an EPUB"}
          </span>
          <span className="block text-sm text-muted">
            {file ? `${formatSize(file.size)} · ready to upload` : "Tap to choose a file, or drop one here."}
          </span>
        </span>
      </label>

      <div className="mt-2 flex flex-col gap-2 px-1 pb-1 sm:flex-row sm:items-center">
        <label htmlFor={titleId} className="sr-only">
          Title (optional)
        </label>
        <input
          id={titleId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title (optional — we’ll use the file name)"
          className="h-11 w-full min-w-0 rounded-full bg-paper-3 px-4 text-[0.9375rem] text-ink placeholder:text-muted sm:flex-1"
        />
        <button
          type="submit"
          disabled={loading || !file}
          aria-busy={loading}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-soft hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Spinner /> : null}
          {loading ? "Uploading…" : "Upload"}
        </button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`px-2 text-sm ${message ? "mt-2 pb-1" : ""} ${message?.tone === "error" ? "font-medium text-danger" : "text-muted"}`}
      >
        {message?.text ?? ""}
      </p>
    </form>
  );
}
