import ReaderClient from "@/components/reader/reader-client";

type ReaderPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ source?: string }>;
};

export default async function ReaderPage({
  params,
  searchParams,
}: ReaderPageProps) {
  const resolvedParams = await params;
  const resolved = searchParams ? await searchParams : undefined;
  const source = resolved?.source === "upload" ? "upload" : "gutenberg";
  return <ReaderClient id={resolvedParams.id} source={source} />;
}
