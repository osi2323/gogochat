import { ChatAuthGuard } from "@/components/auth/ChatAuthGuard";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Client-side guard will handle both authenticated users and guests
  // We need to check localStorage which is only available on client
  return <ChatAuthGuard>{children}</ChatAuthGuard>;
}
