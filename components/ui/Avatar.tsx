function getInitials(displayName?: string | null, email?: string | null): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "TC";
}

interface AvatarProps {
  displayName?: string | null;
  email?: string | null;
  size?: number;
}

/** Initials circle — same visual pattern used across the app (Topbar, Settings). */
export default function Avatar({ displayName, email, size = 38 }: AvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#0F1E30",
        border: "1px solid #1A2640",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.37),
        fontWeight: 500,
        color: "#E2B96F",
        flexShrink: 0,
      }}
    >
      {getInitials(displayName, email)}
    </div>
  );
}
