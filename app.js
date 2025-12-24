const YT_API_KEY = "AIzaSyD3mvCx80XsvwrURRg2RwaD8HmOKqhYkek";
const YT_HANDLE  = "F90-Music";

// Links (ثابتة)
const LINKS = {
  youtube: "https://youtube.com/@f90-music?si=VnsVH56lT7UV8N4n",
  tiktok:  "https://www.tiktok.com/@f90.business?_r=1&_t=ZS-91tnkFox3hp",
  insta:   "https://www.instagram.com/f90_yt?igsh=MWxmM2ttYjVwZnN4bQ==",
  whatsapp: "https://wa.me/970568181910",
  email: "mailto:f90gimme@gmail.com"
};

// Helpers
const qs = (k) => new URLSearchParams(location.search).get(k);
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"});
function escapeHtml(str){
  return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
async function ytFetch(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error("YouTube API error");
  return res.json();
}

// Active nav + year + inject links
function setActiveNav(){
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll("[data-nav]").forEach(a=>{
    if((a.getAttribute("data-nav")||"").toLowerCase() === path) a.classList.add("active");
  });
}
function setYear(){
  const y = document.getElementById("year");
  if(y) y.textContent = new Date().getFullYear();
}
function injectLinks(){
  const y = document.querySelectorAll("[data-link='youtube']");
  const t = document.querySelectorAll("[data-link='tiktok']");
  const i = document.querySelectorAll("[data-link='insta']");
  const w = document.querySelectorAll("[data-link='whatsapp']");
  const e = document.querySelectorAll("[data-link='email']");
  y.forEach(a=>a.href = LINKS.youtube);
  t.forEach(a=>a.href = LINKS.tiktok);
  i.forEach(a=>a.href = LINKS.insta);
  w.forEach(a=>a.href = LINKS.whatsapp);
  e.forEach(a=>a.href = LINKS.email);
}

// Channel ID from handle
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
async function getAllUploads(uploadsPlaylistId){
  let items = [];
  let pageToken = "";
  while(true){
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=50&pageToken=${encodeURIComponent(pageToken)}&key=${YT_API_KEY}`;
    const data = await ytFetch(url);
    const chunk = (data.items || [])
      .map(it => ({
        id: it.contentDetails?.videoId,
        title: it.snippet?.title,
        publishedAt: it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt,
        thumb: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url || ""
      }))
      .filter(v => v.id && v.title && v.title !== "Private video" && v.title !== "Deleted video");
    items.push(...chunk);
    if(!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return items;
}

function renderGrid(gridEl, videos, limit=null){
  const list = limit ? videos.slice(0, limit) : videos;
  gridEl.innerHTML = list.map(v => `
    <article class="item" data-id="${v.id}">
      <img class="thumb" src="${v.thumb}" alt="">
      <div class="itemBody">
        <p class="itemTitle">${escapeHtml(v.title)}</p>
        <p class="itemMeta">${fmtDate(v.publishedAt)}</p>
      </div>
    </article>
  `).join("");

  gridEl.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      location.href = `song.html?id=${encodeURIComponent(id)}`;
    });
  });
}

// Home
async function initHome(){
  const featured = document.getElementById("featuredGrid");
  if(!featured) return;

  const status = document.getElementById("status");
  const total  = document.getElementById("totalVideos");
  const latest = document.getElementById("latestDate");

  try{
    status.textContent = "Loading…";
    const channelId = await getChannelIdFromHandle(YT_HANDLE);
    const uploadsId = await getUploadsPlaylistId(channelId);
    let videos = await getAllUploads(uploadsId);

    videos.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

    if(total) total.textContent = videos.length;
    if(latest) latest.textContent = videos[0] ? fmtDate(videos[0].publishedAt) : "-";

    renderGrid(featured, videos, 6);
    status.textContent = "";
  }catch(e){
    console.error(e);
    status.textContent = "Failed. Check API Key + referrer restriction.";
  }
}

// Songs
async function initSongs(){
  const grid = document.getElementById("grid");
  if(!grid) return;

  const status = document.getElementById("status");
  const count  = document.getElementById("count");
  const qInput = document.getElementById("q");
  const orderSel = document.getElementById("order");

  try{
    status.textContent = "Loading…";
    const channelId = await getChannelIdFromHandle(YT_HANDLE);
    const uploadsId = await getUploadsPlaylistId(channelId);
    let videos = await getAllUploads(uploadsId);

    const render = ()=>{
      const q = (qInput?.value || "").trim().toLowerCase();
      let filtered = videos.filter(v => v.title.toLowerCase().includes(q));
      const order = orderSel?.value || "date_desc";
      if(order === "date_desc") filtered.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
      if(order === "date_asc")  filtered.sort((a,b)=> new Date(a.publishedAt)-new Date(b.publishedAt));
      if(order === "title_asc") filtered.sort((a,b)=> a.title.localeCompare(b.title));
      if(count) count.textContent = `Results: ${filtered.length}`;
      renderGrid(grid, filtered);
      status.textContent = "";
    };

    qInput?.addEventListener("input", render);
    orderSel?.addEventListener("change", render);
    render();

  }catch(e){
    console.error(e);
    status.textContent = "Failed. API key/referrer mismatch.";
  }
}

// Song page
async function initSong(){
  const id = qs("id");
  const player = document.getElementById("player");
  if(!player || !id) return;

  const titleEl = document.getElementById("title");
  const metaEl  = document.getElementById("meta");
  const descEl  = document.getElementById("desc");
  const ytLink  = document.getElementById("ytLink");

  player.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  if(ytLink) ytLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

  try{
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(id)}&key=${YT_API_KEY}`;
    const data = await ytFetch(url);
    const sn = data.items?.[0]?.snippet;
    if(sn){
      document.title = `${sn.title} | F90`;
      if(titleEl) titleEl.textContent = sn.title;
      if(metaEl) metaEl.textContent = `${fmtDate(sn.publishedAt)} • ${sn.channelTitle}`;
      if(descEl) descEl.textContent = sn.description || "";
    }
  }catch(e){
    console.error(e);
    if(titleEl) titleEl.textContent = "Track";
    if(descEl) descEl.textContent = "Player works, but metadata failed to load.";
  }
}

(function boot(){
  setActiveNav();
  setYear();
  injectLinks();
  initHome();
  initSongs();
  initSong();
})();
