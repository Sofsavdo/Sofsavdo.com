import { ImageResponse } from "next/og";

// No logo asset exists anywhere in this repo (no public/ directory at all before this file) — this
// generates a plain brand-colored monogram rather than fabricating a fake logo image. Swap for a
// real designed logo file whenever one exists; this only prevents a blank/browser-default tab icon.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e53935",
          color: "#ffffff",
          fontSize: 40,
          fontWeight: 700,
          fontFamily: "sans-serif",
          borderRadius: 12,
        }}
      >
        S
      </div>
    ),
    { ...size },
  );
}
