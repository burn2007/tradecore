/** Gold 26px rounded square + candlestick mark — used in every topbar. */
export default function LogoMark() {
  return (
    <div
      style={{
        width: 26,
        height: 26,
        backgroundColor: "var(--color-gold)",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        {/* Left candle — filled (bull) */}
        <line x1="4" y1="1.5" x2="4" y2="3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="2.5" y="3" width="3" height="5" rx="0.5" fill="white" />
        <line x1="4" y1="8" x2="4" y2="10" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        {/* Right candle — outlined (bear) */}
        <line x1="10" y1="2.5" x2="10" y2="4.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="8.5" y="4.5" width="3" height="4.5" rx="0.5" fill="none" stroke="white" strokeWidth="1.2" />
        <line x1="10" y1="9" x2="10" y2="11.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
