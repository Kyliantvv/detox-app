import type { ArtVariant } from "@/lib/types";

// Visuels géométriques des maquettes, utilisés à la place de vraies photos pour la démo.
const PALETTE = {
  ink: "#0b0b12",
  night: "#22073f",
  dusk: "#2e2c48",
  panel: "#11111c",
  pink: "#ff2e88",
  sun: "#ffd60a",
  lime: "#22ff88",
};

const BACKGROUND: Record<ArtVariant, string> = {
  sunset: PALETTE.night,
  moon: PALETTE.night,
  triangle: PALETTE.panel,
  diamond: PALETTE.pink,
  pill: PALETTE.lime,
  ring: PALETTE.dusk,
  square: PALETTE.sun,
  dome: PALETTE.pink,
  dot: PALETTE.sun,
  waves: PALETTE.panel,
};

function Shape({ variant }: { variant: ArtVariant }) {
  switch (variant) {
    case "sunset":
      return (
        <>
          {[
            [18, 18],
            [62, 12],
            [78, 20],
            [26, 30],
            [84, 38],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.2} fill={PALETTE.sun} />
          ))}
          <circle cx={50} cy={60} r={24} fill={PALETTE.pink} />
          <path d="M0 78 22 60 40 74 58 52 80 70 100 58V100H0z" fill="#16141f" />
          <path d="M0 88 30 72 55 86 80 74 100 82V100H0z" fill={PALETTE.ink} />
        </>
      );
    case "moon":
      return (
        <>
          <circle cx={50} cy={46} r={22} fill={PALETTE.sun} />
          <circle cx={60} cy={40} r={20} fill={PALETTE.night} />
          <path d="M0 80 30 64 60 78 100 62V100H0z" fill={PALETTE.ink} />
        </>
      );
    case "triangle":
      return <path d="M50 28 72 70H28z" fill={PALETTE.lime} />;
    case "diamond":
      return <path d="M50 24 76 50 50 76 24 50z" fill={PALETTE.ink} />;
    case "pill":
      return <rect x={26} y={41} width={48} height={18} rx={9} fill={PALETTE.ink} />;
    case "ring":
      return <circle cx={50} cy={50} r={17} fill="none" stroke={PALETTE.sun} strokeWidth={7} />;
    case "square":
      return <rect x={32} y={32} width={36} height={36} fill={PALETTE.pink} />;
    case "dome":
      return <path d="M28 62a22 22 0 0 1 44 0z" fill={PALETTE.sun} />;
    case "dot":
      return <circle cx={50} cy={50} r={20} fill={PALETTE.ink} />;
    case "waves":
      return (
        <>
          {[38, 52, 66].map((y, index) => (
            <path
              key={y}
              d={`M10 ${y} q10 -8 20 0 t20 0 t20 0 t20 0`}
              fill="none"
              stroke={[PALETTE.lime, PALETTE.pink, PALETTE.sun][index]}
              strokeWidth={4}
              strokeLinecap="round"
            />
          ))}
        </>
      );
  }
}

export default function Artwork({
  variant,
  className = "",
  label,
}: {
  variant: ArtVariant;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={`block h-full w-full ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width={100} height={100} fill={BACKGROUND[variant]} />
      <Shape variant={variant} />
    </svg>
  );
}
