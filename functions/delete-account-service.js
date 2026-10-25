'use strict';

function validateDeletion(request,nowSeconds,fail){
  if(!request.auth)throw fail('unauthenticated','Sign in before deleting your tracker account.');
  const token=request.auth.token||{};
  if(token.email_verified!==true||typeof token.email!=='string')throw fail('permission-denied','A verified Google account is required.');
  if(request.data?.confirmation!=='DELETE MY ACCOUNT')throw fail('invalid-argument','Type DELETE MY ACCOUNT to confirm.');
  if(!Number.isFinite(token.auth_time)||nowSeconds-token.auth_time>300||token.auth_time>nowSeconds+30)throw fail('failed-precondition','Sign in again before deleting your account.');
  return {uid:request.auth.uid,email:token.email.toLowerCase()};
}

async function eraseTrackerAccount({uid,email},services){
  // Block further client writes first. Retain only a non-financial UID tombstone
  // so previously issued ID tokens cannot recreate the deleted account's data.
  await services.blockAccount(uid);
  await services.removeInvitations(uid,email);
  await services.removeOwnedTracker(uid);
  await services.removeLogin(uid);
  return {deleted:true};
}
module.exports={validateDeletion,eraseTrackerAccount};
