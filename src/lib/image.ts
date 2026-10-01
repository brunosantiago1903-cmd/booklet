/** Utilitários de imagem que rodam no navegador. */

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type PreparedFile = { blob: Blob; mimeType: string; extension: string };

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/**
 * Fotos viram JPEG de até 2000px no maior lado (reduz o upload e o custo da leitura).
 * HEIC do iPhone é convertido quando o navegador consegue decodificar (Safari consegue).
 */
export async function prepareReceiptFile(file: File): Promise<PreparedFile> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("PDF maior que 10 MB.");
    return { blob: file, mimeType: "application/pdf", extension: "pdf" };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("Falha ao converter a imagem.");
    return { blob, mimeType: "image/jpeg", extension: "jpg" };
  } catch {
    // Sem conversão: envia o original se o formato for aceito.
    if (ACCEPTED_UPLOAD_TYPES.includes(file.type) && file.size <= MAX_UPLOAD_BYTES) {
      return { blob: file, mimeType: file.type, extension: EXTENSIONS[file.type] };
    }
    throw new Error("Formato de imagem não suportado neste aparelho. Envie JPG, PNG ou PDF.");
  }
}
