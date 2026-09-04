(function (global) {
  "use strict";

  var GOOGLE_CLIENT_ID = "1054362225241-osudvt9it1hoej6a0v373qkmjh5ts0uc.apps.googleusercontent.com";
  var MS_CLIENT_ID = "a0f846c3-77a9-4177-a978-b77bb4a8fa32";
  var MS_AUTHORITY = "https://login.microsoftonline.com/consumers";
  var MS_SCOPES = ["Files.Read", "User.Read"];
  // drive.readonly alone can't call the userinfo endpoint below - it needs
  // an identity scope too, or _fetchGoogleUserInfo gets a 401.
  var GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

  var _provider = null;        // "google" | "microsoft"
  var _googleToken = null;     // { access_token, expires_at }
  var _msApp = null;           // MSAL PublicClientApplication
  var _msAccount = null;       // MSAL account
  var _msToken = null;         // { access_token, expires_at }
  var _userInfo = null;        // { name, email, picture }
  var _onLoginCallbacks = [];

  function getProvider() { return _provider; }

  function getToken() {
    if (_provider === "google" && _googleToken && Date.now() < _googleToken.expires_at)
      return _googleToken.access_token;
    if (_provider === "microsoft" && _msToken && Date.now() < _msToken.expires_at)
      return _msToken.access_token;
    return null;
  }

  function getUserInfo() { return _userInfo; }

  function onLogin(cb) {
    _onLoginCallbacks.push(cb);
    if (getToken() && _userInfo) cb(_userInfo);
  }

  function _notifyLogin() {
    _onLoginCallbacks.forEach(function (cb) { cb(_userInfo); });
  }

  // ── Google ────────────────────────────────────────────────────────────────

  function _fetchGoogleUserInfo(token, cb) {
    fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + token }
    })
      .then(function (r) { return r.json(); })
      .then(function (info) {
        _userInfo = { name: info.name, email: info.email, picture: info.picture };
        cb(null, _userInfo);
      })
      .catch(cb);
  }

  function signInWithGoogle(cb) {
    if (!global.google || !global.google.accounts) {
      if (cb) cb(new Error("Google Identity Services not loaded"));
      return;
    }
    var client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPE,
      callback: function (response) {
        if (response.error) { if (cb) cb(new Error(response.error)); return; }
        _provider = "google";
        _googleToken = {
          access_token: response.access_token,
          expires_at: Date.now() + (response.expires_in - 60) * 1000
        };
        _fetchGoogleUserInfo(response.access_token, function (err, info) {
          if (err) { if (cb) cb(err); return; }
          _notifyLogin();
          if (cb) cb(null, info);
        });
      }
    });
    client.requestAccessToken({ prompt: "consent" });
  }

  // ── Microsoft ─────────────────────────────────────────────────────────────

  function _initMsal() {
    if (_msApp) return _msApp;
    _msApp = new msal.PublicClientApplication({
      auth: {
        clientId: MS_CLIENT_ID,
        authority: MS_AUTHORITY,
        redirectUri: window.location.origin + window.location.pathname
      },
      cache: { cacheLocation: "sessionStorage" }
    });
    return _msApp;
  }

  function signInWithMicrosoft(cb) {
    if (typeof msal === "undefined") {
      if (cb) cb(new Error("MSAL not loaded"));
      return;
    }
    var app = _initMsal();
    app.loginPopup({ scopes: MS_SCOPES })
      .then(function (result) {
        _msAccount = result.account;
        return app.acquireTokenSilent({ scopes: MS_SCOPES, account: _msAccount });
      })
      .then(function (tokenResult) {
        _provider = "microsoft";
        _msToken = {
          access_token: tokenResult.accessToken,
          expires_at: tokenResult.expiresOn.getTime() - 60000
        };
        _userInfo = {
          name: _msAccount.name,
          email: _msAccount.username,
          picture: null
        };
        _notifyLogin();
        if (cb) cb(null, _userInfo);
      })
      .catch(function (e) { if (cb) cb(e); });
  }

  // ── Sign out ──────────────────────────────────────────────────────────────

  function signOut(cb) {
    if (_provider === "google" && _googleToken && global.google) {
      google.accounts.oauth2.revoke(_googleToken.access_token, function () {});
    }
    if (_provider === "microsoft" && _msApp && _msAccount) {
      _msApp.logoutPopup({ account: _msAccount }).catch(function () {});
    }
    _provider = null;
    _googleToken = null;
    _msToken = null;
    _msAccount = null;
    _userInfo = null;
    if (cb) cb();
  }

  function initHeaderAuth() {
    var googleBtn = document.getElementById("auth-google-btn");
    var msBtn = document.getElementById("auth-ms-btn");
    var userDiv = document.getElementById("auth-user");
    var avatar = document.getElementById("auth-avatar");
    var nameEl = document.getElementById("auth-name");
    var signoutBtn = document.getElementById("auth-signout-btn");

    if (!googleBtn) return;

    function showLoggedOut() {
      googleBtn.style.display = "";
      msBtn.style.display = "";
      userDiv.style.display = "none";
    }

    function showLoggedIn(info) {
      googleBtn.style.display = "none";
      msBtn.style.display = "none";
      userDiv.style.display = "";
      nameEl.textContent = info.name || info.email;
      if (info.picture) { avatar.src = info.picture; avatar.style.display = ""; }
      else { avatar.style.display = "none"; }
    }

    showLoggedOut();

    googleBtn.addEventListener("click", function () {
      signInWithGoogle(function (err) { if (err) console.error(err); });
    });

    msBtn.addEventListener("click", function () {
      signInWithMicrosoft(function (err) { if (err) console.error(err); });
    });

    signoutBtn.addEventListener("click", function () {
      signOut(function () { showLoggedOut(); });
    });

    onLogin(function (info) { showLoggedIn(info); });
  }

  // Auto-init header when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeaderAuth);
  } else {
    initHeaderAuth();
  }

  global.TravelsAuth = {
    signInWithGoogle: signInWithGoogle,
    signInWithMicrosoft: signInWithMicrosoft,
    signOut: signOut,
    getToken: getToken,
    getProvider: getProvider,
    getUserInfo: getUserInfo,
    onLogin: onLogin
  };

}(window));
