const COLUMNS = [
  {
    label: "Pre-market status",
    text: "Upgrade to Premium to unlock your daily mental check-in",
  },
  {
    label: "Tilt fingerprint",
    text: "Upgrade to Premium to see your personal tilt pattern",
  },
  {
    label: "AI insight",
    text: "Upgrade to Premium to unlock behavioural coaching",
  },
] as const;

export default function MindEngineStrip() {
  return (
    <div
      className="hidden md:grid"
      style={{
        backgroundColor: "var(--color-deep)",
        borderTop: "1px solid var(--color-border)",
        padding: "12px 20px 12px 72px",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "1.5rem",
        flexShrink: 0,
      }}
    >
      {COLUMNS.map(({ label, text }) => (
        <div key={label}>
          <div
            style={{
              borderLeft: "2px solid rgba(226, 185, 111, 0.3)",
              paddingLeft: 7,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 500,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {label}
            </span>
          </div>
          <p
            style={{
              fontSize: 10,
              color: "#5A7090",
              lineHeight: 1.55,
              margin: 0,
              paddingLeft: 9,
            }}
          >
            {text}
          </p>
        </div>
      ))}
    </div>
  );
}
