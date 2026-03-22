window.AppState = {
  apiBase: 'https://MON-APP.onrender.com',
  twitch: {
    authorized: false,
    channelId: null,
    userId: null,
    opaqueUserId: null
  },
  viewerPseudo: localStorage.getItem('viewerPseudo') || '',
  currentState: null
};