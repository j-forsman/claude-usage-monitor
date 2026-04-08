// popup.js

const dot        = document.getElementById("dot");
const refreshBtn = document.getElementById("refreshBtn");
const footer     = document.getElementById("footer");
const errorMsg   = document.getElementById("errorMsg");

const sessionPct = document.getElementById("sessionPct");
const sessionBar = document.getElementById("sessionBar");
const weeklyPct  = document.getElementById("weeklyPct");
const weeklyBar  = document.getElementById("weeklyBar");

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function applyBar(pctEl, barEl, pct, type) {
  const clamped = Math.max(0, Math.min(100, pct));
  const warn    = clamped >= 80;

  pctEl.textContent = clamped.toFixed(0) + "%";
  pctEl.className   = "row-pct " + (warn ? "warn" : type);

  barEl.style.width = clamped + "%";
  barEl.className   = "bar-fill " + (warn ? "warn" : type);
}

function render(data) {
  if (!data) {
    dot.className    = "status-dot error";
    footer.textContent = "Ingen data – klicka ↻";
    return;
  }

  if (data.error) {
    dot.className      = "status-dot error";
    footer.textContent = "Senast: " + formatTime(data.updatedAt);
    errorMsg.style.display = "block";
    errorMsg.textContent   = data.error;
    return;
  }

  errorMsg.style.display = "none";
  dot.className = "status-dot ok";

  applyBar(sessionPct, sessionBar, data.session_pct ?? 0, "session");
  applyBar(weeklyPct,  weeklyBar,  data.weekly_pct  ?? 0, "weekly");

  footer.textContent = "Uppdaterad " + formatTime(data.updatedAt);
}

// Ladda cachad data direkt
chrome.storage.local.get("usageData", ({ usageData }) => {
  render(usageData || null);
});

// Refresh-knapp
refreshBtn.addEventListener("click", () => {
  dot.className = "status-dot loading";
  refreshBtn.classList.add("spinning");
  footer.textContent = "Hämtar…";

  chrome.runtime.sendMessage({ type: "REFRESH" }, () => {
    // Läs uppdaterad data från storage
    chrome.storage.local.get("usageData", ({ usageData }) => {
      refreshBtn.classList.remove("spinning");
      render(usageData || null);
    });
  });
});

// ── Debug-sektion: visa råsvaret från API:et ─────────────────────────────
const debugToggle = document.getElementById("debugToggle");
const debugBox    = document.getElementById("debugBox");

if (debugToggle) {
  debugToggle.addEventListener("click", () => {
    chrome.storage.local.get("usageData", ({ usageData }) => {
      if (debugBox.style.display === "block") {
        debugBox.style.display = "none";
        debugToggle.textContent = "Visa rådata";
      } else {
        debugBox.textContent   = JSON.stringify(usageData?.raw ?? usageData, null, 2);
        debugBox.style.display = "block";
        debugToggle.textContent = "Dölj rådata";
      }
    });
  });
}
