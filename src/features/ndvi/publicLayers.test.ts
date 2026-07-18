import { describe, expect, it } from "vitest";
import {
  latestStablePublicDate,
  nasaGibsTileUrl,
  NASA_NDVI_LAYER,
} from "./publicLayers";

describe("camadas públicas NDVI", () => {
  it("monta a URL WMTS temporal da NASA GIBS", () => {
    expect(nasaGibsTileUrl(NASA_NDVI_LAYER, "2026-07-17")).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/2026-07-17/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
    );
  });

  it("evita pedir o dia corrente, que pode estar incompleto", () => {
    expect(latestStablePublicDate("2026-07-18", "2026-07-18")).toBe("2026-07-17");
    expect(latestStablePublicDate("2026-07-18", "2026-06-30")).toBe("2026-06-30");
  });
});
