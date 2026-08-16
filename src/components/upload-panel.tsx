"use client";

import { useState, type FormEvent } from "react";

type UploadPanelProps = {
  onUploaded?: () => void;
};

export default function UploadPanel({ onUploaded }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setMessage("Pick an EPUB file first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) {
        formData.append("title", title.trim());
      }

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Upload failed");
        return;
      }

      setMessage("Upload complete.");
      setFile(null);
      setTitle("");
      onUploaded?.();
    } catch {
      setMessage("Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleUpload}
      className="flex flex-col gap-3 border-l-2 border-primary bg-surface-muted/60 p-4"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          Upload
        </p>
        <h3 className="text-lg font-semibold text-ink">Your EPUB</h3>
      </div>
      <label className="text-xs font-semibold text-ink">Title</label>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Optional title"
        className="w-full border-b border-border bg-transparent px-1 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
      />
      <label className="text-xs font-semibold text-ink">File</label>
      <input
        type="file"
        accept=".epub,application/epub+zip"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
        className="w-full text-xs file:mr-3 file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <button
        type="submit"
        disabled={loading}
        className="self-start bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {loading ? "Uploading..." : "Upload EPUB"}
      </button>
      {message ? (
        <p className="text-xs text-muted" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
}
