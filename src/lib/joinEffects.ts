export type JoinEffectId =
  | "ocean-ribbon"
  | "ruby-crown"
  | "silver-comet"
  | "aurora-prism"
  | "royal-onyx"
  | "gif-effect-1"
  | "gif-effect-2"
  | "gif-effect-3"
  | "gif-effect-4"
  | "gif-effect-dplpd";

export type JoinEffectDefinition = {
  id: JoinEffectId;
  title: string;
  subtitle: string;
  starColorClass: string;
  previewType: "css" | "gif";
  gifPath?: string;
};

export const joinEffectDefinitions: JoinEffectDefinition[] = [
  {
    id: "ocean-ribbon",
    title: "Ocean Ribbon",
    subtitle: "Yumuşak mavi geçiş",
    starColorClass: "text-yellow-300",
    previewType: "css",
  },
  {
    id: "ruby-crown",
    title: "Ruby Crown",
    subtitle: "Kırmızı parıltılı vurgu",
    starColorClass: "text-yellow-200",
    previewType: "css",
  },
  {
    id: "silver-comet",
    title: "Silver Comet",
    subtitle: "Hızlı metalik geçiş",
    starColorClass: "text-sky-200",
    previewType: "css",
  },
  {
    id: "aurora-prism",
    title: "Aurora Prism",
    subtitle: "Kuzey ışığı gibi renk akışı",
    starColorClass: "text-emerald-100",
    previewType: "css",
  },
  {
    id: "royal-onyx",
    title: "Royal Onyx",
    subtitle: "Koyu premium altın çizgiler",
    starColorClass: "text-amber-200",
    previewType: "css",
  },
  {
    id: "gif-effect-1",
    title: "GIF Efekt 1",
    subtitle: "Canlı arkaplan dalgası",
    starColorClass: "text-white",
    previewType: "gif",
    gifPath: "/efektler/1.gif",
  },
  {
    id: "gif-effect-2",
    title: "GIF Efekt 2",
    subtitle: "Parlak akış geçişi",
    starColorClass: "text-white",
    previewType: "gif",
    gifPath: "/efektler/2.gif",
  },
  {
    id: "gif-effect-3",
    title: "GIF Efekt 3",
    subtitle: "Dinamik renk patlaması",
    starColorClass: "text-white",
    previewType: "gif",
    gifPath: "/efektler/3resim.gif",
  },
  {
    id: "gif-effect-4",
    title: "GIF Efekt 4",
    subtitle: "Yumuşak hareketli doku",
    starColorClass: "text-white",
    previewType: "gif",
    gifPath: "/efektler/4gif.gif",
  },
  {
    id: "gif-effect-dplpd",
    title: "GIF Efekt 5",
    subtitle: "Premium yoğun hareket",
    starColorClass: "text-white",
    previewType: "gif",
    gifPath: "/efektler/dplpd.gif",
  },
];

export const joinEffectIds: JoinEffectId[] = joinEffectDefinitions.map(
  (effect) => effect.id,
);

export const joinEffectsById: Record<JoinEffectId, JoinEffectDefinition> =
  joinEffectDefinitions.reduce((acc, effect) => {
    acc[effect.id] = effect;
    return acc;
  }, {} as Record<JoinEffectId, JoinEffectDefinition>);

export const isJoinEffectId = (value: unknown): value is JoinEffectId =>
  typeof value === "string" && joinEffectIds.includes(value as JoinEffectId);
