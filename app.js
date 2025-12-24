"use strict";

/* ========= إعداداتك ========= */
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

/* ========= أدوات ========= */
const $ = (id)=>document.getElementById(id);
const escapeHtml = (s)=>String(s ?? "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtDate = (iso)=> new Date(iso).toLocaleDateString("ar", {year:"numeric", month:"short", day:"numeric"});
const safeText = (el, v)=>{ if(el) el.textContent = v; };

/* ========= حالة ========= */
const state = {
  rap: [],
  sad: [],
  all: [],
  currentListName: "all",
  currentList: [],
  currentIndex: -1,
  now: null,
  isPlaying: false,
};

/* ========= تخزين بسيط للمشغل ========= */
const STORE_KEY = "f90_player_state_v1";
function savePlayerState(){
  try{
    const data = {
      currentListName: state.currentListName,
      currentIndex: state.currentIndex,
      now: state.now ? { id: state.now.id, title: state.now.title, publishedAt: state.now.publishedAt } : null,
      isPlaying: state.isPlaying
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }catch{}
}
function loadPlayerState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}

/* ========= روابط ========= */
function setHrefAll(k, url){
  document.querySelectorAll(`[data-link="${k}"]`).forEach(a=>a.setAttribute("href", url));
}
function injectLinks(){
  Object.keys(LINKS).forEach(k=> setHrefAll(k, LINKS[k]));
}

/* ========= Drawer (نهائي ثابت) ========= */
function bindDrawer(){
  const drawerBtn = $("drawerBtn");
  const drawer    = $("drawer");
  const overlay   = $("drawerOverlay");
  const closeBtn  = $("closeDrawer");

  if(!drawer || !overlay) return;

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

  // اقفل دائمًا عند التحميل
  close();

  drawerBtn?.addEventListener("click", (e)=>{
    e.preventDefault(); e.stopPropagation();
    open();
  });

  closeBtn?.addEventListener("click", (e)=>{
    e.preventDefault(); e.stopPropagation();
    close();
  });

  overlay.addEventListener("pointerdown", (e)=>{
    e.preventDefault(); e.stopPropagation();
    close();
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

/* ========= YouTube API ========= */
async function ytFetchJson(url){
  const r = await fetch(url);
  const txt = await r.text();
  let data = null;
  try{ data = JSON.parse(txt); }catch{ data = { raw: txt }; }

  if(!r.ok){
    const msg = data?.error?.message || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
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

    const data = await ytFetchJson(url);

    const chunk = (data.items || []).map(it=>{
      const id = it.contentDetails?.videoId;
      const title = it.snippet?.title || "";
      const publishedAt = it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt || "";
      const thumb = it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url || "";
      return { id, title, publishedAt, thumb };
    }).filter(v=> v.id && v.title && v.title !== "Private video" && v.title !== "Deleted video");

    items.push(...chunk);

    if(!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  // unique
  const m = new Map();
  items.forEach(v=>{ if(!m.has(v.id)) m.set(v.id, v); });
  return Array.from(m.values());
}

/* ========= UI ========= */
function updateHeader(view){
  const map = {
    home: ["الرئيسية","آخر الإصدارات"],
    all:  ["كل الأغاني","مجمعة من القوائم"],
    rap:  ["الراب","قائمة الراب"],
    sad:  ["رومنسي/حزين/طربي","القائمة الثانية"],
  };
  const t = map[view] || ["F90","—"];
  safeText($("viewTitle"), t[0]);
  safeText($("viewSubtitle"), t[1]);
}

function renderGrid(list){
  const grid = $("grid");
  if(!grid) return;

  if(!list.length){
    grid.innerHTML = `<div class="sideCard" style="margin:18px"><div class="sideCardTitle">لا يوجد أغاني لعرضها</div></div>`;
    return;
  }

  grid.innerHTML = list.map(t=>{
    const songUrl = `song.html?v=${encodeURIComponent(t.id)}`;
    return `
      <article class="item" data-id="${escapeHtml(t.id)}">
        <img class="thumb" src="${escapeHtml(t.thumb)}" alt="">
        <div class="itemBody">
          <p class="itemTitle">${escapeHtml(t.title)}</p>
          <p class="itemMeta">${escapeHtml(fmtDate(t.publishedAt))}</p>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      // صفحة مستقلة لكل أغنية:
      window.location.href = `song.html?v=${encodeURIComponent(id)}`;
    });
  });
}

function setCurrentList(name){
  state.currentListName = name;
  if(name === "rap") state.currentList = state.rap.slice();
  else if(name === "sad") state.currentList = state.sad.slice();
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

  if(sort === "date_desc") list.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  if(sort === "date_asc")  list.sort((a,b)=> new Date(a.publishedAt)-new Date(b.publishedAt));
  if(sort === "title_asc") list.sort((a,b)=> a.title.localeCompare(b.title));

  renderGrid(list);
}

/* ========= Mini Player (على index.html) =========
   التشغيل الحقيقي يتم في song.html عبر iframe.
   هنا نخلي الأزرار تفتح الأغنية السابقة/التالية.
*/
function updateMini(){
  const title = state.now?.title || "—";
  const meta  = state.now?.publishedAt ? fmtDate(state.now.publishedAt) : "—";
  safeText($("miniTitle"), title);
  safeText($("miniMeta"), meta);
  safeText($("playBtn"), state.isPlaying ? "⏸" : "▶");
  savePlayerState();
}

function openByIndex(idx, autoplay){
  const list = state.currentList.length ? state.currentList : state.all;
  if(!list.length) return;

  const i = (idx + list.length) % list.length;
  state.currentIndex = i;
  state.now = list[i];
  state.isPlaying = !!autoplay;
  updateMini();

  // افتح صفحة الأغنية
  const url = `song.html?v=${encodeURIComponent(state.now.id)}&autoplay=${autoplay?1:0}`;
  window.location.href = url;
}

function playPrev(){
  const list = state.currentList.length ? state.currentList : state.all;
  if(!list.length) return;

  if(state.currentIndex < 0 && state.now){
    state.currentIndex = list.findIndex(x=>x.id === state.now.id);
  }
  if(state.currentIndex < 0) state.currentIndex = 0;

  openByIndex(state.currentIndex - 1, true);
}

function playNext(){
  const list = state.currentList.length ? state.currentList : state.all;
  if(!list.length) return;

  if(state.currentIndex < 0 && state.now){
    state.currentIndex = list.findIndex(x=>x.id === state.now.id);
  }
  if(state.currentIndex < 0) state.currentIndex = 0;

  openByIndex(state.currentIndex + 1, true);
}

function playToggle(){
  // على الصفحة الرئيسية: toggle يعني "افتح الأغنية الحالية للتشغيل"
  if(!state.now){
    openByIndex(0, true);
    return;
  }
  state.isPlaying = !state.isPlaying;
  updateMini();
  // افتح صفحة الأغنية بالحالة المطلوبة
  const url = `song.html?v=${encodeURIComponent(state.now.id)}&autoplay=${state.isPlaying?1:0}`;
  window.location.href = url;
}

/* ========= Routing (index.html) ========= */
function route(){
  const h = location.hash || "#/home";
  const parts = h.replace("#/","").split("/");
  const view = parts[0] || "home";

  updateHeader(view);

  const hero = $("hero");
  const toolbar = $("toolbar");

  if(hero) hero.style.display = (view==="home") ? "" : "none";
  if(toolbar) toolbar.style.display = "";

  if(view==="rap") setCurrentList("rap");
  else if(view==="sad") setCurrentList("sad");
  else setCurrentList("all");

  applySearchSort();
}

/* ========= Bootstrap (index.html) ========= */
async function bootstrapIndex(){
  const status = $("homeStatus");
  if(status) status.textContent = "جاري تحميل الأغاني...";

  try{
    const [rap, sad] = await Promise.all([
      getAllPlaylistItems(PLAYLISTS.rap),
      getAllPlaylistItems(PLAYLISTS.sad),
    ]);

    state.rap = rap.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
    state.sad = sad.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

    // دمج كل الأغاني من القائمتين
    const m = new Map();
    [...state.rap, ...state.sad].forEach(v=>{ if(!m.has(v.id)) m.set(v.id, v); });
    state.all = Array.from(m.values()).sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

    safeText($("totalTracks"), String(state.all.length));
    safeText($("latestTrack"), state.all[0] ? fmtDate(state.all[0].publishedAt) : "—");
    safeText($("statsMini"), `${state.all.length} أغنية`);
    if(status) status.textContent = "";

    // استرجاع حالة المشغل إن وجدت
    const saved = loadPlayerState();
    if(saved?.now?.id){
      const found = state.all.find(x=>x.id === saved.now.id) || state.rap.find(x=>x.id===saved.now.id) || state.sad.find(x=>x.id===saved.now.id);
      if(found){
        state.now = found;
        state.isPlaying = !!saved.isPlaying;
        state.currentListName = saved.currentListName || "all";
        setCurrentList(state.currentListName);
        state.currentIndex = state.currentList.findIndex(x=>x.id === found.id);
      }
    }
    updateMini();

    // ابدأ بالروت
    if(!location.hash) location.hash = "#/home";
    route();

  }catch(err){
    console.error(err);
    if(status) status.textContent = `فشل تحميل الأغاني: ${err.message}`;
    // خلي الشبكة فاضية برسالة
    renderGrid([]);
  }
}

/* ========= Song Page (song.html) ========= */
function parseQuery(){
  const p = new URLSearchParams(location.search);
  return {
    id: p.get("v") || "",
    autoplay: p.get("autoplay")==="1"
  };
}

function bootSongPage(){
  const q = parseQuery();
  const id = q.id;

  // روابط
  injectLinks();

  // زر نسخ
  $("copyLink")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(location.href);
      safeText($("songNote"), "تم نسخ الرابط.");
      setTimeout(()=>safeText($("songNote"), ""), 1200);
    }catch{}
  });

  // افتح على يوتيوب
  const ytOpen = $("ytOpen");
  if(ytOpen) ytOpen.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

  // تشغيل iframe
  const frame = $("playerFrame");
  if(frame && id){
    frame.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=${q.autoplay?1:0}&playsinline=1&rel=0`;
  }

  // اقرأ حالة المشغل من التخزين لتفعيل prev/next
  const saved = loadPlayerState();
  if(saved?.now?.id){
    safeText($("miniTitle"), saved.now.title || "—");
    safeText($("miniMeta"), saved.now.publishedAt ? fmtDate(saved.now.publishedAt) : "—");
    safeText($("playBtn"), saved.isPlaying ? "⟂⟂" : "▶");
  } else {
    safeText($("miniTitle"), "—");
    safeText($("miniMeta"), "—");
    safeText($("playBtn"), q.autoplay ? "⏸" : "▶");
  }

  // أزرار المشغل في song.html تعتمد على حالة محفوظة وتعود لـ index لتحديد التالي/السابق
  $("prevBtn")?.addEventListener("click", ()=>{
    // نطلب من index فتح السابق (يعرف القوائم)
    window.location.href = "index.html#/_prev";
  });
  $("nextBtn")?.addEventListener("click", ()=>{
    window.location.href = "index.html#/_next";
  });
  $("playBtn")?.addEventListener("click", ()=>{
    const nextAuto = q.autoplay ? 0 : 1;
    window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=${nextAuto}`;
  });
}

/* ========= جسر: أوامر prev/next من song.html عبر hash ========= */
function handlePlayerBridgeHash(){
  const h = location.hash || "";
  if(h === "#/_prev"){
    playPrev();
    return true;
  }
  if(h === "#/_next"){
    playNext();
    return true;
  }
  return false;
}

/* ========= تشغيل تلقائي حسب الصفحة ========= */
window.F90 = { bootSongPage };

window.addEventListener("load", ()=>{
  // سنة
  const y = new Date().getFullYear();
  ["year","yearF","yearM"].forEach(id=>{ const el=$(id); if(el) el.textContent = y; });

  // روابط
  injectLinks();

  // Drawer
  bindDrawer();

  // إذا الصفحة الرئيسية
  const isIndex = !!$("grid") && !!$("searchInput");
  if(isIndex){
    // أزرار
    $("refreshBtn")?.addEventListener("click", ()=>bootstrapIndex());
    $("shareBtn")?.addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(location.href);
        safeText($("homeStatus"), "تم نسخ الرابط.");
        setTimeout(()=>safeText($("homeStatus"), ""), 1200);
      }catch{}
    });

    document.querySelectorAll("[data-navto]").forEach(b=>{
      b.addEventListener("click", ()=>{ location.hash = b.getAttribute("data-navto"); });
    });

    $("searchInput")?.addEventListener("input", ()=>applySearchSort());
    $("sortSelect")?.addEventListener("change", ()=>applySearchSort());

    $("prevBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playPrev(); });
    $("nextBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playNext(); });
    $("playBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playToggle(); });

    $("mini")?.addEventListener("click", (e)=>{
      if(e.target.closest("button")) return;
      if(state.now){
        window.location.href = `song.html?v=${encodeURIComponent(state.now.id)}&autoplay=${state.isPlaying?1:0}`;
      }
    });

    $("goHome")?.addEventListener("click", ()=>location.hash="#/home");

    window.addEventListener("hashchange", ()=>{
      // bridge commands
      if(handlePlayerBridgeHash()) return;
      route();
    });

    // ابدأ
    bootstrapIndex();
  }
});
