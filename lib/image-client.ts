const MAX_IMAGE_SIDE = 1400;
const JPEG_QUALITY = 0.82;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function compressImageFile(file: File): Promise<File> {
  const source = await readFile(file);
  const image = await loadImage(source);
  const scale = Math.min(
    1,
    MAX_IMAGE_SIDE / Math.max(image.width, image.height),
  );
  const canvas = document.createElement("canvas");

  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器无法处理图片");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas);
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("图片压缩后仍超过 6 MB，请选择尺寸更小的图片");
  }
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";

  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("图片压缩失败"));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
