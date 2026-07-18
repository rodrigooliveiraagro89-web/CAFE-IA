export const NASA_NDVI_LAYER = "MODIS_Terra_NDVI_8Day";
export const NASA_TRUE_COLOR_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
export const NASA_GIBS_ATTRIBUTION =
  '&copy; <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>';

export function nasaGibsTileUrl(layer: string, date: string) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;
}

export function latestStablePublicDate(today: string, requestedDate: string) {
  const latest = new Date(`${today}T12:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() - 1);
  const stableDate = latest.toISOString().slice(0, 10);
  return requestedDate > stableDate ? stableDate : requestedDate;
}
