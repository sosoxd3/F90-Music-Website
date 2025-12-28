"use strict";

/* ========= إعداداتك ========= */
const YT_API_KEY = "AIzaSyDlJd_YDoDlvYdE_uVRkStNVlHB9uDUqkA";

const PLAYLISTS = {
  rap: "PLER5A-XFPVBhQe7mhYW9HPrvw6MIpJIWw",
  f90: "PLER5A-XFPVBhCv-NbbP8SFZXOD1HWiA6C",
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
const STORE_KEY    = "f90_player_state_v4";
const THEME_KEY    = "f90_theme_v1";
const MOTION_KEY   = "f90_motion_v1";
const FAV_KEY      = "f90_favs_v1";
const MODE_KEY     = "f90_mode_v1";
const CONTRAST_KEY = "f90_contrast_v1";
const VOLUME_KEY   = "f90_volume_v1";
const SHUFFLE_KEY  = "f90_shuffle_v1";
const REPEAT_KEY   = "f90_repeat_v1";

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

function getMode(){ return localStorage.getItem(MODE_KEY) || "night"; }
function setMode(v){
  const val = (v==="day") ? "day" : "night";
  document.documentElement.setAttribute("data-mode", val);
  try{ localStorage.setItem(MODE_KEY, val); }catch{}
}
function getContrast(){ return localStorage.getItem(CONTRAST_KEY) || "normal"; }
function setContrast(v){
  const val = (v==="high") ? "high" : "normal";
  document.documentElement.setAttribute("data-contrast", val);
  try{ localStorage.setItem(CONTRAST_KEY, val); }catch{}
}

function getVolume(){
  const n = Number(localStorage.getItem(VOLUME_KEY) ?? 70);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 70;
}
function setVolume(v){
  const n = Math.max(0, Math.min(100, Number(v)||0));
  try{ localStorage.setItem(VOLUME_KEY, String(n)); }catch{}
  return n;
}
function getShuffle(){ return (localStorage.getItem(SHUFFLE_KEY) || "0") === "1"; }
function setShuffle(on){ try{ localStorage.setItem(SHUFFLE_KEY, on ? "1":"0"); }catch{} }
function getRepeat(){ return (localStorage.getItem(REPEAT_KEY) || "0") === "1"; }
function setRepeat(on){ try{ localStorage.setItem(REPEAT_KEY, on ? "1":"0"); }catch{} }

/* ========= Favorites ========= */
function loadFavs(){
  try{
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch{ return []; }
}
function saveFavs(arr){
  try{ localStorage.setItem(FAV_KEY, JSON.stringify(arr)); }catch{}
}
function isFav(id){
  return loadFavs().includes(id);
}
function toggleFav(id){
  const arr = loadFavs();
  const i = arr.indexOf(id);
  if(i >= 0) arr.splice(i,1);
  else arr.unshift(id);
  const uniq = Array.from(new Set(arr)).slice(0, 500);
  saveFavs(uniq);
  return uniq.includes(id);
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
function computeTopRatedText(all){
  let best = 0;
  (all||[]).forEach(t=>{ best = Math.max(best, getRating(t.id)); });
  return best ? `${best}/5` : "—";
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

/* ========= Resume time ========= */
function resumeKey(videoId){ return `f90_resume_${videoId}`; }
function getResume(videoId){
  try{ return Number(localStorage.getItem(resumeKey(videoId)) || 0); }catch{ return 0; }
}
function setResume(videoId, seconds){
  const s = Math.max(0, Number(seconds)||0);
  try{ localStorage.setItem(resumeKey(videoId), String(s)); }catch{}
}

/* ========= State ========= */
const state = {
  rap: [],
  sad: [],
  all: [],
  currentListName: "all",
  currentList: [],
  currentIndex: -1,
  lastRenderedIds: [],

  ytReady:false,
  ytPlayer:null,
  nowId:"",
  saveTimer:null,
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

/* ========= Mode/Contrast ========= */
function refreshModeButtons(){
  const mode = document.documentElement.getAttribute("data-mode") || "night";
  const contrast = document.documentElement.getAttribute("data-contrast") || "normal";

  const modeBtn = $("modeBtn");
  const contrastBtn = $("contrastBtn");

  if(modeBtn){
    modeBtn.textContent = (mode === "day") ? "ليلي" : "نهاري";
    modeBtn.classList.toggle("on", mode === "day");
  }
  if(contrastBtn){
    contrastBtn.textContent = (contrast === "high") ? "عادي" : "تباين";
    contrastBtn.classList.toggle("on", contrast === "high");
  }
}
function bindModeContrast(){
  $("modeBtn")?.addEventListener("click", ()=>{
    const cur = getMode();
    setMode(cur === "day" ? "night" : "day");
    refreshModeButtons();
  });
  $("contrastBtn")?.addEventListener("click", ()=>{
    const cur = getContrast();
    setContrast(cur === "high" ? "normal" : "high");
    refreshModeButtons();
  });
}

/* ========= Shuffle/Repeat/Volume ========= */
function refreshSRVButtons(){
  const sh = getShuffle();
  const rp = getRepeat();
  $("shuffleBtn")?.classList.toggle("on", sh);
  $("repeatBtn")?.classList.toggle("on", rp);

  const vr = $("volRange");
  if(vr) vr.value = String(getVolume());
}
function bindSRVControls(onChangeVolume){
  $("shuffleBtn")?.addEventListener("click", ()=>{
    setShuffle(!getShuffle());
    refreshSRVButtons();
  });
  $("repeatBtn")?.addEventListener("click", ()=>{
    setRepeat(!getRepeat());
    refreshSRVButtons();
  });
  $("volRange")?.addEventListener("input", (e)=>{
    const v = setVolume(e.target.value);
    refreshSRVButtons();
    if(typeof onChangeVolume === "function") onChangeVolume(v);
  });
}

/* ========= Index UI ========= */
function updateHeader(view){
  const map = {
    home:["الرئيسية","واجهة احترافية"],
    all:["كل الأغاني","كل الإصدارات"],
    rap:["الراب","قائمة الراب"],
    sad:["رومنسي/حزين/طربي","القائمة الثانية"],
    fav:["مفضلتي","الأغاني التي حفظتها"],
  };
  const t = map[view] || ["F90","—"];
  safeText($("viewTitle"), t[0]);
  safeText($("viewSubtitle"), t[1]);
}

function openSongFromIndex(id){
  const listIds = state.lastRenderedIds.length ? state.lastRenderedIds.slice() : state.currentList.map(x=>x.id);
  const idx = listIds.indexOf(id);

  savePlayerState({
    currentListName: state.currentListName,
    nowId: id,
    listIds,
    index: idx >= 0 ? idx : 0
  });

  window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=1`;
}

function renderGrid(list){
  const grid = $("grid");
  if(!grid) return;

  state.lastRenderedIds = list.map(x=>x.id);

  if(!list.length){
    grid.innerHTML = `<div class="sideCard" style="margin:18px"><div class="sideCardTitle">لا يوجد أغاني لعرضها</div></div>`;
    return;
  }

  grid.innerHTML = list.map(t=>{
    const r = getRating(t.id);
    const fav = isFav(t.id) ? `<span class="badge">⭐ مفضلة</span>` : "";
    const rate = r ? `<span class="badge">⭐ ${r}/5</span>` : "";
    return `
      <article class="item" data-id="${escapeHtml(t.id)}">
        <img class="thumb" src="${escapeHtml(t.thumb)}" alt="" loading="lazy">
        <div class="itemBody">
          <p class="itemTitle">${escapeHtml(t.title)}</p>
          <p class="itemMeta">${escapeHtml(fmtDate(t.publishedAt))} ${rate} ${fav}</p>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      openSongFromIndex(id);
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
      state.currentListName = "all";
      state.currentList = state.all.slice();
      state.lastRenderedIds = state.all.map(x=>x.id);
      openSongFromIndex(id);
    });
  });
}

function setCurrentList(name){
  state.currentListName = name;
  if(name==="rap") state.currentList = state.rap.slice();
  else if(name==="sad") state.currentList = state.sad.slice();
  else if(name==="fav"){
    const favs = loadFavs();
    const map = new Map(state.all.map(x=>[x.id,x]));
    state.currentList = favs.map(id=>map.get(id)).filter(Boolean);
  } else state.currentList = state.all.slice();
}

function applySearchSort(){
  const q = ($("searchInput")?.value || "").trim().toLowerCase();
  const sort = $("sortSelect")?.value || "date_desc";

  let list = state.currentList.slice();
  if(q) list = list.filter(x=>x.title.toLowerCase().includes(q));

  if(sort === "date_desc") list.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  if(sort === "date_asc")  list.sort((a,b)=> new Date(a.publishedAt)-new Date(b.publishedAt));
  if(sort === "title_asc") list.sort((a,b)=> a.title.localeCompare(b.title));
  if(sort === "rating_desc") list.sort((a,b)=> (getRating(b.id)||0) - (getRating(a.id)||0));

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

  if(backBtn){
    if(view === "home") backBtn.classList.remove("show");
    else backBtn.classList.add("show");
  }

  if(homePro) homePro.style.display = (view==="home") ? "" : "none";
  if(toolbar) toolbar.style.display = (view==="home") ? "none" : "";

  if(view==="rap") setCurrentList("rap");
  else if(view==="sad") setCurrentList("sad");
  else if(view==="fav") setCurrentList("fav");
  else if(view==="all") setCurrentList("all");
  else setCurrentList("all");

  if(view==="home"){
    renderLatestRow();
    return;
  }

  applySearchSort();
}

function updateMini(){
  const saved = loadPlayerState();
  const id = saved?.nowId;
  if(!id){
    safeText($("miniTitle"), "—");
    safeText($("miniMeta"), "—");
    safeText($("playBtn"), "▶");
    return;
  }
  const track = state.all.find(x=>x.id===id) || state.rap.find(x=>x.id===id) || state.sad.find(x=>x.id===id);
  safeText($("miniTitle"), track?.title || "—");
  safeText($("miniMeta"), track?.publishedAt ? fmtDate(track.publishedAt) : "—");
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
    safeText($("topRated"), computeTopRatedText(state.all));

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

/* ========= Song Page ========= */
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

function setFavButton(videoId){
  const btn = $("favBtn");
  if(!btn) return;
  const on = isFav(videoId);
  btn.classList.toggle("on", on);
  btn.textContent = on ? "⭐ إزالة من المفضلة" : "⭐ إضافة للمفضلة";
}

function buildWhatsAppShare(videoId, title){
  const link = location.href;
  const msg = `اسمع/ي هاي الأغنية: ${title}\n${link}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  const a = $("waShare");
  if(a) a.href = wa;
}

async function loadAllForSongPage(){
  const [rap, sad] = await Promise.all([
    getAllPlaylistItems(PLAYLISTS.rap),
    getAllPlaylistItems(PLAYLISTS.sad),
  ]);
  const rapS = rap.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  const sadS = sad.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  const m = new Map();
  [...rapS, ...sadS].forEach(v=>{ if(!m.has(v.id)) m.set(v.id, v); });
  const allS = Array.from(m.values()).sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  return { rap: rapS, sad: sadS, all: allS };
}

function detectCategory(videoId, packs){
  if(packs.rap.some(x=>x.id===videoId)) return "rap";
  if(packs.sad.some(x=>x.id===videoId)) return "sad";
  return "all";
}

function pickSuggestions(packs, currentId, category){
  const pool = category === "rap" ? packs.rap
             : category === "sad" ? packs.sad
             : packs.all;
  return pool.filter(x=>x.id !== currentId).slice(0, 6);
}

function renderSuggestions(list){
  const grid = $("suggestGrid");
  if(!grid) return;

  if(!list.length){
    grid.innerHTML = `<div class="small">لا يوجد مقترحات حالياً.</div>`;
    return;
  }

  grid.innerHTML = list.map(t=>`
    <article class="sCard" data-id="${escapeHtml(t.id)}">
      <img class="sThumb" src="${escapeHtml(t.thumb)}" alt="" loading="lazy">
      <div class="sBody">
        <p class="sTitle">${escapeHtml(t.title)}</p>
        <p class="sMeta">${escapeHtml(fmtDate(t.publishedAt))}</p>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll(".sCard").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      const saved = loadPlayerState() || {};
      savePlayerState({ ...saved, nowId: id });
      window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=1`;
    });
  });
}

/* ---- YouTube IFrame API ---- */
function loadYTApi(){
  return new Promise((resolve)=>{
    if(window.YT && window.YT.Player){ resolve(); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = ()=>resolve();
  });
}

function setPlayBtnUI(isPlaying){
  const b = $("playBtn");
  if(!b) return;
  b.textContent = isPlaying ? "⏸" : "▶";
}

function applyVolumeToPlayer(v){
  try{ state.ytPlayer?.setVolume(v); }catch{}
}

/* ---- Queue navigation ---- */
function getQueue(){
  const saved = loadPlayerState() || {};
  const listIds = Array.isArray(saved.listIds) ? saved.listIds : [];
  let idx = Number(saved.index ?? 0);
  if(!Number.isFinite(idx)) idx = 0;
  return { listIds, idx, saved };
}

function saveQueue(listIds, idx, nowId){
  const saved = loadPlayerState() || {};
  savePlayerState({
    ...saved,
    listIds,
    index: idx,
    nowId: nowId || saved.nowId || ""
  });
}

function pickNextId(dir){
  const { listIds, idx } = getQueue();
  if(!listIds.length) return null;

  if(getShuffle()){
    if(listIds.length === 1) return listIds[0];
    let tries = 0;
    let cand = listIds[idx] || listIds[0];
    while(tries < 10){
      const r = Math.floor(Math.random() * listIds.length);
      cand = listIds[r];
      if(cand !== (listIds[idx] || "")) break;
      tries++;
    }
    const newIdx = listIds.indexOf(cand);
    saveQueue(listIds, newIdx >= 0 ? newIdx : 0, cand);
    return cand;
  }

  let newIdx = idx;
  if(dir === "prev") newIdx = (idx - 1 + listIds.length) % listIds.length;
  else newIdx = (idx + 1) % listIds.length;

  const cand = listIds[newIdx];
  saveQueue(listIds, newIdx, cand);
  return cand;
}

/* ---- Resume saver ---- */
function startResumeSaver(videoId){
  if(state.saveTimer) clearInterval(state.saveTimer);
  state.saveTimer = setInterval(()=>{
    try{
      if(!state.ytPlayer || typeof state.ytPlayer.getCurrentTime !== "function") return;
      const t = state.ytPlayer.getCurrentTime();
      if(Number.isFinite(t) && t > 0) setResume(videoId, Math.floor(t));
    }catch{}
  }, 5000);
}

async function createYTPlayer(videoId, autoplay){
  await loadYTApi();

  return new Promise((resolve)=>{
    state.ytPlayer = new YT.Player("ytPlayer", {
      videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1
      },
      events: {
        onReady: (e)=>{
          state.ytReady = true;

          const v = getVolume();
          applyVolumeToPlayer(v);

          const resumeAt = getResume(videoId);
          const hint = $("resumeHint");
          if(resumeAt > 3){
            try{
              e.target.seekTo(resumeAt, true);
              if(hint) hint.textContent = `تم الاستئناف من ${Math.floor(resumeAt)} ثانية`;
              setTimeout(()=>{ if(hint) hint.textContent = ""; }, 1600);
            }catch{}
          }else{
            if(hint) hint.textContent = "";
          }

          startResumeSaver(videoId);

          setPlayBtnUI(autoplay);
          resolve();
        },
        onStateChange: (e)=>{
          if(!window.YT) return;
          if(e.data === YT.PlayerState.PLAYING) setPlayBtnUI(true);
          if(e.data === YT.PlayerState.PAUSED)  setPlayBtnUI(false);

          if(e.data === YT.PlayerState.ENDED){
            if(getRepeat()){
              try{ state.ytPlayer.seekTo(0,true); state.ytPlayer.playVideo(); }catch{}
              return;
            }
            const nextId = pickNextId("next");
            if(nextId) window.location.href = `song.html?v=${encodeURIComponent(nextId)}&autoplay=1`;
          }
        }
      }
    });
  });
}

async function bootSongPage(){
  injectLinks();

  setTheme(getTheme());
  setMotion(getMotion());
  setMode(getMode());
  setContrast(getContrast());
  refreshModeButtons();

  refreshSRVButtons();

  const q = parseQuery();
  const id = q.id;
  state.nowId = id;

  $("backBtnSong")?.addEventListener("click", ()=>{
    const saved = loadPlayerState();
    const listName = saved?.currentListName || "all";
    window.location.href = `index.html#/${listName === "all" ? "all" : listName}`;
  });

  $("ytOpen")?.setAttribute("href", `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`);

  $("copyLink")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(location.href);
      safeText($("songNote"), "تم نسخ الرابط.");
      setTimeout(()=>safeText($("songNote"), ""), 1000);
    }catch{}
  });

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

  setFavButton(id);
  $("favBtn")?.addEventListener("click", ()=>{
    toggleFav(id);
    setFavButton(id);
    safeText($("songNote"), isFav(id) ? "تمت الإضافة للمفضلة." : "تمت الإزالة من المفضلة.");
    setTimeout(()=>safeText($("songNote"), ""), 900);
  });

  bindThemeUI();
  bindModeContrast();

  bindSRVControls((v)=>applyVolumeToPlayer(v));
  refreshSRVButtons();

  $("playBtn")?.addEventListener("click", ()=>{
    if(!state.ytPlayer) return;
    try{
      const st = state.ytPlayer.getPlayerState();
      if(st === YT.PlayerState.PLAYING) state.ytPlayer.pauseVideo();
      else state.ytPlayer.playVideo();
    }catch{}
  });

  $("prevBtn")?.addEventListener("click", ()=>{
    const prevId = pickNextId("prev");
    if(prevId) window.location.href = `song.html?v=${encodeURIComponent(prevId)}&autoplay=1`;
  });

  $("nextBtn")?.addEventListener("click", ()=>{
    const nextId = pickNextId("next");
    if(nextId) window.location.href = `song.html?v=${encodeURIComponent(nextId)}&autoplay=1`;
  });

  safeText($("miniTitle"), "—");
  safeText($("miniMeta"), "—");

  try{
    safeText($("songNote"), "جاري تحميل بيانات الأغنية...");
    const packs = await loadAllForSongPage();
    const track = packs.all.find(x=>x.id===id) || packs.rap.find(x=>x.id===id) || packs.sad.find(x=>x.id===id);

    const title = track?.title || "الأغنية";
    const publishedAt = track?.publishedAt || "";
    safeText($("songTitle"), title);
    safeText($("songMeta"), publishedAt ? fmtDate(publishedAt) : "—");
    safeText($("miniTitle"), title);
    safeText($("miniMeta"), publishedAt ? fmtDate(publishedAt) : "—");
    buildWhatsAppShare(id, title);

    safeText($("songNote"), "");

    const category = detectCategory(id, packs);
    safeText($("suggestHint"), category === "rap" ? "من قسم الراب"
                        : category === "sad" ? "من قسم رومنسي/حزين/طربي"
                        : "مقترحات عامة");
    renderSuggestions(pickSuggestions(packs, id, category));
  }catch(err){
    console.error(err);
    safeText($("songTitle"), "الأغنية");
    safeText($("songMeta"), "—");
    buildWhatsAppShare(id, "الأغنية");
    safeText($("songNote"), `تعذر تحميل بيانات الأغنية: ${err.message}`);
  }

  await createYTPlayer(id, q.autoplay);
  refreshSRVButtons();
}

/* ========= Expose ========= */
window.F90 = { bootSongPage };

/* ========= Index init ========= */
window.addEventListener("load", ()=>{
  const y = new Date().getFullYear();
  ["year","yearF","yearM"].forEach(id=>{ const el=$(id); if(el) el.textContent = y; });

  setTheme(getTheme());
  setMotion(getMotion());
  setMode(getMode());
  setContrast(getContrast());

  injectLinks();
  bindDrawer();
  bindThemeUI();
  bindModeContrast();
  refreshModeButtons();

  bindSRVControls(null);
  refreshSRVButtons();

  document.querySelectorAll("[data-navto]").forEach(b=>{
    b.addEventListener("click", ()=>{ location.hash = b.getAttribute("data-navto"); });
  });

  $("backBtnIndex")?.addEventListener("click", ()=> history.back());

  $("refreshBtn")?.addEventListener("click", ()=>bootstrapIndex());
  $("shareBtn")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(location.href);
      safeText($("homeStatus"), "تم نسخ الرابط.");
      setTimeout(()=>safeText($("homeStatus"), ""), 1100);
    }catch{}
  });

  $("searchInput")?.addEventListener("input", applySearchSort);
  $("sortSelect")?.addEventListener("change", applySearchSort);

  $("playBtn")?.addEventListener("click", ()=>{
    const saved = loadPlayerState();
    if(saved?.nowId){
      window.location.href = `song.html?v=${encodeURIComponent(saved.nowId)}&autoplay=1`;
      return;
    }
    if(state.all[0]){
      savePlayerState({ currentListName:"all", nowId: state.all[0].id, listIds: state.all.map(x=>x.id), index: 0 });
      window.location.href = `song.html?v=${encodeURIComponent(state.all[0].id)}&autoplay=1`;
    }
  });

  $("prevBtn")?.addEventListener("click", ()=>{
    const saved = loadPlayerState() || {};
    const listIds = Array.isArray(saved.listIds) ? saved.listIds : state.all.map(x=>x.id);
    if(!listIds.length) return;

    const cur = saved.nowId || listIds[0];
    let idx = listIds.indexOf(cur);
    if(idx < 0) idx = 0;

    if(getShuffle()){
      const r = Math.floor(Math.random()*listIds.length);
      const id = listIds[r];
      savePlayerState({ ...saved, nowId: id, listIds, index: r });
      window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=1`;
      return;
    }

    const prevIdx = (idx - 1 + listIds.length) % listIds.length;
    const id = listIds[prevIdx];
    savePlayerState({ ...saved, nowId: id, listIds, index: prevIdx });
    window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=1`;
  });

  $("nextBtn")?.addEventListener("click", ()=>{
    const saved = loadPlayerState() || {};
    const listIds = Array.isArray(saved.listIds) ? saved.listIds : state.all.map(x=>x.id);
    if(!listIds.length) return;

    const cur = saved.nowId || listIds[0];
    let idx = listIds.indexOf(cur);
    if(idx < 0) idx = 0;

    if(getShuffle()){
      const r = Math.floor(Math.random()*listIds.length);
      const id = listIds[r];
      savePlayerState({ ...saved, nowId: id, listIds, index: r });
      window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=1`;
      return;
    }

    const nextIdx = (idx + 1) % listIds.length;
    const id = listIds[nextIdx];
    savePlayerState({ ...saved, nowId: id, listIds, index: nextIdx });
    window.location.href = `song.html?v=${encodeURIComponent(id)}&autoplay=1`;
  });

  window.addEventListener("hashchange", routeIndex);

  if($("grid") && $("homePro")){
    bootstrapIndex();
  }
});
