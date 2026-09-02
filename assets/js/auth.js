(function (global) {
  "use strict";

  var GOOGLE_CLIENT_ID = "1054362225241-osudvt9it1hoej6a0v373qkmjh5ts0uc.apps.googleusercontent.com";
  var DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

  var _googleToken = null;   // { access_token, expires_at }
  var _userInfo = null;      // { name, email, picture }
  var _onLoginCallbacks = [];

  function googleTokenValid() {
    return _googleToken && Date.now() < _googleToken.expires_at;
  }

  function getGoogleToken() {
    return googleTokenValid() ? _googleToken.access_token : null;
  }

  function getUserInfo() {
    return _userInfo;
  }

  function onLogin(cb) {
    _onLoginCallbacks.push(cb);
    if (googleTokenValid() && _userInfo) cb(_userInfo);
  }

  function _notifyLogin() {
    _onLoginCallbacks.forEach(function (cb) { cb(_userInfo); });
  }

  function _fetchUserInfo(token, cb) {
    fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + token }
    })
      .then(function (r) { return r.json(); })
      .then(function (info) {
        _userInfo = { name: info.name, email: info.email, picture: info.picture };
        cb(null, _userInfo);
      })
      .catch(function (e) { cb(e); });
  }

  function signInWithGoogle(cb) {
    if (!global.google || !global.google.accounts) {
      if (cb) cb(new Error("Google Identity Services not loaded"));
      return;
    }
    var client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: function (response) {
        if (response.error) {
          if (cb) cb(new Error(response.error));
          return;
        }
        _googleToken = {
          access_token: response.access_token,
          expires_at: Date.now() + (response.expires_in - 60) * 1000
        };
        _fetchUserInfo(response.access_token, function (err, info) {
          if (err) { if (cb) cb(err); return; }
          _notifyLogin();
          if (cb) cb(null, info);
        });
      }
    });
    client.requestAccessToken({ prompt: "consent" });
  }

  function signOut(cb) {
    if (_googleToken) {
      google.accounts.oauth2.revoke(_googleToken.access_token, function () {});
    }
    _googleToken = null;
    _userInfo = null;
    if (cb) cb();
  }

  global.TravelsAuth = {
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    getGoogleToken: getGoogleToken,
    getUserInfo: getUserInfo,
    onLogin: onLogin
  };

}(window));
