const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = s => { try { const u=new URL(s); return ["http:","https:"].includes(u.protocol)?u.href:""; } catch { return ""; } };
let activeTab="emulators", adminData=null;
$("#year").textContent=new Date().getFullYear();

async function request(url, options={}) {
  const r=await fetch(url,{headers:{"Content-Type":"application/json"},...options});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||"حدث خطأ.");
  return data;
}
function cardImage(url, fallback="🎮") {
  const u=safeUrl(url);
  return u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.parentElement.textContent='${fallback}'">` : fallback;
}
function renderPublic(data) {
  $("#emuCount").textContent=`${data.emulators.length} محاكي`;
  $("#steamCount").textContent=`${data.steam.length} حساب`;
  $("#emulatorGrid").innerHTML=data.emulators.length?data.emulators.map(x=>`
    <article class="item-card"><div class="item-image">${cardImage(x.image)}</div><div class="item-body">
      <h3>${esc(x.name)}</h3><div class="meta">${x.version?`الإصدار ${esc(x.version)}`:"محاكي"}</div>
      <p>${esc(x.description||"لا يوجد وصف بعد.")}</p>
      ${safeUrl(x.downloadUrl)?`<a class="btn" target="_blank" rel="noopener" href="${esc(safeUrl(x.downloadUrl))}">تحميل المحاكي ↗</a>`:""}
    </div></article>`).join(""):`<div class="empty">لا توجد محاكيات حاليًا. ستظهر هنا عند إضافتها من لوحة الإدارة.</div>`;
  $("#steamGrid").innerHTML=data.steam.length?data.steam.map(x=>`
    <article class="item-card"><div class="item-image">${cardImage(x.image,"♙")}</div><div class="item-body">
      <h3>${esc(x.title)}</h3><div class="meta">${esc(x.status||"معلومات")}</div>
      <p>${esc(x.games||"الألعاب غير محددة.")}</p><p>${esc(x.description||"")}</p>
      ${safeUrl(x.profileUrl)?`<a class="btn outline" target="_blank" rel="noopener" href="${esc(safeUrl(x.profileUrl))}">ملف Steam ↗</a>`:""}
    </div></article>`).join(""):`<div class="empty">لا توجد حسابات Steam معروضة حاليًا.</div>`;
}
async function refreshPublic(){try{renderPublic(await request("/api/public"));}catch(e){console.error(e)}}
$("#adminOpen").onclick=async()=>{ $("#loginModal").classList.remove("hidden"); $("#loginMessage").textContent=""; };
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.add("hidden"));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));
$("#loginForm").onsubmit=async e=>{
  e.preventDefault(); const fd=new FormData(e.target);
  try{await request("/api/login",{method:"POST",body:JSON.stringify(Object.fromEntries(fd))});$("#loginModal").classList.add("hidden");await openAdmin();}
  catch(err){$("#loginMessage").textContent=err.message;}
};
async function openAdmin(){
  try{adminData=await request("/api/admin/data");$("#adminModal").classList.remove("hidden");renderAdmin();}
  catch(e){$("#loginModal").classList.remove("hidden");$("#loginMessage").textContent=e.message;}
}
$("#logout").onclick=async()=>{await request("/api/logout",{method:"POST"});$("#adminModal").classList.add("hidden");adminData=null;};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===b));renderAdmin();});
function field(label,name,placeholder="",type="text",value=""){
 return `<label class="field">${label}<input name="${name}" type="${type}" placeholder="${esc(placeholder)}" value="${esc(value)}"></label>`;
}
function textarea(label,name,value=""){return `<label class="field fullrow">${label}<textarea name="${name}" rows="2">${esc(value)}</textarea></label>`}
function itemRows(kind,items){
 return `<div class="admin-list">${items.map(x=>`<div class="admin-row"><div><b>${esc(kind==="emulators"?x.name:x.title)}</b><small>${esc(kind==="emulators"?x.version:(x.games||x.status))}</small></div><div class="actions"><button class="small-btn" data-edit="${kind}" data-id="${esc(x.id)}">تعديل</button><button class="small-btn danger" data-delete="${kind}" data-id="${esc(x.id)}">حذف</button></div></div>`).join("")||'<p class="hint">لا توجد عناصر بعد.</p>'}</div>`;
}
function renderAdmin(){
 if(!adminData)return;
 const root=$("#adminContent");
 if(activeTab==="emulators"){
  root.innerHTML=`<h3>إضافة محاكي</h3><form id="emuForm" class="admin-form">
  ${field("اسم المحاكي","name","مثال: Winlator")}${field("الإصدار","version","مثال: 8.0")}
  ${field("رابط الصورة","image","https://...")}${field("رابط التحميل","downloadUrl","https://...")}
  ${textarea("الوصف","description")}<button class="btn fullrow">إضافة المحاكي</button></form>${itemRows("emulators",adminData.emulators)}`;
  $("#emuForm").onsubmit=async e=>{e.preventDefault();try{await request("/api/admin/emulators",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});$("#adminMessage").textContent="تمت إضافة المحاكي.";await reloadAdmin();}catch(err){$("#adminMessage").textContent=err.message;}};
 } else if(activeTab==="steam"){
  root.innerHTML=`<h3>إضافة معلومات حساب Steam</h3><form id="steamForm" class="admin-form">
  ${field("عنوان الحساب","title","مثال: Steam Library #01")}${field("الحالة","status","متاح")}
  ${field("رابط الصورة","image","https://...")}${field("رابط ملف Steam","profileUrl","https://steamcommunity.com/...")}
  ${textarea("الألعاب الموجودة","games")}${textarea("الوصف","description")}<button class="btn fullrow">إضافة</button></form>${itemRows("steam",adminData.steam)}`;
  $("#steamForm").onsubmit=async e=>{e.preventDefault();try{await request("/api/admin/steam",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});$("#adminMessage").textContent="تمت إضافة المعلومات.";await reloadAdmin();}catch(err){$("#adminMessage").textContent=err.message;}};
 } else {
  root.innerHTML=`<h3>إضافة Admin جديد</h3><p class="hint">شارك بيانات الدخول مع المشرف الموثوق فقط. كلمة المرور لا تُعرض بعد حفظها.</p>
  <form id="adminForm" class="admin-form">${field("اسم المستخدم","username","مثال: moderator")}${field("كلمة مرور قوية (10 أحرف على الأقل)","password","","password")}<button class="btn fullrow">إضافة المشرف</button></form>
  <div class="admin-list">${adminData.admins.map(a=>`<div class="admin-row"><div><b>${esc(a.username)}</b><small>تمت إضافته: ${esc((a.createdAt||"").slice(0,10))}</small></div><div class="actions">${a.id===adminData.currentAdmin.id?'<span class="hint">حسابك الحالي</span>':`<button class="small-btn danger" data-delete="admins" data-id="${esc(a.id)}">حذف</button>`}</div></div>`).join("")}</div>`;
  $("#adminForm").onsubmit=async e=>{e.preventDefault();try{await request("/api/admin/admins",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});$("#adminMessage").textContent="تمت إضافة المشرف.";await reloadAdmin();}catch(err){$("#adminMessage").textContent=err.message;}};
 }
 root.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("هل تريد الحذف؟"))return;try{await request(`/api/admin/${b.dataset.delete}/${b.dataset.id}`,{method:"DELETE"});await reloadAdmin();}catch(e){$("#adminMessage").textContent=e.message;}});
 root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editItem(b.dataset.edit,b.dataset.id));
}
async function editItem(kind,id){
 const list=kind==="emulators"?adminData.emulators:adminData.steam, x=list.find(i=>i.id===id);
 const keys=kind==="emulators"?["name","version","image","downloadUrl","description"]:["title","status","image","profileUrl","games","description"];
 const labels={name:"اسم المحاكي",version:"الإصدار",image:"رابط الصورة",downloadUrl:"رابط التحميل",description:"الوصف",title:"العنوان",status:"الحالة",profileUrl:"رابط ملف Steam",games:"الألعاب"};
 const vals={};for(const k of keys){const v=prompt(labels[k],x[k]||"");if(v===null)return;vals[k]=v;}
 try{await request(`/api/admin/${kind}/${id}`,{method:"PUT",body:JSON.stringify(vals)});$("#adminMessage").textContent="تم التعديل.";await reloadAdmin();}catch(e){$("#adminMessage").textContent=e.message;}
}
async function reloadAdmin(){adminData=await request("/api/admin/data");renderAdmin();await refreshPublic();}
(async()=>{await refreshPublic();try{const s=await request("/api/session");if(s.loggedIn)await openAdmin();}catch(e){}})();
