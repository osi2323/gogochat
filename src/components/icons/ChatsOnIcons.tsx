"use client";

import {
  Activity,
  Bell,
  Bot,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Crown,
  DoorOpen,
  Ellipsis,
  Eye,
  EyeOff,
  Gauge,
  Headphones,
  Heart,
  Home,
  Image,
  LayoutDashboard,
  ListMusic,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  Moon,
  MoreHorizontal,
  Music2,
  Palette,
  Phone,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";

export const CHATSON_ICONS = {
  // Ana navigasyon
  home: Home,
  dashboard: LayoutDashboard,
  rooms: DoorOpen,
  roomList: MessageSquare,
  people: UsersRound,
  users: Users,
  profile: CircleUserRound,
  friends: UserPlus,
  messages: MessageCircle,
  calls: Phone,
  settings: Settings,
  menu: Menu,
  search: Search,

  // Ses / oda
  mic: Mic,
  micOff: MicOff,
  headphones: Headphones,
  volume: Volume2,
  volumeOff: VolumeX,
  camera: Camera,
  radio: Radio,
  music: Music2,
  playlist: ListMusic,

  // Yönetim
  owner: Crown,
  moderator: ShieldCheck,
  security: Shield,
  userManage: UserCog,
  announce: Megaphone,
  bot: Bot,
  analytics: Gauge,
  activity: Activity,
  appearance: Palette,
  controls: SlidersHorizontal,

  // Mesajlaşma
  send: Send,
  attach: Plus,
  image: Image,
  emoji: Sparkles,
  effects: WandSparkles,
  favorite: Heart,
  star: Star,
  mail: Mail,

  // Genel
  light: Sun,
  dark: Moon,
  lock: Lock,
  show: Eye,
  hide: EyeOff,
  notification: Bell,
  delete: Trash2,
  logout: LogOut,
  close: X,
  more: MoreHorizontal,
  ellipsis: Ellipsis,
  back: ChevronLeft,
  forward: ChevronRight,
} satisfies Record<string, LucideIcon>;

export type ChatsOnIconName = keyof typeof CHATSON_ICONS;

type ChatsOnIconProps = {
  name: ChatsOnIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  title?: string;
};

export function ChatsOnIcon({
  name,
  size = 20,
  strokeWidth = 2,
  className,
  title,
}: ChatsOnIconProps) {
  const Icon = CHATSON_ICONS[name];
  return (
    <Icon
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    />
  );
}
