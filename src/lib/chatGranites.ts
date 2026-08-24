export type ChatGraniteCategory =
  | "Parlak / Neon"
  | "Enerji / Hareket"
  | "Şık / Premium"
  | "Deneysel / Glitch"
  | "Çerçeveli / Premium";

export type ChatGraniteOption = {
  id: string;
  className: string;
  label: string;
  category: ChatGraniteCategory;
  previewClass: string;
  includeInSelector: boolean;
};

const curatedGranites: ChatGraniteOption[] = [
  {
    id: "royal-gold",
    className: "granit-hareketli-1",
    label: "Royal Gold Ozel",
    category: "Şık / Premium",
    previewClass: "granit-hareketli-1",
    includeInSelector: true,
  },
  {
    id: "ice-crystal",
    className: "granit-hareketli-2",
    label: "Ice Crystal",
    category: "Şık / Premium",
    previewClass: "granit-hareketli-2",
    includeInSelector: true,
  },
  {
    id: "neon-pink",
    className: "granit-hareketli-3",
    label: "Neon Pink Ozel",
    category: "Parlak / Neon",
    previewClass: "granit-hareketli-3",
    includeInSelector: true,
  },
  {
    id: "cyber-scan",
    className: "granit-hareketli-4",
    label: "Cyber Scan",
    category: "Deneysel / Glitch",
    previewClass: "granit-hareketli-4",
    includeInSelector: true,
  },
  {
    id: "glitch-rgb",
    className: "granit-hareketli-5",
    label: "Glitch RGB Ozel",
    category: "Deneysel / Glitch",
    previewClass: "granit-hareketli-5",
    includeInSelector: true,
  },
  {
    id: "fire-core",
    className: "granit-hareketli-6",
    label: "Fire Core",
    category: "Enerji / Hareket",
    previewClass: "granit-hareketli-6",
    includeInSelector: true,
  },
  {
    id: "arc-reactor",
    className: "granit-hareketli-7",
    label: "Arc Reactor Ozel",
    category: "Enerji / Hareket",
    previewClass: "granit-hareketli-7",
    includeInSelector: true,
  },
  {
    id: "magic-aura",
    className: "granit-hareketli-8",
    label: "Magic Aura",
    category: "Parlak / Neon",
    previewClass: "granit-hareketli-8",
    includeInSelector: true,
  },
  {
    id: "retro-wave",
    className: "granit-hareketli-9",
    label: "Retro Wave",
    category: "Parlak / Neon",
    previewClass: "granit-hareketli-9",
    includeInSelector: true,
  },
  {
    id: "poison-mist",
    className: "granit-hareketli-10",
    label: "Poison Mist",
    category: "Enerji / Hareket",
    previewClass: "granit-hareketli-10",
    includeInSelector: true,
  },
  {
    id: "diamond-pulse",
    className: "granit-hareketli-11",
    label: "Diamond Pulse",
    category: "Şık / Premium",
    previewClass: "granit-hareketli-11",
    includeInSelector: true,
  },
  {
    id: "blood-moon",
    className: "granit-hareketli-12",
    label: "Blood Moon",
    category: "Deneysel / Glitch",
    previewClass: "granit-hareketli-12",
    includeInSelector: true,
  },
];

const legacyGranites: ChatGraniteOption[] = [
  {
    id: "legacy-13",
    className: "granit-hareketli-13",
    label: "Legacy 13",
    category: "Deneysel / Glitch",
    previewClass: "granit-hareketli-13",
    includeInSelector: false,
  },
  {
    id: "legacy-14",
    className: "granit-hareketli-14",
    label: "Legacy 14",
    category: "Deneysel / Glitch",
    previewClass: "granit-hareketli-14",
    includeInSelector: false,
  },
  {
    id: "legacy-15",
    className: "granit-hareketli-15",
    label: "Legacy 15",
    category: "Şık / Premium",
    previewClass: "granit-hareketli-15",
    includeInSelector: false,
  },
  {
    id: "legacy-16",
    className: "granit-hareketli-16",
    label: "Legacy 16",
    category: "Enerji / Hareket",
    previewClass: "granit-hareketli-16",
    includeInSelector: false,
  },
  {
    id: "legacy-17",
    className: "granit-hareketli-17",
    label: "Legacy 17",
    category: "Enerji / Hareket",
    previewClass: "granit-hareketli-17",
    includeInSelector: false,
  },
  {
    id: "legacy-18",
    className: "granit-hareketli-18",
    label: "Legacy 18",
    category: "Parlak / Neon",
    previewClass: "granit-hareketli-18",
    includeInSelector: false,
  },
  {
    id: "legacy-frame-1",
    className: "cerceve-1",
    label: "Kraliyet Altını",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-1",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-2",
    className: "cerceve-2",
    label: "Elmas Kristal",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-2",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-3",
    className: "cerceve-3",
    label: "Kozmik Bulut",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-3",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-4",
    className: "cerceve-4",
    label: "Toksik Neon",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-4",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-5",
    className: "cerceve-5",
    label: "Yakut Ateşi",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-5",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-6",
    className: "cerceve-6",
    label: "Galaksi Denizi",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-6",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-7",
    className: "cerceve-7",
    label: "Gün Batımı",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-7",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-8",
    className: "cerceve-8",
    label: "Gök Gürültüsü",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-8",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-9",
    className: "cerceve-9",
    label: "Ametist Büyüsü",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-9",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-10",
    className: "cerceve-10",
    label: "Zümrüt Krallığı",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-10",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-11",
    className: "cerceve-11",
    label: "Gökkuşağı Matrisi Ozel",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-11",
    includeInSelector: true,
  },
  {
    id: "legacy-frame-12",
    className: "cerceve-12",
    label: "Oniks Gölgesi",
    category: "Çerçeveli / Premium",
    previewClass: "cerceve-12",
    includeInSelector: true,
  },
];

const allGranites = [...curatedGranites, ...legacyGranites];
const selectableGranites = allGranites.filter((item) => item.includeInSelector);

const graniteLookup = new Map(
  allGranites.map((granite) => [granite.className, granite] as const),
);

export const CHAT_GRANITE_OPTIONS = selectableGranites;

export const CHAT_GRANITE_GROUPS: Array<{
  category: ChatGraniteCategory;
  label: string;
  options: ChatGraniteOption[];
}> = [
  {
    category: "Parlak / Neon",
    label: "Parlak / Neon",
    options: selectableGranites.filter(
      (item) => item.category === "Parlak / Neon",
    ),
  },
  {
    category: "Enerji / Hareket",
    label: "Enerji / Hareket",
    options: selectableGranites.filter(
      (item) => item.category === "Enerji / Hareket",
    ),
  },
  {
    category: "Şık / Premium",
    label: "Şık / Premium",
    options: selectableGranites.filter(
      (item) => item.category === "Şık / Premium",
    ),
  },
  {
    category: "Deneysel / Glitch",
    label: "Deneysel / Glitch",
    options: selectableGranites.filter(
      (item) => item.category === "Deneysel / Glitch",
    ),
  },
  {
    category: "Çerçeveli / Premium",
    label: "Çerçeveli / Premium",
    options: selectableGranites.filter(
      (item) => item.category === "Çerçeveli / Premium",
    ),
  },
];

export const getChatGraniteOption = (className?: string | null) => {
  if (!className) return null;
  return graniteLookup.get(className) ?? null;
};
