#!/usr/bin/env node
// Regenerates assets/data/us-canada.geojson and assets/data/world-countries.geojson.
//
// Run from the scripts/ directory:
//   npm install
//   npm run generate
//
// Data sources:
//   - US states + DC: us-atlas (ISC, US Census Bureau) - npm package
//   - Canada provinces/territories: click_that_hood (MIT) - fetched live from GitHub
//   - World countries: world-atlas (ISC, Natural Earth) - npm package
//
// Re-run this whenever you want to pick up upstream boundary updates; the
// map itself only ever reads the committed assets/data/*.geojson files, so
// nothing updates automatically without re-running this script and
// committing the result.

const fs = require("fs");
const path = require("path");
const topojson = require("topojson-client");
const iso = require("iso-3166-1");

const OUT_DIR = path.join(__dirname, "..", "assets", "data");

const CANADA_URL =
  "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/canada.geojson";

function slug(name) {
  return name.replace(/ /g, "-");
}

async function buildUsCanada() {
  const usTopo = require("us-atlas/states-10m.json");
  const usGeo = topojson.feature(usTopo, usTopo.objects.states);

  const US_TERRITORIES = new Set([
    "American Samoa",
    "Commonwealth of the Northern Mariana Islands",
    "Guam",
    "Puerto Rico",
    "United States Virgin Islands"
  ]);

  const usFeatures = usGeo.features
    .filter((f) => !US_TERRITORIES.has(f.properties.name))
    .map((f) => ({
      type: "Feature",
      id: "US-" + slug(f.properties.name),
      properties: { name: f.properties.name, country: "US" },
      geometry: f.geometry
    }));

  console.log("US states + DC:", usFeatures.length, "(expect 51)");

  const canadaRes = await fetch(CANADA_URL);
  if (!canadaRes.ok) {
    throw new Error("Failed to fetch Canada boundaries: HTTP " + canadaRes.status);
  }
  const canadaGeo = await canadaRes.json();

  const caFeatures = canadaGeo.features.map((f) => ({
    type: "Feature",
    id: "CA-" + slug(f.properties.name),
    properties: { name: f.properties.name, country: "CA" },
    geometry: f.geometry
  }));

  console.log("Canada provinces/territories:", caFeatures.length, "(expect 13)");

  const combined = { type: "FeatureCollection", features: usFeatures.concat(caFeatures) };
  const outPath = path.join(OUT_DIR, "us-canada.geojson");
  fs.writeFileSync(outPath, JSON.stringify(combined));
  console.log("Wrote", outPath, "-", combined.features.length, "total features");
}

function buildWorld() {
  const worldTopo = require("world-atlas/countries-50m.json");
  const worldGeo = topojson.feature(worldTopo, worldTopo.objects.countries);

  // Uninhabited/disputed slivers with no meaningful "visited" status.
  const DROP = new Set(["Indian Ocean Ter.", "Siachen Glacier", "Fr. S. Antarctic Lands"]);

  // Entities without a standard ISO 3166-1 numeric code in this dataset.
  const FALLBACK_ID = {
    Kosovo: "XK",
    Somaliland: "XS",
    "N. Cyprus": "XN",
    Antarctica: "AQ"
  };

  const seen = new Set();
  const features = [];

  worldGeo.features.forEach((f) => {
    const name = f.properties.name;
    if (DROP.has(name)) return;

    const numStr = f.id === undefined || f.id === null ? null : String(f.id).padStart(3, "0");
    const info = numStr ? iso.whereNumeric(numStr) : null;
    const code = info ? info.alpha2 : FALLBACK_ID[name];

    if (!code) {
      console.log("Skipping unmapped country (no ISO code found):", name);
      return;
    }
    if (seen.has(code)) {
      console.log("Skipping duplicate code", code, "for", name);
      return;
    }
    seen.add(code);

    features.push({
      type: "Feature",
      id: code,
      properties: { name: name },
      geometry: f.geometry
    });
  });

  console.log("World countries:", features.length, "(expect ~237)");

  const combined = { type: "FeatureCollection", features };
  const outPath = path.join(OUT_DIR, "world-countries.geojson");
  fs.writeFileSync(outPath, JSON.stringify(combined));
  console.log("Wrote", outPath, "-", combined.features.length, "total features");
}

async function main() {
  await buildUsCanada();
  buildWorld();
  console.log("Done. Review the diff in assets/data/ and commit if it looks right.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
