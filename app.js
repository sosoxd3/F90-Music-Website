// =======================
// إعداداتك (لازم)
// =======================
// ضع API KEY الجديد هنا (المفتاح القديم الذي نشرته سابقاً يجب أن يكون محذوفاً)
const YT_API_KEY = "AIzaSyD3mvCx80XsvwrURRg2RwaD8HmOKqhYkek";

// handle القناة من الرابط: https://youtube.com/@F90-Music
const YT_HANDLE = "F90-Music";

// =======================
// ترجمة (AR/EN) بسيطة
// =======================
const I18N = {
  ar: {
    dir: "rtl", lang: "ar",
    siteTitleAr: "اف تسعين للإنتاج الفني",
    siteTitleEn: "F90 For Artistic Production",
    heroH1: "كل أغاني القناة — تحديث تلقائي",
    heroP: "أي فيديو جديد بتنزله على قناتك رح يظهر تلقائيًا هون. اضغط على أي أغنية لفتح صفحتها وتشغيلها.",
    songsTitle: "الأغاني",
    searchPh: "ابحث باسم الأغنية...",
    sortNew: "الأحدث أولاً",
    sortOld: "الأقدم أولاً",
    sortAZ: "العنوان A-Z",
    contactTitle: "تواصل",
    contactP: "ضع روابطك هنا (Instagram / TikTok / Email). عدّلها بسهولة لاحقًا.",
    backBtn: "رجوع",
    descTitle: "وصف",
    loading: "جاري تحميل أغاني القناة من يوتيوب...",
    fail: "فشل التحميل. غالبًا API KEY غير صحيح أو غير مُقيّد صح."
  },
  en: {
    dir: "ltr", lang: "en",
    siteTitleAr: "F90 Artistic Production",
    siteTitleEn: "F90 For Artistic Production",
    heroH1: "All Songs — Auto Updated",
    heroP: "Any new video you publish will appear here automatically. Click any song to open its page and play it.",
    songsTitle: "Songs",
    searchPh: "Search by title...",
    sortNew: "Newest first",
    sortOld: "Oldest first",
    sortAZ: "Title A-Z",
    contactTitle: "Contact",
    contactP: "Put your links here (Instagram / TikTok / Email). Edit anytime.",
    backBtn: "Back",
    descTitle: "Description",
    loading: "Loading channel videos from YouTube...",
    fail: "Load failed. API key might be missing/invalid or not restricted correctly."
  }
};

let CURRENT_LANG = "ar";

function applyLang(code){
  const d = I18N[code] || I18N.ar;
  document.documentElement.dir = d.dir;
  document.documentElement.lang = d.lang;

  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key = el.getAttribute("data-i18n");
    if(d[key]) el.textContent = d[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    const key = el.getAttribute("data-i18n-placeholder");
    if(d[key]) el.setAttribute("placeholder", d[key]);
  });

  CURRENT_LANG = code;
  try { localStorage.setItem("f90_lang", code); } catch {}
}

function initLangToggle(){
  const btn = document.getElementById("langBtn");
  if(!btn) return;
  btn.addEventListener("click", ()=>{
    applyLang(CURRENT_LANG === "ar" ? "en" : "ar");
  });
}

// =======================
// أدوات
// =======================
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"});

const qs = (k) => new URLSearchParams(location.search).get(k);

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function ytFetch(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error("YouTube API error");
  return res.json();
}

// =======================
// 1) Channel ID من handle
// =======================
async function getChannelIdFromHandle(handle){
  // ملاحظة: هذا يعتمد على البحث بالـ handle وقد يفشل لو في تشابه أسماء بشكل قوي.
  const q = `@${handle}`;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`;
  const data = await ytFetch(url);
  if(!data.items?.length) throw new Error("Channel not found by handle");
  return data.items[0].snippet.channelId;
}

// =======================
// 2) Uploads playlist ID
// =======================
async function getUploadsPlaylistId(channelId){
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${YT_API_KEY}`;
  const data = await ytFetch(url);
  const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if(!uploads) throw new Error("Uploads playlist not found");
  return uploads;
}

// =======================
// 3) كل فيديوهات uploads
// =======================
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

// =======================
// الصفحة الرئيسية
// =======================
async function initIndex(){
  const year = document.getElementById("year");
  if(year) year.textContent = new Date().getFullYear();

  const grid = document.getElementById("grid");
  if(!grid) return;

  const status = document.getElementById("status");
  const count = document.getElementById("count");
  const qInput = document.getElementById("q");
  const orderSel = document.getElementById("order");

  const d = I18N[CURRENT_LANG] || I18N.ar;

  try{
    status.textContent = d.loading;

    const channelId = await getChannelIdFromHandle(YT_HANDLE);
    const uploadsId = await getUploadsPlaylistId(channelId);
    let videos = await getAllUploads(uploadsId);

    const render = () => {
      const q = (qInput?.value || "").trim().toLowerCase();

      let filtered = videos.filter(v => v.title.toLowerCase().includes(q));

      const order = orderSel?.value || "date_desc";
      if(order === "date_desc") filtered.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
      if(order === "date_asc") filtered.sort((a,b)=> new Date(a.publishedAt)-new Date(b.publishedAt));
      if(order === "title_asc") filtered.sort((a,b)=> a.title.localeCompare(b.title));

      if(count) count.textContent = `${filtered.length} فيديو`;

      grid.innerHTML = filtered.map(v => `
        <article class="item" data-id="${v.id}">
          <img class="thumb" src="${v.thumb}" alt="">
          <div class="itemBody">
            <p class="itemTitle">${escapeHtml(v.title)}</p>
            <p class="itemMeta">${fmtDate(v.publishedAt)}</p>
          </div>
        </article>
      `).join("");

      grid.querySelectorAll(".item").forEach(el=>{
        el.addEventListener("click", ()=>{
          const id = el.getAttribute("data-id");
          location.href = `song.html?id=${encodeURIComponent(id)}`;
        });
      });

      status.textContent = "";
    };

    qInput?.addEventListener("input", render);
    orderSel?.addEventListener("change", render);
    render();

  }catch(e){
    console.error(e);
    status.textContent = (I18N[CURRENT_LANG] || I18N.ar).fail;
  }
}

// =======================
// صفحة الأغنية
// =======================
async function initSong(){
  const year = document.getElementById("year");
  if(year) year.textContent = new Date().getFullYear();

  const id = qs("id");
  const player = document.getElementById("player");
  if(!player || !id) return;

  const titleEl = document.getElementById("title");
  const metaEl = document.getElementById("meta");
  const descEl = document.getElementById("desc");
  const ytLink = document.getElementById("ytLink");

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
    if(titleEl) titleEl.textContent = "الأغنية";
    if(metaEl) metaEl.textContent = "";
    if(descEl) descEl.textContent = "التشغيل شغال، لكن تعذر تحميل تفاصيل الفيديو من API.";
  }
}

// =======================
// تشغيل
// =======================
(function boot(){
  try {
    const saved = localStorage.getItem("f90_lang");
    if(saved === "en" || saved === "ar") CURRENT_LANG = saved;
  } catch {}

  applyLang(CURRENT_LANG);
  initLangToggle();
  initIndex();
  initSong();
})();
