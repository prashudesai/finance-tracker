'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {validateDeletion,eraseTrackerAccount}=require('./delete-account-service');
initializeApp();
exports.deleteTrackerAccount=onCall({region:'us-central1',timeoutSeconds:180,memory:'256MiB',maxInstances:2},async request=>{
  const account=validateDeletion(request,Math.floor(Date.now()/1000),(code,message)=>new HttpsError(code,message));
  const db=getFirestore();
  return eraseTrackerAccount(account,{
    blockAccount:uid=>db.doc('deletedAccounts/'+uid).set({deletedAt:FieldValue.serverTimestamp()}),
    removeInvitations:async(uid,email)=>{
      const [owned,received]=await Promise.all([db.collection('familyInvites').where('ownerUid','==',uid).get(),db.collection('familyInvites').where('email','==',email).get()]);
      const refs=new Map([...owned.docs,...received.docs].map(document=>[document.ref.path,document.ref]));
      const writer=db.bulkWriter();for(const ref of refs.values())writer.delete(ref);await writer.close();
    },
    removeOwnedTracker:uid=>db.recursiveDelete(db.doc('users/'+uid)),
    removeLogin:async uid=>{try{await getAuth().deleteUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}}
  });
});
