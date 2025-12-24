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

const THEMES = [
  { id:"neon",   name:"Neon"   },
  { id:"cyan",   name:"Cyan"   },
  { id:"purple", name:"Purple" },
  { id:"gold",   name:"Gold"   },
  { id:"red",    name:"Red"    },
  { id:"green",  name:"Green"  },
  { id:"mono",   name:"Mono"   },
];

/* ========= أدوات ========= */
const $ = (id)=>document.getElementById(id);
const escapeHtml = (s)=>String(s ?? "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtDate = (iso)=> new Date(iso).toLocaleDateString("ar", {year:"numeric", month:"short", day:"numeric"});
const safeText = (el, v)=>{ if(el) el.textContent = v; };

function setHrefAll(k, url){
  document.querySelectorAll(`[data-link="${k}"]`).forEach(a=>a.setAttribute("href", url));
}
function injectLinks(){
  Object.keys(LINKS).forEach(k=> setHrefAll(k, LINKS[k]));
}

/* ========= تخزين ========= */
const STORE_KEY = "f90_player_state_v2";
const THEME_KEY = "f90_theme_v1";
const MOTION_KEY= "f90_motion_v1";

function savePlayerState(obj){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(obj)); }catch{}
}
function loadPlayerState(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)||"null"); }catch{ return null; }
}

function getTheme(){ return localStorage.getItem(THEME_KEY) || "neon"; }
function setTheme(t){
  const ok = THEMES.find(x=>x.id===t) ? t : "neon";
  document.documentElement.setAttribute("data-theme", ok);
  try{ localStorage.setItem(THEME_KEY, ok); }catch{}
}
function getMotion(){ return localStorage.getItem(MOTION_KEY) || "on"; }
function setMotion(v){
  const val = (v==="off") ? "off" : "on";
  document.documentElement.setAttribute("data-motion", val);
  try{ localStorage.setItem(MOTION_KEY, val); }catch{}
}

/* ========= بيانات ========= */
const state = {
  rap: [],
  sad: [],
  all: [],
  currentListName: "all",
  currentList: [],
  currentIndex: -1,
  now: null,
  isPlaying: false,
  ratings: new Map(), // videoId -> 1..5
};

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

  const m = new Map();
  items.forEach(v=>{ if(!m.has(v.id)) m.set(v.id, v); });
  return Array.from(m.values());
}

/* ========= Drawer ========= */
function bindDrawer(){
  const drawerBtn = $("drawerBtn");
  const drawer    = $("drawer");
  const overlay   = $("drawerOverlay");
  const closeBtn  = $("closeDrawer");
  if(!drawer || !overlay) return;

  const open = ()=>{ drawer.classList.add("open"); overlay.classList.add("open"); document.body.style.overflow="hidden"; };
  const close= ()=>{ drawer.classList.remove("open"); overlay.classList.remove("open"); document.body.style.overflow=""; };

  close();
  drawerBtn?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); open(); });
  closeBtn?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); close(); });

  overlay.addEventListener("pointerdown",(e)=>{ e.preventDefault(); e.stopPropagation(); close(); }, true);
  drawer.addEventListener("click",(e)=>{ if(e.target.closest("a")) close(); }, true);
  window.addEventListener("hashchange", close);
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") close(); });

  document.addEventListener("pointerdown",(e)=>{
    if(!drawer.classList.contains("open")) return;
    if(e.target.closest("#drawer")) return;
    if(e.target.closest("#drawerBtn")) return;
    close();
  }, true);
}

/* ========= Theme Modal ========= */
function buildThemeModal(){
  const grid = $("themeGrid");
  if(!grid) return;

  grid.innerHTML = THEMES.map(t=>`
    <button class="themeSwatch" type="button" data-theme="${escapeHtml(t.id)}">
      <div class="swTop">
        <div class="swName">${escapeHtml(t.name)}</div>
        <div class="swDot"></div>
      </div>
      <div class="swBar"></div>
    </button>
  `).join("");

  // جعل كل بطاقة تأخذ ألوان ثيمها
  grid.querySelectorAll(".themeSwatch").forEach(btn=>{
    const id = btn.getAttribute("data-theme");
    btn.addEventListener("click", ()=>{
      setTheme(id);
      closeThemeModal();
    });
  });
}
function openThemeModal(){
  $("themeOverlay")?.classList.add("open");
  $("themeModal")?.classList.add("open");
}
function closeThemeModal(){
  $("themeOverlay")?.classList.remove("open");
  $("themeModal")?.classList.remove("open");
}
function bindThemeUI(){
  buildThemeModal();
  $("themeBtn")?.addEventListener("click", openThemeModal);
  $("closeTheme")?.addEventListener("click", closeThemeModal);
  $("themeOverlay")?.addEventListener("pointerdown", closeThemeModal, true);

  $("motionBtn")?.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-motion") || "on";
    setMotion(cur === "on" ? "off" : "on");
  });
}

/* ========= Ratings (local) ========= */
function ratingKey(videoId){ return `f90_rate_${videoId}`; }
function getRating(videoId){
  try{ return Number(localStorage.getItem(ratingKey(videoId)) || 0); }catch{ return 0; }
}
function setRating(videoId, val){
  const v = Math.max(1, Math.min(5, Number(val||0)));
  try{ localStorage.setItem(ratingKey(videoId), String(v)); }catch{}
}
function computeTopRatedText(){
  // أعلى تقييم (لو في أي تقييمات)
  let best = { id:null, rate:0, title:"—" };
  state.all.forEach(t=>{
    const r = getRating(t.id);
    if(r > best.rate){ best = { id:t.id, rate:r, title:t.title }; }
  });
  if(best.rate === 0) return "—";
  return `${best.rate}/5`;
}

/* ========= Comments (local) ========= */
function commentsKey(videoId){ return `f90_cm_${videoId}`; }
function loadComments(videoId){
  try{
    const raw = localStorage.getItem(commentsKey(videoId));
    return raw ? JSON.parse(raw) : [];
  }catch{ return []; }
}
function saveComments(videoId, arr){
  try{ localStorage.setItem(commentsKey(videoId), JSON.stringify(arr)); }catch{}
}

/* ========= Index UI ========= */
function updateHeader(view){
  const map = {
    home:["الرئيسية","واجهة احترافية"],
    all:["كل الأغاني","كل الإصدارات"],
    rap:["الراب","قائمة الراب"],
    sad:["رومنسي/حزين/طربي","القائمة الثانية"],
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
    const r = getRating(t.id);
    const badge = r ? `<span class="badge">⭐ ${r}/5</span>` : "";
    return `
      <article class="item" data-id="${escapeHtml(t.id)}">
        <img class="thumb" src="${escapeHtml(t.thumb)}" alt="" loading="lazy">
        <div class="itemBody">
          <p class="itemTitle">${escapeHtml(t.title)}</p>
          <p class="itemMeta">${escapeHtml(fmtDate(t.publishedAt))} ${badge}</p>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      // حفظ مرجع الرجوع
      savePlayerState({
        currentListName: state.currentListName,
        currentIndex: state.currentList.findIndex(x=>x.id===id),
        now: state.all.find(x=>x.id===id) || null,
        isPlaying: true
      });
      window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=1`;
    });
  });
}

function renderLatestRow(){
  const row = $("latestRow");
  if(!row) return;
  const latest = state.all.slice(0,6);

  row.innerHTML = latest.map(t=>`
    <article class="rowCard" data-id="${escapeHtml(t.id)}">
      <img class="rowThumb" src="${escapeHtml(t.thumb)}" alt="" loading="lazy">
      <div class="rowBody">
        <p class="rowTitle">${escapeHtml(t.title)}</p>
        <p class="rowMeta">${escapeHtml(fmtDate(t.publishedAt))}</p>
      </div>
    </article>
  `).join("");

  row.querySelectorAll(".rowCard").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      savePlayerState({
        currentListName: "all",
        currentIndex: state.all.findIndex(x=>x.id===id),
        now: state.all.find(x=>x.id===id) || null,
        isPlaying: true
      });
      window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=1`;
    });
  });
}

function setCurrentList(name){
  state.currentListName = name;
  if(name==="rap") state.currentList = state.rap.slice();
  else if(name==="sad") state.currentList = state.sad.slice();
  else state.currentList = state.all.slice();
}

function applySearchSort(){
  const q = ($("searchInput")?.value || "").trim().toLowerCase();
  const sort = $("sortSelect")?.value || "date_desc";

  let list = state.currentList.slice();
  if(q) list = list.filter(x=>x.title.toLowerCase().includes(q));

  if(sort === "date_desc") list.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  if(sort === "date_asc")  list.sort((a,b)=> new Date(a.publishedAt)-new Date(b.publishedAt));
  if(sort === "title_asc") list.sort((a,b)=> a.title.localeCompare(b.title));

  // الأعلى تقييماً
  if(sort === "views_desc"){
    list.sort((a,b)=> (getRating(b.id)||0) - (getRating(a.id)||0));
  }

  renderGrid(list);
}

function routeIndex(){
  const h = location.hash || "#/home";
  const parts = h.replace("#/","").split("/");
  const view = parts[0] || "home";

  updateHeader(view);

  const homePro = $("homePro");
  const toolbar = $("toolbar");
  const backBtn = $("backBtnIndex");

  // زر رجوع يظهر بكل الصفحات عدا home
  if(backBtn){
    if(view === "home") backBtn.classList.remove("show");
    else backBtn.classList.add("show");
  }

  // هوم احترافي فقط على home
  if(homePro) homePro.style.display = (view==="home") ? "" : "none";
  if(toolbar) toolbar.style.display = (view==="home") ? "none" : "";

  if(view==="rap") setCurrentList("rap");
  else if(view==="sad") setCurrentList("sad");
  else setCurrentList("all");

  if(view==="home"){
    renderLatestRow();
    return;
  }

  applySearchSort();
}

/* ========= Mini Bar (index) ========= */
function updateMini(){
  const saved = loadPlayerState();
  const title = saved?.now?.title || "—";
  const meta = saved?.now?.publishedAt ? fmtDate(saved.now.publishedAt) : "—";
  safeText($("miniTitle"), title);
  safeText($("miniMeta"), meta);
  safeText($("playBtn"), saved?.isPlaying ? "⏸" : "▶");
}

/* ========= Bootstrap Index ========= */
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

    const m = new Map();
    [...state.rap, ...state.sad].forEach(v=>{ if(!m.has(v.id)) m.set(v.id, v); });
    state.all = Array.from(m.values()).sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

    safeText($("totalTracks"), String(state.all.length));
    safeText($("latestTrack"), state.all[0] ? fmtDate(state.all[0].publishedAt) : "—");
    safeText($("statsMini"), `${state.all.length} أغنية`);

    // أعلى تقييم في الهوم
    safeText($("topRated"), computeTopRatedText());

    if(status) status.textContent = "";

    if(!location.hash) location.hash = "#/home";
    routeIndex();
    updateMini();

  }catch(err){
    console.error(err);
    if(status) status.textContent = `فشل تحميل الأغاني: ${err.message}`;
    renderGrid([]);
  }
}

/* ========= Song Page Boot ========= */
function parseQuery(){
  const p = new URLSearchParams(location.search);
  return { id: p.get("v") || "", autoplay: p.get("autoplay")==="1" };
}

function renderStars(videoId){
  const stars = $("stars");
  if(!stars) return;

  const current = getRating(videoId);
  stars.innerHTML = [1,2,3,4,5].map(n=>{
    const active = (n <= current) ? "active" : "";
    return `<button class="starBtn ${active}" type="button" data-v="${n}" aria-label="تقييم ${n}">★</button>`;
  }).join("");

  stars.querySelectorAll(".starBtn").forEach(b=>{
    b.addEventListener("click", ()=>{
      const v = Number(b.getAttribute("data-v"));
      setRating(videoId, v);
      renderStars(videoId);
      safeText($("rateHint"), `تم حفظ تقييمك: ${v}/5`);
    });
  });
}

function renderComments(videoId){
  const list = $("cmList");
  const count = $("cmCount");
  if(!list || !count) return;

  const arr = loadComments(videoId);
  safeText(count, `${arr.length} تعليق`);

  if(!arr.length){
    list.innerHTML = `<div class="small">لا يوجد تعليقات بعد. كن أول واحد.</div>`;
    return;
  }

  list.innerHTML = arr.slice().reverse().map((c, idxFromEnd)=>{
    const idx = arr.length - 1 - idxFromEnd;
    return `
      <div class="cmItem">
        <div class="cmTop">
          <div>
            <div class="cmName">${escapeHtml(c.name || "زائر")}</div>
            <div class="cmTime">${escapeHtml(fmtDate(c.ts))}</div>
          </div>
          <button class="btn cmDel" type="button" data-del="${idx}">حذف</button>
        </div>
        <div class="cmText">${escapeHtml(c.text)}</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = Number(btn.getAttribute("data-del"));
      const arr2 = loadComments(videoId);
      arr2.splice(i,1);
      saveComments(videoId, arr2);
      renderComments(videoId);
      safeText($("cmStatus"), "تم حذف التعليق.");
      setTimeout(()=>safeText($("cmStatus"), ""), 900);
    });
  });
}

function bootSongPage(){
  injectLinks();

  const q = parseQuery();
  const id = q.id;

  // Back button
  $("backBtnSong")?.addEventListener("click", ()=>{
    // يرجع لقائمة كان فيها المستخدم
    const saved = loadPlayerState();
    const listName = saved?.currentListName || "all";
    window.location.href = `index.html#/${listName === "all" ? "all" : listName}`;
  });

  // title/meta from saved state (if exists)
  const saved = loadPlayerState();
  if(saved?.now?.id === id && saved.now){
    safeText($("songTitle"), saved.now.title || "الأغنية");
    safeText($("songMeta"), saved.now.publishedAt ? fmtDate(saved.now.publishedAt) : "—");
    safeText($("miniTitle"), saved.now.title || "—");
    safeText($("miniMeta"), saved.now.publishedAt ? fmtDate(saved.now.publishedAt) : "—");
  } else {
    safeText($("songTitle"), "الأغنية");
    safeText($("songMeta"), "—");
    safeText($("miniTitle"), "—");
    safeText($("miniMeta"), "—");
  }

  // Play
  const frame = $("playerFrame");
  if(frame && id){
    frame.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=${q.autoplay?1:0}&playsinline=1&rel=0`;
  }

  // YouTube open
  const ytOpen = $("ytOpen");
  if(ytOpen) ytOpen.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

  // Copy link
  $("copyLink")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(location.href);
      safeText($("songNote"), "تم نسخ الرابط.");
      setTimeout(()=>safeText($("songNote"), ""), 1000);
    }catch{}
  });

  // Rating + Comments
  renderStars(id);
  renderComments(id);

  $("cmForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();
    const name = ($("cmName")?.value || "").trim().slice(0,30);
    const text = ($("cmText")?.value || "").trim().slice(0,300);
    if(!text){
      safeText($("cmStatus"), "اكتب تعليق قبل النشر.");
      return;
    }
    const arr = loadComments(id);
    arr.push({ name, text, ts: new Date().toISOString() });
    saveComments(id, arr);
    if($("cmText")) $("cmText").value = "";
    safeText($("cmStatus"), "تم نشر التعليق.");
    setTimeout(()=>safeText($("cmStatus"), ""), 900);
    renderComments(id);
  });

  $("cmClear")?.addEventListener("click", ()=>{
    saveComments(id, []);
    renderComments(id);
    safeText($("cmStatus"), "تم مسح كل التعليقات.");
    setTimeout(()=>safeText($("cmStatus"), ""), 900);
  });

  // Mini controls (بدون IFrame API: toggle يغيّر autoplay فقط)
  $("playBtn")?.addEventListener("click", ()=>{
    const nextAuto = q.autoplay ? 0 : 1;
    // حفظ حالة تشغيل
    const curSaved = loadPlayerState() || {};
    curSaved.isPlaying = (nextAuto===1);
    savePlayerState(curSaved);
    window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=${nextAuto}`;
  });

  $("prevBtn")?.addEventListener("click", ()=>{
    // رجوع للقائمة ثم "السابق" من هناك (أضمن)
    const s = loadPlayerState();
    const list = s?.currentListName || "all";
    window.location.href = `index.html#/${list}`;
  });
  $("nextBtn")?.addEventListener("click", ()=>{
    const s = loadPlayerState();
    const list = s?.currentListName || "all";
    window.location.href = `index.html#/${list}`;
  });
}

/* ========= Global init ========= */
window.F90 = { bootSongPage };

window.addEventListener("load", ()=>{
  // سنة
  const y = new Date().getFullYear();
  ["year","yearF","yearM"].forEach(id=>{ const el=$(id); if(el) el.textContent = y; });

  // theme + motion from storage
  setTheme(getTheme());
  setMotion(getMotion());

  injectLinks();
  bindDrawer();
  bindThemeUI();

  // nav buttons
  document.querySelectorAll("[data-navto]").forEach(b=>{
    b.addEventListener("click", ()=>{ location.hash = b.getAttribute("data-navto"); });
  });

  // back button (index)
  $("backBtnIndex")?.addEventListener("click", ()=>{
    history.back();
  });

  // refresh/share (index)
  $("refreshBtn")?.addEventListener("click", ()=>bootstrapIndex());
  $("shareBtn")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(location.href);
      safeText($("homeStatus"), "تم نسخ الرابط.");
      setTimeout(()=>safeText($("homeStatus"), ""), 1100);
    }catch{}
  });

  // search/sort (index)
  $("searchInput")?.addEventListener("input", applySearchSort);
  $("sortSelect")?.addEventListener("change", applySearchSort);

  // mini controls (index) — يفتح صفحة الأغنية الحالية
  $("playBtn")?.addEventListener("click", ()=>{
    const saved = loadPlayerState();
    if(saved?.now?.id){
      const auto = saved.isPlaying ? 0 : 1;
      saved.isPlaying = (auto===1);
      savePlayerState(saved);
      window.location.href = `song.html?v=${encodeURIComponent(saved.now.id)}&autoplay=${auto}`;
      return;
    }
    // إذا ما في أغنية محفوظة: افتح أحدث أغنية
    if(state.all[0]){
      savePlayerState({ currentListName:"all", currentIndex:0, now: state.all[0], isPlaying:true });
      window.location.href = `song.html?v=${encodeURIComponent(state.all[0].id)}&autoplay=1`;
    }
  });

  $("prevBtn")?.addEventListener("click", ()=>{
    // للتبسيط: رجّع للأغنية السابقة حسب ترتيب all
    const s = loadPlayerState();
    if(!s?.now?.id || !state.all.length) return;
    const idx = state.all.findIndex(x=>x.id===s.now.id);
    const prev = state.all[(idx - 1 + state.all.length) % state.all.length];
    savePlayerState({ currentListName:"all", currentIndex: idx-1, now: prev, isPlaying:true });
    window.location.href = `song.html?v=${encodeURIComponent(prev.id)}&autoplay=1`;
  });

  $("nextBtn")?.addEventListener("click", ()=>{
    const s = loadPlayerState();
    if(!s?.now?.id || !state.all.length) return;
    const idx = state.all.findIndex(x=>x.id===s.now.id);
    const next = state.all[(idx + 1) % state.all.length];
    savePlayerState({ currentListName:"all", currentIndex: idx+1, now: next, isPlaying:true });
    window.location.href = `song.html?v=${encodeURIComponent(next.id)}&autoplay=1`;
  });

  // routing (index)
  window.addEventListener("hashchange", routeIndex);

  // لو هذه صفحة index (وجود grid + homePro)
  if($("grid") && $("homePro")){
    bootstrapIndex();
  }
});
