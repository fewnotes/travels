(function () {
  "use strict";

  var DATA_URL = "assets/data/us-canada.geojson";
  var THEME_KEY = "visitedMap.test.theme";
  var PAGE_THEME_KEY = "visitedMap.test.pageTheme";

  // ---------------------------------------------------------------------
  // Hardcoded list of visited regions. Edit this to reflect real visits.
  // Ids follow the pattern "US-<State-Name>" / "CA-<Province-Name>" with
  // spaces replaced by hyphens (see assets/data/us-canada.geojson).
  // ---------------------------------------------------------------------
  var VISITED_IDS = [
    "US-California",
    "US-Texas",
    "US-Washington",
    "US-New-York",
    "CA-Quebec",
    "CA-Ontario"
  ];

  // Postal / ISO-3166-2 style short codes shown as labels on the map.
  var REGION_CODES = {
    "US-Alabama": "AL", "US-Arizona": "AZ", "US-Arkansas": "AR", "US-California": "CA",
    "US-Colorado": "CO", "US-Connecticut": "CT", "US-Delaware": "DE",
    "US-District-of-Columbia": "DC", "US-Florida": "FL", "US-Georgia": "GA",
    "US-Idaho": "ID", "US-Illinois": "IL", "US-Indiana": "IN", "US-Iowa": "IA",
    "US-Kansas": "KS", "US-Kentucky": "KY", "US-Louisiana": "LA", "US-Maine": "ME",
    "US-Maryland": "MD", "US-Massachusetts": "MA", "US-Michigan": "MI",
    "US-Minnesota": "MN", "US-Mississippi": "MS", "US-Missouri": "MO",
    "US-Montana": "MT", "US-Nebraska": "NE", "US-Nevada": "NV",
    "US-New-Hampshire": "NH", "US-New-Jersey": "NJ", "US-New-Mexico": "NM",
    "US-New-York": "NY", "US-North-Carolina": "NC", "US-North-Dakota": "ND",
    "US-Ohio": "OH", "US-Oklahoma": "OK", "US-Oregon": "OR",
    "US-Pennsylvania": "PA", "US-Rhode-Island": "RI", "US-South-Carolina": "SC",
    "US-South-Dakota": "SD", "US-Tennessee": "TN", "US-Texas": "TX", "US-Utah": "UT",
    "US-Vermont": "VT", "US-Virginia": "VA", "US-Washington": "WA",
    "US-West-Virginia": "WV", "US-Wisconsin": "WI", "US-Wyoming": "WY",
    "US-Alaska": "AK", "US-Hawaii": "HI",
    "CA-Alberta": "AB", "CA-British-Columbia": "BC", "CA-Manitoba": "MB",
    "CA-New-Brunswick": "NB", "CA-Newfoundland-and-Labrador": "NL",
    "CA-Northwest-Territories": "NT", "CA-Nova-Scotia": "NS", "CA-Nunavut": "NU",
    "CA-Ontario": "ON", "CA-Prince-Edward-Island": "PE", "CA-Quebec": "QC",
    "CA-Saskatchewan": "SK", "CA-Yukon-Territory": "YT"
  };

  var THEMES = [
    { id: "ocean", name: "Ocean", visited: "#1f6f8b", stroke: "#155466" },
    { id: "sunset", name: "Sunset", visited: "#e0793c", stroke: "#a85526" },
    { id: "forest", name: "Forest", visited: "#4c8c4a", stroke: "#33612f" },
    { id: "berry", name: "Berry", visited: "#9c3f6c", stroke: "#6f2a4c" },
    { id: "mono", name: "Monochrome", visited: "#333333", stroke: "#111111" }
  ];

  var visited = new Set(VISITED_IDS);
  var currentTheme = loadTheme();
  var selectedId = null;

  var themeSelect = document.getElementById("theme-select");
  var statCount = document.getElementById("stat-count");
  var tooltip = document.getElementById("tooltip");
  var svg = d3.select("#map");
  var mapWrap = document.getElementById("map-wrap");
  var themeLightBtn = document.getElementById("theme-light-btn");
  var themeDarkBtn = document.getElementById("theme-dark-btn");
  var totalByCountry = { US: 0, CA: 0 };

  populateThemeSelect();
  themeSelect.value = currentTheme;

  themeSelect.addEventListener("change", function () {
    currentTheme = themeSelect.value;
    saveTheme(currentTheme);
    applyColors();
  });

  updatePageThemeBtns();
  themeLightBtn.addEventListener("click", function () { setPageTheme("light"); });
  themeDarkBtn.addEventListener("click", function () { setPageTheme("dark"); });

  d3.json(DATA_URL).then(function (geo) {
    var mainWidth = 960;
    var leftPad = 130; // strip on the left for the Alaska/Hawaii insets
    var width = mainWidth + leftPad;
    var mainHeight = 600;
    var topPad = 140; // extra room so northern Canada (Nunavut's Arctic islands) isn't clipped
    var height = topPad + mainHeight;
    svg.attr("viewBox", "0 0 " + width + " " + height);

    // Mainland projection covers the lower 48 US states, DC, and Canada.
    var mainProjection = d3.geoAlbers()
      .rotate([96, 0])
      .center([0, 45])
      .parallels([40, 55])
      .scale(700)
      .translate([leftPad + mainWidth / 2, topPad + mainHeight / 2]);

    // Alaska and Hawaii are geographically distant, so they get their own
    // small inset projections (same rotate/parallels d3.geoAlbersUsa uses),
    // stacked in the left margin close to the mainland: Alaska roughly
    // level with the Pacific Northwest/Yukon, Hawaii below it.
    var akProjection = d3.geoConicEqualArea()
      .rotate([154, 0])
      .center([-2, 58.5])
      .parallels([55, 65])
      .scale(210)
      .translate([69, topPad + 280]);

    var hiProjection = d3.geoConicEqualArea()
      .rotate([157, 0])
      .center([-3, 19.9])
      .parallels([8, 18])
      .scale(480)
      .translate([69, topPad + 410]);

    var mainPath = d3.geoPath().projection(mainProjection);
    var akPath = d3.geoPath().projection(akProjection);
    var hiPath = d3.geoPath().projection(hiProjection);

    function pathFor(d) {
      if (d.id === "US-Alaska") return akPath;
      if (d.id === "US-Hawaii") return hiPath;
      return mainPath;
    }

    geo.features.forEach(function (d) {
      totalByCountry[d.properties.country] = (totalByCountry[d.properties.country] || 0) + 1;
    });

    var regions = svg.append("g").attr("class", "regions");

    regions.selectAll("path")
      .data(geo.features)
      .enter()
      .append("path")
      .attr("class", "state-path")
      .attr("id", function (d) { return "region-" + d.id; })
      .attr("d", function (d) { return pathFor(d)(d); })
      .on("click", function (event, d) {
        onRegionClick(d);
      })
      .on("mousemove", function (event, d) {
        showTooltip(event, d);
      })
      .on("mouseleave", hideTooltip);

    var labels = svg.append("g").attr("class", "labels");

    labels.selectAll("text")
      .data(geo.features)
      .enter()
      .append("text")
      .attr("class", "region-label")
      .attr("transform", function (d) {
        var c = pathFor(d).centroid(d);
        return "translate(" + c[0] + "," + c[1] + ")";
      })
      .text(function (d) { return REGION_CODES[d.id] || ""; });

    applyColors();
    updateStat();
  }).catch(function (err) {
    console.error("Failed to load map data:", err);
    mapWrap.innerHTML = "<p style='text-align:center;color:#a33;'>Could not load map data.</p>";
  });

  function onRegionClick(d) {
    setSelected(selectedId === d.id ? null : d.id);
    // TODO: once selected, open a popup showing photos for this region
    // (d.properties.name / d.id) instead of just highlighting it.
  }

  function setSelected(id) {
    selectedId = id;
    svg.selectAll(".state-path").classed("selected", function (d) {
      return d.id === selectedId;
    });
  }

  function applyColors() {
    var theme = THEMES.find(function (t) { return t.id === currentTheme; }) || THEMES[0];
    svg.selectAll(".state-path").each(function (d) {
      var isVisited = visited.has(d.id);
      d3.select(this)
        .style("fill", isVisited ? theme.visited : null)
        .style("stroke", isVisited ? theme.stroke : null);
    });
  }

  function updateStat() {
    var visitedUS = 0, visitedCA = 0;
    visited.forEach(function (id) {
      if (id.indexOf("US-") === 0) visitedUS++;
      else if (id.indexOf("CA-") === 0) visitedCA++;
    });
    statCount.textContent =
      "US: " + visitedUS + "/" + totalByCountry.US + " (50 states + DC)" +
      " | Canada: " + visitedCA + "/" + totalByCountry.CA;
  }

  function showTooltip(event, d) {
    var rect = mapWrap.getBoundingClientRect();
    tooltip.hidden = false;
    tooltip.textContent = d.properties.name + (visited.has(d.id) ? " ✓" : "");
    tooltip.style.left = (event.clientX - rect.left) + "px";
    tooltip.style.top = (event.clientY - rect.top) + "px";
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function populateThemeSelect() {
    THEMES.forEach(function (t) {
      var opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      themeSelect.appendChild(opt);
    });
  }

  function loadTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || THEMES[0].id;
    } catch (e) {
      return THEMES[0].id;
    }
  }

  function saveTheme(id) {
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch (e) { /* storage unavailable */ }
  }

  function setPageTheme(value) {
    document.documentElement.setAttribute("data-theme", value);
    savePageTheme(value);
    updatePageThemeBtns();
  }

  function updatePageThemeBtns() {
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    themeLightBtn.classList.toggle("active", isLight);
    themeLightBtn.setAttribute("aria-pressed", String(isLight));
    themeDarkBtn.classList.toggle("active", !isLight);
    themeDarkBtn.setAttribute("aria-pressed", String(!isLight));
  }

  function savePageTheme(value) {
    try {
      localStorage.setItem(PAGE_THEME_KEY, value);
    } catch (e) { /* storage unavailable */ }
  }
})();
