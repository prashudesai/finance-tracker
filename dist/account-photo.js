// Account identity is deliberately separate from tracker snapshots and backups.
export async function compressAccountPhoto(file){
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('Choose a JPG, PNG, WebP or GIF image.');
  if(file.size>12*1024*1024)throw new Error('Choose an image smaller than 12 MB.');
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight)throw new Error('This image could not be opened.');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,256);
    const size=Math.min(image.naturalWidth,image.naturalHeight);
    ctx.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,256,256);
    const result=canvas.toDataURL('image/jpeg',0.8);
    if(result.length>120000)throw new Error('This image is too detailed. Choose a smaller image.');
    return result;
  }finally{URL.revokeObjectURL(url);}
}
export async function initializeAccountPhoto(api){
  const panel=document.getElementById('settingsAccountPanel');if(!panel||document.getElementById('accountPhotoSection'))return;
  const key='pft-account-photo:'+api.uid;
  const valid=value=>typeof value==='string'&&(value===''||value.length<=120000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value));
  let source='',busy=false,revision=0;
  const googlePhoto=typeof api.googlePhotoURL==='string'&&/^https:\/\//i.test(api.googlePhotoURL)?api.googlePhotoURL:'';
  try{const cached=localStorage.getItem(key);if(valid(cached))source=cached;}catch{}
  const originals=new Map([...document.querySelectorAll('[data-family-profile-trigger]')].map(button=>[button,button.dataset.personalIcon||button.innerHTML]));
  const section=document.createElement('section');section.id='accountPhotoSection';section.className='account-photo-section';
  section.innerHTML='<h3>Profile photo</h3><div class="account-photo-row"><div class="account-photo-avatar" aria-label="Account photo"><span aria-hidden="true">👤</span></div><div><div class="account-photo-actions"><button type="button" id="accountPhotoChoose">Add photo</button><button type="button" id="accountPhotoRemove">Remove</button></div><p>Choose a photo from your device. The centre is cropped to a square.</p></div></div><p>Your Google photo is used by default. Add a custom photo any time. Tap the header photo to choose a family profile.</p><p id="accountPhotoStatus" role="status" aria-live="polite"></p><input type="file" id="accountPhotoFile" accept="image/jpeg,image/png,image/webp,image/gif" hidden>';
  panel.querySelector('p').after(section);
  const choose=section.querySelector('#accountPhotoChoose'),remove=section.querySelector('#accountPhotoRemove'),input=section.querySelector('input'),status=section.querySelector('#accountPhotoStatus'),avatar=section.querySelector('.account-photo-avatar');
  function image(url,onFailure){const img=document.createElement('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';img.className='account-header-photo';if(onFailure)img.onerror=onFailure;return img;}
  function render(){
    const displayPhoto=source||googlePhoto;
    for(const [button,markup] of originals){
      const fallback=()=>{button.innerHTML=button.dataset.familyProfileView==='combined'?button.dataset.householdIcon:markup;button.classList.remove('has-account-photo');};
      if(displayPhoto){button.replaceChildren(image(displayPhoto,fallback));button.classList.add('has-account-photo');}else fallback();
    }
    if(displayPhoto)avatar.replaceChildren(image(displayPhoto,()=>{avatar.textContent='👤';}));else avatar.textContent='👤';
    choose.textContent=source?'Change photo':'Add photo';remove.hidden=!source;choose.disabled=remove.disabled=busy;
  }
  window.addEventListener('pft-profile-view-change',render);
  function cache(){try{if(source)localStorage.setItem(key,source);else localStorage.removeItem(key);}catch{}}
  async function save(next){
    if(!navigator.onLine)throw new Error('Connect to the internet to save your profile photo.');
    await api.save(next);source=next;cache();status.textContent=next?'Photo saved.':googlePhoto?'Custom photo removed. Showing Google photo.':'Photo removed.';
  }
  async function action(work){if(busy)return;busy=true;revision++;render();status.textContent='Saving photo…';try{await work();}catch(error){status.textContent=error.message||'Unable to save the photo. Try again.';}finally{busy=false;input.value='';render();}}
  choose.onclick=()=>input.click();
  input.onchange=()=>{const file=input.files[0];if(file)action(async()=>save(await compressAccountPhoto(file)));};
  remove.onclick=()=>action(()=>save(''));
  render();const loadingRevision=revision;
  try{const remote=await api.load();if(revision===loadingRevision&&valid(remote)){source=remote;cache();render();}}
  catch{status.textContent=source?'Showing the saved photo on this device.':'Connect to the internet to load your account photo.';}
}
