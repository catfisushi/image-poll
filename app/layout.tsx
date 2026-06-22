import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "图片二选一",
  description: "上传两张图片并生成分享链接",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
