"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImageFile } from "@/lib/image-client";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type SelectedImage = {
  file: File;
  preview: string;
};

type ImageFieldProps = {
  inputId: string;
  label: string;
  preview: string;
  fileName?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function ImageField({
  inputId,
  label,
  preview,
  fileName,
  onChange,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="image-field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <button
        className={`image-picker ${preview ? "has-image" : ""}`}
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={`选择${label}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${label}预览`} />
        ) : (
          <span className="picker-empty">
            <strong>选择图片</strong>
            <small>JPG、PNG、WebP</small>
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        id={inputId}
        className="file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onClick={(event) => {
          event.currentTarget.value = "";
        }}
        onChange={onChange}
      />
      <span className="file-name">
        {fileName || "尚未选择图片"}
      </span>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<(SelectedImage | null)[]>([null, null]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function selectImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.item(0);

    console.log(`[image-upload] 图片 ${index === 0 ? "A" : "B"} input change`, {
      files: input.files,
      file,
    });

    if (!file) {
      console.warn(`[image-upload] 图片 ${index === 0 ? "A" : "B"} 未接收到 File`);
      return;
    }

    console.log(`[image-upload] 已选择图片 ${index === 0 ? "A" : "B"}`, file);

    if (!file.type.startsWith("image/")) {
      setError("请选择有效的图片文件。");
      return;
    }

    setError("");
    const reader = new FileReader();

    reader.onload = () => {
      const preview = reader.result;

      if (typeof preview !== "string") {
        console.error("[image-upload] FileReader 未返回可用的预览地址", reader.result);
        setError("图片预览生成失败，请重新选择。");
        return;
      }

      setImages((current) =>
        current.map((item, i) => (i === index ? { file, preview } : item)),
      );
      console.log(`[image-upload] 图片 ${index === 0 ? "A" : "B"} 预览已更新`, {
        name: file.name,
        type: file.type,
        size: file.size,
      });
    };

    reader.onerror = () => {
      console.error("[image-upload] 图片读取失败", reader.error);
      setError("图片读取失败，请重新选择。");
    };

    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!images[0] || !images[1]) {
      setError("请上传图片 A 和图片 B。");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const [imageA, imageB] = await Promise.all([
        compressImageFile(images[0].file),
        compressImageFile(images[1].file),
      ]);

      const uploadResponse = await fetch("/api/polls/upload-urls", {
        method: "POST",
      });
      const upload = (await uploadResponse.json()) as {
        id?: string;
        imageA?: { path: string; token: string };
        imageB?: { path: string; token: string };
        error?: string;
      };

      if (
        !uploadResponse.ok ||
        !upload.id ||
        !upload.imageA ||
        !upload.imageB
      ) {
        throw new Error(upload.error || "创建图片上传地址失败");
      }
      const supabase = getSupabaseBrowser();
      const [uploadA, uploadB] = await Promise.all([
        supabase.storage
          .from("poll-images")
          .uploadToSignedUrl(upload.imageA.path, upload.imageA.token, imageA, {
            contentType: "image/jpeg",
            cacheControl: "31536000",
          }),
        supabase.storage
          .from("poll-images")
          .uploadToSignedUrl(upload.imageB.path, upload.imageB.token, imageB, {
            contentType: "image/jpeg",
            cacheControl: "31536000",
          }),
      ]);

      if (uploadA.error || uploadB.error) {
        throw new Error(
          `图片上传失败：${uploadA.error?.message || uploadB.error?.message}`,
        );
      }

      const response = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: upload.id,
          title: title.trim(),
          imageAPath: upload.imageA.path,
          imageBPath: upload.imageB.path,
        }),
      });

      const result = (await response.json()) as {
        poll?: { id: string };
        error?: string;
      };

      if (!response.ok || !result.poll) {
        throw new Error(result.error || "创建投票失败");
      }

      router.push(`/p/${result.poll.id}`);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "生成失败，请重试。";
      setError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="create-panel">
        <header className="page-header">
          <span className="brand-mark">AB</span>
          <div>
            <h1>图片二选一</h1>
            <p>上传两张图片，生成一个查看链接。</p>
          </div>
        </header>

        <form onSubmit={handleSubmit}>
          <label className="text-field">
            <span className="field-label">标题</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：哪张更适合当头像？"
              maxLength={60}
            />
          </label>

          <div className="image-grid">
            <ImageField
              inputId="image-a"
              label="图片 A"
              preview={images[0]?.preview ?? ""}
              fileName={images[0]?.file.name}
              onChange={(event) => selectImage(0, event)}
            />
            <ImageField
              inputId="image-b"
              label="图片 B"
              preview={images[1]?.preview ?? ""}
              fileName={images[1]?.file.name}
              onChange={(event) => selectImage(1, event)}
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "正在生成..." : "生成分享链接"}
          </button>
        </form>

        <p className="storage-note">
          创建后可复制链接分享；本地开发数据保存在项目目录中。
        </p>
      </section>
    </main>
  );
}
