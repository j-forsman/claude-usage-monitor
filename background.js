// background.js — detached window + usage fetching

const REFRESH_INTERVAL_MIN = 5;
const WIN_URL = chrome.runtime.getURL("window.html");
let windowId  = null;

// ── Toggle fönster vid klick på ikonen ───────────────────────────────────
chrome.action.onClicked.addListener(async () => {
  // Kontrollera om fönstret redan finns
  if (windowId !== null) {
    try {
      const win = await chrome.windows.get(windowId);
      if (win) {
        chrome.windows.remove(windowId);
        windowId = null;
        return;
      }
    } catch (_) {
      windowId = null;
    }
  }

  // Beräkna position: nedre högra hörnet
  const screen = await chrome.system.display.getInfo();
  const display = screen[0]?.bounds ?? { left: 0, top: 0, width: 1920, height: 1080 };
  const W = 360, H = 300;
  const left = display.left + display.width  - W - 20;
  const top  = display.top  + display.height - H - 60;

  const win = await chrome.windows.create({
    url:    WIN_URL,
    type:   "popup",
    width:  W,
    height: H,
    left,
    top,
    focused: false,   // öppna utan att ta fokus
  });
  windowId = win.id;

  // Nollställ windowId om användaren stänger fönstret manuellt
  chrome.windows.onRemoved.addListener(function onRemoved(id) {
    if (id === windowId) {
      windowId = null;
      chrome.windows.onRemoved.removeListener(onRemoved);
    }
  });
});

// ── Usage-hämtning ────────────────────────────────────────────────────────
async function fetchUsage() {
  try {
    const orgsRes = await fetch("https://claude.ai/api/organizations", {
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (!orgsRes.ok) throw new Error(`Inte inloggad (${orgsRes.status})`);

    const orgs    = await orgsRes.json();
    const orgList = Array.isArray(orgs) ? orgs : (orgs.organizations || [orgs]);
    if (!orgList.length) throw new Error("Inga organisationer hittades");
    const orgId = orgList[0].uuid || orgList[0].id;
    if (!orgId) throw new Error("Kunde inte hitta org-ID");

    const usageRes = await fetch(
      `https://claude.ai/api/organizations/${orgId}/usage`,
      { credentials: "include", headers: { "Accept": "application/json" } }
    );
    if (!usageRes.ok) throw new Error(`Usage-anrop misslyckades (${usageRes.status})`);

    const data = await usageRes.json();

    await chrome.storage.local.set({
      usageData: {
        session_pct:   data.five_hour?.utilization  ?? 0,
        weekly_pct:    data.seven_day?.utilization   ?? 0,
        session_reset: data.five_hour?.resets_at     ?? null,
        weekly_reset:  data.seven_day?.resets_at     ?? null,
        extra:         data.extra_usage              ?? null,
        raw:           data,
        updatedAt:     Date.now(),
        error:         null
      }
    });

    // Meddela fönstret om det är öppet
    chrome.runtime.sendMessage({ type: "DATA_UPDATED" }).catch(() => {});

  } catch (err) {
    await chrome.storage.local.set({
      usageData: {
        session_pct: 0, weekly_pct: 0,
        updatedAt: Date.now(),
        error: err.message
      }
    });
    chrome.runtime.sendMessage({ type: "DATA_UPDATED" }).catch(() => {});
  }
}

chrome.alarms.create("refresh", { periodInMinutes: REFRESH_INTERVAL_MIN });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refresh") fetchUsage();
});
chrome.runtime.onInstalled.addListener(fetchUsage);
chrome.runtime.onStartup.addListener(fetchUsage);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "REFRESH") {
    fetchUsage().then(() => sendResponse({ ok: true }));
    return true;
  }
});
