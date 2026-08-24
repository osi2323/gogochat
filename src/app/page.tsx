import { HomePageClient } from "@/components/auth/HomePageClient";
import { getServerApiClient } from "@/lib/api/serverClient";
import {
  createSystemSettingsService,
  type MaintenanceModeSettings,
} from "@/services/systemSettingsService";
import { cache } from "react";
import type { Metadata } from "next";

const DEFAULT_SETTINGS: MaintenanceModeSettings = {
  maintenanceMode: false,
  siteName: "KingMobile",
  siteTitle: null,
  homePageHtml: "",
  homePageImage: null,
  homePageLogo: null,
  welcomeMessageTemplate: null,
  activeLoginDesign: "standard" as const,
  premiumArticleTopTitle: null,
  premiumArticleTopContent: null,
  premiumArticleMiddleTitle: null,
  premiumArticleMiddleContent: null,
  premiumArticleBottomTitle: null,
  premiumArticleBottomContent: null,
  premiumAndroidAppUrl: null,
  premiumIosAppUrl: null,
};

const resolveSiteTitle = (siteTitle?: string | null) =>
  siteTitle?.trim() ? siteTitle.trim() : "KingMobile";

const getInitialSettings = cache(async (): Promise<MaintenanceModeSettings> => {
  try {
    const client = await getServerApiClient();
    return createSystemSettingsService(client).getMaintenanceMode();
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getInitialSettings();
  return {
    title: resolveSiteTitle(settings.siteTitle),
    description: "KingMobile giris sayfasi",
  };
}

export default async function Home() {
  const initialSettings = await getInitialSettings();
  return <HomePageClient initialSettings={initialSettings} />;
}
