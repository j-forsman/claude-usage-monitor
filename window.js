// window.js – logik för det fristående fönstret

const dot          = document.getElementById("dot");
const refreshBtn   = document.getElementById("refreshBtn");
const closeBtn     = document.getElementById("closeBtn");
const footer       = document.getElementById("footer");
const errorMsg     = document.getElementById("errorMsg");
const sessionPct   = document.getElementById("sessionPct");
const sessionBar   = document.getElementById("sessionBar");
const sessionReset = document.getElementById("sessionReset");
const weeklyPct    = document.getElementById("weeklyPct");
const weeklyBar    = document.getElementById("weeklyBar");
const weeklyReset  = document.getElementById("weeklyReset");
const extraChip    = document.getElementById("extraChip");

closeBtn.addEventListener("click", () => window.close());

function timeUntil(iso) {
  if (!iso) return "";
  const diff = new Date(iso) - Date.now();
  if (diff <= 0) return "återställer snart";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `återställer om ${Math.floor(h/24)}d ${h%24}h`;
  return h > 0 ? `återställer om ${h}h ${m}m` : `återställer om ${m}m`;
}

function fmt(ts) {
  return ts
    ? new Date(ts).toLocaleTimeString("sv-SE", { hour:"2-digit", minute:"2-digit", second:"2-digit" })
    : "";
}

function applyBar(pctEl, barEl, pct, type) {
  const v = Math.max(0, Math.min(100, pct ?? 0));
  pctEl.textContent = v + "%";
  pctEl.className   = "row-pct " + (v >= 80 ? "warn" : type);
  barEl.style.width = v + "%";
  barEl.className   = "bar-fill "  + (v >= 80 ? "warn" : type);
}

async function autoResize() {
  const titleBarH = window.outerHeight - window.innerHeight;
  const contentH  = document.documentElement.scrollHeight;
  const win = await chrome.windows.getCurrent();
  await chrome.windows.update(win.id, { height: contentH + titleBarH });
}

function render(data) {
  if (!data) { dot.className = "status-dot error"; footer.textContent = "Ingen data"; autoResize(); return; }

  if (data.error) {
    dot.className = "status-dot error";
    errorMsg.style.display = "block";
    errorMsg.textContent   = data.error;
    footer.textContent     = "Senast: " + fmt(data.updatedAt);
    autoResize();
    return;
  }

  errorMsg.style.display = "none";
  dot.className = "status-dot ok";

  applyBar(sessionPct, sessionBar, data.session_pct, "session");
  applyBar(weeklyPct,  weeklyBar,  data.weekly_pct,  "weekly");

  sessionReset.textContent = timeUntil(data.session_reset);
  weeklyReset.textContent  = timeUntil(data.weekly_reset);

  const ex = data.extra;
  if (ex?.is_enabled) {
    extraChip.className   = "extra-chip visible";
    extraChip.textContent =
      `Extra usage: ${ex.used_credits ?? 0} / ${ex.monthly_limit ?? 0} credits (${ex.utilization ?? 0}%)`;
  } else {
    extraChip.className = "extra-chip";
  }

  footer.textContent = "Uppdaterad " + fmt(data.updatedAt);
  autoResize();
}

// Initial render från cache
chrome.storage.local.get("usageData", ({ usageData }) => render(usageData ?? null));

// Lyssna på uppdateringar från background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "DATA_UPDATED") {
    chrome.storage.local.get("usageData", ({ usageData }) => render(usageData ?? null));
  }
});

// Manuell refresh
refreshBtn.addEventListener("click", () => {
  dot.className = "status-dot loading";
  refreshBtn.classList.add("spinning");
  footer.textContent = "Hämtar…";
  chrome.runtime.sendMessage({ type: "REFRESH" }, () => {
    refreshBtn.classList.remove("spinning");
    chrome.storage.local.get("usageData", ({ usageData }) => render(usageData ?? null));
  });
});

// Uppdatera "återställer om X" varje minut utan ny fetch
setInterval(() => {
  chrome.storage.local.get("usageData", ({ usageData }) => {
    if (!usageData?.error) {
      sessionReset.textContent = timeUntil(usageData?.session_reset);
      weeklyReset.textContent  = timeUntil(usageData?.weekly_reset);
    }
  });
}, 60000);
