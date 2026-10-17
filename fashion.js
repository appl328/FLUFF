/* FLUFF Fashion: independent local collection; original image bytes are preserved. */
(()=>{'use strict';
const $=id=>document.getElementById(id), uid=()=>crypto.randomUUID(), versions=['여성','남성','공용','기타'];
const MIME=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif']);
let db, entries=[], version='여성', draft=null, pending=null, busy=false, imageReads=0;
let urls=[];
const message=(text)=>{const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2000);};
const errorText=e=>e?.name==='QuotaExceededError'?'브라우저 저장 공간이 부족함 · 백업 후 불필요한 이미지를 정리해 주세요':e?.message||'저장 작업을 완료하지 못했습니다';
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('fluff_fashion_v1:'+new URL('./',location.href).pathname,1);req.onupgradeneeded=()=>req.result.createObjectStore('entries',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>{$('fashionError').textContent='다른 FLUFF 창을 닫고 다시 열어 주세요';};});}
function readAll(){return new Promise((resolve,reject)=>{const t=db.transaction('entries','readonly'),req=t.objectStore('entries').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function write(action){return new Promise((resolve,reject)=>{const tx=db.transaction('entries','readwrite');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('저장이 취소되었습니다'));tx.onerror=()=>{};try{action(tx.objectStore('entries'));}catch(e){tx.abort();reject(e);}});}
function lock(value){busy=value;for(const id of ['fashionAdd','fashionExport','fashionImport','fashionMerge','fashionReplace','fashionImportCancel'])$(id).disabled=value;}
function objectURL(blob){const url=URL.createObjectURL(blob);urls.push(url);return url;}
function button(text,cls,action,label){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;if(label)b.setAttribute('aria-label',label);b.onclick=action;return b;}
async function copyTag(entry){
 try{await navigator.clipboard.writeText(entry.tag);message('태그 복사됨');}
 catch{const field=document.createElement('textarea');field.value=entry.tag;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();const ok=document.execCommand('copy');field.remove();if(ok)message('태그 복사됨');else $('fashionError').textContent='복사가 차단됨 · 편집창에서 태그를 직접 복사해 주세요';}
}
function attachGestures(photo,entry){
 let press=null,timer=null,lastTap=null,lastTouchCopy=0;
 const cancel=()=>{clearTimeout(timer);timer=null;press=null;};
 const open=()=>{cancel();lastTap=null;if(!busy&&!$('fashionEditor').open)edit(entry);};
 photo.addEventListener('contextmenu',ev=>{ev.preventDefault();open();});
 photo.addEventListener('pointerdown',ev=>{
  if(ev.button!==0||!ev.isPrimary)return;cancel();press={x:ev.clientX,y:ev.clientY,type:ev.pointerType};
  timer=setTimeout(open,550);
 });
 photo.addEventListener('pointermove',ev=>{if(press&&Math.hypot(ev.clientX-press.x,ev.clientY-press.y)>10){cancel();lastTap=null;}});
 photo.addEventListener('pointercancel',()=>{cancel();lastTap=null;});
 photo.addEventListener('pointerleave',()=>cancel());
 photo.addEventListener('pointerup',ev=>{
  if(!press)return;const point=press;cancel();if(point.type==='mouse')return;
  const now=Date.now();
  if(lastTap&&now-lastTap.time<360&&Math.hypot(ev.clientX-lastTap.x,ev.clientY-lastTap.y)<24){lastTap=null;lastTouchCopy=now;copyTag(entry);}
  else lastTap={time:now,x:ev.clientX,y:ev.clientY};
 });
 photo.addEventListener('dblclick',ev=>{ev.preventDefault();if(Date.now()-lastTouchCopy>500&&!$('fashionEditor').open)copyTag(entry);});
 photo.addEventListener('click',ev=>{if(ev.detail===0&&!$('fashionEditor').open)copyTag(entry);});
 photo.addEventListener('keydown',ev=>{if(ev.key==='ContextMenu'||(ev.shiftKey&&ev.key==='F10')){ev.preventDefault();open();}});
}
function render(){urls.forEach(URL.revokeObjectURL);urls=[];const grid=$('fashionGrid');grid.replaceChildren();const q=$('fashionSearch').value.trim().toLocaleLowerCase();const all=entries.filter(e=>e.version===version);const list=all.filter(e=>e.tag.toLocaleLowerCase().includes(q)).sort((a,b)=>b.createdAt-a.createdAt);
 $('fashionCount').textContent=`${version} · ${list.length}개${q?' / 전체 '+all.length+'개':''}`;
 if(!list.length){const empty=document.createElement('div');empty.className='fashion-empty';empty.textContent=q?'검색 결과가 없음':`${version}에 등록된 이미지가 없음`;grid.append(empty);return;}
 for(const e of list){const card=document.createElement('article');card.className='fashion-card';card.dataset.id=e.id;const media=document.createElement('div');media.className='fashion-media';const photo=button('','fashion-photo',null,'패션 이미지 · 두 번 눌러 태그 복사, 길게 눌러 편집');const img=document.createElement('img');img.loading='lazy';img.draggable=false;img.alt='패션 이미지';img.src=objectURL(e.images[0].blob);photo.append(img);attachGestures(photo,e);media.append(photo);
 card.append(media);grid.append(card);}
}
function edit(e){draft=e?{...e,images:e.images.map(i=>({...i}))}:{id:uid(),version,tag:'',images:[],createdAt:Date.now()};$('fashionEditorTitle').textContent=e?'패션 편집':'새 패션 등록';$('fashionVersion').value=draft.version;$('fashionTag').value=draft.tag;$('fashionEditError').textContent='';$('fashionSave').disabled=false;$('fashionImages').disabled=false;imageReads=0;renderThumbs();let del=$('fashionDelete');if(!del){del=button('패션 삭제','btn danger',removeEntry);del.id='fashionDelete';$('fashionForm').querySelector('.actions').prepend(del);}del.hidden=!e;$('fashionEditor').showModal();$('fashionTag').focus();}
let thumbURLs=[];
function renderThumbs(){thumbURLs.forEach(URL.revokeObjectURL);thumbURLs=[];$('fashionThumbs').replaceChildren();draft.images.forEach(im=>{const box=document.createElement('div');box.className='fashion-thumb';const image=document.createElement('img');const url=URL.createObjectURL(im.blob);thumbURLs.push(url);image.src=url;image.alt=im.name||'등록 이미지';const bar=document.createElement('div');bar.append(button('이미지 삭제','',()=>{draft.images=[];renderThumbs();}));box.append(image,bar);$('fashionThumbs').append(box);});}
async function validateImage(blob){if(!MIME.has(blob.type))throw new Error('지원하지 않는 이미지 형식입니다');if(blob.size>20*1024*1024)throw new Error('이미지는 장당 20MB 이하여야 합니다');if(!blob.size)throw new Error('빈 이미지 파일입니다');const url=URL.createObjectURL(blob);try{const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth)throw Error();}catch{throw new Error('읽을 수 없는 이미지 파일입니다');}finally{URL.revokeObjectURL(url);}}
$('fashionImages').onchange=async ev=>{const files=[...ev.target.files];ev.target.value='';const current=draft;imageReads++;$('fashionSave').disabled=true;$('fashionImages').disabled=true;$('fashionEditError').textContent='이미지 확인 중…';try{const added=[];for(const f of files){await validateImage(f);added.push({id:uid(),name:f.name,blob:f});}if(draft===current&&$('fashionEditor').open){draft.images=added.slice(0,1);renderThumbs();$('fashionEditError').textContent='';}}catch(e){if(draft===current)$('fashionEditError').textContent=errorText(e);}finally{if(draft===current){imageReads--;$('fashionSave').disabled=imageReads>0;$('fashionImages').disabled=false;}}};
$('fashionForm').onsubmit=async ev=>{ev.preventDefault();if(busy||imageReads)return;const tag=$('fashionTag').value.trim();if(!tag||!draft.images.length){$('fashionEditError').textContent=!tag?'패션 태그를 입력해 주세요':'이미지를 한 장 이상 등록해 주세요';return;}const record={...draft,tag,version:$('fashionVersion').value,updatedAt:Date.now()};lock(true);$('fashionSave').disabled=true;$('fashionCancel').disabled=true;$('fashionDelete').disabled=true;try{await write(store=>store.put(record));entries=await readAll();setVersion(record.version);$('fashionEditor').close();message('패션 저장됨');}catch(e){$('fashionEditError').textContent=errorText(e);}finally{lock(false);$('fashionSave').disabled=false;$('fashionCancel').disabled=false;$('fashionDelete').disabled=false;}};
async function removeEntry(){if(busy||!confirm('이 패션의 태그와 등록 이미지를 삭제할까요?'))return;lock(true);try{await write(store=>store.delete(draft.id));entries=await readAll();$('fashionEditor').close();render();message('패션 삭제됨');}catch(e){$('fashionEditError').textContent=errorText(e);}finally{lock(false);}}
$('fashionEditor').addEventListener('cancel',e=>{if(busy)e.preventDefault();});$('fashionEditor').addEventListener('close',()=>{thumbURLs.forEach(URL.revokeObjectURL);thumbURLs=[];draft=null;});$('fashionCancel').onclick=()=>{if(!busy)$('fashionEditor').close();};$('fashionAdd').onclick=()=>edit(null);
function setVersion(v){version=v;document.querySelectorAll('[data-fashion-version]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.fashionVersion===v)));render();}
for(const b of document.querySelectorAll('[data-fashion-version]'))b.onclick=()=>setVersion(b.dataset.fashionVersion);
$('fashionSearch').oninput=render;
const toDataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
$('fashionExport').onclick=async()=>{if(busy)return;lock(true);$('fashionError').textContent='';try{const all=await readAll(),records=[];for(const e of all){const images=[];for(const im of e.images)images.push({id:im.id,name:im.name,data:await toDataURL(im.blob)});records.push({...e,images});}const blob=new Blob([JSON.stringify({format:'fluff-fashion',version:1,exportedAt:new Date().toISOString(),entries:records})],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fluff-fashion-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('Fashion 전체 백업 저장됨');}catch(e){$('fashionError').textContent=errorText(e);}finally{lock(false);}};
async function parseBackup(file){const data=JSON.parse(await file.text());if(data?.format!=='fluff-fashion'||data.version!==1||!Array.isArray(data.entries))throw new Error('Fashion 백업 파일이 아닙니다');const ids=new Set(),out=[];for(const e of data.entries){if(!e||typeof e.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(e.id)||ids.has(e.id)||!versions.includes(e.version)||typeof e.tag!=='string'||!e.tag.trim()||e.tag.length>2000||!Array.isArray(e.images)||e.images.length!==1)throw new Error('백업의 패션 정보가 올바르지 않습니다');ids.add(e.id);const images=[];for(const im of e.images){if(typeof im?.data!=='string')throw new Error('백업 이미지가 올바르지 않습니다');const m=/^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/]*={0,2})$/.exec(im.data);if(!m||m[2].length>28*1024*1024)throw new Error('백업 이미지 형식이나 크기가 올바르지 않습니다');const binary=atob(m[2]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const blob=new Blob([bytes],{type:m[1]});await validateImage(blob);images.push({id:uid(),name:typeof im.name==='string'?im.name.slice(0,500):'image',blob});}out.push({id:e.id,version:e.version,tag:e.tag.trim(),images,createdAt:Number.isFinite(e.createdAt)?e.createdAt:Date.now(),updatedAt:Number.isFinite(e.updatedAt)?e.updatedAt:Date.now()});}return out;}
$('fashionImport').onclick=()=>$('fashionBackupFile').click();$('fashionBackupFile').onchange=async ev=>{const file=ev.target.files[0];ev.target.value='';if(!file||busy)return;lock(true);$('fashionError').textContent='백업 확인 중…';try{pending=await parseBackup(file);$('fashionImportSummary').textContent=versions.map(v=>v+' '+pending.filter(e=>e.version===v).length+'개').join(' · ');$('fashionError').textContent='';$('fashionImportDialog').showModal();}catch(e){pending=null;$('fashionError').textContent=errorText(e);}finally{lock(false);}};
async function importEntries(replace){if(busy||!pending)return;if(replace&&!confirm('모든 카테고리의 패션 카드를 백업 내용으로 교체합니다. 계속할까요?'))return;lock(true);try{await write(store=>{if(replace)store.clear();for(const e of pending){if(replace)store.put(e);else{const req=store.get(e.id);req.onsuccess=()=>{if(!req.result)store.put(e);};}}});entries=await readAll();render();$('fashionImportDialog').close();pending=null;message(replace?'전체 복원 완료':'목록 추가 완료');}catch(e){$('fashionError').textContent=errorText(e);$('fashionImportDialog').close();}finally{lock(false);}}
$('fashionMerge').onclick=()=>importEntries(false);$('fashionReplace').onclick=()=>importEntries(true);$('fashionImportCancel').onclick=()=>{$('fashionImportDialog').close();pending=null;};$('fashionImportDialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();else pending=null;});
(async()=>{try{db=await openDB();db.onversionchange=()=>db.close();entries=await readAll();render();lock(false);}catch(e){$('fashionError').textContent='로컬 저장소를 열지 못했습니다 · '+errorText(e);$('fashionCount').textContent='저장소 접근 실패';}})();
})();
