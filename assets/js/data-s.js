// ---------------------------------------------------------------------
// Hardcoded list of visited/bucket-list regions for this person. Edit
// these to reflect real visits. State/province ids follow
// "US-<Name>" / "CA-<Name>" (see assets/data/us-canada.geojson);
// country ids are ISO 3166-1 alpha-2 codes (see
// assets/data/world-countries.geojson). A region listed in both wins
// as "visited".
// ---------------------------------------------------------------------
var STATE_VISITED_IDS = [
  "US-Washington",
  "US-Oregon",
  "US-California",
  "US-Nevada",
  "US-New-York",
  "US-New-Jersey",
  "CA-British-Columbia",
  "CA-Yukon-Territory",
  "CA-Alberta",
  "CA-Ontario"
];

var WORLD_VISITED_IDS = [
  "CA",
  "US",
  "MX",
  "FR",
  "NO",
  "IT",
  "CH",
  "IR",
  "IQ",
  "SY",
  "AE",
  "TR",
  "TH",
  "UK"
];

var STATE_BUCKET_LIST_IDS = [
  "US-Alaska",
  "CA-Northwest-Territories",
  "CA-Manitoba",
  "CA-Newfoundland-and-Labrador"
];

var WORLD_BUCKET_LIST_IDS = ["GR", "VN", "KR"];
