const $=id=>document.getElementById(id);
const api=(p,o={})=>fetch(p,{credentials:"include",...o}).then(async r=>({ok:r.ok,data:await r.json().catch(()=>({}))}));
let categories=[];

async function start(){
  const r=await api("/api/admin/me");
  if(r.ok) showApp(); else showLogin();
}
function showLogin(){$("login").hidden=false;$("app").hidden=true}
function showApp(){$("login").hidden=true;$("app").hidden=false;loadCategories();loadPosts()}
$("loginForm").onsubmit=async e=>{
  e.preventDefault(); $("loginMsg").textContent="";
  const r=await api("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("email").value,password:$("password").value})});
  if(r.ok) showApp(); else $("loginMsg").textContent=r.data.error||"Login gagal";
};
$("logout").onclick=async()=>{await api("/api/admin/logout",{method:"POST"});showLogin()};
async function loadCategories(){
  const r=await api("/api/categories"); categories=r.data||[];
  $("category").innerHTML=categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
async function loadPosts(){
  const r=await api("/api/admin/posts");
  if(!r.ok){$("list").innerHTML="<p>Gagal memuat berita.</p>";return}
  $("list").innerHTML=(r.data||[]).map(p=>`
  <article class="post">
    <div><h3>${esc(p.title)}</h3><div class="meta">${esc(p.category_name||"Tanpa kategori")} · ${p.status} ${p.is_headline?"· HEADLINE":""}</div></div>
    <div class="actions"><button onclick="editPost(${p.id})">Edit</button><button onclick="delPost(${p.id})">Hapus</button></div>
  </article>`).join("")||"<p>Belum ada berita.</p>";
}
$("newBtn").onclick=()=>openEditor();
$("closeBtn").onclick=()=>{$("editor").hidden=true};
function openEditor(p=null){
  $("editor").hidden=false;$("editorTitle").textContent=p?"Edit Berita":"Tulis Berita";
  $("postId").value=p?.id||"";$("title").value=p?.title||"";$("slug").value=p?.slug||"";
  $("category").value=p?.category_id||categories[0]?.id||"";$("image").value=p?.featured_image||"";
  $("excerpt").value=p?.excerpt||"";$("content").value=p?.content||"";$("headline").checked=!!p?.is_headline;
  $("status").value=p?.status||"draft";window.scrollTo({top:0,behavior:"smooth"});
}
$("title").addEventListener("input",()=>{if(!$("postId").value)$("slug").value=$("title").value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-")});
$("postForm").onsubmit=async e=>{
  e.preventDefault();$("saveMsg").textContent="";
  const body={title:$("title").value,slug:$("slug").value,category_id:Number($("category").value)||null,
    featured_image:$("image").value||null,excerpt:$("excerpt").value,content:$("content").value,
    status:$("status").value,is_headline:$("headline").checked};
  const id=$("postId").value;
  const r=await api(id?`/api/admin/posts/${id}`:"/api/admin/posts",{method:id?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(r.ok){$("saveMsg").style.color="#079b58";$("saveMsg").textContent="Tersimpan";loadPosts();setTimeout(()=>{$("editor").hidden=true},500)}
  else {$("saveMsg").textContent=r.data.error||"Gagal menyimpan"}
};
window.editPost=async id=>{const r=await api(`/api/admin/posts/${id}`);if(r.ok)openEditor(r.data)};
window.delPost=async id=>{if(!confirm("Hapus berita ini?"))return;const r=await api(`/api/admin/posts/${id}`,{method:"DELETE"});if(r.ok)loadPosts();else alert(r.data.error||"Gagal menghapus")};
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
start();
