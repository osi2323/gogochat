export type ChatFontCategory =
  | "Modern"
  | "El Yazisi"
  | "Tech"
  | "Klasik";

export type ChatFontOption = {
  id: string;
  category: ChatFontCategory;
  fontName: string;
  label: string;
  cssVariable: string;
  fallback: "sans-serif" | "serif" | "cursive" | "monospace";
  previewClass: string;
  fontSize: string;
  includeInSelector: boolean;
};

const curatedChatFonts: ChatFontOption[] = [
  {
    id: "space-grotesk",
    category: "Modern",
    fontName: "Space Grotesk",
    label: "Space Grotesk",
    cssVariable: "--font-chat-space-grotesk",
    fallback: "sans-serif",
    previewClass: "chat-font-preview--space-grotesk",
    fontSize: "1.08em",
    includeInSelector: true,
  },
  {
    id: "comfortaa",
    category: "Modern",
    fontName: "Comfortaa",
    label: "Comfortaa",
    cssVariable: "--font-chat-comfortaa",
    fallback: "cursive",
    previewClass: "chat-font-preview--comfortaa",
    fontSize: "1.1em",
    includeInSelector: true,
  },
  {
    id: "bebas-neue",
    category: "Modern",
    fontName: "Bebas Neue",
    label: "Bebas Neue",
    cssVariable: "--font-chat-bebas-neue",
    fallback: "sans-serif",
    previewClass: "chat-font-preview--bebas-neue",
    fontSize: "1.22em",
    includeInSelector: true,
  },
  {
    id: "kalam",
    category: "El Yazisi",
    fontName: "Kalam",
    label: "Kalam",
    cssVariable: "--font-chat-kalam",
    fallback: "cursive",
    previewClass: "chat-font-preview--kalam",
    fontSize: "1.35em",
    includeInSelector: true,
  },
  {
    id: "pacifico",
    category: "El Yazisi",
    fontName: "Pacifico",
    label: "Pacifico",
    cssVariable: "--font-chat-pacifico",
    fallback: "cursive",
    previewClass: "chat-font-preview--pacifico",
    fontSize: "1.24em",
    includeInSelector: true,
  },
  {
    id: "caveat",
    category: "El Yazisi",
    fontName: "Caveat",
    label: "Caveat",
    cssVariable: "--font-chat-caveat",
    fallback: "cursive",
    previewClass: "chat-font-preview--caveat",
    fontSize: "1.34em",
    includeInSelector: true,
  },
  {
    id: "permanent-marker",
    category: "El Yazisi",
    fontName: "Permanent Marker",
    label: "Permanent Marker",
    cssVariable: "--font-chat-permanent-marker",
    fallback: "cursive",
    previewClass: "chat-font-preview--permanent-marker",
    fontSize: "1.15em",
    includeInSelector: true,
  },
  {
    id: "lobster-two",
    category: "El Yazisi",
    fontName: "Lobster Two",
    label: "Lobster Two",
    cssVariable: "--font-chat-lobster-two",
    fallback: "cursive",
    previewClass: "chat-font-preview--lobster-two",
    fontSize: "1.25em",
    includeInSelector: true,
  },
  {
    id: "orbitron",
    category: "Tech",
    fontName: "Orbitron",
    label: "Orbitron",
    cssVariable: "--font-chat-orbitron",
    fallback: "monospace",
    previewClass: "chat-font-preview--orbitron",
    fontSize: "1.15em",
    includeInSelector: true,
  },
  {
    id: "audiowide",
    category: "Tech",
    fontName: "Audiowide",
    label: "Audiowide",
    cssVariable: "--font-chat-audiowide",
    fallback: "sans-serif",
    previewClass: "chat-font-preview--audiowide",
    fontSize: "1.15em",
    includeInSelector: true,
  },
  {
    id: "turret-road",
    category: "Tech",
    fontName: "Turret Road",
    label: "Turret Road",
    cssVariable: "--font-chat-turret-road",
    fallback: "sans-serif",
    previewClass: "chat-font-preview--turret-road",
    fontSize: "1.15em",
    includeInSelector: true,
  },
  {
    id: "monoton",
    category: "Tech",
    fontName: "Monoton",
    label: "Monoton",
    cssVariable: "--font-chat-monoton",
    fallback: "sans-serif",
    previewClass: "chat-font-preview--monoton",
    fontSize: "1.18em",
    includeInSelector: true,
  },
  {
    id: "cormorant-garamond",
    category: "Klasik",
    fontName: "Cormorant Garamond",
    label: "Cormorant Garamond",
    cssVariable: "--font-chat-cormorant-garamond",
    fallback: "serif",
    previewClass: "chat-font-preview--cormorant-garamond",
    fontSize: "1.2em",
    includeInSelector: true,
  },
  {
    id: "playfair-display",
    category: "Klasik",
    fontName: "Playfair Display",
    label: "Playfair Display",
    cssVariable: "--font-chat-playfair-display",
    fallback: "serif",
    previewClass: "chat-font-preview--playfair-display",
    fontSize: "1.18em",
    includeInSelector: true,
  },
  {
    id: "cinzel",
    category: "Klasik",
    fontName: "Cinzel",
    label: "Cinzel",
    cssVariable: "--font-chat-cinzel",
    fallback: "serif",
    previewClass: "chat-font-preview--cinzel",
    fontSize: "1.16em",
    includeInSelector: true,
  },
];

const legacyChatFonts: ChatFontOption[] = [
  {
    id: "grenze-gotisch",
    category: "Klasik",
    fontName: "Grenze Gotisch",
    label: "Grenze Gotisch",
    cssVariable: "--font-chat-grenze-gotisch",
    fallback: "serif",
    previewClass: "chat-font-preview--grenze-gotisch",
    fontSize: "1.25em",
    includeInSelector: false,
  },
];

const allChatFonts = [...curatedChatFonts, ...legacyChatFonts];

const chatFontLookup = new Map(
  allChatFonts.map((font) => [font.fontName, font] as const),
);

export const CHAT_FONT_OPTIONS = curatedChatFonts;

export const CHAT_FONT_GROUPS: Array<{
  category: ChatFontCategory;
  label: string;
  options: ChatFontOption[];
}> = [
  {
    category: "Modern",
    label: "Modern",
    options: curatedChatFonts.filter((font) => font.category === "Modern"),
  },
  {
    category: "El Yazisi",
    label: "El Yazısı",
    options: curatedChatFonts.filter((font) => font.category === "El Yazisi"),
  },
  {
    category: "Tech",
    label: "Tech",
    options: curatedChatFonts.filter((font) => font.category === "Tech"),
  },
  {
    category: "Klasik",
    label: "Klasik",
    options: curatedChatFonts.filter((font) => font.category === "Klasik"),
  },
];

export const getChatFontOption = (fontName?: string | null) => {
  if (!fontName) return null;
  return chatFontLookup.get(fontName) ?? null;
};

export const getChatFontFamily = (fontName?: string | null) => {
  const option = getChatFontOption(fontName);
  if (!option) return null;
  return `var(${option.cssVariable}), ${option.fallback}`;
};

export const getChatFontSize = (fontName?: string | null) => {
  const option = getChatFontOption(fontName);
  return option?.fontSize ?? "1.05em";
};

export const getChatFontPreviewClass = (fontName?: string | null) => {
  const option = getChatFontOption(fontName);
  return option?.previewClass ?? null;
};
