window.Router = (function () {
  function initTwitch() {
    if (window.Twitch && window.Twitch.ext) {
      window.Twitch.ext.onAuthorized(function (auth) {
        window.AppState.twitch.authorized = true;
        window.AppState.twitch.channelId = auth.channelId || null;
        window.AppState.twitch.userId = auth.userId || null;
        window.AppState.twitch.opaqueUserId = auth.userId || null;
      });
    }
  }

  function boot() {
    initTwitch();

    if (window.Utils.isPanelPage()) {
      window.PanelApp.init();
      return;
    }

    if (window.Utils.isViewerPage()) {
      window.ViewerApp.init();
      return;
    }

    window.ViewerApp.init();
  }

  return {
    boot: boot
  };
})();