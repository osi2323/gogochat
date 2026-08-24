"use client";

// Emoji GIF dosya isimleri
const EMOJI_FILES = [
  "e1",
  "e2",
  "e3",
  "e4",
  "e5",
  "e6",
  "e7",
  "e8",
  "e9",
  "e10",
  "e11",
  "e12",
  "e13",
  "e14",
  "e15",
  "e16",
  "e17",
  "e18",
  "e19",
  "e20",
  "e21",
  "e22",
  "e23",
  "e24",
  "e25",
  "e26",
  "e27",
  "e28",
  "e29",
  "e30",
  "e31",
  "e32",
  "e33",
  "e34",
  "e35",
  "e36",
  "e37",
  "e38",
  "e39",
  "e40",
  "e41",
  "e42",
  "e43",
  "e44",
  "e45",
  "e46",
  "e47",
  "e48",
  "e49",
  "e50",
  "e51",
  "e52",
  "e53",
  "e54",
  "e56",
  "e57",
  "e58",
  "e59",
  "e60",
  "e61",
  "e62",
  "e63",
  "e64",
  "e65",
  "e66",
  "e67",
  "e68",
  "e69",
  "e70",
  "e71",
  "e72",
];

type MsnEmojiPickerProps = {
  onEmojiSelect: (emojiUrl: string) => void;
};

export const MsnEmojiPicker = ({ onEmojiSelect }: MsnEmojiPickerProps) => {
  const emojis = EMOJI_FILES.map((file) => `/emom/${file}.gif`);

  return (
    <div className="flex max-h-[min(54dvh,250px)] w-[min(calc(100vw-16px),248px)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl md:max-h-[350px] md:w-[320px]">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50 px-2.5 py-1.5 md:px-3 md:py-2">
        <h3 className="text-xs font-semibold text-zinc-700 md:text-sm">Emoji Seç</h3>
      </div>

      {/* Emoji Grid */}
      <div className="flex-1 overflow-y-auto p-1.5 md:p-2">
        <div className="grid grid-cols-8 gap-0.5 md:gap-1">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onEmojiSelect(emoji)}
              className="flex h-7 w-7 items-center justify-center rounded transition-all hover:scale-110 hover:bg-blue-50 active:scale-95 md:h-9 md:w-9"
              title={emoji.split("/").pop()?.replace(".gif", "")}
            >
              <img
                src={emoji}
                alt="emoji"
                className="h-[22px] w-[22px] object-contain md:h-7 md:w-7"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
