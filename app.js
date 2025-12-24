"use strict";

// ===== إعداداتك =====
const YT_API_KEY = "AIzaSyD3mvCx80XsvwrURRg2RwaD8HmOKqhYkek";

const PLAYLISTS = {
  rap: "PL2FIA-SoBgYtotc48ZfKSYagxMd3AMmVp",
  sad: "PL2FIA-SoBgYvY4B-0IDWTtKriVGPb1qnx",
};

const LINKS = {
  youtube: "https://youtube.com/@f90-music?si=VnsVH56lT7UV8N4n",
  tiktok:  "https://www.tiktok.com/@f90.business?_r=1&_t=ZS-91tnkFox3hp",
  insta:   "https://www.instagram.com/f90_yt?igsh=MWxmM2ttYjVwZnN4bQ==",
  whatsapp:"https://wa.me/970568181910",
  email:   "mailto:f90gimme@gmail.com",
};

const $ = (id)=>document.getElementById(id);
const escapeHtml = (s)=>String(s ?? "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtDate = (iso)=> new Date(iso).toLocaleDateString("ar", {year:"numeric", month:"short", day:"numeric"});

// ===== حالة الموقع =====
const state = {
  all: [],
  rap: [],
  sad: [],
  currentListName: "all",
  currentList: [],
  now: null,
  currentIndex: -1,
  isPlaying: false,
};

// ===== روابط =====
function setHrefAll(k, url){
  document.querySelectorAll(`[data-link="${k}"]`).forEach(a=>a.href=url);
}
function injectLinks(){
  Object.keys(LINKS).forEach(k=> setHrefAll(k, LINKS[k]));
}

// ===== Drawer (نهائي) =====
function bindDrawer(){
  const drawerBtn = $("drawerBtn");
  const drawer    = $("drawer");
  const overlay   = $("drawerOverlay");
  const closeBtn  = $("closeDrawer");

  if(!drawerBtn || !drawer || !overlay || !closeBtn) return;

  const open = ()=>{
    drawer.classList.add("open");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  };
  const close = ()=>{
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  };

  // اقفل فورًا (حتى لو CSS عاملها ظاهرة)
  close();

  drawerBtn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); open(); });
  closeBtn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); close(); });

  overlay.addEventListener("pointerdown", (e)=>{
    e.preventDefault(); e.stopPropagation(); close();
  }, true);

  drawer.addEventListener("click", (e)=>{
    if(e.target.closest("a")) close();
  }, true);

  window.addEventListener("hashchange", close);
  document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") close(); });

  document.addEventListener("pointerdown", (e)=>{
    if(!drawer.classList.contains("open")) return;
    if(e.target.closest("#drawer")) return;
    if(e.target.closest("#drawerBtn")) return;
    close();
  }, true);
}

// ===== YouTube Data API =====
async function ytFetch(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error("YT API error " + r.status);
  return r.json();
}

async function getAllPlaylistItems(playlistId){
  let items = [];
  let pageToken = "";

  while(true){
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems` +
      `?part=snippet,contentDetails&maxResults=50` +
      `&playlistId=${encodeURIComponent(playlistId)}` +
      `&pageToken=${encodeURIComponent(pageToken)}` +
      `&key=${encodeURIComponent(YT_API_KEY)}`;

    const data = await ytFetch(url);

    const chunk = (data.items || []).map(it=>{
      const vid = it.contentDetails?.videoId;
      const title = it.snippet?.title || "";
      const publishedAt = it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt || "";
      const thumb = it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url || "";
      return { id: vid, title, publishedAt, thumb };
    }).filter(v=> v.id && v.title && v.title !== "Private video" && v.title !== "Deleted video");

    items.push(...chunk);

    if(!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  // إزالة تكرار
  const m = new Map();
  items.forEach(v=>{ if(!m.has(v.id)) m.set(v.id, v); });
  return Array.from(m.values());
}

// ===== UI =====
function renderGrid(list){
  const grid = $("grid");
  if(!grid) return;

  if(!list.length){
    grid.innerHTML = `<div class="sideCard" style="margin:18px"><div class="sideCardTitle">لا يوجد أغاني لعرضها</div></div>`;
    return;
  }

  grid.innerHTML = list.map(t=>`
    <article class="item" data-id="${escapeHtml(t.id)}">
      <img class="thumb" src="${escapeHtml(t.thumb)}" alt="">
      <div class="itemBody">
        <p class="itemTitle">${escapeHtml(t.title)}</p>
        <p class="itemMeta">${escapeHtml(fmtDate(t.publishedAt))}</p>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      location.hash = `#/track/${encodeURIComponent(id)}`;
    });
  });
}

function updateHeader(view){
  const map = {
    home:["الرئيسية","آخر الإصدارات"],
    all:["كل الأغاني","مجمّعة من القوائم"],
    rap:["الراب","قائمة الراب"],
    sad:["رومنسي/حزين/طربي","القائمة الثانية"],
    track:["الأغنية","تشغيل"]
  };
  const t = map[view] || ["F90 Music","—"];
  if($("viewTitle")) $("viewTitle").textContent = t[0];
  if($("viewSubtitle")) $("viewSubtitle").textContent = t[1];
}

function setCurrentList(name){
  state.currentListName = name;
  if(name==="rap") state.currentList = state.rap.slice();
  else if(name==="sad") state.currentList = state.sad.slice();
  else state.currentList = state.all.slice();

  if(state.now){
    state.currentIndex = state.currentList.findIndex(x=>x.id === state.now.id);
  }
}

function applySearchSort(){
  const q = ($("searchInput")?.value || "").trim().toLowerCase();
  const sort = $("sortSelect")?.value || "date_desc";

  let list = state.currentList.slice();

  if(q) list = list.filter(x=>x.title.toLowerCase().includes(q));

  if(sort==="date_desc") list.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  if(sort==="date_asc")  list.sort((a,b)=> new Date(a.publishedAt)-new Date(b.publishedAt));
  if(sort==="title_asc") list.sort((a,b)=> a.title.localeCompare(b.title));

  renderGrid(list);
}

function openTrack(videoId, autoplay){
  const t = state.all.find(x=>x.id===videoId) || state.rap.find(x=>x.id===videoId) || state.sad.find(x=>x.id===videoId);
  if(!t) return;

  state.now = t;
  const idx = state.currentList.findIndex(x=>x.id===videoId);
  if(idx >= 0) state.currentIndex = idx;

  if($("miniTitle")) $("miniTitle").textContent = t.title;
  if($("miniMeta")) $("miniMeta").textContent = fmtDate(t.publishedAt);
  if($("songTitle")) $("songTitle").textContent = t.title;
  if($("songMeta")) $("songMeta").textContent = fmtDate(t.publishedAt);

  const ytBtn = $("ytBtn");
  if(ytBtn) ytBtn.href = `https://www.youtube.com/watch?v=${encodeURIComponent(t.id)}`;

  // إذا عندك iframe في song panel:
  const frame = $("playerFrame");
  if(frame){
    frame.src = `https://www.youtube.com/embed/${encodeURIComponent(t.id)}?autoplay=${autoplay?1:0}&playsinline=1&rel=0`;
  }else{
    // وإذا أنت تستخدم IFrame API: تجاهل هذا
  }

  $("panelSong")?.classList.add("show");
}

function playNext(){
  const list = state.currentList.length ? state.currentList : state.all;
  if(!list.length) return;

  if(state.currentIndex < 0) state.currentIndex = 0;
  else state.currentIndex = (state.currentIndex + 1) % list.length;

  openTrack(list[state.currentIndex].id, true);
  state.isPlaying = true;
  if($("playBtn")) $("playBtn").textContent = "⏸";
}

function playPrev(){
  const list = state.currentList.length ? state.currentList : state.all;
  if(!list.length) return;

  if(state.currentIndex < 0) state.currentIndex = 0;
  else state.currentIndex = (state.currentIndex - 1 + list.length) % list.length;

  openTrack(list[state.currentIndex].id, true);
  state.isPlaying = true;
  if($("playBtn")) $("playBtn").textContent = "⏸";
}

function playToggle(){
  // هذا Toggle بسيط للـ iframe: تشغيل = reload autoplay=1 / إيقاف = autoplay=0
  if(!state.now){
    const first = state.currentList[0] || state.all[0];
    if(first) openTrack(first.id, true);
    state.isPlaying = true;
    if($("playBtn")) $("playBtn").textContent = "⏸";
    return;
  }

  const frame = $("playerFrame");
  if(!frame){
    // إذا ما عندك iframe، اتركه (موقعك القديم كان IFrame API)
    return;
  }

  if(state.isPlaying){
    frame.src = `https://www.youtube.com/embed/${encodeURIComponent(state.now.id)}?autoplay=0&playsinline=1&rel=0`;
    state.isPlaying = false;
    if($("playBtn")) $("playBtn").textContent = "▶";
  }else{
    frame.src = `https://www.youtube.com/embed/${encodeURIComponent(state.now.id)}?autoplay=1&playsinline=1&rel=0`;
    state.isPlaying = true;
    if($("playBtn")) $("playBtn").textContent = "⏸";
  }
}

function route(){
  const h = location.hash || "#/home";
  const parts = h.replace("#/","").split("/");
  const view = parts[0] || "home";
  const id = parts[1] ? decodeURIComponent(parts[1]) : null;

  updateHeader(view);

  const hero = $("hero");
  const toolbar = $("toolbar");
  const panel = $("panelSong");

  if(hero) hero.style.display = (view==="home") ? "" : "none";
  if(toolbar) toolbar.style.display = (view==="track") ? "none" : "";
  if(panel) panel.classList.toggle("show", view==="track");

  if(view==="rap") setCurrentList("rap");
  else if(view==="sad") setCurrentList("sad");
  else setCurrentList("all");

  if(view==="home"){ renderGrid(state.all.slice(0,18)); return; }
  if(view==="all"){ renderGrid(state.all); return; }
  if(view==="rap"){ renderGrid(state.rap); return; }
  if(view==="sad"){ renderGrid(state.sad); return; }
  if(view==="track" && id){ openTrack(id, false); return; }

  renderGrid(state.all.slice(0,18));
}

// ===== تحميل البيانات =====
async function bootstrap(){
  const status = $("homeStatus");
  if(status) status.textContent = "جاري تحميل الأغاني...";

  try{
    const [rap, sad] = await Promise.all([
      getAllPlaylistItems(PLAYLISTS.rap),
      getAllPlaylistItems(PLAYLISTS.sad),
    ]);

    state.rap = rap.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
    state.sad = sad.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

    // دمج للقائمة الرئيسية
    const m = new Map();
    [...state.rap, ...state.sad].forEach(v=>{ if(!m.has(v.id)) m.set(v.id, v); });
    state.all = Array.from(m.values()).sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

    if($("totalTracks")) $("totalTracks").textContent = String(state.all.length);
    if($("latestTrack")) $("latestTrack").textContent = state.all[0] ? fmtDate(state.all[0].publishedAt) : "—";
    if(status) status.textContent = "";

  }catch(err){
    console.error(err);
    if(status) status.textContent = "فشل تحميل الأغاني. (مفتاح API أو القيود أو الكاش)";
  }

  setCurrentList("all");
  if(!location.hash) location.hash = "#/home";
  route();
  applySearchSort();
}

window.addEventListener("load", ()=>{
  // اغلاق قسري للدرج
  $("drawer")?.classList.remove("open");
  $("drawerOverlay")?.classList.remove("open");

  // روابط
  injectLinks();

  // درج
  bindDrawer();

  // أزرار البحث/الفرز
  $("searchInput")?.addEventListener("input", applySearchSort);
  $("sortSelect")?.addEventListener("change", applySearchSort);

  // أزرار المشغل السفلي
  $("prevBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playPrev(); });
  $("nextBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playNext(); });
  $("playBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playToggle(); });

  // تنقل
  $("goHome")?.addEventListener("click", ()=>location.hash="#/home");
  window.addEventListener("hashchange", route);

  // بدء
  bootstrap();
});
