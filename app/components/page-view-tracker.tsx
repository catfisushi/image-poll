"use client";

import { useEffect } from "react";

type PageViewTrackerProps = {
  pathname: string;
};

export function PageViewTracker({ pathname }: PageViewTrackerProps) {
  useEffect(() => {
    fetch("/api/page-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname }),
      keepalive: true,
    }).catch((error) => {
      console.error("[page-view] 记录失败", error);
    });
  }, [pathname]);

  return null;
}
