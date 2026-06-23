"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AdminLoginProps = {
  isConfigured: boolean;
};

export function AdminLogin({ isConfigured }: AdminLoginProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "登录失败");
      }

      setPassword("");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login-form" onSubmit={handleSubmit}>
        <span className="brand-mark">AB</span>
        <h1>数据后台</h1>
        <p>请输入管理员密码。</p>
        <label className="text-field">
          <span className="field-label">密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={!isConfigured}
            required
          />
        </label>
        {!isConfigured && (
          <p className="error-message">请先配置环境变量 ADMIN_PASSWORD。</p>
        )}
        {error && <p className="error-message">{error}</p>}
        <button
          className="primary-button"
          type="submit"
          disabled={!isConfigured || isSubmitting}
        >
          {isSubmitting ? "正在验证..." : "进入后台"}
        </button>
      </form>
    </main>
  );
}
