// ---------------------------------------------------------------------
// Hardcoded list of visited/bucket-list regions for this person. Edit
// these to reflect real visits. State/province ids follow
// "US-<Name>" / "CA-<Name>" (see assets/data/us-canada.geojson);
// country ids are ISO 3166-1 alpha-2 codes (see
// assets/data/world-countries.geojson). A region listed in both wins
// as "visited".
// ---------------------------------------------------------------------
var STATE_VISITED_IDS = [
  "US-Hawaii",
  "US-Washington",
  "US-Oregon",
  "US-California",
  "US-Nevada",
  "US-Wyoming",
  "US-Montana",
  "US-Idaho",
  "US-Arizona",
  "US-Utah",
  "US-New-York",
  "US-Florida",
  "CA-British-Columbia"
];

var WORLD_VISITED_IDS = ["US", "CA", "IN", "JP"];

var STATE_BUCKET_LIST_IDS = ["US-Illinois"];

var WORLD_BUCKET_LIST_IDS = ["IT", "CN"];
