# My Room 2.0 🌿

Saját, magyar nyelvű, sötét/világos témás, mobilra telepíthető otthonmenedzsment PWA. **GitHub Pages-en önmagában is működik, Firebase nélkül.**

## Funkciók

- Személyre szabott **napi / heti / havi / egyszeri** feladatok, egyéni emlékeztetési idővel.
- Hálószoba, fürdő, konyha, nappali; új helyiségek létrehozása, átnevezése, törlése (ha nincs benne feladat).
- Interaktív havi naptár, a kiválasztott nap feladataival, készültségi jelöléssel.
- Szellőztetés-időzítő, napló 0–5 szagértékkel, páratartalommal és jegyzetekkel.
- Helyi automatikus mentés (localStorage), PWA offline cache, JSON import/export; v1.0 adatok egyszeri helyi átvétele.
- Opcionális Google-belépés + Firebase Firestore szinkron.
- Opcionális szerveroldali **Web Push** értesítés Firebase Functions + Cloud Scheduler + VAPID segítségével.
- `.ics` naptárexport a következő 93 nap időpontra ütemezett feladataival; ez értesítéshez Firebase nélküli alternatíva, ha a naptárapp támogatja az importálást és riasztást.

## 1. Ingyenes üzemmód: GitHub Pages (nem szükséges Firebase)

1. Készíts GitHubon új **public** repository-t, például `my-room` néven.
2. Másold az összes gyökérszintű fájlt a repo gyökerébe (`index.html`, `app.js`, `cloud.js`, `style.css`, `config.js`, `sw.js`, `manifest.webmanifest`, képek). A `functions/` mappa is tárolható itt.
3. `Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save`.
4. Nyisd meg a GitHub Pages HTTPS címét, például `https://FELHASZNALO.github.io/my-room/`.
5. iPhone-on Safariban: **Megosztás → Hozzáadás a főképernyőhöz → Hozzáadás**.
6. A helyi módhoz nincs bejelentkezés és nincs szerver. Az adatok a telepített webapp böngészőtárhelyéhez kötődnek; ezért **rendszeresen exportálj JSON-mentést**. A Safari lap és a főképernyős app tárolója különbözhet.

**Fontos:** a GitHub Pages nem futtat szerverkódot, így önmagában sem háttérben futó megbízható értesítést, sem készülékek közötti felhős szinkront nem tud biztosítani.

## 2. Opcionális Firebase-felhő (Google-belépés + szinkron)

1. Hozz létre Firebase projektet: <https://console.firebase.google.com/>.
2. `Authentication → Sign-in method`: engedélyezd a **Google** szolgáltatót; add hozzá a GitHub Pages hostnevet az **Authorized domains** listához (`FELHASZNALO.github.io`). Egyes iPhone/PWA OAuth-flow-k eltérően működhetnek; szükség lehet Safari-böngészőben történő belépésre vagy egy saját domain/redirect-flow beállítására.
3. `Firestore Database → Create database` (production mode).
4. `Project settings → Your apps → Web`: regisztrálj webappot; másold a publikus `firebaseConfig` mezőket a `config.js` `firebase` objektumába. **A `config.js` értékei nem titkosak**; a biztonságot a Firestore Rules biztosítja. Soha ne illessz be Firebase Admin SDK private key-t!
5. Tedd közzé a Firestore-szabályokat: Firebase CLI telepítése (`npm install -g firebase-tools`), majd `firebase login`, `firebase use --add`, végül `firebase deploy --only firestore:rules` (a projekt `firebase.json` állománya tartalmazza a rules elérési útját).
6. Nyisd meg az appot → Beállítások → Google bejelentkezés. Első belépéskor a helyi adatok feltölthetők, ha már volt felhős adat, választhatsz, melyik maradjon.

**Szinkronkorlát:** az egész állapot egy dokumentumként szinkronizálódik „utolsó módosítás nyer” elven, ezért **két eszközön egyidejű módosítás adatvesztést okozhat**. Offline mód alatt a helyi adatok működnek, de a távoli szinkronhoz később internet szükséges.

## 3. Opcionális pushértesítések

A pushhoz a Firebase szinkron **mellett** szerveroldali környezet kell. **Firebase Functions + Scheduler általában Blaze (számlázás engedélyezése) csomagot igényel**, és használat szerint díjat számolhatnak fel.

1. Generálj VAPID kulcspárt például a `functions` mappában `npx web-push generate-vapid-keys` paranccsal.
2. A **nyilvános** kulcs kerüljön a gyökér `config.js` `vapidPublicKey` mezőjébe. A **privát** kulcsot NE töltsd fel GitHubra.
3. A gyökérben lévő `functions/.env` fájlba írd: `WEB_PUSH_PUBLIC_KEY=...` és `WEB_PUSH_CONTACT=mailto:sajat-cimed@example.com` (ez a fájl `.gitignore` miatt nincs verziókövetve).
4. A privát kulcsot a Firebase Secret Managerben állítsd be: `firebase functions:secrets:set WEB_PUSH_PRIVATE_KEY`.
5. Telepítsd az npm-függőségeket: `cd functions && npm install && cd ..`.
6. Publikáld a funkciókat: `firebase deploy --only functions`.
7. Telepítsd a PWA-t iPhone főképernyőjére. iOS 16.4 vagy újabb szükséges a webes pushhoz, és kizárólag a főképernyőre telepített webapp kérhet push-engedélyt. **Az engedélyt az appban, a Beállításoknál adott kattintáskor kérjük.**
8. Beállítások → Google bejelentkezés → Értesítések bekapcsolása. Feladatonként adj meg HH:MM emlékeztetőt.

A szerver ötpercenként fut, az időzóna szerinti esedékes feladatokat keresi, és kiküldi a pushokat. A kézbesítés nem garantált percre pontosan. A mintamegoldás az első 500 eszköz-előfizetést nézi át: sok felhasználó esetén célzottabb, skálázhatóbb ütemezés szükséges.

**Kockázat:** a statikus fájlok publikálása **nem** telepíti a szerverfunkciókat. Push és felhő csak a fenti külső szolgáltatások létrehozása, telepítése és engedélyezése után lesz aktív. A helyi funkciók ettől függetlenül működnek.

## Biztonság

- A Firestore `users/{uid}` adatot kizárólag az adott bejelentkezett felhasználó olvashatja/írhatja; a `subscriptions` adatokhoz csak az Admin SDK fér hozzá.
- Kizárólag HTTPS alatt működnek a PWA telepítéshez és Push API-hoz szükséges lehetőségek (localhost fejlesztésre kivétel).
- Ez egy személyes alkalmazásmintaprojekt, nem auditált, nagy léptékű szolgáltatás.

## Fájlszerkezet

- `index.html`, `style.css`, `app.js` — teljes UI + helyi logika.
- `cloud.js`, `config.js` — opcionális Firebase integráció.
- `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png` — PWA és értesítés megjelenítés.
- `functions/index.js`, `functions/package.json` — Firebase callable és ütemezett Web Push funkciók.
- `firestore.rules`, `firebase.json` — biztonsági szabályok és telepítési konfiguráció.

## Felhasználási megjegyzés

A tartós szobaszag lehet nedvességgel, penésszel vagy más forrással kapcsolatos. A rutin segít megfigyelni, de nem helyettesíti az ok feltárását és szükség esetén a szakszerű javítást.
