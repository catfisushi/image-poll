"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogout() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function logout() {
    setIsSubmitting(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <button
      className="admin-logout-button"
      type="button"
      onClick={logout}
      disabled={isSubmitting}
    >
      {isSubmitting ? "退出中..." : "退出"}
    </button>
  );
}
