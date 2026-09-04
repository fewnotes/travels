(function (global) {
  "use strict";

  var PAGE_KEY = (typeof global.TRAVELS_PAGE_KEY === "string") ? global.TRAVELS_PAGE_KEY : "p";
  // Each person's photos live in their own top-level folder, e.g.
  // "travels-map-t" - shared (read-only) with that person individually,
  // so a flat, uniquely-named folder both avoids leaking siblings' photos
  // and is easy to find. Drive folder ids are permanent (stable across
  // renames/moves/re-shares), so these are hardcoded rather than resolved
  // by a "find folder named X" query on every region click.
  var ROOT_FOLDER_IDS = {
    p: "17TrTdUjiqUbFLx20_KA5Ua9nTGKzy10e",
    s: "1SSJRqvWME94Fuqjre6-stx2VRVsgYNOl",
    t: "160Pj8-fcsA8mscrAqheGPwJBWQZ4qRj2"
  };
  var ROOT_FOLDER_ID = ROOT_FOLDER_IDS[PAGE_KEY];

  var _modal = null;
  var _currentRegionId = null;
  var _driveFolderCache = {};

  var _lightbox = null;
  var _currentFiles = [];
  var _currentIndex = -1;
  var _currentToken = null;

  // Fetches the full-resolution image blob for a file on demand (used by
  // the lightbox), rather than upfront for every photo in the strip - the
  // strip only ever needs Drive's small pre-generated thumbnail.
  function _ensureFullRes(f, cb) {
    if (f.blobUrl) { cb(); return; }
    fetch(f.downloadUrl, { headers: { Authorization: "Bearer " + _currentToken } })
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        f.blobUrl = URL.createObjectURL(blob);
        cb();
      })
      .catch(function () { cb(new Error("Could not load photo")); });
  }

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

  // ── Lightbox (full-size, prev/next) ─────────────────────────────────────────

  function _buildLightbox() {
    if (_lightbox) return;
    var overlay = document.createElement("div");
    overlay.id = "photo-lightbox-overlay";
    overlay.innerHTML = [
      '<button id="photo-lightbox-close" aria-label="Close">&times;</button>',
      '<button id="photo-lightbox-prev" aria-label="Previous">&#8249;</button>',
      '<img id="photo-lightbox-img" alt="">',
      '<button id="photo-lightbox-next" aria-label="Next">&#8250;</button>',
      '<span id="photo-lightbox-caption"></span>'
    ].join("");
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) { if (e.target === overlay) _closeLightbox(); });
    document.getElementById("photo-lightbox-close").addEventListener("click", _closeLightbox);
    document.getElementById("photo-lightbox-prev").addEventListener("click", function () { _lightboxStep(-1); });
    document.getElementById("photo-lightbox-next").addEventListener("click", function () { _lightboxStep(1); });
    document.addEventListener("keydown", function (e) {
      if (!_lightbox || _lightbox.overlay.style.display !== "flex") return;
      if (e.key === "Escape") _closeLightbox();
      else if (e.key === "ArrowLeft") _lightboxStep(-1);
      else if (e.key === "ArrowRight") _lightboxStep(1);
    });

    _lightbox = {
      overlay: overlay,
      img: document.getElementById("photo-lightbox-img"),
      caption: document.getElementById("photo-lightbox-caption"),
      prevBtn: document.getElementById("photo-lightbox-prev"),
      nextBtn: document.getElementById("photo-lightbox-next")
    };
  }

  function _openLightbox(index) {
    _buildLightbox();
    _currentIndex = index;
    _updateLightboxImage();
    _lightbox.overlay.style.display = "flex";
  }

  function _closeLightbox() {
    if (_lightbox) _lightbox.overlay.style.display = "none";
  }

  function _lightboxStep(delta) {
    var len = _currentFiles.length;
    var next = _currentIndex + delta;
    if (next < 0 || next >= len) return; // stop at the ends, don't wrap
    _currentIndex = next;
    _updateLightboxImage();
  }

  function _updateLightboxImage() {
    var f = _currentFiles[_currentIndex];
    if (!f) return;
    _lightbox.caption.textContent = f.date || "";
    _lightbox.prevBtn.style.display = _currentIndex > 0 ? "" : "none";
    _lightbox.nextBtn.style.display = _currentIndex < _currentFiles.length - 1 ? "" : "none";

    if (f.blobUrl) {
      _lightbox.img.src = f.blobUrl;
      return;
    }
    // Show the already-loaded thumbnail immediately, then swap to
    // full-resolution once it arrives.
    _lightbox.img.src = f.thumbnailUrl || "";
    var openedIndex = _currentIndex;
    _ensureFullRes(f, function (err) {
      if (err || _currentIndex !== openedIndex) return; // navigated away before this resolved
      _lightbox.img.src = f.blobUrl;
    });
  }

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
    _currentFiles = files;
    _currentToken = token;

    var strip = document.createElement("div");
    strip.className = "photo-strip";
    _showModal(regionName, "");
    _modal.body.appendChild(strip);

    files.forEach(function (f, index) {
      var item = document.createElement("div");
      item.className = "photo-strip-item";

      var img = document.createElement("img");
      img.className = "photo-strip-img";
      img.alt = regionName;
      img.loading = "lazy";
      img.addEventListener("click", function () { _openLightbox(index); });
      item.appendChild(img);

      if (f.date) {
        var dateEl = document.createElement("span");
        dateEl.className = "photo-date";
        dateEl.textContent = f.date;
        item.appendChild(dateEl);
      }

      strip.appendChild(item);

      if (f.thumbnailUrl) {
        img.src = f.thumbnailUrl;
      } else {
        // No Drive-generated thumbnail for this file - fall back to the
        // full-resolution fetch just for this one photo.
        _ensureFullRes(f, function (err) {
          if (err) { img.alt = "Could not load photo"; return; }
          img.src = f.blobUrl;
        });
      }
    });
  }

  // ── Google Drive API ──────────────────────────────────────────────────────

  function _driveQuery(q, token, cb) {
    var url = "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
      "&fields=files(id,name,mimeType,imageMediaMetadata(time),thumbnailLink)&pageSize=50";
    fetch(url, { headers: { Authorization: "Bearer " + token } })
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(null, data.files || []); })
      .catch(function (e) { cb(e); });
  }

  function _findGooglePhotos(regionId, token, cb) {
    var cacheKey = "g:" + regionId;
    if (_driveFolderCache[cacheKey]) { cb(null, _driveFolderCache[cacheKey]); return; }

    _driveQuery("name='" + regionId + "' and '" + ROOT_FOLDER_ID + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false", token, function (err, regions) {
      if (err || !regions.length) { cb(null, []); return; }
      _driveQuery("'" + regions[0].id + "' in parents and mimeType contains 'image/' and trashed=false", token, function (err, files) {
        if (err) { cb(null, []); return; }
        var mapped = files.map(function (f) {
          var time = f.imageMediaMetadata && f.imageMediaMetadata.time;
          return {
            id: f.id,
            name: f.name,
            downloadUrl: "https://www.googleapis.com/drive/v3/files/" + f.id + "?alt=media",
            thumbnailUrl: f.thumbnailLink || null,
            date: time ? time.substring(0, 7).replace(":", "-") : null
          };
        });
        mapped.sort(function (a, b) {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0);
        });
        _driveFolderCache[cacheKey] = mapped;
        cb(null, mapped);
      });
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────

  function openPhotoModal(regionName, regionId) {
    _currentRegionId = regionId;
    var token = TravelsAuth.getToken();

    if (!token) { _showLoginPrompt(regionName); return; }

    _showLoading(regionName);

    _findGooglePhotos(regionId, token, function (err, files) {
      _showPhotos(regionName, files || [], token);
    });
  }

  global.TravelsPhotos = { openPhotoModal: openPhotoModal, closeModal: closeModal };

}(window));
