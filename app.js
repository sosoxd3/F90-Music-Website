// ===== F90 MUSIC - Arabic Only - FINAL app.js (Drawer FIXED + Stable Player + Prev/Play/Pause/Next) =====
const YT_API_KEY = "AIzaSyD3mvCx80XsvwrURRg2RwaD8HmOKqhYkek";
const YT_HANDLE  = "F90-Music";

const PLAYLISTS = {
  rap: "PL2FIA-SoBgYtotc48ZfKSYagxMd3AMmVp",
  sad: "PL2FIA-SoBgYvY4B-0IDWTtKriVGPb1qnx",
};
"use strict";

// روابطك
const URLS = {
  channel: "https://youtube.com/@f90-music?si=VnsVH56lT7UV8N4n",
  tiktok: "https://www.tiktok.com/@f90.business?_r=1&_t=ZS-91tnkFox3hp",
  insta:  "https://www.instagram.com/f90_yt?igsh=MWxmM2ttYjVwZnN4bQ==",
  wa:     "https://wa.me/970568181910",
  mail:   "mailto:f90gimme@gmail.com",
};

// معرفات البلايليست
const PLAYLISTS = {
  rap: "PL2FIA-SoBgYtotc48ZfKSYagxMd3AMmVp",
  sad: "PL2FIA-SoBgYvY4B-0IDWTtKriVGPb1qnx",
};

// ملاحظة: هذا هو channel_id لقناة @f90-music لازم يتجلب تلقائيًا؟
// أسهل: نعتمد على playlist RSS + فيديوهات القناة من channel RSS.
// إذا ما عرفت channel_id: بنجيب “كل الأغاني” من الـ playlists مع دمجهم.
// (هذه الطريقة تضمن ظهور أغانيك حتى لو ما قدرنا نجيب channel_id)

const $ = (id)=>document.getElementById(id);
const escapeHtml = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtDate = (iso)=> new Date(iso).toLocaleDateString("ar", {year:"numeric", month:"short", day:"numeric"});

const state = {
  all: [],
  rap: [],
  sad: [],
  now: null,
  isPlaying: false,
  currentList: [],
  currentIndex: -1,
};

function showStatus(msg){ const el=$("homeStatus"); if(el) el.textContent = msg||""; }

function bindLinks(){
  $("ytChannelBtn").href = URLS.channel;
  $("ytChannelBtn2").href = URLS.channel;
  $("tiktokBtn").href = URLS.tiktok;
  $("tiktokBtn2").href = URLS.tiktok;
  $("instaBtn").href = URLS.insta;
  $("instaBtn2").href = URLS.insta;
  $("waBtn").href = URLS.wa;
  $("mailBtn").href = URLS.mail;
}

function bindDrawer(){
  const drawerBtn = $("drawerBtn");
  const drawer = $("drawer");
  const overlay = $("drawerOverlay");
  const closeBtn = $("closeDrawer");
  if(!drawerBtn || !drawer || !overlay || !closeBtn) return;

  const open = ()=>{ drawer.classList.add("open"); overlay.classList.add("open"); document.body.style.overflow="hidden"; };
  const close= ()=>{ drawer.classList.remove("open"); overlay.classList.remove("open"); document.body.style.overflow=""; };

  close();

  drawerBtn.addEventListener("click",(e)=>{e.preventDefault();e.stopPropagation();open();});
  closeBtn.addEventListener("click",(e)=>{e.preventDefault();e.stopPropagation();close();});
  overlay.addEventListener("pointerdown",(e)=>{e.preventDefault();e.stopPropagation();close();}, true);
  drawer.addEventListener("click",(e)=>{ if(e.target.closest("a")) close(); }, true);
  window.addEventListener("hashchange", close);
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") close(); });
}

async function fetchPlaylistRSS(playlistId){
  const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error("RSS error");
  const xml = await r.text();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const entries = Array.from(doc.getElementsByTagName("entry"));
  return entries.map(e=>{
    const id = e.getElementsByTagName("yt:videoId")[0]?.textContent?.trim();
    const title = e.getElementsByTagName("title")[0]?.textContent?.trim() || "";
    const publishedAt = e.getElementsByTagName("published")[0]?.textContent?.trim() || "";
    const thumb = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
    return { id, title, publishedAt, thumb };
  }).filter(x=>x.id && x.title && x.title!=="Private video" && x.title!=="Deleted video");
}

function uniqById(list){
  const m = new Map();
  list.forEach(x=>{ if(x?.id && !m.has(x.id)) m.set(x.id, x); });
  return Array.from(m.values());
}

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

function setHeader(view){
  const map = {
    home: ["الرئيسية","آخر الإصدارات"],
    all:  ["كل الأغاني","دمج القوائم"],
    rap:  ["الراب","قائمة الراب"],
    sad:  ["رومنسي/حزين/طربي","القائمة الثانية"],
    track:["الأغنية","تشغيل"]
  };
  const t = map[view] || ["F90 Music","—"];
  $("viewTitle").textContent = t[0];
  $("viewSubtitle").textContent = t[1];
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

function openTrack(id, autoplay){
  const t = state.all.find(x=>x.id===id) || state.rap.find(x=>x.id===id) || state.sad.find(x=>x.id===id);
  if(!t) return;

  state.now = t;

  $("songTitle").textContent = t.title;
  $("songMeta").textContent = fmtDate(t.publishedAt);
  $("miniTitle").textContent = t.title;
  $("miniMeta").textContent = fmtDate(t.publishedAt);

  $("ytBtn").href = `https://www.youtube.com/watch?v=${encodeURIComponent(t.id)}`;

  // iframe player
  const frame = $("playerFrame");
  frame.src = `https://www.youtube.com/embed/${encodeURIComponent(t.id)}?autoplay=${autoplay?1:0}&playsinline=1&rel=0`;

  // show panel
  $("panelSong").classList.add("show");
}

function route(){
  const h = location.hash || "#/home";
  const parts = h.replace("#/","").split("/");
  const view = parts[0] || "home";
  const id = parts[1] ? decodeURIComponent(parts[1]) : null;

  setHeader(view);

  const hero = $("hero");
  const panel = $("panelSong");
  const toolbar = $("toolbar");

  if(hero) hero.style.display = (view==="home") ? "" : "none";
  if(toolbar) toolbar.style.display = (view==="track") ? "none" : "";
  if(panel) panel.classList.toggle("show", view==="track");

  if(view==="rap") state.currentList = state.rap.slice();
  else if(view==="sad") state.currentList = state.sad.slice();
  else state.currentList = state.all.slice();

  if(view==="home"){ renderGrid(state.all.slice(0,18)); return; }
  if(view==="all"){ renderGrid(state.all); return; }
  if(view==="rap"){ renderGrid(state.rap); return; }
  if(view==="sad"){ renderGrid(state.sad); return; }
  if(view==="track" && id){ openTrack(id, false); return; }

  renderGrid(state.all.slice(0,18));
}

function bindPlayerBar(){
  const playBtn = $("playBtn");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  const setPlayIcon = (playing)=>{ playBtn.textContent = playing ? "⏸" : "▶"; };

  const play = ()=>{
    if(!state.now && state.all[0]) openTrack(state.all[0].id, true);
    else if(state.now) openTrack(state.now.id, true);
    state.isPlaying = true;
    setPlayIcon(true);
  };

  const pause = ()=>{
    // لا يوجد pause حقيقي للـ iframe بدون API، فنعملها “stop” بسيط
    const frame = $("playerFrame");
    frame.src = frame.src.replace("autoplay=1","autoplay=0");
    state.isPlaying = false;
    setPlayIcon(false);
  };

  const goIndex = (idx)=>{
    const list = state.currentList.length ? state.currentList : state.all;
    if(!list.length) return;
    state.currentIndex = (idx + list.length) % list.length;
    openTrack(list[state.currentIndex].id, true);
    state.isPlaying = true;
    setPlayIcon(true);
  };

  playBtn.addEventListener("click",(e)=>{
    e.stopPropagation();
    if(state.isPlaying) pause(); else play();
  });

  prevBtn.addEventListener("click",(e)=>{
    e.stopPropagation();
    const list = state.currentList.length ? state.currentList : state.all;
    if(!state.now){
      if(list[0]) { state.currentIndex=0; openTrack(list[0].id,true); setPlayIcon(true); state.isPlaying=true; }
      return;
    }
    const i = list.findIndex(x=>x.id===state.now.id);
    goIndex(i-1);
  });

  nextBtn.addEventListener("click",(e)=>{
    e.stopPropagation();
    const list = state.currentList.length ? state.currentList : state.all;
    if(!state.now){
      if(list[0]) { state.currentIndex=0; openTrack(list[0].id,true); setPlayIcon(true); state.isPlaying=true; }
      return;
    }
    const i = list.findIndex(x=>x.id===state.now.id);
    goIndex(i+1);
  });

  $("mini").addEventListener("click",(e)=>{
    if(e.target.closest("button")) return;
    if(state.now) location.hash = `#/track/${encodeURIComponent(state.now.id)}`;
  });

  setPlayIcon(false);
}

async function bootstrap(){
  showStatus("جاري تحميل الأغاني...");

  try{
    const [rap, sad] = await Promise.all([
      fetchPlaylistRSS(PLAYLISTS.rap),
      fetchPlaylistRSS(PLAYLISTS.sad),
    ]);

    state.rap = rap.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
    state.sad = sad.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

    state.all = uniqById([...state.rap, ...state.sad]).sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));

    $("totalTracks").textContent = String(state.all.length);
    $("latestTrack").textContent = state.all[0] ? fmtDate(state.all[0].publishedAt) : "—";
    $("statsMini").textContent = `${state.all.length} أغنية`;

    showStatus("");
  }catch(err){
    console.error(err);
    showStatus("فشل تحميل الأغاني. تأكد من رفع الملفات الصحيحة.");
  }

  if(!location.hash) location.hash = "#/home";
  route();
  applySearchSort();
}

window.addEventListener("load", ()=>{
  // روابط
  bindLinks();

  // درج
  bindDrawer();

  // بحث/فرز
  $("searchInput").addEventListener("input", applySearchSort);
  $("sortSelect").addEventListener("change", applySearchSort);

  // راوت
  window.addEventListener("hashchange", route);
  $("goHome").addEventListener("click", ()=>location.hash="#/home");

  // لاعب سفلي
  bindPlayerBar();

  // بدء
  bootstrap();
});
