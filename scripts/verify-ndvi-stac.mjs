/* global process, fetch, console */

const endpoint =
  process.env.NDVI_STAC_URL || "https://stac.dataspace.copernicus.eu/v1";

const response = await fetch(`${endpoint.replace(/\/$/, "")}/search`, {
  method: "POST",
  headers: {
    Accept: "application/geo+json, application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    collections: ["sentinel-2-l2a"],
    intersects: {
      type: "Polygon",
      coordinates: [[
        [-47.01, -18.95],
        [-46.98, -18.95],
        [-46.98, -18.92],
        [-47.01, -18.92],
        [-47.01, -18.95],
      ]],
    },
    datetime: "2026-04-01T00:00:00Z/2026-07-18T23:59:59Z",
    limit: 5,
    query: { "eo:cloud_cover": { lte: 80 } },
  }),
});

if (!response.ok) {
  throw new Error(`Copernicus STAC respondeu ${response.status}: ${await response.text()}`);
}

const payload = await response.json();
if (!Array.isArray(payload.features) || payload.features.length === 0) {
  throw new Error("Nenhuma cena real retornada para a área de verificação.");
}

const first = payload.features[0];
if (!first.id || !first.properties?.datetime) {
  throw new Error("A cena retornada não possui id e data válidos.");
}

console.log(
  JSON.stringify({
    source: endpoint,
    collection: first.collection,
    item: first.id,
    datetime: first.properties.datetime,
    cloudCover: first.properties["eo:cloud_cover"],
    returned: payload.features.length,
  }, null, 2),
);
