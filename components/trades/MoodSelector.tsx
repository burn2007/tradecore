"use client";

interface MoodOption {
  value: number;
  label: string;
  color: string;
}

const MOODS: MoodOption[] = [
  { value: 1, label: "Anxious",   color: "#F07C7C" },
  { value: 2, label: "Cautious",  color: "#E2B96F" },
  { value: 3, label: "Neutral",   color: "#8BA8C4" },
  { value: 4, label: "Confident", color: "#50E3B8" },
  { value: 5, label: "Euphoric",  color: "#E2B96F" },
];

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export default function MoodSelector({ value, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
      {MOODS.map((m) => {
        const active = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              flex: 1,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: `2px solid ${active ? m.color : "#1A2640"}`,
                backgroundColor: active ? `${m.color}18` : "#0A0F1A",
                transition: "border-color 0.15s, background-color 0.15s",
              }}
            />
            <span
              style={{
                fontSize: 9,
                color: active ? m.color : "#2E4060",
                fontWeight: active ? 500 : 400,
                lineHeight: 1,
                textAlign: "center",
              }}
            >
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
