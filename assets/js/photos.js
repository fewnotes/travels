(function (global) {
  "use strict";

  var DRIVE_ROOT_NAME = "travels-map";
  var PAGE_KEY = "p";

  var _modal = null;
  var _currentRegionId = null;
  var _driveFolderCache = {};

  // ── Modal UI ──────────────────────────────────────────────────────────────

  function _buildModal() {
    if (_modal) return;
    var overlay = document.createElement("div");
    overlay.id = "photo-modal-overlay";
    overlay.innerHTML = [
      '<div id="photo-modal">',
      '  <div id="photo-modal-header">',
      '    <span id="photo-modal-title"></span>',
      '    <button id="photo-modal-close" aria-label="Close">&times;</button>',
      '  </div>',
      '  <div id="photo-modal-body"></div>',
      '</div>'
    ].join("");
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    document.getElementById("photo-modal-close").addEventListener("click", closeModal);
    _modal = {
      overlay: overlay,
      title: document.getElementById("photo-modal-title"),
      body: document.getElementById("photo-modal-body")
    };
  }

  function closeModal() { if (_modal) _modal.overlay.style.display = "none"; }

  function _showModal(regionName, content) {
    _buildModal();
    _modal.title.textContent = regionName;
    _modal.body.innerHTML = content;
    _modal.overlay.style.display = "flex";
  }

  function _showLoginPrompt(regionName) {
    _showModal(regionName,
      '<div class="photo-login-prompt"><p>Sign in using the button in the header to see photos.</p></div>'
    );
  }

  function _showLoading(regionName) {
    _showModal(regionName, '<div class="photo-loading">Loading photos…</div>');
  }

  function _showPhotos(regionName, files, token) {
    if (!files.length) {
      _showModal(regionName, '<div class="photo-empty">No photos for this region yet.</div>');
      return;
    }
    var strip = document.createElement("div");
    strip.className = "photo-strip";
    _showModal(regionName, "");
    _modal.body.appendChild(strip);

    files.forEach(function (f) {
      var img = document.createElement("img");
      img.className = "photo-strip-img";
      img.alt = regionName;
      img.loading = "lazy";
      strip.appendChild(img);
      fetch(f.downloadUrl, { headers: { Authorization: "Bearer " + token } })
        .then(function (r) { return r.blob(); })
        .then(function (blob) { img.src = URL.createObjectURL(blob); })
        .catch(function () { img.alt = "Could not load photo"; });
    });
  }

  // ── Google Drive API ──────────────────────────────────────────────────────

  function _driveQuery(q, token, cb) {
    var url = "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
      "&fields=files(id,name,mimeType)&pageSize=50";
    fetch(url, { headers: { Authorization: "Bearer " + token } })
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(null, data.files || []); })
      .catch(function (e) { cb(e); });
  }

  function _findGooglePhotos(regionId, token, cb) {
    var cacheKey = "g:" + regionId;
    if (_driveFolderCache[cacheKey]) { cb(null, _driveFolderCache[cacheKey]); return; }

    _driveQuery("name='" + DRIVE_ROOT_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false", token, function (err, roots) {
      if (err || !roots.length) { cb(null, []); return; }
      _driveQuery("name='" + PAGE_KEY + "' and '" + roots[0].id + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false", token, function (err, pages) {
        if (err || !pages.length) { cb(null, []); return; }
        _driveQuery("name='" + regionId + "' and '" + pages[0].id + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false", token, function (err, regions) {
          if (err || !regions.length) { cb(null, []); return; }
          _driveQuery("'" + regions[0].id + "' in parents and mimeType contains 'image/' and trashed=false", token, function (err, files) {
            if (err) { cb(null, []); return; }
            var mapped = files.map(function (f) {
              return { id: f.id, name: f.name, downloadUrl: "https://www.googleapis.com/drive/v3/files/" + f.id + "?alt=media" };
            });
            _driveFolderCache[cacheKey] = mapped;
            cb(null, mapped);
          });
        });
      });
    });
  }

  // ── OneDrive (Microsoft Graph) API ────────────────────────────────────────

  function _graphGet(path, token, cb) {
    fetch("https://graph.microsoft.com/v1.0" + path, {
      headers: { Authorization: "Bearer " + token }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(null, data); })
      .catch(function (e) { cb(e); });
  }

  function _findOneDrivePhotos(regionId, token, cb) {
    var cacheKey = "ms:" + regionId;
    if (_driveFolderCache[cacheKey]) { cb(null, _driveFolderCache[cacheKey]); return; }

    var folderPath = "/" + DRIVE_ROOT_NAME + "/" + PAGE_KEY + "/" + regionId;
    _graphGet("/me/drive/root:/" + encodeURIComponent(DRIVE_ROOT_NAME) + "/" + PAGE_KEY + "/" + regionId + ":/children?$filter=file ne null&$select=id,name,file", token, function (err, data) {
      if (err || !data.value) { cb(null, []); return; }
      var images = (data.value || []).filter(function (f) {
        return f.file && f.file.mimeType && f.file.mimeType.indexOf("image/") === 0;
      });
      var mapped = images.map(function (f) {
        return { id: f.id, name: f.name, downloadUrl: "https://graph.microsoft.com/v1.0/me/drive/items/" + f.id + "/content" };
      });
      _driveFolderCache[cacheKey] = mapped;
      cb(null, mapped);
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────

  function openPhotoModal(regionName, regionId) {
    _currentRegionId = regionId;
    var token = TravelsAuth.getToken();
    var provider = TravelsAuth.getProvider();

    if (!token) { _showLoginPrompt(regionName); return; }

    _showLoading(regionName);

    var fetchFn = provider === "microsoft" ? _findOneDrivePhotos : _findGooglePhotos;
    fetchFn(regionId, token, function (err, files) {
      _showPhotos(regionName, files || [], token);
    });
  }

  global.TravelsPhotos = { openPhotoModal: openPhotoModal, closeModal: closeModal };

}(window));
