// ====== F90 Music - FINAL (Drawer fix + Simple mini player + API + RSS fallback) ======
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
const escapeHtml = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtDate = (iso)=> new Date(iso).toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"});
const nfmt = (num)=>{ const n=Number(num||0); return n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,"")+"M":n>=1e3?(n/1e3).toFixed(1).replace(/\.0$/,"")+"K":String(n); };

const state = {
  channelId:null,
  uploadsId:null,
  liveVideoId:null,
  all:[],
  rap:[],
  sad:[],
  stats:new Map(),
  now:null,
};

const I18N = {
  ar: { loading:"جاري تحميل الأغاني...", failed:"فشل تحميل الأغاني (API/Referrer). سيتم استخدام مصدر بديل.", noItems:"لا يوجد أغاني لعرضها.", views:"مشاهدات", liveNow:"LIVE NOW", noLive:"لا يوجد بث الآن" },
  en: { loading:"Loading tracks...", failed:"Failed to load (API/Referrer). Using fallback.", noItems:"No tracks to show.", views:"views", liveNow:"LIVE NOW", noLive:"No live now" },
};
function lang(){ return (document.documentElement.lang==="en") ? "en":"ar"; }
function T(){ return I18N[lang()] || I18N.ar; }
function showStatus(msg){ const el=$("homeStatus"); if(el) el.textContent = msg || ""; }
function setText(id, v){ const el=$(id); if(el) el.textContent = v; }
function setHrefAll(k, url){ document.querySelectorAll(`[data-link="${k}"]`).forEach(a=>a.href=url); }

// -------- YouTube API --------
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
      channelTitle: it.snippet?.channelTitle || "",
    })).filter(v=>v.id && v.title && v.title!=="Private video" && v.title!=="Deleted video");
    items.push(...chunk);
    if(!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  const m=new Map(); items.forEach(v=>{ if(!m.has(v.id)) m.set(v.id,v); });
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

// -------- RSS fallback --------
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
    return { id:vid, title, publishedAt:published, thumb, channelTitle:"F90 Music" };
  }).filter(x=>x.id);
}

// -------- Clean UI --------
function cleanUI(){
  // hide repeated footer links if exist
  const footLinks = document.querySelector(".footLinks");
  if(footLinks) footLinks.style.display = "none";
}

// -------- Render --------
function renderGrid(list){
  const grid = $("grid");
  if(!grid) return;

  if(!list.length){
    grid.innerHTML = `<div class="card pad" style="margin:18px"><div class="cardTitle">${escapeHtml(T().noItems)}</div></div>`;
    return;
  }

  grid.innerHTML = list.map(t=>{
    const views = state.stats.get(t.id)?.views ?? 0;
    return `
      <article class="item" data-id="${escapeHtml(t.id)}">
        <img class="thumb" src="${escapeHtml(t.thumb)}" alt="">
        <div class="itemBody">
          <p class="itemTitle">${escapeHtml(t.title)}</p>
          <p class="itemMeta">${escapeHtml(fmtDate(t.publishedAt))} • ${escapeHtml(nfmt(views))} ${escapeHtml(T().views)}</p>
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

function trackById(id){
  return state.all.find(x=>x.id===id) || state.rap.find(x=>x.id===id) || state.sad.find(x=>x.id===id) || null;
}

// -------- rating/comments (local device) --------
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
  $("stars")?.querySelectorAll(".star").forEach((s, i)=>{
    s.classList.toggle("active", (i+1) <= (st.rating||0));
  });
}
function renderCommentsFor(id){
  const st = loadTrackState(id);
  const list = st.comments || [];
  const wrap = $("commentsList");
  if(!wrap) return;

  if(!list.length){
    wrap.innerHTML = `<div class="small">${escapeHtml("لا يوجد تعليقات بعد • محفوظ على جهازك")}</div>`;
    return;
  }
  wrap.innerHTML = list.map(c=>`
    <div class="listItem">
      <div>
        <div class="small">${escapeHtml(c.time||"")}</div>
        <div>${escapeHtml(c.text||"")}</div>
      </div>
      <button class="btn pill" data-del="${escapeHtml(c.id)}">Del</button>
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
function cryptoId(){
  try{ return crypto.randomUUID(); }catch{ return String(Date.now()) + Math.random().toString(16).slice(2); }
}

// -------- Track View --------
function showTrack(id){
  const t = trackById(id);
  if(!t){ renderGrid(state.all.slice(0,24)); return; }
  state.now = t;

  $("panelSong")?.classList.add("show");
  $("toolbar") && ($("toolbar").style.display="none");
  $("hero") && ($("hero").style.display="none");

  setText("songTitle", t.title);
  setText("songMeta", fmtDate(t.publishedAt));

  const ytBtn = $("ytBtn");
  if(ytBtn) ytBtn.href = `https://www.youtube.com/watch?v=${encodeURIComponent(t.id)}`;

  const player = $("player");
  if(player) player.src = `https://www.youtube.com/embed/${encodeURIComponent(t.id)}?autoplay=1`;

  setText("miniTitle", t.title);
  setText("miniMeta", fmtDate(t.publishedAt));

  renderStarsFor(t.id);
  renderCommentsFor(t.id);
}

function route(){
  const h = location.hash || "#/home";
  const [path] = h.split("?");
  const parts = path.replace("#/","").split("/");
  const view = parts[0] || "home";
  const id = parts[1] ? decodeURIComponent(parts[1]) : null;

  $("panelSong")?.classList.remove("show");
  $("toolbar") && ($("toolbar").style.display="");
  $("hero") && ($("hero").style.display= (view==="home") ? "" : "none");

  if(view==="home"){ renderGrid(state.all.slice(0, 18)); return; }
  if(view==="all"){ renderGrid(state.all); return; }
  if(view==="rap"){ renderGrid(state.rap); return; }
  if(view==="sad"){ renderGrid(state.sad); return; }
  if(view==="live"){
    if(state.liveVideoId) showTrack(state.liveVideoId);
    else renderGrid([]);
    return;
  }
  if(view==="track" && id){ showTrack(id); return; }

  renderGrid(state.all.slice(0, 18));
}

// -------- Sorting / searching (simple) --------
function applySearchSort(){
  const q = ($("searchInput")?.value || "").trim().toLowerCase();
  const sort = $("sortSelect")?.value || "date_desc";
  let list = state.all.slice();

  if(q) list = list.filter(x=>x.title.toLowerCase().includes(q));

  if(sort === "date_desc") list.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  if(sort === "date_asc")  list.sort((a,b)=> new Date(a.publishedAt)-new Date(b.publishedAt));
  if(sort === "title_asc") list.sort((a,b)=> a.title.localeCompare(b.title));
  if(sort === "views_desc") list.sort((a,b)=> (state.stats.get(b.id)?.views||0) - (state.stats.get(a.id)?.views||0));

  renderGrid(list);
}

// -------- Drawer Fix (RTL + close on click) --------
function bindDrawer(){
  const drawerBtn = $("drawerBtn");
  const drawer = $("drawer");
  const overlay = $("drawerOverlay");
  const closeBtn = $("closeDrawer");

  function openDrawer(){
    drawer?.classList.add("open");
    overlay?.classList.add("open");
  }
  function closeDrawer(){
    drawer?.classList.remove("open");
    overlay?.classList.remove("open");
  }

  drawerBtn?.addEventListener("click", openDrawer);
  closeBtn?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  // close when clicking any link inside drawer
  drawer?.addEventListener("click", (e)=>{
    if(e.target.closest("a")) closeDrawer();
  });
}

// -------- Mini Player Simple (Prev/Next from list) --------
function playNext(){
  if(!state.all.length) return;
  if(!state.now){ location.hash="#/track/"+encodeURIComponent(state.all[0].id); return; }
  const idx = state.all.findIndex(x=>x.id===state.now.id);
  const next = state.all[(idx+1) % state.all.length];
  if(next) location.hash="#/track/"+encodeURIComponent(next.id);
}
function playPrev(){
  if(!state.all.length) return;
  if(!state.now){ location.hash="#/track/"+encodeURIComponent(state.all[0].id); return; }
  const idx = state.all.findIndex(x=>x.id===state.now.id);
  const prev = state.all[(idx-1+state.all.length) % state.all.length];
  if(prev) location.hash="#/track/"+encodeURIComponent(prev.id);
}

// -------- Boot --------
function injectLinks(){
  Object.keys(LINKS).forEach(k=> setHrefAll(k, LINKS[k]));
}

async function bootstrap(){
  cleanUI();
  showStatus(T().loading);

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
    setText("liveState", state.liveVideoId ? T().liveNow : T().noLive);

    showStatus("");
  }catch(err){
    console.error(err);
    try{
      const rssItems = await fetchRSS(state.channelId);
      state.all = rssItems;
      state.rap = [];
      state.sad = [];
      state.stats = new Map();

      setText("totalTracks", String(state.all.length));
      setText("latestTrack", state.all[0] ? fmtDate(state.all[0].publishedAt) : "—");
      setText("liveState", T().noLive);

      showStatus(T().failed);
    }catch(e2){
      console.error(e2);
      showStatus(T().failed);
    }
  }

  if(!location.hash) location.hash="#/home";
  route();
}

window.addEventListener("hashchange", ()=>{
  route();
});

window.addEventListener("load", ()=>{
  // years
  const y = new Date().getFullYear();
  ["year","yearF","yearM"].forEach(id=>{ const el=$(id); if(el) el.textContent = y; });

  injectLinks();
  bindDrawer();

  // nav buttons
  document.querySelectorAll("[data-navto]").forEach(b=>{
    b.addEventListener("click", ()=>{ location.hash = b.getAttribute("data-navto"); });
  });

  // Refresh & Share
  $("refreshBtn")?.addEventListener("click", ()=>bootstrap());
  $("shareBtn")?.addEventListener("click", async ()=>{
    const url = location.href;
    try{
      if(navigator.share) await navigator.share({ title:"F90 Music", url });
      else { await navigator.clipboard.writeText(url); alert("Copied"); }
    }catch{}
  });

  // Search/Sort
  $("searchInput")?.addEventListener("input", ()=>applySearchSort());
  $("sortSelect")?.addEventListener("change", ()=>applySearchSort());

  // Mini player simple
  $("prevBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playPrev(); });
  $("nextBtn")?.addEventListener("click", (e)=>{ e.stopPropagation(); playNext(); });
  $("playBtn")?.addEventListener("click", (e)=>{
    e.stopPropagation();
    if(state.now) location.hash = `#/track/${encodeURIComponent(state.now.id)}`;
    else location.hash = "#/home";
  });

  $("mini")?.addEventListener("click", (e)=>{
    if(e.target.closest("button")) return;
    if(state.now) location.hash = `#/track/${encodeURIComponent(state.now.id)}`;
  });

  // Rating
  $("stars")?.querySelectorAll(".star").forEach((s, idx)=>{
    s.addEventListener("click", ()=>{
      if(!state.now) return;
      const id = state.now.id;
      const st = loadTrackState(id);
      st.rating = idx + 1;
      saveTrackState(id, st);
      renderStarsFor(id);
    });
  });

  // Comments
  $("addCommentBtn")?.addEventListener("click", ()=>{
    if(!state.now) return;
    const id = state.now.id;
    const txt = ($("commentInput")?.value || "").trim();
    if(!txt) return;
    const st = loadTrackState(id);
    st.comments = st.comments || [];
    st.comments.unshift({ id: cryptoId(), text: txt, time: new Date().toLocaleString() });
    saveTrackState(id, st);
    $("commentInput").value = "";
    renderCommentsFor(id);
  });

  // Theme/Motion/Lang (simple)
  $("themeBtn")?.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme") || "neon";
    const next = (cur==="neon") ? "cyan" : (cur==="cyan") ? "pink" : "neon";
    document.documentElement.setAttribute("data-theme", next);
  });
  $("motionBtn")?.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-motion") || "on";
    document.documentElement.setAttribute("data-motion", cur==="off" ? "on" : "off");
  });
  $("langBtn")?.addEventListener("click", ()=>{
    const html = document.documentElement;
    const isEN = html.lang === "en";
    html.lang = isEN ? "ar" : "en";
    html.dir  = isEN ? "rtl" : "ltr";
    // re-route to update text direction safely
    route();
  });

  // go home
  $("goHome")?.addEventListener("click", ()=>location.hash="#/home");

  bootstrap();
});
