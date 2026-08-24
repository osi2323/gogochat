"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { apiClient } from "@/services/apiClient";

const DEFAULT_SITE_TITLE = "KingMobile";

const resolveSiteTitle = (siteTitle?: string | null) =>
  siteTitle?.trim() ? siteTitle.trim() : DEFAULT_SITE_TITLE;

export const GlobalSiteTitleSync = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/") return;

    let cancelled = false;

    const syncTitle = async () => {
      try {
        const settings = await apiClient.systemSettings.getMaintenanceMode();
        if (cancelled) return;
        const nextTitle = resolveSiteTitle(settings.siteTitle);
        document.title = nextTitle;
      } catch (error) {
        if (cancelled) return;
        document.title = DEFAULT_SITE_TITLE;
      }
    };

    void syncTitle();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
};
