const THUMBNAIL_MAX_SIZE = 320;

export const imageFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });

export const createImageThumbnail = async (
  file: File,
): Promise<{ mediaType: "image/png" | "image/jpeg"; contentBase64: string }> => {
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      element.src = source;
    });
    const ratio = Math.min(
      1,
      THUMBNAIL_MAX_SIZE / image.naturalWidth,
      THUMBNAIL_MAX_SIZE / image.naturalHeight,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("썸네일을 생성할 수 없습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const mediaType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const dataUrl = canvas.toDataURL(mediaType, mediaType === "image/jpeg" ? 0.82 : undefined);
    return { mediaType, contentBase64: dataUrl.split(",")[1] ?? "" };
  } finally {
    URL.revokeObjectURL(source);
  }
};
