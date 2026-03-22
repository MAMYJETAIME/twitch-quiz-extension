window.Utils = (function () {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function remainingSeconds(timerEnd) {
    if (!timerEnd) return 0;
    return Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
  }

  function isPanelPage() {
    return window.location.pathname.indexOf('panel.html') !== -1;
  }

  function isViewerPage() {
    return window.location.pathname.indexOf('video_overlay.html') !== -1;
  }

  return {
    escapeHtml: escapeHtml,
    remainingSeconds: remainingSeconds,
    isPanelPage: isPanelPage,
    isViewerPage: isViewerPage
  };
})();