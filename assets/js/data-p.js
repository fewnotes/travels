// ---------------------------------------------------------------------
// Hardcoded list of visited/bucket-list regions for this person. Edit
// these to reflect real visits. State/province ids follow
// "US-<Name>" / "CA-<Name>" (see assets/data/us-canada.geojson);
// country ids are ISO 3166-1 alpha-2 codes (see
// assets/data/world-countries.geojson). A region listed in both wins
// as "visited".
// ---------------------------------------------------------------------
var STATE_VISITED_IDS = [
  "US-California",
  "US-Texas",
  "US-Washington",
  "US-New-York",
  "CA-Quebec",
  "CA-Ontario"
];

var WORLD_VISITED_IDS = ["US", "CA", "FR", "JP", "IN"];

var STATE_BUCKET_LIST_IDS = [
  "US-Alaska",
  "US-Montana",
  "CA-British-Columbia"
];

var WORLD_BUCKET_LIST_IDS = ["NZ", "IS", "AU", "PE"];
