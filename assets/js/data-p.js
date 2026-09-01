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
  "US-New-York",
  "US-New-Jersey",
  "US-Washington",
  "US-Oregon",
  "US-California",
  "US-Nevada",
  "US-Montana",
  "US-Idaho",
  "US-Florida",
  "US-Illinois",
  "US-District-of-Columbia",
  "US-Virginia",
  "US-Utah",
  "US-Arizona",
  "US-Wyoming",
  "CA-British-Columbia",
  "CA-Yukon-Territory",
  "CA-Alberta"
];

var WORLD_VISITED_IDS = ["CA", "US", "MX", "IS", "NO", "IT", "CH", "IN", "JP"];

var STATE_BUCKET_LIST_IDS = [
  "US-Alaska",
  "US-Maine",
  "CA-Northwest-Territories",
  "CA-Nunavut",
  "CA-Newfoundland-and-Labrador",
  "CA-Nova-Scotia",
  "CA-Manitoba"
];

var WORLD_BUCKET_LIST_IDS = ["GL", "AR", "CL", "NZ", "MN"];
