const fs = require("fs");
const path = "src/app/page.tsx";
let s = fs.readFileSync(path, "utf8");

function replaceOnce(anchor, replacement, label) {
  const idx = s.indexOf(anchor);
  if (idx === -1) {
    console.error("MISSING anchor for:", label);
    process.exit(1);
  }
  if (s.indexOf(anchor, idx + 1) !== -1) {
    console.error("NON-UNIQUE anchor for:", label);
    process.exit(1);
  }
  s = s.slice(0, idx) + replacement + s.slice(idx + anchor.length);
}

// 1. Extend MainTab type
replaceOnce(
  'type MainTab = "discover" | "library" | "collections";',
  'type MainTab = "discover" | "library" | "collections" | "uploads";',
  "MainTab type"
);

// 2. Add the new tab button
replaceOnce(
  '    { value: "collections", label: "Collections" },\n  ];',
  '    { value: "collections", label: "Collections" },\n    { value: "uploads", label: "My Uploads" },\n  ];',
  "mainTabs array"
);

// 3. Insert the My Uploads tab branch before the Collections fallback branch
const collectionsBranchAnchor = `        ) : (
          /* ── COLLECTIONS TAB ───────────────────────────────────────────── */`;

const uploadsBranch = `        ) : activeTab === "uploads" ? (
          /* ── MY UPLOADS TAB ─────────────────────────────────────────────── */
          <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
            {/* Sidebar: upload form */}
            <aside className="flex flex-col gap-6">
              <UploadPanel onUploaded={refreshPanels} />
            </aside>

            <div className="flex flex-col gap-4">
              <SectionHeader
                title="My Uploads"
                subtitle="Your EPUBs"
                count={uploads.length}
              />
              <BookGrid>
                {uploads.length > 0
                  ? uploads.map((upload) => (
                      <BookCard key={upload.id} book={upload} source="upload"
                        activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                    ))
                  : <EmptyState message="Upload an EPUB on the left and it will appear here." />
                }
              </BookGrid>
            </div>
          </div>

        ) : (
          /* ── COLLECTIONS TAB ───────────────────────────────────────────── */`;

replaceOnce(collectionsBranchAnchor, uploadsBranch, "uploads tab branch");

fs.writeFileSync(path, s);
console.log("page.tsx patched OK");
