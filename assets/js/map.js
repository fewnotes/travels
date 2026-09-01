(function () {
  "use strict";

  var THEME_KEY = "visitedMap.test.theme";
  var PAGE_THEME_KEY = "visitedMap.test.pageTheme";

  var THEMES = [
    { id: "ocean", name: "Ocean", visited: "#1f6f8b", stroke: "#155466" },
    { id: "sunset", name: "Sunset", visited: "#e0793c", stroke: "#a85526" },
    { id: "forest", name: "Forest", visited: "#4c8c4a", stroke: "#33612f" },
    { id: "berry", name: "Berry", visited: "#9c3f6c", stroke: "#6f2a4c" },
    { id: "mono", name: "Monochrome", visited: "#333333", stroke: "#111111" }
  ];

  // ---------------------------------------------------------------------
  // Hardcoded list of visited regions per view. Edit these to reflect
  // real visits. State/province ids follow "US-<Name>" / "CA-<Name>"
  // (see assets/data/us-canada.geojson); country ids are ISO 3166-1
  // alpha-2 codes (see assets/data/world-countries.geojson).
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

  // Postal / ISO-3166-2 style short codes shown as labels on the state map.
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

  // ---------------------------------------------------------------------
  // View definitions. Each view owns its own data, visited set, and
  // projection setup; switching views clears and redraws the SVG.
  // ---------------------------------------------------------------------
  var views = {
    state: {
      key: "state",
      label: "States & Provinces",
      dataUrl: "assets/data/us-canada.geojson",
      visited: new Set(STATE_VISITED_IDS),
      selectedId: null,
      geo: null,
      hasLabels: true,
      regionCodeFor: function (d) { return REGION_CODES[d.id] || ""; },
      setupProjection: function (svgSel, geo) {
        var mainWidth = 960;
        var leftPad = 130; // strip on the left for the Alaska/Hawaii insets
        var width = mainWidth + leftPad;
        var mainHeight = 600;
        var topPad = 140; // room so northern Canada (Nunavut's Arctic islands) isn't clipped
        var height = topPad + mainHeight;
        svgSel.attr("viewBox", "0 0 " + width + " " + height);

        // Mainland projection covers the lower 48 US states, DC, and Canada.
        var mainProjection = d3.geoAlbers()
          .rotate([96, 0])
          .center([0, 45])
          .parallels([40, 55])
          .scale(700)
          .translate([leftPad + mainWidth / 2, topPad + mainHeight / 2]);

        // Alaska and Hawaii are geographically distant, so they get their
        // own small inset projections (same rotate/parallels
        // d3.geoAlbersUsa uses), stacked in the left margin close to the
        // mainland: Alaska roughly level with the Pacific Northwest/Yukon,
        // Hawaii below it.
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

        return function pickPath(d) {
          if (d.id === "US-Alaska") return akPath;
          if (d.id === "US-Hawaii") return hiPath;
          return mainPath;
        };
      },
      stat: function (geo) {
        var totalByCountry = { US: 0, CA: 0 };
        geo.features.forEach(function (d) {
          totalByCountry[d.properties.country] = (totalByCountry[d.properties.country] || 0) + 1;
        });
        var visitedUS = 0, visitedCA = 0;
        views.state.visited.forEach(function (id) {
          if (id.indexOf("US-") === 0) visitedUS++;
          else if (id.indexOf("CA-") === 0) visitedCA++;
        });
        return "US: " + visitedUS + "/" + totalByCountry.US + " (50 states + DC)" +
          " | Canada: " + visitedCA + "/" + totalByCountry.CA;
      }
    },
    world: {
      key: "world",
      label: "Countries",
      dataUrl: "assets/data/world-countries.geojson",
      visited: new Set(WORLD_VISITED_IDS),
      selectedId: null,
      geo: null,
      hasLabels: false,
      regionCodeFor: function () { return ""; },
      setupProjection: function (svgSel, geo) {
        var width = 960;
        var height = 500;
        var pad = 24; // visible margin so nothing sits flush against the edge
        svgSel.attr("viewBox", "0 0 " + width + " " + height);

        var projection = d3.geoNaturalEarth1()
          .fitExtent([[pad, pad], [width - pad, height - pad]], geo);
        var path = d3.geoPath().projection(projection);

        return function pickPath() { return path; };
      },
      stat: function (geo) {
        return views.world.visited.size + " of " + geo.features.length + " countries visited";
      }
    }
  };

  var currentViewKey = "world";
  var currentTheme = loadTheme();

  var themeSelect = document.getElementById("theme-select");
  var statCount = document.getElementById("stat-count");
  var tooltip = document.getElementById("tooltip");
  var svg = d3.select("#map");
  var mapWrap = document.getElementById("map-wrap");
  var themeLightBtn = document.getElementById("theme-light-btn");
  var themeDarkBtn = document.getElementById("theme-dark-btn");
  var viewStateBtn = document.getElementById("view-state-btn");
  var viewWorldBtn = document.getElementById("view-world-btn");
  var subtitle = document.getElementById("subtitle");
  var SUBTITLES = {
    state: "US States & Canadian Provinces/Territories",
    world: "Countries of the World"
  };

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

  updateViewBtns();
  viewStateBtn.addEventListener("click", function () { switchView("state"); });
  viewWorldBtn.addEventListener("click", function () { switchView("world"); });

  loadAndRender(views[currentViewKey]);

  function switchView(key) {
    if (key === currentViewKey) return;
    currentViewKey = key;
    updateViewBtns();
    loadAndRender(views[currentViewKey]);
  }

  function loadAndRender(view) {
    hideTooltip();
    mapWrap.classList.add("loading");
    if (view.geo) {
      renderView(view, view.geo);
      return;
    }
    d3.json(view.dataUrl).then(function (geo) {
      view.geo = geo;
      renderView(view, geo);
    }).catch(function (err) {
      console.error("Failed to load map data:", err);
      mapWrap.innerHTML = "<p style='text-align:center;color:#a33;'>Could not load map data.</p>";
    });
  }

  function renderView(view, geo) {
    svg.selectAll("*").remove();
    mapWrap.classList.remove("loading");

    var pickPath = view.setupProjection(svg, geo);

    var regions = svg.append("g").attr("class", "regions");

    regions.selectAll("path")
      .data(geo.features)
      .enter()
      .append("path")
      .attr("class", "state-path")
      .attr("id", function (d) { return "region-" + d.id; })
      .attr("d", function (d) { return pickPath(d)(d); })
      .on("click", function (event, d) { onRegionClick(view, d); })
      .on("mousemove", function (event, d) { showTooltip(view, event, d); })
      .on("mouseleave", hideTooltip);

    if (view.hasLabels) {
      var labels = svg.append("g").attr("class", "labels");
      labels.selectAll("text")
        .data(geo.features)
        .enter()
        .append("text")
        .attr("class", "region-label")
        .attr("transform", function (d) {
          var c = pickPath(d).centroid(d);
          return "translate(" + c[0] + "," + c[1] + ")";
        })
        .text(function (d) { return view.regionCodeFor(d); });
    }

    applyColors();
    updateStat();
  }

  function onRegionClick(view, d) {
    view.selectedId = view.selectedId === d.id ? null : d.id;
    svg.selectAll(".state-path").classed("selected", function (dd) {
      return dd.id === view.selectedId;
    });
    // TODO: once selected, open a popup showing photos for this region
    // (d.properties.name / d.id) instead of just highlighting it.
  }

  function applyColors() {
    var view = views[currentViewKey];
    var theme = THEMES.find(function (t) { return t.id === currentTheme; }) || THEMES[0];
    svg.selectAll(".state-path").each(function (d) {
      var isVisited = view.visited.has(d.id);
      d3.select(this)
        .style("fill", isVisited ? theme.visited : null)
        .style("stroke", isVisited ? theme.stroke : null);
    });
  }

  function updateStat() {
    var view = views[currentViewKey];
    statCount.textContent = view.stat(view.geo);
  }

  function showTooltip(view, event, d) {
    var rect = mapWrap.getBoundingClientRect();
    tooltip.hidden = false;
    tooltip.textContent = d.properties.name + (view.visited.has(d.id) ? " ✓" : "");
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

  function updateViewBtns() {
    var isState = currentViewKey === "state";
    viewStateBtn.classList.toggle("active", isState);
    viewStateBtn.setAttribute("aria-pressed", String(isState));
    viewWorldBtn.classList.toggle("active", !isState);
    viewWorldBtn.setAttribute("aria-pressed", String(!isState));
    subtitle.textContent = SUBTITLES[currentViewKey];
  }
})();
