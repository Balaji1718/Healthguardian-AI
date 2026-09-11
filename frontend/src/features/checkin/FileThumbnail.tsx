import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, File } from "lucide-react";
import type { ConnectedFileEntry } from "@/services/localStorage/folderAccess";

interface FileThumbnailProps {
  entry: ConnectedFileEntry;
  className?: string;
}

export function FileThumbnail({ entry, className = "size-8" }: FileThumbnailProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const isImage = entry.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(entry.name);
  const isPdf = entry.type === "application/pdf" || /\.pdf$/i.test(entry.name);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    if (isImage && entry.fileHandle && !loadFailed) {
      const handle = entry.fileHandle;
      void (async () => {
        try {
          const file = await handle.getFile();
          if (cancelled) return;
          url = URL.createObjectURL(file);
          setThumbUrl(url);
        } catch {
          if (!cancelled) setLoadFailed(true);
        }
      })();
    }

    return () => {
      cancelled = true;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [entry, isImage, loadFailed]);

  if (isImage && thumbUrl && !loadFailed) {
    return (
      <div
        className={`${className} rounded-lg overflow-hidden border bg-muted/40 shrink-0 flex items-center justify-center`}
      >
        <img
          src={thumbUrl}
          alt={entry.name}
          loading="lazy"
          onError={() => setLoadFailed(true)}
          className="size-full object-cover"
        />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div
        className={`${className} rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 shrink-0 flex items-center justify-center`}
      >
        <FileText className="size-4" />
      </div>
    );
  }

  if (isImage) {
    return (
      <div
        className={`${className} rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 flex items-center justify-center`}
      >
        <ImageIcon className="size-4" />
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-lg bg-muted/60 text-muted-foreground border shrink-0 flex items-center justify-center`}
    >
      <File className="size-4" />
    </div>
  );
}
