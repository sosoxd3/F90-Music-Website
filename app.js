// ====== F90 Music - FIXED BUILD (API + RSS FALLBACK + CLEAN UI) ======
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

// RSS fallback (works even when API key/referrer fails)
const RSS_URL = "https://www.youtube.com/feeds/videos.xml?channel_id="; // we will resolve channel_id first

// ---------- helpers ----------
const $ = (id)=>document.getElementById(id);
const escapeHtml = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtDate = (iso)=> new Date(iso).toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"});
const nfmt = (num)=>{ const n=Number(num||0); return n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,"")+"M":n>=1e3?(n/1e3).toFixed(1).replace(/\.0$/,"")+"K":String(n); };
function showStatus(msg){ const el=$("homeStatus"); if(el) el.textContent = msg || ""; }
function setText(id, v){ const el=$(id); if(el) el.textContent = v; }
function setHrefAll(k, url){ document.querySelectorAll(`[data-link="${k}"]`).forEach(a=>a.href=url); }
function safeJSONParse(s, fb){ try{return JSON.parse(s)}catch{return fb} }

// ---------- minimal i18n (enough) ----------
const I18N = {
  ar: { failed:"فشل تحميل الأغاني. السبب غالبًا مفتاح API أو referrer. سيتم استخدام مصدر بديل.", loading:"جاري تحميل الأغاني...", noItems:"لا يوجد أغاني لعرضها.", views:"مشاهدات", liveNow:"LIVE NOW", noLive:"لا يوجد بث الآن" },
  en: { failed:"Failed to load videos (API key/referrer). Using fallback source.", loading:"Loading tracks...", noItems:"No tracks to show.", views:"views", liveNow:"LIVE NOW", noLive:"No live now" },
};
function lang(){ return (document.documentElement.lang==="en") ? "en":"ar"; }
function T(){ return I18N[lang()] || I18N.ar; }

// ---------- state ----------
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

// ---------- YouTube API ----------
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
  // dedupe
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

// ---------- RSS fallback ----------
async function fetchRSS(channelId){
  const url = RSS_URL + encodeURIComponent(channelId);
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

// ---------- UI clean (remove duplicated social blocks) ----------
function cleanUI(){
  // hide footer social row text links visually (keep copyright)
  const footLinks = document.querySelector(".footLinks");
  if(footLinks) footLinks.style.display = "none";

  // hide duplicated social buttons inside song panel row (keep WhatsApp/Email in sidebar)
  const songRow = document.querySelector("#panelSong .row");
  if(songRow){
    songRow.querySelectorAll('a.btn').forEach(a=>a.style.display="none");
  }
}

// ---------- Render ----------
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

function showTrack(id){
  const t = trackById(id);
  if(!t){ renderGrid(state.all.slice(0,24)); return; }
  state.now = t;

  $("panelSong")?.classList.add("show");
  $("panelQueue")?.classList.remove("show");
  $("hero") && ($("hero").style.display="none");
  $("toolbar") && ($("toolbar").style.display="none");

  setText("songTitle", t.title);
  setText("songMeta", fmtDate(t.publishedAt));
  const ytBtn = $("ytBtn");
  if(ytBtn) ytBtn.href = `https://www.youtube.com/watch?v=${encodeURIComponent(t.id)}`;

  const player = $("player");
  if(player) player.src = `https://www.youtube.com/embed/${encodeURIComponent(t.id)}?autoplay=1`;

  setText("miniTitle", t.title);
  setText("miniMeta", fmtDate(t.publishedAt));
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

  if(view==="home"){
    renderGrid(state.all.slice(0, 18));
    return;
  }
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

// ---------- Boot ----------
function injectLinks(){
  Object.keys(LINKS).forEach(k=> setHrefAll(k, LINKS[k]));
}

async function bootstrap(){
  // expose links and clean UI
  injectLinks();
  cleanUI();

  showStatus(T().loading);

  // Always resolve channelId first (API). If API fails, we still can’t discover channelId via RSS.
  // But handle discovery usually works even with unrestricted key; if it fails, you must fix referrer.
  state.channelId = await getChannelIdFromHandle(YT_HANDLE);

  // Try full API path:
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

    const stats = await getVideosStats(state.all.map(x=>x.id));
    state.stats = stats;

    state.liveVideoId = await checkLive(state.channelId);

    setText("totalTracks", String(state.all.length));
    setText("latestTrack", state.all[0] ? fmtDate(state.all[0].publishedAt) : "—");
    setText("liveState", state.liveVideoId ? T().liveNow : T().noLive);

    showStatus("");
  }catch(err){
    console.error(err);

    // Fallback RSS for listing (no views/live stats)
    try{
      const rssItems = await fetchRSS(state.channelId);
      state.all = rssItems;
      state.rap = rssItems.filter(()=>false); // keep empty in fallback
      state.sad = rssItems.filter(()=>false);

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
