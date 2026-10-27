const FIXED: Record<string, string> = {
  lina: "bg-lime text-ink",
  karim: "bg-pink text-ink",
  ines: "bg-sun text-ink",
  sam: "bg-dusk text-fg",
  noah: "bg-lime text-ink",
};

const ROTATION = ["bg-lime text-ink", "bg-pink text-ink", "bg-sun text-ink"];

function colorsFor(seed: string) {
  if (FIXED[seed]) return FIXED[seed];
  const sum = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ROTATION[sum % ROTATION.length];
}

export default function Avatar({
  name,
  seed = name,
  size = 40,
  ring,
}: {
  name: string;
  seed?: string;
  size?: number;
  ring?: "pink" | "line";
}) {
  const circle = (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-display font-bold ${colorsFor(seed)}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
  if (!ring) return circle;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border-2 p-[3px] ${ring === "pink" ? "border-pink" : "border-line"}`}
    >
      {circle}
    </span>
  );
}
