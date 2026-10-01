import { ImageResponse } from "next/og";

const SIZES: Record<string, { size: number; padding: number }> = {
  "192": { size: 192, padding: 0 },
  "512": { size: 512, padding: 0 },
  maskable: { size: 512, padding: 96 },
  apple: { size: 180, padding: 0 },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((variant) => ({ variant }));
}

export async function GET(_request: Request, ctx: RouteContext<"/icons/[variant]">) {
  const { variant } = await ctx.params;
  const spec = SIZES[variant];
  if (!spec) return new Response("Not found", { status: 404 });
  const { size, padding } = spec;
  const inner = size - padding * 2;
  const radius = padding > 0 ? 0 : Math.round(size * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2a78d6",
          borderRadius: radius,
        }}
      >
        <svg width={inner * 0.62} height={inner * 0.62} viewBox="0 0 24 24" fill="none">
          <rect x="2.5" y="5" width="19" height="14" rx="3" stroke="white" strokeWidth="1.8" />
          <path d="M2.5 9.5h19" stroke="white" strokeWidth="1.8" />
          <path d="M6.5 15h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16.5" cy="14.8" r="1.6" fill="white" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
