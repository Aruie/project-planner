export const defaultPdfFilename = (title: string, version: number): string => {
  const safeTitle = title
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${safeTitle || "문서"}_v${Math.max(version, 1)}`;
};
