const YT_API_KEY = "AIzaSyD3mvCx80XsvwrURRg2RwaD8HmOKqhYkek";
const YT_HANDLE  = "F90-Music";

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

const I18N = {
  ar: {
    home:"الرئيسية", all:"كل الأغاني", rap:"الراب", sad:"رومنسي/حزين/طربي",
    trending:"Trending", live:"LIVE", fav:"المفضلة", later:"استمع لاحقًا", history:"السجل", queue:"Queue",
    searchPH:"ابحث باسم الأغنية...", refresh:"تحديث", share:"مشاركة",
    total:"عدد الأغاني", latest:"آخر إصدار", liveLbl:"Live",
    rate:"قيّم الأغنية", comments:"التعليقات", commentPH:"اكتب تعليقك هنا…", add:"إضافة", local:"محفوظ على جهازك",
    loading:"جاري التحميل…", failed:"فشل التحميل. غالبًا API KEY أو referrer.",
    liveNow:"LIVE NOW", noLive:"لا يوجد بث الآن", openLive:"فتح البث",
    addQueue:"+ Queue", added:"تمت الإضافة", removed:"تم الحذف",
    empty:"لا يوجد عناصر",
    mostPlayed:"الأكثر تشغيلًا داخل الموقع",
    views:"مشاهدات",
  },
  en: {
    home:"Home", all:"All", rap:"Rap", sad:"Romantic/Sad/Tarab",
    trending:"Trending", live:"LIVE", fav:"Favorites", later:"Listen Later", history:"History", queue:"Queue",
    searchPH:"Search by title...", refresh:"Refresh", share:"Share",
    total:"Total Tracks", latest:"Latest Release", liveLbl:"Live",
    rate:"Rate", comments:"Comments", commentPH:"Write your comment…", add:"Add", local:"Saved on this device",
    loading:"Loading…", failed:"Load failed. API key or referrer mismatch.",
    liveNow:"LIVE NOW", noLive:"No live now", openLive:"Open live",
    addQueue:"+ Queue", added:"Added", removed:"Removed",
    empty:"No items",
    mostPlayed:"Most played on this device",
    views:"views",
  }
};

// ===== State / Storage =====
const LS = {
  lang:"f90_lang",
  theme:"f90_theme",
  motion:"f90_motion",
  fav:"f90_fav",
  later:"f90_later",
  history:"f90_history",
  queue:"f90_queue",
  plays:"f90_plays",
  cache:"f90_cache_v1"
};

const state = {
  lang: getLS(LS.lang, "ar"),
  theme: getLS(LS.theme, "neon"),
  motion: getLS(LS.motion, "on"),
  channelId: null,
  uploadsId: null,
  liveVideoId: null,

  all: [],
  rap: [],
  sad: [],
  statsById: new Map(),   // id -> {views, duration, ...}
  now: null,              // current track object
  view: "home",
};

function getLS(key, fallback){
  try{ const v = localStorage.getItem(key); return v ?? fallback; }catch{ return fallback; }
}
function setLS(key, v){
  try{ localStorage.setItem(key, v); }catch{}
}
function getJSON(key, fallback){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch{ return fallback; }
}
function setJSON(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
}

function L(){ return I18N[state.lang] || I18N.ar; }

// ===== DOM helpers =====
const $ = (id)=>document.getElementById(id);
const fmtDate = (iso)=> new Date(iso).toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"});
function escapeHtml(str){
  return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function nfmt(num){
  try{
    const n = Number(num||0);
    if(n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,"")+"M";
    if(n >= 1_000) return (n/1_000).toFixed(1).replace(/\.0$/,"")+"K";
    return String(n);
  }catch{return String(num||0);}
}

// ===== Links inject =====
function injectLinks(){
  Object.keys(LINKS).forEach(k=>{
    document.querySelectorAll(`[data-link="${k}"]`).forEach(a=>{ a.href = LINKS[k]; });
  });
}

// ===== Theme / Lang / Motion apply =====
function applyPrefs(){
  document.documentElement.setAttribute("data-theme", state.theme);
  document.documentElement.setAttribute("data-motion", state.motion === "off" ? "off" : "on");
  document.documentElement.lang = state.lang === "en" ? "en" : "ar";
  document.documentElement.dir  = state.lang === "en" ? "ltr" : "rtl";

  $("searchInput").placeholder = L().searchPH;
  $("refreshBtn").textContent = L().refresh;
  $("shareBtn").textContent = L().share;

  $("lblTotal").textContent = L().total;
  $("lblLatest").textContent = L().latest;
  $("lblLive").textContent = L().liveLbl;

  $("rateTitle").textContent = L().rate;
  $("commentsTitle").textContent = L().comments;
  $("commentInput").placeholder = L().commentPH;
  $("addCommentBtn").textContent = L().add;
  $("localNote").textContent = L().local;

  // Sort labels (keep values)
  const sort = $("sortSelect");
  sort.options[0].textContent = state.lang==="en" ? "Newest" : "الأحدث";
  sort.options[1].textContent = state.lang==="en" ? "Oldest" : "الأقدم";
  sort.options[2].textContent = state.lang==="en" ? "Most views" : "الأكثر مشاهدة";
  sort.options[3].textContent = "A-Z";

  // Filter labels (values fixed)
  const filter = $("filterSelect");
  filter.options[0].textContent = "All";
  filter.options[1].textContent = "Rap";
  filter.options[2].textContent = "Sad";
  filter.options[3].textContent = L().fav;
  filter.options[4].textContent = L().later;
  filter.options[5].textContent = L().history;

  // Sidebar render text
  renderSideNav();
}

// ===== Drawer =====
function openDrawer(){
  $("drawer").classList.add("open");
  $("drawerOverlay").classList.add("open");
}
function closeDrawer(){
  $("drawer").classList.remove("open");
  $("drawerOverlay").classList.remove("open");
}

// ===== Router (hash) =====
function parseRoute(){
  const h = location.hash || "#/home";
  const [path, query] = h.split("?");
  const parts = path.replace("#/","").split("/");
  return { view: parts[0] || "home", id: parts[1] || null, query: query||"" };
}
function go(hash){ location.hash = hash; }
function setView(view, subtitle=""){
  state.view = view;
  $("viewTitle").textContent = viewTitle(view);
  $("viewSubtitle").textContent = subtitle || "—";
  $("viewPill").textContent = "F90";
  // home hero visible only on home/trending/live
  $("hero").style.display = (view==="home") ? "" : "none";
  // panels
  $("panelSong").classList.remove("show");
  $("panelQueue").classList.remove("show");
}
function viewTitle(view){
  const t = {
    home: L().home,
    all: L().all,
    rap: L().rap,
    sad: L().sad,
    trending: L().trending,
    live: L().live,
    fav: L().fav,
    later: L().later,
    history: L().history,
    queue: L().queue,
    track: "Track",
  };
  return t[view] || L().home;
}

// ===== YouTube API =====
async function ytFetch(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error("YT API error");
  return res.json();
}
async function getChannelIdFromHandle(handle){
  const q = `@${handle}`;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`;
  const data = await ytFetch(url);
  if(!data.items?.length) throw new Error("Channel not found");
  return data.items[0].snippet.channelId;
}
async function getUploadsPlaylistId(channelId){
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${YT_API_KEY}`;
  const data = await ytFetch(url);
  const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if(!uploads) throw new Error("Uploads not found");
  return uploads;
}
async function getAllPlaylistItems(playlistId){
  let items = [];
  let pageToken = "";
  while(true){
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=50&pageToken=${encodeURIComponent(pageToken)}&key=${YT_API_KEY}`;
    const data = await ytFetch(url);
    const chunk = (data.items || [])
      .map(it => ({
        id: it.contentDetails?.videoId,
        title: it.snippet?.title || "",
        publishedAt: it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt,
        thumb: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url || "",
        channelTitle: it.snippet?.channelTitle || "",
      }))
      .filter(v => v.id && v.title && v.title !== "Private video" && v.title !== "Deleted video");
    items.push(...chunk);
    if(!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return items;
}
async function getVideosStats(ids){
  // batch 50 ids per call
  const out = new Map();
  for(let i=0;i<ids.length;i+=50){
    const batch = ids.slice(i,i+50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${encodeURIComponent(batch.join(","))}&key=${YT_API_KEY}`;
    const data = await ytFetch(url);
    (data.items||[]).forEach(it=>{
      const id = it.id;
      const views = Number(it.statistics?.viewCount || 0);
      const duration = it.contentDetails?.duration || "";
      const publishedAt = it.snippet?.publishedAt || "";
      out.set(id, { views, duration, publishedAt });
    });
  }
  return out;
}
async function checkLive(channelId){
  // If live running, YouTube search with eventType=live
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&maxResults=1&key=${YT_API_KEY}`;
  const data = await ytFetch(url);
  const item = data.items?.[0];
  return item?.id?.videoId || null;
}

// ===== Cache layer =====
function loadCache(){
  const c = getJSON(LS.cache, null);
  if(!c) return null;
  // 30 min TTL
  if(Date.now() - (c.ts||0) > 30*60*1000) return null;
  return c;
}
function saveCache(payload){
  setJSON(LS.cache, { ts: Date.now(), ...payload });
}

// ===== Data bootstrap =====
async function bootstrapData(force=false){
  $("homeStatus").textContent = L().loading;

  if(!force){
    const cached = loadCache();
    if(cached){
      state.channelId = cached.channelId;
      state.uploadsId = cached.uploadsId;
      state.all = cached.all || [];
      state.rap = cached.rap || [];
      state.sad = cached.sad || [];
      state.liveVideoId = cached.liveVideoId || null;
      state.statsById = new Map(Object.entries(cached.statsById || {}).map(([k,v])=>[k,v]));
      applyHeaderStats();
      $("homeStatus").textContent = "";
      return;
    }
  }

  // fresh load
  state.channelId = await getChannelIdFromHandle(YT_HANDLE);
  state.uploadsId = await getUploadsPlaylistId(state.channelId);

  const [all, rap, sad] = await Promise.all([
    getAllPlaylistItems(state.uploadsId),
    getAllPlaylistItems(PLAYLISTS.rap),
    getAllPlaylistItems(PLAYLISTS.sad),
  ]);

  // Deduplicate in each list
  const uniq = (arr)=>{
    const m = new Map();
    arr.forEach(v=>{ if(!m.has(v.id)) m.set(v.id, v); });
    return Array.from(m.values());
  };

  state.all = uniq(all).sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  state.rap = uniq(rap).sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  state.sad = uniq(sad).sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

  // stats for all ids (for trending/views sort)
  const ids = state.all.map(v=>v.id);
  const statsMap = await getVideosStats(ids);
  state.statsById = statsMap;

  // live
  state.liveVideoId = await checkLive(state.channelId);

  saveCache({
    channelId: state.channelId,
    uploadsId: state.uploadsId,
    all: state.all,
    rap: state.rap,
    sad: state.sad,
    liveVideoId: state.liveVideoId,
    statsById: Object.fromEntries(state.statsById.entries()),
  });

  applyHeaderStats();
  $("homeStatus").textContent = "";
}

function applyHeaderStats(){
  $("totalTracks").textContent = String(state.all.length || "—");
  $("latestTrack").textContent = state.all[0] ? fmtDate(state.all[0].publishedAt) : "—";

  if(state.liveVideoId){
    $("liveState").textContent = L().liveNow;
    $("liveQuickBtn").classList.add("primary");
  }else{
    $("liveState").textContent = L().noLive;
    $("liveQuickBtn").classList.remove("primary");
  }

  $("statsMini").textContent = `${L().total}: ${state.all.length || 0}`;
}

// ===== Sidebar nav =====
const NAV_ITEMS = [
  { key:"home", hash:"#/home" },
  { key:"all", hash:"#/all" },
  { key:"rap", hash:"#/rap" },
  { key:"sad", hash:"#/sad" },
  { key:"trending", hash:"#/trending" },
  { key:"live", hash:"#/live" },
  { key:"fav", hash:"#/fav" },
  { key:"later", hash:"#/later" },
  { key:"history", hash:"#/history" },
  { key:"queue", hash:"#/queue" },
];

function renderSideNav(){
  const make = (containerId)=>{
    const nav = $(containerId);
    if(!nav) return;
    nav.innerHTML = NAV_ITEMS.map(it=>{
      const label = L()[it.key] || it.key;
      return `<a href="${it.hash}" data-k="${it.key}">${escapeHtml(label)}</a>`;
    }).join("");
  };

  make("sideNav");
  make("sideNavMobile");
  updateActiveNav();
}

function updateActiveNav(){
  const { view } = parseRoute();
  document.querySelectorAll(".sideNav a").forEach(a=>{
    a.classList.toggle("active", a.getAttribute("data-k") === view);
  });
}

// ===== Library features (fav/later/history/plays/queue) =====
function getSet(key){ return new Set(getJSON(key, [])); }
function setSet(key, s){ setJSON(key, Array.from(s)); }

function getQueue(){ return getJSON(LS.queue, []); }
function setQueue(q){ setJSON(LS.queue, q); }

function addPlay(id){
  const plays = getJSON(LS.plays, {});
  plays[id] = (plays[id]||0) + 1;
  setJSON(LS.plays, plays);
}

function pushHistory(id){
  const h = getJSON(LS.history, []);
  const next = [id, ...h.filter(x=>x!==id)].slice(0, 120);
  setJSON(LS.history, next);
}

function trackById(id){
  return state.all.find(x=>x.id===id) || state.rap.find(x=>x.id===id) || state.sad.find(x=>x.id===id) || null;
}

function isNew(publishedAt){
  const t = new Date(publishedAt).getTime();
  return (Date.now() - t) <= 7*24*60*60*1000;
}

// ===== Rendering grid =====
function computeBadges(t){
  const badges = [];
  if(isNew(t.publishedAt)) badges.push("NEW");
  const fav = getSet(LS.fav);
  if(fav.has(t.id)) badges.push("★");
  const later = getSet(LS.later);
  if(later.has(t.id)) badges.push("⏳");
  return badges;
}

function renderGrid(list){
  const grid = $("grid");
  grid.innerHTML = list.map(t=>{
    const st = state.statsById.get(t.id) || {};
    const views = st.views ?? 0;
    const badges = computeBadges(t);
    return `
      <article class="item" data-id="${t.id}">
        <img class="thumb" src="${t.thumb}" alt="">
        <div class="itemBody">
          <p class="itemTitle">${escapeHtml(t.title)}</p>
          <p class="itemMeta">${fmtDate(t.publishedAt)} • ${nfmt(views)} ${escapeHtml(L().views)}</p>
          ${badges.length ? `<div class="badges">${badges.map(b=>`<span class="pill">${escapeHtml(b)}</span>`).join("")}</div>` : ``}
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      go(`#/track/${encodeURIComponent(id)}`);
    });
  });
}

// ===== Filters / sorts =====
function applySearchSortFilter(list){
  const q = ($("searchInput").value || "").trim().toLowerCase();
  const sort = $("sortSelect").value;
  const filter = $("filterSelect").value;

  let out = list;

  // filter lists by special sets
  if(filter === "rap") out = state.rap.slice();
  else if(filter === "sad") out = state.sad.slice();
  else if(filter === "fav"){
    const fav = getSet(LS.fav);
    out = state.all.filter(x=>fav.has(x.id));
  }
  else if(filter === "later"){
    const later = getSet(LS.later);
    out = state.all.filter(x=>later.has(x.id));
  }
  else if(filter === "history"){
    const h = getJSON(LS.history, []);
    out = h.map(id=>trackById(id)).filter(Boolean);
  }

  if(q) out = out.filter(x=>x.title.toLowerCase().includes(q));

  // sort
  if(sort === "date_desc") out.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  if(sort === "date_asc") out.sort((a,b)=> new Date(a.publishedAt)-new Date(b.publishedAt));
  if(sort === "title_asc") out.sort((a,b)=> a.title.localeCompare(b.title));
  if(sort === "views_desc"){
    out.sort((a,b)=> (state.statsById.get(b.id)?.views||0) - (state.statsById.get(a.id)?.views||0));
  }

  return out;
}

// ===== Track view =====
function showTrack(id){
  const t = trackById(id);
  if(!t) return;

  state.now = t;
  setView("track", fmtDate(t.publishedAt));
  $("panelSong").classList.add("show");
  $("panelQueue").classList.remove("show");
  $("hero").style.display = "none";

  $("songTitle").textContent = t.title;
  $("songMeta").textContent = `${fmtDate(t.publishedAt)} • ${t.channelTitle || "F90"}`;
  $("ytBtn").href = `https://www.youtube.com/watch?v=${encodeURIComponent(t.id)}`;

  $("player").src = `https://www.youtube.com/embed/${encodeURIComponent(t.id)}?autoplay=1`;
  $("miniTitle").textContent = t.title;
  $("miniMeta").textContent = fmtDate(t.publishedAt);
  $("playBtn").textContent = "Playing";

  // local actions
  addPlay(t.id);
  pushHistory(t.id);

  // update buttons state
  updateFavLaterBtns();
  renderStarsFor(t.id);
  renderCommentsFor(t.id);

  // if queue empty, auto seed queue from current view category (smart)
  if(getQueue().length === 0){
    const seed = smartSeedQueue(t.id);
    setQueue(seed);
  }
  renderQueue();

  // auto next when video ends: YouTube iframe API would be needed; we do simple “Next” buttons (no heavy API).
}

function smartSeedQueue(currentId){
  // prioritize current category list; if in rap use rap list else sad else all
  const inRap = state.rap.some(x=>x.id===currentId);
  const inSad = state.sad.some(x=>x.id===currentId);
  const base = (inRap ? state.rap : inSad ? state.sad : state.all).slice();
  const idx = base.findIndex(x=>x.id===currentId);
  if(idx === -1) return base.slice(0, 20).map(x=>x.id);

  const ordered = base.slice(idx, idx+30).concat(base.slice(0, idx)).slice(0, 30);
  return ordered.map(x=>x.id);
}

// ===== Favorites / Later =====
function updateFavLaterBtns(){
  const id = state.now?.id;
  if(!id) return;
  const fav = getSet(LS.fav);
  const later = getSet(LS.later);

  $("favBtn").textContent = fav.has(id) ? "♥" : "♡";
  $("laterBtn").textContent = later.has(id) ? "Later ✓" : "Later";
}
function toggleFav(id){
  const fav = getSet(LS.fav);
  fav.has(id) ? fav.delete(id) : fav.add(id);
  setSet(LS.fav, fav);
  updateFavLaterBtns();
  refreshCurrentGrid();
}
function toggleLater(id){
  const later = getSet(LS.later);
  later.has(id) ? later.delete(id) : later.add(id);
  setSet(LS.later, later);
  updateFavLaterBtns();
  refreshCurrentGrid();
}

// ===== Comments + Rating (local) =====
function trackKey(id){ return `f90_track_${id}`; }
function loadTrackState(id){
  try{
    const raw = localStorage.getItem(trackKey(id));
    return raw ? JSON.parse(raw) : { rating: 0, comments: [] };
  }catch{ return { rating: 0, comments: [] }; }
}
function saveTrackState(id, obj){
  localStorage.setItem(trackKey(id), JSON.stringify(obj));
}
function renderStarsFor(id){
  const st = loadTrackState(id);
  $("stars").querySelectorAll(".star").forEach((s, i)=>{
    s.classList.toggle("active", (i+1) <= (st.rating||0));
  });
}
function renderCommentsFor(id){
  const st = loadTrackState(id);
  const list = st.comments || [];
  const wrap = $("commentsList");
  if(!list.length){
    wrap.innerHTML = `<div class="small">${escapeHtml(L().empty)} • ${escapeHtml(L().local)}</div>`;
    return;
  }
  wrap.innerHTML = list.map(c=>`
    <div class="listItem">
      <div class="liLeft">
        <div>
          <div class="small">${escapeHtml(c.time||"")}</div>
          <div>${escapeHtml(c.text||"")}</div>
        </div>
      </div>
      <div class="liBtns">
        <button class="btn pill" data-del="${escapeHtml(c.id)}">Del</button>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-del]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const cid = b.getAttribute("data-del");
      const st2 = loadTrackState(id);
      st2.comments = (st2.comments||[]).filter(x=>x.id!==cid);
      saveTrackState(id, st2);
      renderCommentsFor(id);
    });
  });
}

// ===== Queue =====
function renderQueue(){
  const q = getQueue();
  $("queueHint").textContent = `Items: ${q.length}`;
  const list = $("queueList");
  if(!q.length){
    list.innerHTML = `<div class="small">${escapeHtml(L().empty)}</div>`;
    return;
  }
  list.innerHTML = q.map((id, idx)=>{
    const t = trackById(id);
    if(!t) return "";
    return `
      <div class="listItem" data-qid="${escapeHtml(id)}">
        <div class="liLeft" role="button" tabindex="0" data-play="${escapeHtml(id)}">
          <img class="liThumb" src="${escapeHtml(t.thumb)}" alt="">
          <div style="min-width:0">
            <div class="liTitle">${escapeHtml(t.title)}</div>
            <div class="liMeta">${fmtDate(t.publishedAt)}</div>
          </div>
        </div>
        <div class="liBtns">
          <button class="btn pill" data-up="${idx}">↑</button>
          <button class="btn pill" data-down="${idx}">↓</button>
          <button class="btn pill" data-rem="${escapeHtml(id)}">✕</button>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-play]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-play");
      go(`#/track/${encodeURIComponent(id)}`);
    });
  });
  list.querySelectorAll("[data-rem]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-rem");
      const q2 = getQueue().filter(x=>x!==id);
      setQueue(q2);
      renderQueue();
    });
  });
  list.querySelectorAll("[data-up]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = Number(btn.getAttribute("data-up"));
      const q2 = getQueue();
      if(i<=0) return;
      [q2[i-1], q2[i]] = [q2[i], q2[i-1]];
      setQueue(q2);
      renderQueue();
    });
  });
  list.querySelectorAll("[data-down]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = Number(btn.getAttribute("data-down"));
      const q2 = getQueue();
      if(i>=q2.length-1) return;
      [q2[i+1], q2[i]] = [q2[i], q2[i+1]];
      setQueue(q2);
      renderQueue();
    });
  });
}

function addCurrentToQueue(){
  const id = state.now?.id;
  if(!id) return;
  const q = getQueue();
  if(!q.includes(id)){
    q.push(id);
    setQueue(q);
  }
  renderQueue();
}

// ===== Views render =====
function refreshCurrentGrid(){
  const { view } = parseRoute();
  renderByView(view);
}

function renderByView(view){
  updateActiveNav();

  $("panelSong").classList.remove("show");
  $("panelQueue").classList.remove("show");
  $("toolbar").style.display = "";

  if(view === "home"){
    setView("home", "F90");
    $("toolbar").style.display = "none";
    $("panelQueue").classList.remove("show");
    const list = state.all.slice(0, 12);
    renderGrid(list);
    return;
  }

  if(view === "all"){
    setView("all", `${state.all.length} tracks`);
    $("filterSelect").value = "all";
    const list = applySearchSortFilter(state.all.slice());
    renderGrid(list);
    return;
  }

  if(view === "rap"){
    setView("rap", `${state.rap.length} tracks`);
    $("filterSelect").value = "rap";
    const list = applySearchSortFilter(state.rap.slice());
    renderGrid(list);
    return;
  }

  if(view === "sad"){
    setView("sad", `${state.sad.length} tracks`);
    $("filterSelect").value = "sad";
    const list = applySearchSortFilter(state.sad.slice());
    renderGrid(list);
    return;
  }

  if(view === "trending"){
    setView("trending", "Most views");
    $("filterSelect").value = "all";
    $("sortSelect").value = "views_desc";
    const list = applySearchSortFilter(state.all.slice()).slice(0, 48);
    renderGrid(list);
    return;
  }

  if(view === "live"){
    setView("live", "Channel Live");
    $("toolbar").style.display = "none";
    if(state.liveVideoId){
      const t = trackById(state.liveVideoId) || { id: state.liveVideoId, title: L().liveNow, publishedAt: new Date().toISOString(), thumb:"", channelTitle:"F90" };
      renderGrid([t]);
      // quick open in player
      $("homeStatus").textContent = "";
    }else{
      $("grid").innerHTML = `
        <div class="card pad" style="margin:18px">
          <div class="cardTitle">${escapeHtml(L().noLive)}</div>
          <div class="small">${escapeHtml("إذا بدأ بث مباشر سيظهر هنا تلقائيًا بعد Refresh.")}</div>
          <div class="row" style="margin-top:12px">
            <button class="btn primary" id="checkLiveBtn" type="button">${escapeHtml(L().refresh)}</button>
            <a class="btn" data-link="youtube" target="_blank" rel="noopener">YouTube</a>
          </div>
        </div>
      `;
      const b = document.getElementById("checkLiveBtn");
      if(b) b.addEventListener("click", async ()=>{
        await bootstrapData(true);
        renderByView("live");
      });
    }
    return;
  }

  if(view === "fav"){
    setView("fav", L().local);
    $("filterSelect").value = "fav";
    const list = applySearchSortFilter(state.all.slice());
    renderGrid(list);
    return;
  }

  if(view === "later"){
    setView("later", L().local);
    $("filterSelect").value = "later";
    const list = applySearchSortFilter(state.all.slice());
    renderGrid(list);
    return;
  }

  if(view === "history"){
    setView("history", L().local);
    $("filterSelect").value = "history";
    const list = applySearchSortFilter(state.all.slice());
    renderGrid(list);
    return;
  }

  if(view === "queue"){
    setView("queue", L().local);
    $("toolbar").style.display = "none";
    $("panelQueue").classList.add("show");
    renderQueue();
    $("grid").innerHTML = "";
    return;
  }
}

// ===== Share =====
async function shareCurrent(){
  const { view, id } = parseRoute();
  const url = location.href;
  const title = (view === "track" && id) ? (trackById(id)?.title || "F90 Track") : "F90 Music";
  if(navigator.share){
    try{ await navigator.share({ title, url }); return; }catch{}
  }
  try{
    await navigator.clipboard.writeText(url);
    alert("Copied!");
  }catch{
    prompt("Copy link:", url);
  }
}

// ===== Events =====
function bindEvents(){
  // drawer
  $("drawerBtn").addEventListener("click", openDrawer);
  $("closeDrawer").addEventListener("click", closeDrawer);
  $("drawerOverlay").addEventListener("click", closeDrawer);

  // home click
  $("goHome").addEventListener("click", ()=>go("#/home"));

  // navto buttons
  document.querySelectorAll("[data-navto]").forEach(b=>{
    b.addEventListener("click", ()=>go(b.getAttribute("data-navto")));
  });

  // prefs
  $("langBtn").addEventListener("click", ()=>{
    state.lang = (state.lang === "ar") ? "en" : "ar";
    setLS(LS.lang, state.lang);
    applyPrefs();
    refreshCurrentGrid();
  });

  $("themeBtn").addEventListener("click", ()=>{
    const next = (state.theme === "neon") ? "cyan" : (state.theme === "cyan") ? "pink" : "neon";
    state.theme = next;
    setLS(LS.theme, next);
    applyPrefs();
  });

  $("motionBtn").addEventListener("click", ()=>{
    state.motion = (state.motion === "off") ? "on" : "off";
    setLS(LS.motion, state.motion);
    applyPrefs();
  });

  $("refreshBtn").addEventListener("click", async ()=>{
    await bootstrapData(true);
    refreshCurrentGrid();
  });

  $("shareBtn").addEventListener("click", shareCurrent);

  // search/sort/filter
  $("searchInput").addEventListener("input", ()=>refreshCurrentGrid());
  $("sortSelect").addEventListener("change", ()=>refreshCurrentGrid());
  $("filterSelect").addEventListener("change", ()=>refreshCurrentGrid());

  // hash router
  window.addEventListener("hashchange", ()=>{
    const r = parseRoute();
    updateActiveNav();
    if(r.view === "track" && r.id){
      showTrack(decodeURIComponent(r.id));
    }else{
      renderByView(r.view);
    }
  });

  // mini controls
  $("queueBtn").addEventListener("click", ()=>go("#/queue"));
  $("prevBtn").addEventListener("click", playPrev);
  $("nextBtn").addEventListener("click", playNext);
  $("playBtn").addEventListener("click", ()=>{
    if(state.now) go(`#/track/${encodeURIComponent(state.now.id)}`);
    else go("#/home");
  });

  // song panel buttons
  $("addQueueBtn").addEventListener("click", addCurrentToQueue);
  $("favBtn").addEventListener("click", ()=> state.now && toggleFav(state.now.id));
  $("laterBtn").addEventListener("click", ()=> state.now && toggleLater(state.now.id));

  // stars
  $("stars").querySelectorAll(".star").forEach((s, idx)=>{
    s.addEventListener("click", ()=>{
      if(!state.now) return;
      const id = state.now.id;
      const st = loadTrackState(id);
      st.rating = idx + 1;
      saveTrackState(id, st);
      renderStarsFor(id);
    });
  });

  // comments
  $("addCommentBtn").addEventListener("click", ()=>{
    if(!state.now) return;
    const id = state.now.id;
    const txt = ($("commentInput").value || "").trim();
    if(!txt) return;
    const st = loadTrackState(id);
    st.comments = st.comments || [];
    st.comments.unshift({ id: cryptoId(), text: txt, time: new Date().toLocaleString() });
    saveTrackState(id, st);
    $("commentInput").value = "";
    renderCommentsFor(id);
  });

  // queue clear
  $("clearQueueBtn").addEventListener("click", ()=>{
    setQueue([]);
    renderQueue();
  });
}

function cryptoId(){
  try{ return crypto.randomUUID(); }catch{ return String(Date.now()) + Math.random().toString(16).slice(2); }
}

// ===== Next/Prev from queue =====
function playNext(){
  const q = getQueue();
  if(!q.length){
    // fallback: next in all list
    if(!state.now){ go("#/home"); return; }
    const idx = state.all.findIndex(x=>x.id===state.now.id);
    const next = state.all[(idx+1) % state.all.length];
    if(next) go(`#/track/${encodeURIComponent(next.id)}`);
    return;
  }
  if(!state.now){
    go(`#/track/${encodeURIComponent(q[0])}`);
    return;
  }
  const i = q.indexOf(state.now.id);
  const nextId = q[(i+1) % q.length] || q[0];
  go(`#/track/${encodeURIComponent(nextId)}`);
}
function playPrev(){
  const q = getQueue();
  if(!q.length){
    if(!state.now){ go("#/home"); return; }
    const idx = state.all.findIndex(x=>x.id===state.now.id);
    const prev = state.all[(idx-1+state.all.length) % state.all.length];
    if(prev) go(`#/track/${encodeURIComponent(prev.id)}`);
    return;
  }
  if(!state.now){
    go(`#/track/${encodeURIComponent(q[0])}`);
    return;
  }
  const i = q.indexOf(state.now.id);
  const prevId = q[(i-1+q.length) % q.length] || q[0];
  go(`#/track/${encodeURIComponent(prevId)}`);
}

// ===== Boot =====
(async function boot(){
  // years
  const y = new Date().getFullYear();
  ["year","yearF","yearM"].forEach(id=>{ const el = $(id); if(el) el.textContent = y; });

  injectLinks();
  applyPrefs();
  bindEvents();

  // default route
  if(!location.hash) location.hash = "#/home";

  try{
    await bootstrapData(false);
  }catch(e){
    console.error(e);
    $("homeStatus").textContent = L().failed;
  }

  // initial render
  const r = parseRoute();
  if(r.view === "track" && r.id) showTrack(decodeURIComponent(r.id));
  else renderByView(r.view);

})();
