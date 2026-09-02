(function (global) {
  "use strict";

  // Root folder name in Google Drive containing the map photo folders.
  // Structure: travels-map/p/<region-id>/photo.jpg
  var DRIVE_ROOT_NAME = "travels-map";
  var PAGE_KEY = "p"; // only p/ uses this for now

  var _modal = null;
  var _driveFolderCache = {}; // region-id → [file objects]

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

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.getElementById("photo-modal-close").addEventListener("click", closeModal);

    _modal = {
      overlay: overlay,
      title: document.getElementById("photo-modal-title"),
      body: document.getElementById("photo-modal-body")
    };
  }

  function closeModal() {
    if (_modal) _modal.overlay.style.display = "none";
  }

  function _showModal(regionName, content) {
    _buildModal();
    _modal.title.textContent = regionName;
    _modal.body.innerHTML = content;
    _modal.overlay.style.display = "flex";
  }

  function _showLoginPrompt(regionName) {
    _showModal(regionName, [
      '<div class="photo-login-prompt">',
      '  <p>Sign in to see photos for this region.</p>',
      '  <button id="photo-google-signin" class="signin-btn google-btn">',
      '    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="">',
      '    Sign in with Google',
      '  </button>',
      '</div>'
    ].join(""));

    document.getElementById("photo-google-signin").addEventListener("click", function () {
      TravelsAuth.signInWithGoogle(function (err) {
        if (!err) openPhotoModal(regionName, _currentRegionId);
      });
    });
  }

  var _currentRegionId = null;

  function _showLoading(regionName) {
    _showModal(regionName, '<div class="photo-loading">Loading photos…</div>');
  }

  function _showPhotos(regionName, files, token) {
    if (!files.length) {
      _showModal(regionName, '<div class="photo-empty">No photos for this region yet.</div>');
      return;
    }
    var imgs = files.map(function (f) {
      var src = "https://www.googleapis.com/drive/v3/files/" + f.id + "?alt=media";
      return '<img src="' + src + '" alt="' + regionName + '" data-token="' + token + '" class="photo-strip-img" loading="lazy">';
    }).join("");
    _showModal(regionName, '<div class="photo-strip">' + imgs + '</div>');

    // Inject auth header via fetch + blob URL (Drive requires Bearer token for media)
    _modal.body.querySelectorAll(".photo-strip-img").forEach(function (img) {
      var fileId = files[img.src.match(/files\/([^?]+)/)[1] ? img.src.match(/files\/([^?]+)/)[1] : 0];
      var url = img.src;
      fetch(url, { headers: { Authorization: "Bearer " + token } })
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

  function _findPhotosForRegion(regionId, token, cb) {
    if (_driveFolderCache[regionId]) { cb(null, _driveFolderCache[regionId]); return; }

    // 1. Find the root folder "travels-map"
    _driveQuery("name='" + DRIVE_ROOT_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false", token, function (err, roots) {
      if (err || !roots.length) { cb(null, []); return; }
      var rootId = roots[0].id;

      // 2. Find the page subfolder "p" inside root
      _driveQuery("name='" + PAGE_KEY + "' and '" + rootId + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false", token, function (err, pages) {
        if (err || !pages.length) { cb(null, []); return; }
        var pageId = pages[0].id;

        // 3. Find the region folder inside the page folder
        _driveQuery("name='" + regionId + "' and '" + pageId + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false", token, function (err, regions) {
          if (err || !regions.length) { cb(null, []); return; }
          var regionFolderId = regions[0].id;

          // 4. List image files inside the region folder
          _driveQuery("'" + regionFolderId + "' in parents and mimeType contains 'image/' and trashed=false", token, function (err, files) {
            if (err) { cb(null, []); return; }
            _driveFolderCache[regionId] = files;
            cb(null, files);
          });
        });
      });
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────

  function openPhotoModal(regionName, regionId) {
    _currentRegionId = regionId;
    var token = TravelsAuth.getGoogleToken();

    if (!token) {
      _showLoginPrompt(regionName);
      return;
    }

    _showLoading(regionName);
    _findPhotosForRegion(regionId, token, function (err, files) {
      _showPhotos(regionName, files || [], token);
    });
  }

  global.TravelsPhotos = { openPhotoModal: openPhotoModal, closeModal: closeModal };

}(window));
