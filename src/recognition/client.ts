import type { SongModel } from "../types";

interface RecognitionResponse {
  song: SongModel;
  verification: {
    status: "reader-agreed" | "judge-confirmed" | "unresolved";
    pageCount: number;
    readers: string[];
    judge: string | null;
    unresolvedCount: number;
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(`IMAGE_READ_FAILED:${file.name}`));
    });
    reader.addEventListener("error", () => {
      reject(new Error(`IMAGE_READ_FAILED:${file.name}`));
    });
    reader.readAsDataURL(file);
  });
}

export async function recognizeScoreImages(
  files: readonly File[],
): Promise<RecognitionResponse> {
  if (files.length < 1 || files.length > 4) {
    throw new Error("RECOGNITION_FILE_COUNT");
  }
  const dataUrls = await Promise.all(files.map(fileToDataUrl));
  const response = await fetch("/api/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pages: files.map((file, index) => ({
        pageNumber: index + 1,
        fileName: file.name,
        dataUrl: dataUrls[index],
      })),
    }),
  });
  const body = (await response.json()) as RecognitionResponse | { error?: string };
  if (!response.ok || !("song" in body)) {
    throw new Error(
      "error" in body && body.error
        ? body.error
        : "RECOGNITION_RESPONSE_FAILED",
    );
  }
  return body;
}
