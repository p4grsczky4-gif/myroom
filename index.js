'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {defineSecret}=require('firebase-functions/params');
const admin=require('firebase-admin');const crypto=require('node:crypto');const webpush=require('web-push');
admin.initializeApp();const db=admin.firestore();const privateKey=defineSecret('WEB_PUSH_PRIVATE_KEY');const publicKey=process.env.WEB_PUSH_PUBLIC_KEY||'';const mailto=process.env.WEB_PUSH_CONTACT||'mailto:admin@example.com';
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const endpointCheck=s=>typeof s==='string'&&/^https:\/\//.test(s)&&s.length<2100;
const requireUser=req=>{if(!req.auth?.uid)throw new HttpsError('unauthenticated','Jelentkezz be a pushértesítésekhez.');return req.auth.uid};
exports.registerPush=onCall({region:'us-central1'},async request=>{
  const uid=requireUser(request),{subscription,timezone}=request.data||{};
  if(!subscription||!endpointCheck(subscription.endpoint)||typeof subscription.keys?.p256dh!=='string'||typeof subscription.keys?.auth!=='string')throw new HttpsError('invalid-argument','Érvénytelen push előfizetés.');
  if(!timezone||typeof timezone!=='string'||timezone.length>70)throw new HttpsError('invalid-argument','Érvénytelen időzóna.');
  try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format()}catch{throw new HttpsError('invalid-argument','Ismeretlen időzóna.')}
  const id=digest(subscription.endpoint);await db.doc(`users/${uid}/subscriptions/${id}`).set({subscription:{endpoint:subscription.endpoint,keys:{p256dh:subscription.keys.p256dh,auth:subscription.keys.auth}},timezone,createdAt:admin.firestore.FieldValue.serverTimestamp(),lastSent:{}},{merge:true});return {ok:true};
});
exports.removePush=onCall({region:'us-central1'},async request=>{const uid=requireUser(request),endpoint=request.data?.endpoint;if(!endpointCheck(endpoint))throw new HttpsError('invalid-argument','Érvénytelen endpoint.');await db.doc(`users/${uid}/subscriptions/${digest(endpoint)}`).delete();return {ok:true}});
const localParts=(date,timeZone)=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(date);const obj=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {date:`${obj.year}-${obj.month}-${obj.day}`,hour:Number(obj.hour),minute:Number(obj.minute),weekday:new Date(`${obj.year}-${obj.month}-${obj.day}T12:00:00Z`).getUTCDay(),day:Number(obj.day),year:Number(obj.year),month:Number(obj.month)}};
const due=(task,p)=>{if(task.frequency==='once')return task.startDate===p.date;if(task.startDate&&task.startDate>p.date)return false;if(task.frequency==='daily')return true;if(task.frequency==='weekly')return Number(task.weekday)===p.weekday;if(task.frequency==='monthly'){const days=new Date(Date.UTC(p.year,p.month,0)).getUTCDate();return p.day===Math.min(Number(task.monthday)||1,days)}return false};
// Five-minute cadence; retry prevention via per-subscription lastSent[date/task].
// Cloud Scheduler and Blaze billing are required. Cold starts and iOS delivery may introduce delays.
exports.sendReminders=onSchedule({schedule:'every 5 minutes',region:'us-central1',secrets:[privateKey],timeoutSeconds:120,memory:'256MiB'},async()=>{
  if(!publicKey){console.warn('WEB_PUSH_PUBLIC_KEY not set');return}
  webpush.setVapidDetails(mailto,publicKey,privateKey.value());const now=new Date();
  const subscriptions=await db.collectionGroup('subscriptions').limit(500).get();let sent=0;
  for(const snap of subscriptions.docs){const data=snap.data();if(!data.subscription||!data.timezone)continue;
    let p;try{p=localParts(now,data.timezone)}catch{continue}
    const userRef=snap.ref.parent.parent;if(!userRef)continue;
    const user=await userRef.get();const payload=user.data()?.payload;if(!Array.isArray(payload?.tasks))continue;
    const prev=data.lastSent||{},updates={};for(const task of payload.tasks){if(!task.reminder||!/^([01]\d|2[0-3]):[0-5]\d$/.test(task.reminder)||!due(task,p))continue;
      const [h,m]=task.reminder.split(':').map(Number);const target=h*60+m,current=p.hour*60+p.minute;
      if(current<target||current>=target+5)continue;
      const id=`${p.date}_${task.id}`;if(prev[id])continue;
      const body=JSON.stringify({title:'My Room · Emlékeztető',body:task.name,tag:id});
      try{await webpush.sendNotification(data.subscription,body,{TTL:3600});updates[`lastSent.${id}`]=admin.firestore.FieldValue.serverTimestamp();sent++}
      catch(err){if([404,410].includes(err.statusCode)){await snap.ref.delete();break}console.warn('Push send failed',err.statusCode||err.message)}
    }
    if(Object.keys(updates).length)await snap.ref.update(updates);
    // Keep only recent dedupe entries (avoid unbounded document growth).
    const stale=Object.keys(prev).filter(k=>k.slice(0,10)<new Date(now.getTime()-8*86400000).toISOString().slice(0,10));if(stale.length){const rm={};for(const k of stale)rm[`lastSent.${k}`]=admin.firestore.FieldValue.delete();await snap.ref.update(rm)}
  }
  console.log('Reminders delivered:',sent);
});
