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
    } catch (error) {
      setMessage("Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleUpload}
      className="flex flex-col gap-3 rounded-3xl border border-border bg-white/70 p-4 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.6)] backdrop-blur"
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
        className="w-full rounded-2xl border border-border bg-white/80 px-3 py-2 text-sm"
      />
      <label className="text-xs font-semibold text-ink">File</label>
      <input
        type="file"
        accept=".epub,application/epub+zip"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
        className="w-full text-xs"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
      >
        {loading ? "Uploading..." : "Upload EPUB"}
      </button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </form>
  );
}
