(function (global) {
  "use strict";

  var PAGE_KEY = (typeof global.TRAVELS_PAGE_KEY === "string") ? global.TRAVELS_PAGE_KEY : "p";
  // Each person's photos live in their own top-level folder, e.g.
  // "travels-map-t". This is what gets shared (read-only) with that
  // person individually - a flat, uniquely-named folder is both easier
  // to find by name via the provider APIs and avoids leaking siblings'
  // photos the way sharing one common parent folder would.
  var ROOT_FOLDER_NAME = "travels-map-" + PAGE_KEY;

  var _modal = null;
  var _currentRegionId = null;
  var _driveFolderCache = {};

  var _lightbox = null;
  var _currentFiles = [];
  var _currentIndex = -1;

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
    var hasMultiple = _currentFiles.length > 1;
    _lightbox.prevBtn.style.display = hasMultiple ? "" : "none";
    _lightbox.nextBtn.style.display = hasMultiple ? "" : "none";
    _updateLightboxImage();
    _lightbox.overlay.style.display = "flex";
  }

  function _closeLightbox() {
    if (_lightbox) _lightbox.overlay.style.display = "none";
  }

  function _lightboxStep(delta) {
    var len = _currentFiles.length;
    if (!len) return;
    _currentIndex = (_currentIndex + delta + len) % len;
    _updateLightboxImage();
  }

  function _updateLightboxImage() {
    var f = _currentFiles[_currentIndex];
    if (!f) return;
    _lightbox.img.src = f.blobUrl || "";
    _lightbox.caption.textContent = f.date || "";
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
      fetch(f.downloadUrl, { headers: { Authorization: "Bearer " + token } })
        .then(function (r) { return r.blob(); })
        .then(function (blob) {
          f.blobUrl = URL.createObjectURL(blob);
          img.src = f.blobUrl;
          if (_lightbox && _lightbox.overlay.style.display === "flex" && _currentIndex === index) {
            _updateLightboxImage();
          }
        })
        .catch(function () { img.alt = "Could not load photo"; });
    });
  }

  // ── Google Drive API ──────────────────────────────────────────────────────

  function _driveQuery(q, token, cb) {
    var url = "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
      "&fields=files(id,name,mimeType,imageMediaMetadata(time))&pageSize=50";
    fetch(url, { headers: { Authorization: "Bearer " + token } })
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(null, data.files || []); })
      .catch(function (e) { cb(e); });
  }

  function _findGooglePhotos(regionId, token, cb) {
    var cacheKey = "g:" + regionId;
    if (_driveFolderCache[cacheKey]) { cb(null, _driveFolderCache[cacheKey]); return; }

    // Drive's files.list searches both files the signer owns and files
    // shared with them by default, so a single name lookup finds
    // ROOT_FOLDER_NAME whether this account owns it or someone else
    // shared it with them - no separate "shared" path needed.
    _driveQuery("name='" + ROOT_FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false", token, function (err, roots) {
      if (err || !roots.length) { cb(null, []); return; }
      _driveQuery("name='" + regionId + "' and '" + roots[0].id + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false", token, function (err, regions) {
        if (err || !regions.length) { cb(null, []); return; }
        _driveQuery("'" + regions[0].id + "' in parents and mimeType contains 'image/' and trashed=false", token, function (err, files) {
          if (err) { cb(null, []); return; }
          var mapped = files.map(function (f) {
            var time = f.imageMediaMetadata && f.imageMediaMetadata.time;
            return {
              id: f.id,
              name: f.name,
              downloadUrl: "https://www.googleapis.com/drive/v3/files/" + f.id + "?alt=media",
              date: time ? time.substring(0, 7).replace(":", "-") : null
            };
          });
          _driveFolderCache[cacheKey] = mapped;
          cb(null, mapped);
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

  function _mapOneDriveFiles(cacheKey, items, driveId) {
    var images = items.filter(function (f) {
      return f.file && f.file.mimeType && f.file.mimeType.indexOf("image/") === 0;
    });
    // Items found in someone else's drive (via the sharedWithMe fallback
    // below) must be downloaded via /drives/{driveId}/items/{id}/content -
    // /me/drive/items/{id}/content only resolves within the signer's own
    // drive and would 404 for an id that lives in the owner's drive.
    var base = driveId
      ? "https://graph.microsoft.com/v1.0/drives/" + driveId + "/items/"
      : "https://graph.microsoft.com/v1.0/me/drive/items/";
    var mapped = images.map(function (f) {
      var taken = f.photo && f.photo.takenDateTime;
      return {
        id: f.id,
        name: f.name,
        downloadUrl: base + f.id + "/content",
        date: taken ? taken.substring(0, 7) : null
      };
    });
    _driveFolderCache[cacheKey] = mapped;
    return mapped;
  }

  function _findOneDrivePhotos(regionId, token, cb) {
    var cacheKey = "ms:" + regionId;
    if (_driveFolderCache[cacheKey]) { cb(null, _driveFolderCache[cacheKey]); return; }

    // First try the signed-in account's own drive - this is what makes
    // it work when the folder's owner signs in on any page: no sharing
    // involved, since they own the whole tree themselves.
    var ownPath = "/me/drive/root:/" + ROOT_FOLDER_NAME + "/" + regionId + ":/children?$select=id,name,file,photo";
    _graphGet(ownPath, token, function (err, data) {
      if (!err && data && data.value) {
        cb(null, _mapOneDriveFiles(cacheKey, data.value, null));
        return;
      }

      // Not in their own drive (404/error) - this is a different person
      // who only has ROOT_FOLDER_NAME shared with them. Graph doesn't
      // expose shared items under /me/drive/root: at all, so find it via
      // sharedWithMe instead, then browse by drive+item id.
      _graphGet("/me/drive/sharedWithMe?allowexternal=true", token, function (err2, shared) {
        if (err2 || !shared || !shared.value) { cb(null, []); return; }
        var match = shared.value.filter(function (item) {
          return item.name === ROOT_FOLDER_NAME && item.remoteItem && item.remoteItem.folder;
        })[0];
        if (!match) { cb(null, []); return; }

        var driveId = match.remoteItem.parentReference.driveId;
        var itemId = match.remoteItem.id;
        var sharedPath = "/drives/" + driveId + "/items/" + itemId + ":/" + regionId + ":/children?$select=id,name,file,photo";
        _graphGet(sharedPath, token, function (err3, data3) {
          if (err3 || !data3 || !data3.value) { cb(null, []); return; }
          cb(null, _mapOneDriveFiles(cacheKey, data3.value, driveId));
        });
      });
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
