const state = {
  tab: "home",
  weight: 20,
  region: "מרכז",
  favorites: [],
  foods: [],
  journal: [],
  config: { pushConfigured: false, vapidPublicKey: null, regions: [] },
  notifOn: false,
  profile: null,
};

const $content = document.getElementById("content");
const $nav = document.getElementById("bottom-nav");

const TABS = [
  { key: "home", label: "בית", icon: "🏠" },
  { key: "journal", label: "יומן", icon: "📖" },
  { key: "food", label: "אוכל", icon: "🛍️" },
  { key: "profile", label: "פרופיל", icon: "👤" },
];

const JOURNAL_TYPES = {
  vaccine: { label: "חיסון", icon: "💉" },
  walk: { label: "טיול", icon: "🐾" },
  vet: { label: "וטרינר", icon: "🩺" },
  weight: { label: "משקל", icon: "⚖️" },
};

function getDeviceId() {
  let id = localStorage.getItem("dogHaavDeviceId");
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));
    localStorage.setItem("dogHaavDeviceId", id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", "X-Device-Id": DEVICE_ID },
    ...opts,
  });
  return res.json();
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/service-worker.js");
}

async function enablePush() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("הדפדפן הזה לא תומך בהתראות. נסה לפתוח את האפליקציה בכרום או בספארי.");
    return;
  }
  if (!state.config.pushConfigured) {
    alert("השרת עדיין לא הוגדר לשליחת התראות (חסרים VAPID keys).");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    state.notifOn = false;
    render();
    return;
  }
  const reg = await registerServiceWorker();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(state.config.vapidPublicKey),
  });
  await api("/api/subscribe", { method: "POST", body: JSON.stringify(sub) });
  state.notifOn = true;
  render();
}

async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api("/api/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
  }
  state.notifOn = false;
  render();
}

function renderOnboarding() {
  $nav.innerHTML = "";
  $content.innerHTML = `
    <div style="padding-top:30px;">
      <div class="eyebrow">ברוכים הבאים</div>
      <div class="title">בואו נכיר את הכלב שלכם</div>
      <div class="card">
        <div style="font-size:11px;color:var(--ink-soft);margin-bottom:4px;">שם הכלב</div>
        <input type="text" id="ob-name" placeholder="לדוגמה: מקס" />
        <div style="font-size:11px;color:var(--ink-soft);margin-bottom:4px;">גזע (אופציונלי)</div>
        <input type="text" id="ob-breed" placeholder="לדוגמה: לברדור" />
        <div style="font-size:11px;color:var(--ink-soft);margin-bottom:4px;">גיל (אופציונלי)</div>
        <input type="text" id="ob-age" placeholder="לדוגמה: 3, או גור" />
        <button class="btn-primary" id="ob-save">שמור והמשך</button>
        <div id="ob-error" class="note-warn"></div>
      </div>
    </div>
  `;
  document.getElementById("ob-save").addEventListener("click", async () => {
    const name = document.getElementById("ob-name").value;
    const breed = document.getElementById("ob-breed").value;
    const age = document.getElementById("ob-age").value;
    const $err = document.getElementById("ob-error");
    if (!name.trim()) {
      $err.textContent = "צריך להזין שם לכלב.";
      return;
    }
    $err.textContent = "";
    const profile = await api("/api/profile", { method: "POST", body: JSON.stringify({ name, breed, age }) });
    state.profile = profile;
    render();
  });
}

function renderNav() {
  $nav.innerHTML = TABS.map(
    (t) => `
    <button class="nav-btn ${state.tab === t.key ? "active" : ""}" data-tab="${t.key}">
      <span class="nav-icon">${t.icon}</span>
      <span>${t.label}</span>
    </button>`
  ).join("");
  $nav.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab;
      render();
    });
  });
}

function dogInitial() {
  return state.profile && state.profile.name ? state.profile.name[0] : "🐶";
}

function dogSubtitle() {
  if (!state.profile) return "";
  const parts = [state.profile.breed, state.profile.age ? "בן " + state.profile.age : ""].filter(Boolean);
  return parts.join(" · ");
}

function renderHome() {
  const name = state.profile ? state.profile.name : "";
  $content.innerHTML = `
    <div class="eyebrow">בוקר טוב</div>
    <div class="title">מה שלום ${name} היום?</div>
    <div class="card">
      <div style="font-weight:700;">${name}${dogSubtitle() ? " · " + dogSubtitle() : ""}</div>
      <div style="font-size:12px;color:var(--ink-soft);">בדוק ביומן מתי החיסון הבא</div>
    </div>
    <div class="eyebrow" style="margin-top:14px;">הכל במקום אחד</div>
    <div class="action-row" data-go="journal">
      <div class="action-icon" style="background:var(--primary-soft);">📖</div>
      <div><div class="action-label">יומן הכלב</div><div class="action-desc">חיסונים, טיולים ותזכורות</div></div>
    </div>
    <div class="action-row" data-go="food">
      <div class="action-icon" style="background:var(--gold);">🛍️</div>
      <div><div class="action-label">השוואת אוכל</div><div class="action-desc">מחיר אמיתי לק"ג + משלוחים</div></div>
    </div>
  `;
  $content.querySelectorAll("[data-go]").forEach((el) =>
    el.addEventListener("click", () => {
      state.tab = el.dataset.go;
      render();
    })
  );
}

async function renderJournal() {
  const data = await api("/api/journal");
  state.journal = data;

  $content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
      <div><div class="eyebrow">יומן</div><div class="title">הכל על ${state.profile ? state.profile.name : ""}</div></div>
      <button class="nav-btn" id="toggle-form" style="background:var(--primary);color:#fff;border-radius:10px;width:34px;height:34px;">+</button>
    </div>
    <div id="journal-form" style="display:none;"></div>
    <div id="journal-list"></div>
  `;

  document.getElementById("toggle-form").addEventListener("click", () => {
    const el = document.getElementById("journal-form");
    el.style.display = el.style.display === "none" ? "block" : "none";
    if (el.style.display === "block") renderJournalForm();
  });

  function renderJournalForm() {
    const el = document.getElementById("journal-form");
    el.innerHTML = `
      <div class="card">
        <div class="pill-row" id="type-pills">
          ${Object.entries(JOURNAL_TYPES)
            .map(([k, t]) => `<button class="pill" data-type="${k}">${t.icon} ${t.label}</button>`)
            .join("")}
        </div>
        <input type="date" id="entry-date" value="${new Date().toISOString().slice(0, 10)}" />
        <input type="text" id="entry-note" placeholder="פרטים... (למשל: חיסון כלבת שנתי)" />
        <div style="font-size:11px;color:var(--ink-soft);margin-bottom:4px;">תזכורת בטלפון (אופציונלי)</div>
        <input type="date" id="entry-reminder" />
        <button class="btn-primary" id="save-entry">שמור ביומן</button>
      </div>
    `;
    let selectedType = "walk";
    const pills = el.querySelectorAll("#type-pills .pill");
    pills.forEach((p) => {
      if (p.dataset.type === selectedType) p.classList.add("active");
      p.addEventListener("click", () => {
        selectedType = p.dataset.type;
        pills.forEach((x) => x.classList.remove("active"));
        p.classList.add("active");
      });
    });
    document.getElementById("save-entry").addEventListener("click", async () => {
      const note = document.getElementById("entry-note").value;
      const date = document.getElementById("entry-date").value;
      const reminderDate = document.getElementById("entry-reminder").value || null;
      if (!note.trim()) return;
      await api("/api/journal", {
        method: "POST",
        body: JSON.stringify({ type: selectedType, note, date, reminderDate }),
      });
      document.getElementById("journal-form").style.display = "none";
      renderJournal();
    });
  }

  const $list = document.getElementById("journal-list");
  if (!state.journal.length) {
    $list.innerHTML = `<div class="card" style="text-align:center;color:var(--ink-soft);font-size:13px;">עדיין אין רשומות. לחצו על + כדי להוסיף אירוע ראשון.</div>`;
    return;
  }
  $list.innerHTML = `
    <div class="timeline">
      <div class="timeline-line"></div>
      ${state.journal
        .map((e) => {
          const meta = JOURNAL_TYPES[e.type] || JOURNAL_TYPES.walk;
          return `
          <div class="timeline-item">
            <div class="timeline-dot" style="background:var(--primary-soft);">${meta.icon}</div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span style="font-weight:700;font-size:13px;">${meta.label} ${e.reminderDate ? "🔔" : ""}</span>
                <span style="font-family:'JetBrains Mono';font-size:11px;color:var(--ink-soft);">${e.date}</span>
              </div>
              <div style="font-size:12.5px;color:var(--ink-soft);margin-top:2px;">${e.note}</div>
              ${e.reminderDate ? `<div style="font-size:10.5px;color:var(--gold);margin-top:2px;">תזכורת ל־${e.reminderDate}</div>` : ""}
            </div>
          </div>`;
        })
        .join("")}
    </div>
  `;
}

async function renderFood() {
  const [favorites, foods] = await Promise.all([
    api("/api/favorites"),
    api(`/api/food?weight=${state.weight}&region=${encodeURIComponent(state.region)}`),
  ]);
  state.favorites = favorites;
  state.foods = foods;

  const sizeLabels = { all: "הכל", small: "קטן", medium: "בינוני", large: "גדול" };
  let sizeFilter = "all";

  function renderList() {
    const filtered = state.foods.filter((f) => sizeFilter === "all" || f.size === sizeFilter || f.size === "all");
    const cheapest = [...filtered].sort((a, b) => a.pricePerKg - b.pricePerKg)[0];
    document.getElementById("food-list").innerHTML = filtered
      .map((f) => {
        const isFav = state.favorites.includes(f.id);
        const isBest = cheapest && f.id === cheapest.id;
        return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div><div style="font-weight:800;font-size:15px;">${f.brand}</div><div style="font-size:12px;color:var(--ink-soft);">${f.line}</div></div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${isBest ? `<span class="pill active" style="background:var(--gold);border-color:var(--gold);">הכי משתלם</span>` : ""}
              <button class="fav-btn" data-fav="${f.id}">${isFav ? "❤️" : "🤍"}</button>
            </div>
          </div>
          <div class="price-row">
            <div><div class="price-main">₪${f.pricePerKg}</div><div class="price-sub">לק"ג</div></div>
            <div class="divider-v"></div>
            <div><div class="price-main" style="color:var(--primary);">₪${f.monthlyCost}</div><div class="price-sub">לחודש ל־${state.weight} ק"ג</div></div>
            <div class="divider-v"></div>
            <div><div style="font-weight:700;font-size:12px;">שק ${f.bagKg} ק"ג</div><div class="price-sub">₪${f.bagPrice} לשק</div></div>
          </div>
          <div style="font-size:12px;margin-top:8px;">${f.fact}</div>
          <div class="shipping-row" style="color:${f.shipping.free ? "var(--primary)" : "var(--ink-soft)"};">
            🚚 ${f.shipping.free ? "משלוח חינם" : "משלוח בתשלום"} · ${f.shipping.days} · ${f.shipping.region}
          </div>
          <div class="note-small">מגיע ל: ${f.shipping.coverage}</div>
        </div>`;
      })
      .join("");

    document.querySelectorAll("[data-fav]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        state.favorites = await api("/api/favorites/toggle", {
          method: "POST",
          body: JSON.stringify({ id: btn.dataset.fav }),
        });
        renderList();
      })
    );
  }

  $content.innerHTML = `
    <div class="eyebrow">אוכל · נתונים מהשוק הישראלי</div>
    <div class="title">השוואת מחירים</div>
    <div class="card">
      <div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:8px;">משקל הכלב שלך — לחישוב עלות חודשית</div>
      <div class="weight-control">
        <button class="weight-btn" id="w-minus">−</button>
        <div class="weight-value" id="w-value">${state.weight} ק"ג</div>
        <button class="weight-btn" id="w-plus">+</button>
      </div>
    </div>
    <div class="card">
      <div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:8px;">🚚 אזור המשלוח שלך</div>
      <div class="pill-row" id="region-pills">
        ${state.config.regions.map((r) => `<button class="pill ${r === state.region ? "active" : ""}" data-region="${r}">${r}</button>`).join("")}
      </div>
    </div>
    <div class="card">
      <div style="font-weight:700;font-size:13.5px;margin-bottom:8px;">🤖 שאל את הבינה המלאכותית</div>
      <div style="font-size:11px;color:var(--ink-soft);margin-bottom:6px;">גודל גזע</div>
      <select id="ai-size" style="width:100%;font-family:'Heebo';font-size:13px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);margin-bottom:8px;">
        <option value="small">קטן</option>
        <option value="medium" selected>בינוני</option>
        <option value="large">גדול</option>
      </select>
      <div style="font-size:11px;color:var(--ink-soft);margin-bottom:6px;">מה הכי חשוב לך? (למשל: תקציב נמוך, בעיות עיכול, מפרקים)</div>
      <input type="text" id="ai-priorities" placeholder="לדוגמה: הכי משתלם עם איכות סבירה" />
      <button class="btn-primary btn-dark" id="ai-ask">קבל המלצה</button>
      <div id="ai-result"></div>
    </div>
    <div class="pill-row" id="size-pills">
      ${Object.entries(sizeLabels).map(([k, l]) => `<button class="pill ${k === "all" ? "active" : ""}" data-size="${k}">${l}</button>`).join("")}
    </div>
    <div id="food-list"></div>
    <div class="note-small" style="text-align:center;">
      המחירים ממוצעים משוק הקמעונאות בישראל ומשתנים בין חנויות ומבצעים. חישוב העלות החודשית מבוסס על כלל אצבע
      של כ-2.5% ממשקל הגוף ליום ואינו תחליף להמלצת וטרינר. זמני המשלוח הם הערכה כללית.
    </div>
  `;

  document.getElementById("w-minus").addEventListener("click", async () => {
    state.weight = Math.max(2, state.weight - 1);
    await api("/api/settings", { method: "POST", body: JSON.stringify({ dogWeight: state.weight }) });
    renderFood();
  });
  document.getElementById("w-plus").addEventListener("click", async () => {
    state.weight = Math.min(70, state.weight + 1);
    await api("/api/settings", { method: "POST", body: JSON.stringify({ dogWeight: state.weight }) });
    renderFood();
  });
  document.querySelectorAll("#region-pills [data-region]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      state.region = btn.dataset.region;
      await api("/api/settings", { method: "POST", body: JSON.stringify({ region: state.region }) });
      renderFood();
    })
  );
  document.querySelectorAll("#size-pills [data-size]").forEach((btn) =>
    btn.addEventListener("click", () => {
      document.querySelectorAll("#size-pills .pill").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      sizeFilter = btn.dataset.size;
      renderList();
    })
  );

  document.getElementById("ai-ask").addEventListener("click", async () => {
    const dogSize = document.getElementById("ai-size").value;
    const priorities = document.getElementById("ai-priorities").value;
    const $result = document.getElementById("ai-result");
    $result.innerHTML = `<div class="note-small">חושב...</div>`;
    try {
      const res = await api("/api/ai-recommend", {
        method: "POST",
        body: JSON.stringify({ weight: state.weight, dogSize, priorities }),
      });
      if (res.error) {
        $result.innerHTML = `<div class="note-warn">${res.error}</div>`;
      } else {
        $result.innerHTML = `<div class="card" style="margin-top:10px;white-space:pre-wrap;font-size:13px;">${res.recommendation}</div>`;
      }
    } catch (e) {
      $result.innerHTML = `<div class="note-warn">שגיאה בתקשורת עם השרת.</div>`;
    }
  });

  renderList();
}

async function renderProfile() {
  const name = state.profile ? state.profile.name : "";
  $content.innerHTML = `
    <div class="eyebrow">הפרופיל שלי</div>
    <div class="title">${name}</div>
    <div class="card" style="text-align:center;padding:28px 16px;">
      <div style="font-family:'Suez One';font-size:28px;">${dogInitial()}</div>
      <div style="font-family:'Suez One';font-size:20px;margin-top:8px;">${name}</div>
      <div style="font-size:12px;color:var(--ink-soft);">${dogSubtitle()}</div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">${state.notifOn ? "🔔" : "🔕"}</span>
          <div><div style="font-weight:700;font-size:13.5px;">תזכורות ליומן</div><div style="font-size:11px;color:var(--ink-soft);">חיסונים, וטרינר ועוד</div></div>
        </div>
        <button class="switch ${state.notifOn ? "on" : ""}" id="notif-toggle"><div class="knob"></div></button>
      </div>
      <div class="note-small">
        זו התראת Push אמיתית: היא מגיעה מהשרת גם אם האפליקציה סגורה, ברגע שהמכשיר מחובר לאינטרנט —
        בתנאי שהתקנת את האפליקציה למסך הבית ואישרת התראות.
      </div>
    </div>
  `;
  document.getElementById("notif-toggle").addEventListener("click", () => {
    if (state.notifOn) disablePush();
    else enablePush();
  });
}

async function render() {
  if (!state.profile) {
    renderOnboarding();
    return;
  }
  renderNav();
  if (state.tab === "home") renderHome();
  else if (state.tab === "journal") renderJournal();
  else if (state.tab === "food") renderFood();
  else if (state.tab === "profile") renderProfile();
}

async function init() {
  state.config = await api("/api/config");
  state.profile = await api("/api/profile");

  if (state.profile) {
    const settings = await api("/api/settings");
    state.weight = settings.dogWeight || 20;
    state.region = settings.region || "מרכז";

    if ("serviceWorker" in navigator) {
      const reg = await registerServiceWorker();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        state.notifOn = Boolean(sub);
      }
    }
  }
  render();
}
// Function to communicate with the AI endpoint
async function askAI(userQuestion) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: userQuestion })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("AI communication error:", error);
  }
}

init();
