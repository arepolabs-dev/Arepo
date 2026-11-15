import { ImageResponse } from "next/og";

export const alt = "Arepo Labs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#F7F6F4",
          color: "#101010",
        }}
      >
        <div style={{ fontSize: 40, color: "#E50C0E" }}>Arepo Labs</div>
        <div style={{ fontSize: 76, marginTop: 24, lineHeight: 1.1 }}>
          Practical automation for local businesses.
        </div>
      </div>
    ),
    size,
  );
}
