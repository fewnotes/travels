(function () {
  "use strict";

  var DATA_URL = "assets/data/us-canada.geojson";
  var STORAGE_KEY = "visitedMap.test.visited";
  var THEME_KEY = "visitedMap.test.theme";

  var THEMES = [
    { id: "ocean", name: "Ocean", visited: "#1f6f8b", stroke: "#155466" },
    { id: "sunset", name: "Sunset", visited: "#e0793c", stroke: "#a85526" },
    { id: "forest", name: "Forest", visited: "#4c8c4a", stroke: "#33612f" },
    { id: "berry", name: "Berry", visited: "#9c3f6c", stroke: "#6f2a4c" },
    { id: "mono", name: "Monochrome", visited: "#333333", stroke: "#111111" }
  ];

  var visited = loadVisited();
  var currentTheme = loadTheme();

  var themeSelect = document.getElementById("theme-select");
  var statCount = document.getElementById("stat-count");
  var resetBtn = document.getElementById("reset-btn");
  var tooltip = document.getElementById("tooltip");
  var svg = d3.select("#map");
  var mapWrap = document.getElementById("map-wrap");

  populateThemeSelect();
  themeSelect.value = currentTheme;

  themeSelect.addEventListener("change", function () {
    currentTheme = themeSelect.value;
    saveTheme(currentTheme);
    applyColors();
  });

  resetBtn.addEventListener("click", function () {
    if (!confirm("Clear all visited regions?")) return;
    visited.clear();
    saveVisited();
    applyColors();
    updateStat();
  });

  d3.json(DATA_URL).then(function (geo) {
    var width = 960;
    var height = 600;
    svg.attr("viewBox", "0 0 " + width + " " + height);

    var projection = d3.geoAlbers()
      .rotate([96, 0])
      .center([0, 45])
      .parallels([40, 55])
      .scale(700)
      .translate([width / 2, height / 2]);

    var path = d3.geoPath().projection(projection);

    svg.selectAll("path")
      .data(geo.features)
      .enter()
      .append("path")
      .attr("class", "state-path")
      .attr("id", function (d) { return "region-" + d.id; })
      .attr("d", path)
      .on("click", function (event, d) {
        toggleVisited(d.id);
      })
      .on("mousemove", function (event, d) {
        showTooltip(event, d);
      })
      .on("mouseleave", hideTooltip);

    applyColors();
    updateStat();
  }).catch(function (err) {
    console.error("Failed to load map data:", err);
    mapWrap.innerHTML = "<p style='text-align:center;color:#a33;'>Could not load map data.</p>";
  });

  function toggleVisited(id) {
    if (visited.has(id)) {
      visited.delete(id);
    } else {
      visited.add(id);
    }
    saveVisited();
    applyColors();
    updateStat();
  }

  function applyColors() {
    var theme = THEMES.find(function (t) { return t.id === currentTheme; }) || THEMES[0];
    svg.selectAll("path").each(function (d) {
      var isVisited = visited.has(d.id);
      d3.select(this)
        .style("fill", isVisited ? theme.visited : null)
        .style("stroke", isVisited ? theme.stroke : null);
    });
  }

  function updateStat() {
    statCount.textContent = visited.size + " of 62 regions visited";
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

  function loadVisited() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function saveVisited() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visited)));
    } catch (e) { /* storage unavailable */ }
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
})();
