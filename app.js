// ===== F90 MUSIC - Arabic Only - FINAL app.js (Drawer FIXED + Stable Player + Prev/Play/Pause/Next) =====
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

const $ = (id)=>document.getElementById(id);
const escapeHtml = (s)=>String(s??"")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtDate = (iso)=> new Date(iso).toLocaleDateString("ar", {year:"numeric", month:"short", day:"numeric"});
const nfmt = (num)=>{
  const n=Number(num||0);
  return n>=1e6 ? (n/1e6).toFixed(1).replace(/\.0$/,"")+"م"
       : n>=1e3 ? (n/1e3).toFixed(1).replace(/\.0$/,"")+"ألف"
       : String(n);
};

function setText(id, v){ const el=$(id); if(el) el.textContent = v; }
function showStatus(msg){ const el=$("homeStatus"); if(el) el.textContent = msg || ""; }
function setHrefAll(k, url){ document.querySelectorAll(`[data-link="${k}"]`).forEach(a=>a.href=url); }

// ---------------- State ----------------
const state = {
  channelId:null,
  uploadsId:null,
  liveVideoId:null,
  all:[],
  rap:[],
  sad:[],
  stats:new Map(),
  now:null,

  ytReady:false,
  playerMini:null,
  playerBig:null,
  isPlaying:false,

  currentListName:"all",
  currentList:[],
  currentIndex:-1,
};

// ---------------- YouTube API (Data v3) ----------------
async function ytFetch(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error("YT API error " + r.status);
  return r.json();
}

async function getChannelIdFromHandle(handle){
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent("@"+handle)}&key=${YT_API_KEY}`;
  const data = await ytFetch(url);
  const id = data.items?.[0]?.snippet?.channelId;
  if(!id) throw new Error("channel not found");
  return id;
}

async function getUploadsPlaylistId(channelId){
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${YT_API_KEY}`;
  const data = await ytFetch(url);
  const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if(!uploads) throw new Error("uploads not found");
  return uploads;
}

async function getAllPlaylistItems(playlistId){
  let items=[], pageToken="";
  while(true){
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=50&pageToken=${encodeURIComponent(pageToken)}&key=${YT_API_KEY}`;
    const data = await ytFetch(url);

    const chunk = (data.items||[]).map(it=>({
      id: it.contentDetails?.videoId,
      title: it.snippet?.title || "",
      publishedAt: it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt,
      thumb: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url || "",
    })).filter(v=>v.id && v.title && v.title!=="Private video" && v.title!=="Deleted video");

    items.push(...chunk);
    if(!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  const m=new Map();
  items.forEach(v=>{ if(!m.has(v.id)) m.set(v.id,v); });
  return Array.from(m.values());
}

async function getVideosStats(ids){
  const out=new Map();
  for(let i=0;i<ids.length;i+=50){
    const batch=ids.slice(i,i+50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(batch.join(","))}&key=${YT_API_KEY}`;
    const data = await ytFetch(url);
    (data.items||[]).forEach(it=>{
      out.set(it.id, { views:Number(it.statistics?.viewCount||0) });
    });
  }
  return out;
}

async function checkLive(channelId){
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&maxResults=1&key=${YT_API_KEY}`;
  const data = await ytFetch(url);
  return data.items?.[0]?.id?.videoId || null;
}

// ---------------- RSS fallback ----------------
async function fetchRSS(channelId){
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error("RSS error " + r.status);
  const xml = await r.text();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const entries = Array.from(doc.getElementsByTagName("entry"));
  return entries.map(e=>{
    const vid = e.getElementsByTagName("yt:videoId")[0]?.textContent?.trim();
    const title = e.getElementsByTagName("title")[0]?.textContent?.trim() || "";
    const published = e.getElementsByTagName("published")[0]?.textContent?.trim() || "";
    const thumb = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
    return { id:vid, title, publishedAt:published, thumb };
  }).filter(x=>x.id);
}

// ---------------- Drawer (FINAL FIX) ----------------
function bindDrawer(){
  const drawerBtn = document.getElementById("drawerBtn");
  const drawer    = document.getElementById("drawer");
  const overlay   = document.getElementById("drawerOverlay");
  const closeBtn  = document.getElementById("closeDrawer");

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

  // اقفل فوراً (حل فتح تلقائي/تعليق)
  close();

  // فتح الدرج
  drawerBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    open();
  });

  // إغلاق بزر الإغلاق
  closeBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  // إغلاق عند الضغط على الخلفية (الأضمن للموبايل)
  overlay.addEventListener("pointerdown", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    close();
  }, true);

  // إغلاق عند الضغط على رابط داخل الدرج
  drawer.addEventListener("click", (e)=>{
    if(e.target.closest("a")) close();
  }, true);

  // إغلاق عند تغيير الصفحة
  window.addEventListener("hashchange", close);

  // إغلاق عند ESC
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") close();
  });

  // إغلاق عند الضغط خارج الدرج وهو مفتوح
  document.addEventListener("pointerdown", (e)=>{
    if(!drawer.classList.contains("open")) return;
    if(e.target.closest("#drawer")) return;
    if(e.target.closest("#drawerBtn")) return;
    close();
  }, true);
}

// ---------------- UI Render ----------------
function renderGrid(list){
  const grid = $("grid");
  if(!grid) return;

  if(!list.length){
    grid.innerHTML = `<div class="sideCard" style="margin:18px"><div class="sideCardTitle">لا يوجد أغاني لعرضها</div></div>`;
    return;
  }

  grid.innerHTML = list.map(t=>{
    const views = state.stats.get(t.id)?.views ?? 0;
    return `
      <article class="item" data-id="${escapeHtml(t.id)}">
        <img class="thumb" src="${escapeHtml(t.thumb)}" alt="">
        <div class="itemBody">
          <p class="itemTitle">${escapeHtml(t.title)}</p>
          <p class="itemMeta">${escapeHtml(fmtDate(t.publishedAt))} • ${escapeHtml(nfmt(views))} مشاهدة</p>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      location.hash = `#/track/${encodeURIComponent(id)}`;
    });
  });
}

function updateHeader(view){
  const map = {
    home: ["الرئيسية","أفضل تجربة تشغيل وتصنيف"],
    all:  ["كل الأغاني","كل إصدارات القناة"],
    rap:  ["الراب","قائمة الراب"],
    sad:  ["رومنسي/حزين/طربي","القائمة الثانية"],
    live: ["لايف","إذا كان هناك بث مباشر"],
    track:["الأغنية","تشغيل وتحكم كامل"]
  };
  const t = map[view] || ["F90","—"];
  setText("viewTitle", t[0]);
  setText("viewSubtitle", t[1]);
}

// ---------------- Search/Sort ----------------
function applySearchSort(){
  const q = ($("searchInput")?.value || "").trim().toLowerCase();
  const sort = $("sortSelect")?.value || "date_desc";

  let list = (state.currentListName==="rap") ? state.rap.slice()
          : (state.currentListName==="sad") ? state.sad.slice()
          : state.all.slice();

  if(q) list = list.filter(x=>x.title.toLowerCase().includes(q));

  if(sort === "date_desc") list.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  if(sort === "date_asc")  list.sort((a,b)=> new Date(a.publishedAt)-new Date(b.publishedAt));
  if(sort === "title_asc") list.sort((a,b)=> a.title.localeCompare(b.title));
  if(sort === "views_desc") list.sort((a,b)=> (state.stats.get(b.id)?.views||0) - (state.stats.get(a.id)?.views||0));

  renderGrid(list);
}

// ---------------- Stable Player (YouTube IFrame API) ----------------
function loadYTApi(){
  return new Promise((resolve)=>{
    if(window.YT && window.YT.Player){ resolve(); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = ()=>resolve();
  });
}

function createPlayers(){
  state.playerMini = new YT.Player("playerMini", {
    height: "1",
    width: "1",
    videoId: "",
    playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onReady: ()=>{ state.ytReady = true; },
      onStateChange: (e)=>{
        state.isPlaying = (e.data === YT.PlayerState.PLAYING);
        updatePlayButton();
        if(e.data === YT.PlayerState.ENDED) playNext();
      }
    }
  });

  state.playerBig = new YT.Player("playerBig", {
    height: "520",
    width: "100%",
    videoId: "",
    playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onStateChange: (e)=>{
        state.isPlaying = (e.data === YT.PlayerState.PLAYING);
        updatePlayButton();
        if(e.data === YT.PlayerState.ENDED) playNext();
      }
    }
  });
}

function updatePlayButton(){
  const btn = $("playBtn");
  if(!btn) return;
  btn.textContent = state.isPlaying ? "⏸" : "▶";
}

function syncPlayersToVideo(videoId, autoplay){
  if(!state.playerMini || !state.playerBig) return;

  try{
    state.playerMini.loadVideoById({ videoId });
    state.playerBig.loadVideoById({ videoId });
    if(!autoplay){
      state.playerMini.pauseVideo();
      state.playerBig.pauseVideo();
    }
  }catch{
    state.playerMini.cueVideoById(videoId);
    state.playerBig.cueVideoById(videoId);
  }

  if(autoplay){
    setTimeout(()=>{
      try{ state.playerMini.playVideo(); }catch{}
      try{ state.playerBig.playVideo(); }catch{}
    }, 250);
  }
}

function setCurrentList(name){
  state.currentListName = name;

  if(name==="rap") state.currentList = state.rap.slice();
  else if(name==="sad") state.currentList = state.sad.slice();
  else if(name==="live"){
    state.currentList = state.liveVideoId
      ? [{ id: state.liveVideoId, title:"بث مباشر", publishedAt:new Date().toISOString(), thumb:`https://i.ytimg.com/vi/${state.liveVideoId}/hqdefault.jpg` }]
      : [];
  } else state.currentList = state.all.slice();

  if(state.now){
    const idx = state.currentList.findIndex(x=>x.id===state.now.id);
    state.currentIndex = idx;
  }
}

function openTrack(videoId, autoplay){
  const t = state.all.find(x=>x.id===videoId) || state.rap.find(x=>x.id===videoId) || state.sad.find(x=>x.id===videoId)
         || { id: videoId, title:"الأغنية", publishedAt:new Date().toISOString(), thumb:`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };

  state.now = t;

  setText("miniTitle", t.title);
  setText("miniMeta", fmtDate(t.publishedAt));
  setText("songTitle", t.title);
  setText("songMeta", fmtDate(t.publishedAt));

  const ytBtn = $("ytBtn");
  if(ytBtn) ytBtn.href = `https://www.youtube.com/watch?v=${encodeURIComponent(t.id)}`;

  const idx = state.currentList.findIndex(x=>x.id===videoId);
  if(idx >= 0) state.currentIndex = idx;

  syncPlayersToVideo(videoId, autoplay);
}

function playToggle(){
  if(!state.ytReady) return;

  if(!state.now){
    const first = state.currentList[0] || state.all[0];
    if(!first) return;
    state.currentIndex = 0;
    openTrack(first.id, true);
    return;
  }

  try{
    if(state.isPlaying){
      state.playerMini.pauseVideo();
      state.playerBig.pauseVideo();
      state.isPlaying = false;
    }else{
      state.playerMini.playVideo();
      state.playerBig.playVideo();
      state.isPlaying = true;
    }
    updatePlayButton();
  }catch{}
}

function playNext(){
  const list = state.currentList.length ? state.currentList : state.all;
  if(!list.length) return;

  if(state.currentIndex < 0) state.currentIndex = 0;
  else state.currentIndex = (state.currentIndex + 1) % list.length;

  const next = list[state.currentIndex];
  if(next) openTrack(next.id, true);
}

function playPrev(){
  const list = state.currentList.length ? state.currentList : state.all;
  if(!list.length) return;

  if(state.currentIndex < 0) state.currentIndex = 0;
  else state.currentIndex = (state.currentIndex - 1 + list.length) % list.length;

  const prev = list[state.currentIndex];
  if(prev) openTrack(prev.id, true);
}

// ---------------- Boot ----------------
function injectLinks(){
  Object.keys(LINKS).forEach(k=> setHrefAll(k, LINKS[k]));
}

async function bootstrap(){
  showStatus("جاري تحميل الأغاني...");

  state.channelId = await getChannelIdFromHandle(YT_HANDLE);

  try{
    state.uploadsId = await getUploadsPlaylistId(state.channelId);

    const [all, rap, sad] = await Promise.all([
      getAllPlaylistItems(state.uploadsId),
      getAllPlaylistItems(PLAYLISTS.rap),
      getAllPlaylistItems(PLAYLISTS.sad),
    ]);

    state.all = all.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
    state.rap = rap.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
    state.sad = sad.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

    state.stats = await getVideosStats(state.all.map(x=>x.id));
    state.liveVideoId = await checkLive(state.channelId);

    setText("totalTracks", String(state.all.length));
    setText("latestTrack", state.all[0] ? fmtDate(state.all[0].publishedAt) : "—");
    setText("liveState", state.liveVideoId ? "مباشر الآن" : "لا يوجد");

    showStatus("");
  }catch(err){
    console.error(err);
    try{
      const rss = await fetchRSS(state.channelId);
      state.all = rss;
      state.rap = [];
      state.sad = [];
      state.stats = new Map();
      state.liveVideoId = null;

      setText("totalTracks", String(state.all.length));
      setText("latestTrack", state.all[0] ? fmtDate(state.all[0].publishedAt) : "—");
      setText("liveState", "لا يوجد");

      showStatus("فشل API (مفتاح/Referrer). تم تشغيل المصدر البديل.");
    }catch(e2){
      console.error(e2);
      showStatus("فشل تحميل الأغاني.");
    }
  }

  setCurrentList("all");

  if(!location.hash) location.hash="#/home";
  route();
  applySearchSort();
}

function route(){
  const h = location.hash || "#/home";
  const parts = h.replace("#/","").split("/");
  const view = parts[0] || "home";
  const id = parts[1] ? decodeURIComponent(parts[1]) : null;

  updateHeader(view);

  const hero = $("hero"), toolbar = $("toolbar"), panelSong = $("panelSong");
  if(hero) hero.style.display = (view==="home") ? "" : "none";
  if(toolbar) toolbar.style.display = (view==="track") ? "none" : "";
  if(panelSong) panelSong.classList.toggle("show", view==="track");

  if(view==="rap") setCurrentList("rap");
  else if(view==="sad") setCurrentList("sad");
  else if(view==="live") setCurrentList("live");
  else setCurrentList("all");

  if(view==="home"){ renderGrid(state.all.slice(0,18)); return; }
  if(view==="all"){ renderGrid(state.all); return; }
  if(view==="rap"){ renderGrid(state.rap); return; }
  if(view==="sad"){ renderGrid(state.sad); return; }
  if(view==="live"){
    if(state.liveVideoId){
      const liveTrack = { id: state.liveVideoId, title:"بث مباشر", publishedAt:new Date().toISOString(), thumb:`https://i.ytimg.com/vi/${state.liveVideoId}/hqdefault.jpg` };
      renderGrid([liveTrack]);
    }else{
      renderGrid([]);
    }
    return;
  }
  if(view==="track" && id){
    openTrack(id, false);
    return;
  }

  renderGrid(state.all.slice(0,18));
}

window.addEventListener("load", async ()=>{
  // اقفل بصمت قبل أي شيء
  $("drawer")?.classList.remove("open");
  $("drawerOverlay")?.classList.remove("open");

  const y = new Date().getFullYear();
  ["year","yearF","yearM"].forEach(id=>{ const el=$(id); if(el) el.textContent = y; });

  injectLinks();
  bindDrawer(); // استدعاء واحد فقط

  $("themeBtn")?.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme") || "neon";
    const next = (cur==="neon") ? "cyan" : (cur==="cyan") ? "pink" : "neon";
    document.documentElement.setAttribute("data-theme", next);
  });

  $("motionBtn")?.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-motion") || "on";
    document.documentElement.setAttribute("data-motion", cur==="off" ? "on" : "off");
  });

  document.querySelectorAll("[data-navto]").forEach(b=>{
    b.addEventListener("click", ()=>{ location.hash = b.getAttribute("data-navto"); });
  });

  $("refreshBtn")?.addEventListener("click", ()=>bootstrap());

  $("shareBtn")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(location.href);
      showStatus("تم نسخ الرابط.");
      setTimeout(()=>showStatus(""), 1200);
    }catch{}
  });

  $("searchInput")?.addEventListener("input", ()=>applySearchSort());
  $("sortSelect")?.addEventListener("change", ()=>applySearchSort());

  $("prevBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playPrev(); });
  $("nextBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playNext(); });
  $("playBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playToggle(); });

  $("mini")?.addEventListener("click", (e)=>{
    if(e.target.closest("button")) return;
    if(state.now) location.hash = `#/track/${encodeURIComponent(state.now.id)}`;
  });

  $("goHome")?.addEventListener("click", ()=>location.hash="#/home");
  window.addEventListener("hashchange", ()=>route());

  await loadYTApi();
  createPlayers();

  bootstrap();
});
```0
