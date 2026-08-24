export type AgentDisplayUser = {
  username: string;
  displayUsername?: string | null;
  agentNickname?: string | null;
  roleStarCount?: number | null;
};

export const formatAgentDisplayName = (
  user: AgentDisplayUser,
  viewerStarCount: number,
): string => {
  const agentNickname = (user.agentNickname || "").trim();
  if (agentNickname) {
    const requiredStars =
      typeof user.roleStarCount === "number" && Number.isFinite(user.roleStarCount)
        ? Math.max(0, user.roleStarCount)
        : null;

    if (requiredStars !== null && viewerStarCount >= requiredStars) {
      return `${agentNickname} (${user.username})`;
    }
    return agentNickname;
  }

  return (user.displayUsername || user.username || "").trim();
};
