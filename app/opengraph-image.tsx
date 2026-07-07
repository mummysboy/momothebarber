import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Momo The Barber — Hair Cut and Shave, San Francisco";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori can't do mix-blend-multiply, so the card is white to blend with the
// logo JPEG's white background; the deco border keeps it on-brand.
const NAVY = "#263248";

async function interBlack(): Promise<ArrayBuffer | null> {
  try {
    // Plain fetch (no browser UA) makes Google Fonts return TTF, which Satori accepts.
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Inter:wght@900",
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OgImage() {
  const [logo, font] = await Promise.all([
    readFile(join(process.cwd(), "public/logo-mark.jpg")),
    interBlack(),
  ]);
  const logoSrc = `data:image/jpeg;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#ffffff",
          padding: 28,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `3px solid ${NAVY}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={210} height={167} alt="" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 8,
              color: NAVY,
            }}
          >
            <div style={{ width: 70, height: 2, background: NAVY }} />
            <div style={{ fontSize: 22 }}>★</div>
            <div style={{ width: 70, height: 2, background: NAVY }} />
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 84,
              fontWeight: 900,
              color: NAVY,
              letterSpacing: 4,
            }}
          >
            MOMO THE BARBER
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 30,
              color: NAVY,
              letterSpacing: 16,
            }}
          >
            HAIR CUT AND SHAVE
          </div>
          <div
            style={{
              marginTop: 34,
              fontSize: 24,
              color: "#6b6459",
              letterSpacing: 2,
            }}
          >
            110 Sutter St, San Francisco · momothebarber.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Inter", data: font, weight: 900 as const, style: "normal" as const }]
        : undefined,
    },
  );
}
