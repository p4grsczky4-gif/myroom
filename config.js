/* Másold ide a Firebase Console -> Project settings -> Your apps -> Web app -> firebaseConfig értékeit.
 * Publikus projektazonosítók; TITKOS SZOLGÁLTATÁSKULCSOT SOHA NE TEGYÉL IDE.
 * Firebase nélkül a teljes helyi alkalmazás működik. */
window.MYROOM_CONFIG = {
  firebase: null,
  // Példa: firebase: { apiKey:'...', authDomain:'...firebaseapp.com', projectId:'...', appId:'...' },
  vapidPublicKey: '' // Firebase nélkül üres; Web Push VAPID nyilvános kulcs.
};
