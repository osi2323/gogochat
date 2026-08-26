"use client";

const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃",
  "😉","😌","😍","🥰","😘","😋","😎","🤩","🥳","😏","😒","😞",
  "😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭",
  "😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥",
  "🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😴",
  "👍","👎","👏","🙌","🤝","🙏","💪","❤️","💙","💜","🔥","✨",
];

type MsnEmojiPickerProps = { onEmojiSelect: (emoji: string) => void };

export const MsnEmojiPicker = ({ onEmojiSelect }: MsnEmojiPickerProps) => (
  <div className="w-full bg-white text-zinc-900">
    <div className="border-b border-zinc-200 px-3 py-2 text-xs font-black">Emoji</div>
    <div className="grid grid-cols-8 gap-1 p-2 sm:grid-cols-10">
      {EMOJIS.map((emoji, index) => (
        <button
          key={`${emoji}-${index}`}
          type="button"
          onClick={() => onEmojiSelect(emoji)}
          className="flex h-9 w-full items-center justify-center rounded-lg text-[22px] transition hover:bg-blue-50 active:scale-90"
          aria-label={`Emoji ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  </div>
);
