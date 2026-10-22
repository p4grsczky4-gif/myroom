// Firebase kizárólag bejelentkezéskor töltődik be; a helyi PWA offline is működik.
const SDK='https://www.gstatic.com/firebasejs/11.10.0/';
export class Cloud{
  constructor(){this.user=null;this.db=null;this.functions=null;this.auth=null;this.unsub=null;this.timer=null;this.pending=false;this.lastLocal='';this.remoteLoaded=false;this.hydrating=false;}
  async init(){if(this.auth)return;const [app,auth,firestore,functions]=await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),import(SDK+'firebase-firestore.js'),import(SDK+'firebase-functions.js')]);this.lib={auth,firestore,functions};this.instance=app.initializeApp(window.MYROOM_CONFIG.firebase);this.auth=auth.getAuth(this.instance);this.db=firestore.getFirestore(this.instance);this.functions=functions.getFunctions(this.instance,'us-central1');}
  async signIn({onReady,onRemote,onStatus}){
    await this.init();const {auth,firestore}=this.lib;
    // Popup works in most browsers and in standalone mode if the provider allows the OAuth redirect.
    // Prefer browser-authorized popup; iOS standalone can require signing in via Safari first.
    const provider=new auth.GoogleAuthProvider();const result=await auth.signInWithPopup(this.auth,provider);this.user=result.user;
    if(this.unsub)this.unsub();
    const ref=firestore.doc(this.db,'users',this.user.uid);
    const snap=await firestore.getDocFromServer(ref).catch(async()=>firestore.getDoc(ref));
    const remote=snap.exists()?snap.data()?.payload:null;
    onReady(remote||null);this.lastLocal=JSON.stringify(remote||{});this.remoteLoaded=true;
    this.unsub=firestore.onSnapshot(ref,snap=>{
      if(!snap.exists()||snap.metadata.hasPendingWrites)return;
      const data=snap.data()?.payload;if(!data||!this.remoteLoaded)return;
      const serialized=JSON.stringify(data);if(serialized===this.lastLocal)return;
      if(this.pending)return;this.lastLocal=serialized;onRemote(data);onStatus('Felhő szinkronizálva');
    },err=>onStatus('Szinkronhiba: '+err.message));
  }
  queueSave(payload){if(!this.user||!this.db)return;this.next=JSON.parse(JSON.stringify(payload));clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),700);}
  async flush(){if(!this.user||!this.next)return;const value=this.next;this.next=null;this.pending=true;const {firestore}=this.lib;try{await firestore.setDoc(firestore.doc(this.db,'users',this.user.uid),{payload:value,updatedAt:firestore.serverTimestamp()},{merge:true});this.lastLocal=JSON.stringify(value)}catch(err){console.warn('Felhős szinkronizáció:',err);alert('A felhős mentés nem sikerült. Az adatok helyben megmaradtak. Ellenőrizd az internetet és a Firestore-szabályokat.')}finally{this.pending=false;if(this.next)this.flush()}}
  async setPush(enabled,registration){if(!this.user)throw Error('Nincs bejelentkezve.');const {functions}=this.lib;const vapid=window.MYROOM_CONFIG?.vapidPublicKey;if(!vapid)throw Error('A VAPID nyilvános kulcs hiányzik a config.js-ből.');const urlToBytes=base64=>{const padding='='.repeat((4-base64.length%4)%4);const s=atob((base64+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0))};const push=registration.pushManager;let sub=await push.getSubscription();if(enabled){if(!sub)sub=await push.subscribe({userVisibleOnly:true,applicationServerKey:urlToBytes(vapid)});await functions.httpsCallable(this.functions,'registerPush')({subscription:sub.toJSON(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});}else if(sub){await functions.httpsCallable(this.functions,'removePush')({endpoint:sub.endpoint});await sub.unsubscribe()}}
  async signOut(){clearTimeout(this.timer);if(this.next)await this.flush();if(this.unsub){this.unsub();this.unsub=null}if(this.auth)await this.lib.auth.signOut(this.auth);this.user=null;this.remoteLoaded=false;}
}
