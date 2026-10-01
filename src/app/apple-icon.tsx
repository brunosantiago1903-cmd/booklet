import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2a78d6",
        }}
      >
        <svg width={112} height={112} viewBox="0 0 24 24" fill="none">
          <rect x="2.5" y="5" width="19" height="14" rx="3" stroke="white" strokeWidth="1.8" />
          <path d="M2.5 9.5h19" stroke="white" strokeWidth="1.8" />
          <path d="M6.5 15h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16.5" cy="14.8" r="1.6" fill="white" />
        </svg>
      </div>
    ),
    size,
  );
}
