import { TERMS_PARAS, PRIVACY_PARAS, TERMS_VERSION, TERMS_VERSIONS, TERMS_PAGE, termsLabel, termsHtml } from "./terms.js";
import {
  PAYMENT_METHODS, RIDE_LABEL, STATUS_CARRIER, paymentLabel, formatKc, formatWhen, pragueParts,
  validEmail, validIco, registrationFieldErrors, parseCsDate, formatCsDate, stashPending,
  recordsReady, canShowDriverHome, postLoginView, createEmptyDb, rehydrate, registerDriver, loginDemo,
  checkPin as checkPinDemo, createOffer, placeOrder, startRide, endRide, markPaid, recordEet,
  setEet, proposeChange, discardChange, cancelRide, confirmationView, emailStatusView,
  recordSimulatedEmail, toCsv, paymentSums, ridesFor, updateProfile, setCarrierStatus, flushEet, setPin,
} from "./engine.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = (id) => document.getElementById(id);

const BUSY_TEXT = {
  login: "Přihlašuji…",
  "forgot-send": "Odesílám odkaz…",
  "set-new-password": "Ukládám heslo…",
  "reg-submit": "Odesílám…",
  "reg-next": "Pokračuji…",
  ares: "Načítám z ARES…",
  "create-offer": "Ukládám nabídku…",
  "to-customer": "Otevírám…",
  "place-order": "Ukládám objednávku…",
  "start-ride": "Zahajuji jízdu…",
  "end-ride": "Ukončuji jízdu…",
  "mark-paid": "Ukládám platbu…",
  "resend-email": "Odesílám e-mail…",
  "cancel-ride": "Ruším…",
  "save-change": "Ukládám změnu…",
  "discard-change": "Ruším změnu…",
  "save-profile": "Ukládám…",
  "save-pin": "Ukládám PIN…",
  "save-first-pin": "Ukládám…",
  "save-eet": "Ukládám…",
  "flush-eet": "Odesílám…",
  "export-csv": "Připravuji soubor…",
  "set-status": "Ukládám…",
  "retry-pending": "Dokončuji registraci…",
  "retry-boot": "Načítám…",
  logout: "Odhlašuji…",
  "open-ride": "Otevírám…",
  "go-quick": "Připravuji…",
  "check-pin": "Ověřuji PIN…",
};

function busyText(act) {
  return BUSY_TEXT[act] || "Ukládám…";
}

function spinLabel(text) {
  return `<span class="btn-busy"><span class="spin" aria-hidden="true"></span><span>${esc(text)}</span></span>`;
}

function showBusy(el, act) {
  const root = $("app");
  if (!root) return;
  root.querySelectorAll("button").forEach((btn) => {
    const a = btn.dataset.act;
    if (a === "toggle-night") return;
    btn.disabled = true;
  });
  let target = el && el.tagName === "FORM" ? el.querySelector("button[type=submit], button.btn") : el;
  if (target && target.tagName === "BUTTON" && target.dataset.act !== "pin-key") {
    target.disabled = true;
    target.classList.add("is-busy");
    target.setAttribute("aria-busy", "true");
    target.innerHTML = spinLabel(busyText(act));
  }
}
const SAMPLE = {
  name: "Jan Novák", ico: "12345679", dic: "CZ12345679", vatPayer: false,
  street: "Dlouhá 12", city: "Praha 1", zip: "110 00", iban: "CZ6508000000192000145399",
  email: "jan.novak@example.com", phone: "777 123 456", loginEmail: "jan.novak@example.com",
  password: "demo1234", password2: "demo1234", pin: "1234", pin2: "1234",
  firstName: "Jan", lastName: "Novák", licenceNumber: "T-2024-001234", licenceUntil: "2028-12-31",
  rz: "1A2 3456", make: "BYD", model: "Sealion 7", registryNote: "Výpis z evidence vozidel taxislužby",
  noTaximeter: true,
};

const S = {
  // Tmavý vzhled je výchozí; světlý se zapne tlačítkem režimu.
  night: localStorage.getItem("svezemete.theme") !== "light",
  view: "boot",
  draft: {},
  error: "",
  info: "",
  fieldErrors: {},
  recovering: false,
  rideId: null,
  customerLock: false,
  pinTries: 0,
  pinLockedUntil: 0,
  busy: false,
  busyAct: "",
  pinShake: false,
  bundle: null,
  backend: null,
  regStep: 1,
  termsBack: "order",
};

function appBaseUrl() {
  return new URL("./", location.href).href.split("#")[0].split("?")[0];
}

function authErrorCs(error) {
  const code = String(error?.code || error?.error_code || "").toLowerCase();
  const status = error?.status;
  const msg = String(error?.message || error || "");
  const text = `${code} ${msg}`.toLowerCase();
  if (code === "invalid_credentials" || /invalid login credentials|invalid (email|login) or password|invalid_credentials/.test(text)) {
    return "Nesprávný e-mail nebo heslo.";
  }
  if (code === "email_not_confirmed" || /email not confirmed|email_not_confirmed/.test(text)) {
    return "E-mail zatím nebyl potvrzen. Zkontrolujte schránku.";
  }
  if (code === "over_email_send_rate_limit" || status === 429 || /rate limit|too many requests|for security purposes|over_email_send_rate_limit|email rate limit/.test(text)) {
    return "Příliš mnoho pokusů, zkuste to za chvíli.";
  }
  if (code === "user_already_exists" || /already registered|user already exists|already been registered/.test(text)) {
    return "Účet s tímto e-mailem už existuje.";
  }
  if (code === "weak_password" || /password should be at least|password is known|weak_password/.test(text)) {
    return "Heslo musí mít alespoň 8 znaků.";
  }
  if (/missing email or phone|unable to validate email|invalid (email )?format|valid email/.test(text)) {
    return "Zadejte platný e-mail.";
  }
  if (/same as the old password|same password/.test(text)) {
    return "Nové heslo musí být jiné než původní.";
  }
  if (/auth session missing|session expired|invalid (or expired )?token|otp_expired|recovery.*expired/.test(text)) {
    return "Odkaz pro obnovu hesla už není platný. Požádejte o nový.";
  }
  if (/failed to fetch|networkerror|network request failed|load failed/.test(text)) {
    return "Nepodařilo se spojit se serverem. Zkuste to znovu.";
  }
  if (/[áčďéěíňóřšťúůýž]/i.test(msg)) return msg;
  return "Něco se nepovedlo. Zkuste to znovu.";
}

function asCzechError(err) {
  const msg = String(err?.message || "");
  if (!msg) return "Něco se nepovedlo. Zkuste to znovu.";
  const mapped = authErrorCs(err);
  if (mapped !== "Něco se nepovedlo. Zkuste to znovu.") return mapped;
  if (/[áčďéěíňóřšťúůýž]/i.test(msg) || /IČO|PIN|PSČ/.test(msg)) return msg;
  if (/(error|invalid|failed|cannot|undefined|permission denied|violates|duplicate|unexpected|column|relation|function)/i.test(msg)) {
    return "Něco se nepovedlo. Zkuste to znovu.";
  }
  return msg;
}

function recoveryInUrl() {
  try {
    const raw = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    return new URLSearchParams(raw).get("type") === "recovery";
  } catch {
    return false;
  }
}

function markRecovering() {
  S.recovering = true;
  try { sessionStorage.setItem("svezemete.recovery", "1"); } catch { /* ignore */ }
}

function clearRecovering() {
  S.recovering = false;
  try { sessionStorage.removeItem("svezemete.recovery"); } catch { /* ignore */ }
}

const PENDING_KEY = "svezemete.pending";

function readPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePending(input) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(stashPending(input))); } catch { /* ignore */ }
}

function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

function skipAccountStep() {
  return !!(S.bundle?.me && S.bundle.me.role === "driver" && !recordsReady(S.bundle));
}

function loginState(view = S.view) {
  return {
    backend: !!S.backend,
    recovering: S.recovering,
    view,
    signedIn: !!S.bundle?.me,
    role: S.bundle?.me?.role,
    hasCarrier: !!S.bundle?.carrier,
    hasDriver: !!S.bundle?.driver,
    hasVehicle: !!S.bundle?.vehicle,
    hasPending: !!readPending(),
    hasPin: S.bundle?.driver ? S.bundle.driver.hasPin === true : undefined,
    customerLock: S.customerLock,
  };
}

function focusField(name) {
  const el = document.querySelector(`[data-field="${name}"]`);
  if (!el) return;
  const details = el.closest("details");
  if (details) details.open = true;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showStepErrors(fields) {
  S.fieldErrors = fields;
  S.error = "";
  render();
  const first = Object.keys(fields)[0];
  if (first) focusField(first);
}

function themeToggle() {
  const toLight = S.night;
  const label = toLight ? "Světlý režim" : "Tmavý režim";
  const hint = toLight ? "Přepnout na světlý režim" : "Přepnout na tmavý režim";
  const icon = toLight
    ? '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path fill="currentColor" d="M12 2h1v3h-2V2zm0 17h1v3h-2v-3zM2 11h3v2H2v-2zm17 0h3v2h-3v-2zM5.05 4.34l1.41-1.41 2.12 2.12-1.41 1.41L5.05 4.34zm10.37 10.37 1.41-1.41 2.12 2.12-1.41 1.41-2.12-2.12zM4.34 18.95l1.41 1.41 2.12-2.12-1.41-1.41-2.12 2.12zm10.37-10.37 1.41 1.41 2.12-2.12-1.41-1.41-2.12 2.12z"/></svg>'
    : '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 3.05a8.5 8.5 0 1 0 5.45 13.4A7 7 0 0 1 13 5.2a8.4 8.4 0 0 0 2.5-2.15z"/></svg>';
  return `<button type="button" class="tool theme-toggle" data-act="toggle-night" title="${hint}" aria-label="${hint}">${icon}<span>${label}</span></button>`;
}

function configured() {
  const c = window.SVEZEME_CONFIG || {};
  const url = String(c.supabaseUrl || "");
  const key = String(c.supabaseAnonKey || "");
  return url.startsWith("https://") && !url.includes("__SB") && key.length > 20 && !key.includes("__SB");
}

function demoAllowed() {
  return window.SVEZEME_CONFIG?.demo === true;
}

function pullDraft() {
  document.querySelectorAll("[data-field]").forEach((el) => {
    S.draft[el.dataset.field] = el.type === "checkbox" ? el.checked : el.value;
  });
}

function rideBy(id) {
  return S.bundle?.rides?.find((r) => r.ride.id === (id || S.rideId)) || null;
}

function go(view, extra = {}) {
  if (extra.rideId !== undefined) S.rideId = extra.rideId;
  if (extra.keepDraft !== true && extra.resetDraft) S.draft = {};
  const changed = S.view !== view;
  S.view = view;
  try {
    sessionStorage.setItem("svezemete.ui", JSON.stringify({
      view: S.view, rideId: S.rideId, customerLock: S.customerLock, regStep: S.regStep,
    }));
  } catch { /* ignore */ }
  render();
  if (changed) window.scrollTo(0, 0);
}

async function refresh() {
  S.bundle = await S.backend.load();
}

function goAfterLogin() {
  if (!recordsReady(S.bundle) && readPending()) {
    go("finishing");
    finishSessionRegistration();
    return;
  }
  const next = postLoginView(loginState("home"));
  if (next === "home" && recordsReady(S.bundle) && S.bundle.carrier.status !== "active") {
    S.info = "Registrace čeká na ověření správcem.";
  }
  go(next === "login" ? "home" : next);
}

async function finishSessionRegistration() {
  if (!S.backend?.completePending) {
    go(readPending() || !S.bundle?.me ? "login" : "incomplete");
    return;
  }
  S.view = "finishing";
  S.error = "";
  render();
  try {
    S.bundle = await S.backend.completePending();
    if (!recordsReady(S.bundle)) {
      if (readPending()) throw new Error("Registraci se nepodařilo dokončit. Zkuste to znovu, nebo údaje vyplňte znovu.");
      go("incomplete");
      return;
    }
    goAfterLogin();
  } catch (err) {
    console.error(err);
    S.error = asCzechError(err);
    go("incomplete");
  }
}


function viewNow() {
  return postLoginView(loginState());
}

const PAY_INFO = {
  hotovost: { label: "Hotově", sub: "Řidič po dokončení jízdy", short: "Hotově" },
  karta: { label: "Platební kartou", sub: "Terminál řidiče / online dle nabídky", short: "Karta" },
  qr: { label: "QR platbou", sub: "Bankovní převod na účet dopravce", short: "QR" },
  faktura: { label: "Na fakturu", sub: "Po schválení, se sjednanou splatností", short: "Faktura" },
};

function shell(mode, body, wide) {
  const who = S.bundle?.me;
  return `<div class="app${wide ? " wide" : ""}">
    <header>
      <div class="brand"><div class="mark" aria-hidden="true">S</div><div class="nm">SvezemeTě</div></div>
      <div class="tools">
        ${S.customerLock ? "" : themeToggle()}
        ${who && !S.customerLock ? `<button type="button" class="tool" data-act="logout">Odhlásit</button>` : ""}
      </div>
    </header>
    <div class="rule" aria-hidden="true"></div>
    ${S.backend?.mode === "demo" ? `<div class="banner">DEMO REŽIM. Data zůstávají jen v tomto prohlížeči. E-mail se neodesílá a čas objednávky je simulace času serveru.</div>` : ""}
    <main>
      <p class="mode">${esc(mode)}</p>
      ${S.error ? `<div class="alert bad" role="alert">${esc(S.error)}</div>` : S.info ? `<div class="alert ok" role="status">${esc(S.info)}</div>` : ""}
      ${body}
    </main>
  </div>`;
}

// Datová karta: malý popisek, výrazná hodnota, barevný proužek vlevo (c1 tyrkys, c2 modrá, c3 fialová).
function card(label, value, accent = "c1", extra = "") {
  return `<div class="card ${accent}"><span class="lbl">${label}</span><strong class="val">${value}</strong>${extra}</div>`;
}

function payOptions(current, opts = {}) {
  if (opts.grid) {
    return `<div class="paygrid" role="radiogroup" aria-label="Způsob platby">${PAYMENT_METHODS.map((p) => `<button type="button" class="payopt sm${current === p.id ? " on" : ""}" role="radio" aria-checked="${current === p.id}" data-act="pick-pay" data-method="${p.id}"><span class="dot" aria-hidden="true"></span><strong>${PAY_INFO[p.id]?.short || p.label}</strong></button>`).join("")}</div>`;
  }
  return `<div class="paylist" role="radiogroup" aria-label="Způsob platby">${PAYMENT_METHODS.map((p) => `<button type="button" class="payopt${current === p.id ? " on" : ""}" role="radio" aria-checked="${current === p.id}" data-act="pick-pay" data-method="${p.id}"><span class="dot" aria-hidden="true"></span><span><strong>${PAY_INFO[p.id]?.label || p.label}</strong><small>${PAY_INFO[p.id]?.sub || ""}</small></span></button>`).join("")}</div>`;
}

function rideCard(b) {
  return `<button type="button" class="card-btn c2" data-act="open-ride" data-id="${b.ride.id}">
    <span class="badge">${esc(RIDE_LABEL[b.ride.status] || b.ride.status)}</span>
    <strong>${esc(b.offer?.fromPlace || "Nabídka")} → ${esc(b.offer?.toPlace || "")}</strong>
    <span class="accent">${b.offer ? formatKc(b.offer.priceKc) : ""} · ${esc(paymentLabel(b.offer?.paymentMethod))}</span>
  </button>`;
}

function queuedEet() {
  const carrierId = S.bundle?.carrier?.id;
  const eet = S.bundle?.eet;
  if (!eet?.enabled || !carrierId) return false;
  const latest = new Map();
  for (const m of S.bundle.db.eetMessages || []) {
    if (m.carrierId !== carrierId) continue;
    const prev = latest.get(m.paymentId);
    if (!prev || (m.attempt || 0) >= (prev.attempt || 0)) latest.set(m.paymentId, m);
  }
  return [...latest.values()].some((m) => m.status === "queued");
}

// Oblíbené trasy řidiče: jen z jeho vlastních jízd v aplikaci (bez mapových služeb).
function favouriteRoutes(limit = 4) {
  const map = new Map();
  for (const r of S.bundle?.rides || []) {
    const o = r.offer;
    if (!o?.fromPlace || !o?.toPlace) continue;
    const key = `${o.fromPlace.trim().toLowerCase()}|${o.toPlace.trim().toLowerCase()}`;
    const hit = map.get(key);
    const when = String(r.ride.createdAt || "");
    if (!hit) map.set(key, { from: o.fromPlace, to: o.toPlace, price: o.priceKc, method: o.paymentMethod, count: 1, when });
    else {
      hit.count += 1;
      if (when > hit.when) Object.assign(hit, { from: o.fromPlace, to: o.toPlace, price: o.priceKc, method: o.paymentMethod, when });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.when.localeCompare(a.when)).slice(0, limit);
}

function lastStart() {
  const r = (S.bundle?.rides || []).find((x) => x.offer?.fromPlace);
  return r ? r.offer.fromPlace : "";
}

function viewHome() {
  if (S.bundle.me.role === "admin") return viewAdmin();
  if (!canShowDriverHome(S.bundle)) return viewIncomplete();
  const b = S.bundle;
  if (b.carrier.status !== "active") {
    return shell("Registrace / stav", `
      <h1>${esc(b.carrier.name)}</h1>
      ${card("Stav registrace", esc(STATUS_CARRIER[b.carrier.status] || b.carrier.status), "c3")}
      <p class="hint">Než správce registraci schválí, jízdu založit nejde. Údaje jsou uložené a můžete si je zkontrolovat.</p>
      <button type="button" class="btn" data-act="go" data-view="profile">Můj profil</button>`);
  }
  const today = pragueParts(new Date().toISOString()).key;
  const todays = b.rides.filter((r) => r.ride.status !== "cancelled" && pragueParts(r.ride.createdAt).key === today);
  const unfinished = b.rides.filter((r) => r.ride.status === "completed" && !r.delivery);
  return shell("Režim řidiče", `
    <h1>Dobrý den, ${esc(b.driver.firstName)}</h1>
    ${card("Vozidlo", `${esc(b.vehicle.make)} ${esc(b.vehicle.model)} · ${esc(b.vehicle.rz)}`, "c2")}
    <button type="button" class="btn xl" data-act="go-quick">Nová jízda</button>
    ${unfinished.map((r) => `<button type="button" class="btn dark" data-act="open-ride" data-id="${r.ride.id}">Dokončit platbu a potvrzení<br>${esc(r.offer.fromPlace)} → ${esc(r.offer.toPlace)}</button>`).join("")}
    ${queuedEet() ? `<div class="alert wait">EET čeká na odeslání. Jízdy jedou dál.</div><button type="button" class="btn ghost" data-act="flush-eet">Odeslat čekající EET (zkušební)</button>` : ""}
    <button type="button" class="btn ghost" data-act="go" data-view="inspect">Pro kontrolu</button>
    <h2>Dnešní jízdy</h2>
    ${todays.length ? todays.map(rideCard).join("") : `<p class="empty">Dnes ještě žádná jízda. Klepněte na Nová jízda.</p>`}
    <div class="row2">
      <button type="button" class="btn ghost" data-act="go" data-view="history">Historie a export</button>
      <button type="button" class="btn ghost" data-act="go" data-view="profile">Můj profil</button>
    </div>`);
}

function viewQuick() {
  const favs = favouriteRoutes();
  return shell("Rychlá objednávka", `
    <h1>Kam pojedeme?</h1>
    <label class="card c1 incard"><span class="lbl">Nástup <em>upravit</em></span>
      <input data-field="from" value="${esc(S.draft.from ?? "")}" autocomplete="off" placeholder="Místo nástupu"></label>
    <h2>Oblíbené trasy</h2>
    ${favs.length ? favs.map((f, i) => `<button type="button" class="card-btn ${["c1", "c2", "c3"][i % 3]}" data-act="pick-fav" data-i="${i}">
        <strong>${esc(f.from)} → ${esc(f.to)}</strong>
        <span class="accent">Uložená nabídka: ${formatKc(f.price)}</span>
      </button>`).join("") : `<p class="empty">Zatím žádné oblíbené trasy. Objeví se tu samy podle vašich jízd.</p>`}
    <p class="hint">Oblíbené trasy jsou vaše nejčastější jízdy s poslední cenou. Cenu a trasu před předáním ještě zkontrolujete.</p>
    <button type="button" class="btn xl" data-act="quick-other">Zadat jiný cíl</button>
    <button type="button" class="btn ghost" data-act="go-offer">Celý formulář trasy</button>
    <button type="button" class="btn ghost" data-act="go" data-view="home">Zpět</button>`);
}

function viewPrice() {
  const method = S.draft.paymentMethod || "hotovost";
  return shell("Rychlá objednávka", `
    <h1>Cena a platba</h1>
    <div class="card c1 incard"><span class="lbl">Trasa <em>upravit</em></span>
      <input data-field="from" value="${esc(S.draft.from || "")}" autocomplete="off" placeholder="Odkud" aria-label="Odkud">
      <span class="arrow" aria-hidden="true">↓</span>
      <input data-field="to" value="${esc(S.draft.to || "")}" autocomplete="off" placeholder="Kam" aria-label="Kam" ${S.draft.to ? "" : "autofocus"}>
    </div>
    <label class="card c2 incard"><span class="lbl">Konečná cena v Kč <em>upravit</em></span>
      <input class="price-in" data-field="priceKc" inputmode="numeric" value="${esc(S.draft.priceKc || "")}" placeholder="850"></label>
    <h2>Způsob platby</h2>
    ${payOptions(method, { grid: true })}
    <p class="hint">Zákazník uvidí konečnou cenu, trasu, dopravce, řidiče a vozidlo ještě před objednáním. Jízdu nelze zahájit dřív.</p>
    <button type="button" class="btn xl" data-act="create-offer">Předat zákazníkovi</button>
    <button type="button" class="btn ghost" data-act="go" data-view="quick">Zpět</button>`);
}

function viewUnconfigured() {
  return `<main class="gate"><p>Aplikace zatím není nastavena</p></main>`;
}

function viewForgot() {
  return shell("Obnova hesla", `
    <h1>Zapomenuté heslo</h1>
    <p class="hint">Zadejte e-mail k účtu. Pošleme vám odkaz k nastavení nového hesla.</p>
    <form data-act="forgot-send" autocomplete="on" class="card c1 formcard" novalidate>
      <label>E-mail<input type="email" data-field="loginEmail" autocomplete="username" value="${esc(S.draft.loginEmail || "")}"></label>
      <button class="btn" type="submit">Odeslat odkaz</button>
    </form>
    <button type="button" class="btn ghost" data-act="go" data-view="login">Zpět na přihlášení</button>`);
}

function viewNewPassword() {
  return shell("Nové heslo", `
    <h1>Nastavit nové heslo</h1>
    <p class="hint">Zvolte si nové heslo k účtu. Musí mít alespoň 8 znaků.</p>
    <form data-act="set-new-password" autocomplete="on" class="card c1 formcard" novalidate>
      <label>Nové heslo<input type="password" data-field="password" autocomplete="new-password"></label>
      <label>Nové heslo znovu<input type="password" data-field="password2" autocomplete="new-password"></label>
      <button class="btn" type="submit">Uložit heslo</button>
    </form>
    <button type="button" class="btn ghost" data-act="cancel-recovery">Zpět na přihlášení</button>`);
}

function viewLogin() {
  const demo = S.backend.mode === "demo";
  const roster = demo ? S.backend.roster() : [];
  return shell("Přihlášení", `
    <h1>Vítejte</h1>
    <p class="hint">Aplikace slouží k elektronickému objednávání přepravy v taxislužbě. Je určena dopravcům, kteří splňují podmínky pro provozování taxislužby bez taxametru.</p>
    <form data-act="login" autocomplete="on" class="card c1 formcard" novalidate>
      <span class="lbl">Už mám účet</span>
      <label>E-mail<input type="email" data-field="loginEmail" autocomplete="username" value="${esc(S.draft.loginEmail || "")}"></label>
      <label>Heslo<input type="password" data-field="password" autocomplete="current-password"></label>
      <button class="btn" type="submit">Přihlásit</button>
      <button type="button" class="link forgot-link" data-act="go-forgot">Zapomenuté heslo?</button>
    </form>
    <button type="button" class="btn ghost" data-act="go-register">Registrovat se jako řidič</button>
    ${roster.length ? `<h2>Účty v tomto prohlížeči</h2>${roster.map((u) => `<button type="button" class="card-btn c2" data-act="pick-user" data-email="${esc(u.email)}"><strong>${esc(u.name)}</strong><span>${esc(u.email)}</span></button>`).join("")}<p class="hint">Jen demo v tomto prohlížeči. Hesla se tu nezobrazují.</p>` : ""}
    ${demo ? `<button type="button" class="btn ghost" data-act="demo-admin">Vstoupit jako správce (demo)</button>` : ""}
    <p class="foot-links"><a href="${TERMS_PAGE}">Obchodní podmínky pro zákazníky</a></p>`);
}

function field(label, name, opts = {}) {
  const val = S.draft[name] ?? "";
  const type = opts.type || "text";
  const err = S.fieldErrors?.[name] || "";
  const errHtml = err ? `<span class="field-error" id="err-${name}" role="alert">${esc(err)}</span>` : "";
  const described = err ? ` aria-invalid="true" aria-describedby="err-${name}"` : "";
  if (type === "checkbox") {
    const on = opts.defaultOn ? S.draft[name] !== false : S.draft[name] === true;
    return `<label class="consent${err ? " has-error" : ""}"><input type="checkbox" data-field="${name}" ${on ? "checked" : ""}${described}><span>${label}</span>${errHtml}</label>`;
  }
  if (type === "date") {
    const shown = formatCsDate(val) || val;
    const dateErr = err ? errHtml : `<span class="hint date-hint">den.měsíc.rok, například 31.12.2028</span>`;
    return `<label class="${err ? "has-error" : ""}">${label}<input class="${err ? "invalid" : ""}" type="text" inputmode="numeric" lang="cs" data-field="${name}" value="${esc(shown)}" placeholder="dd.mm.rrrr" autocomplete="off"${described}>${dateErr}</label>`;
  }
  return `<label class="${err ? "has-error" : ""}">${label}<input class="${err ? "invalid" : ""}" type="${type}" data-field="${name}" value="${esc(val)}" ${opts.mode ? `inputmode="${opts.mode}"` : ""} ${opts.ac ? `autocomplete="${opts.ac}"` : ""} ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ""} lang="cs"${described}>${errHtml}</label>`;
}

function doc(title, inner, open) {
  return `<details class="doc"${open ? " open" : ""}><summary><span>${title}</span><b aria-hidden="true">+</b></summary><div class="docin">${inner}</div></details>`;
}

function viewRegister() {
  const step = S.regStep;
  const titles = ["", "Údaje dopravce", "Vytvořte účet", "Řidič a vozidlo", "Odeslat ke kontrole"];
  let body = "";
  if (step === 1) {
    body = `${field("Jméno a příjmení nebo název firmy", "name")}${field("IČO", "ico", { mode: "numeric" })}
      <button type="button" class="btn ghost" data-act="ares">Načíst z ARES</button>
      <p class="hint">Údaje z ARES si můžete opravit.</p>
      ${field("DIČ", "dic")}${field("Jsem plátce DPH", "vatPayer", { type: "checkbox" })}
      ${field("Ulice a číslo", "street")}<div class="row2">${field("PSČ", "zip")}${field("Město", "city")}</div>
      ${field("Bankovní účet (IBAN)", "iban", { placeholder: "CZ…" })}${field("E-mail dopravce", "email", { type: "email", ac: "email" })}${field("Telefon", "phone", { type: "tel" })}
      ${S.backend.mode === "demo" ? `<button type="button" class="btn ghost" data-act="fill-demo">Vyplnit ukázkové údaje</button>` : ""}`;
  } else if (step === 2) {
    body = `${field("Přihlašovací e-mail", "loginEmail", { type: "email" })}
      ${field("Heslo (alespoň 8 znaků)", "password", { type: "password", ac: "new-password" })}
      ${field("Heslo znovu", "password2", { type: "password", ac: "new-password" })}
      ${field("PIN pro návrat od zákazníka (4 číslice)", "pin", { mode: "numeric", ac: "off" })}
      ${field("PIN znovu", "pin2", { mode: "numeric", ac: "off" })}
      <p class="hint">PIN zadáte, když vám zákazník vrátí telefon. Bez něj se do režimu řidiče nevrátíte.</p>`;
  } else if (step === 3) {
    body = `<div class="row2">${field("Jméno řidiče", "firstName")}${field("Příjmení", "lastName")}</div>
      ${field("Registrační značka", "rz")}<div class="row2">${field("Tovární značka", "make")}${field("Obchodní označení", "model")}</div>
      <h2>Doklady</h2>
      ${doc("Koncese dopravce (nepovinné)", `${field("Koncese (číslo, pokud ho máte u sebe)", "concessionNumber")}${field("Platnost koncese", "concessionUntil", { type: "date" })}`)}
      ${doc("Průkaz řidiče taxislužby (povinné)", `${field("Číslo oprávnění řidiče taxislužby", "licenceNumber")}${field("Platnost oprávnění", "licenceUntil", { type: "date" })}`, true)}
      ${doc("Evidence vozidla a nálepka (nepovinné)", `${field("Výpis z evidence vozidel taxislužby", "registryNote", { placeholder: "číslo nebo poznámka" })}`, true)}
      ${doc("Platná STK / emise (nepovinné)", `<p class="hint">Mějte ve vozidle platnou technickou a emisní kontrolu. Aplikace ji neukládá.</p>`)}
      ${doc("Povinné ručení pro taxi (nepovinné)", `<p class="hint">Pojištění odpovědnosti musí krýt provoz taxislužby. Aplikace ho neukládá.</p>`)}
      ${field("Jezdím bez taxametru, jen na elektronickou objednávku (§ 21 odst. 6). Vozidlo nemá střešní svítilnu ani nápis TAXI.", "noTaximeter", { type: "checkbox", defaultOn: true })}`;
  } else {
    const d = S.draft;
    body = `${card("Dopravce", `${esc(d.name || "")}<small>IČO ${esc(d.ico || "")} · ${esc([d.street, d.zip, d.city].filter(Boolean).join(", "))}</small>`, "c1")}
      ${card("Řidič a vozidlo", `${esc(d.firstName || "")} ${esc(d.lastName || "")}<small>${esc(d.make || "")} ${esc(d.model || "")} · ${esc(d.rz || "")}</small>`, "c2")}
      ${card("Přihlášení", esc(d.loginEmail || d.email || ""), "c3")}
      ${card("Stav registrace", S.backend.mode === "demo" ? "V demu hned aktivní" : "Po odeslání čeká na ověření", "c3")}
      <p class="hint">${S.backend.mode === "demo"
        ? "V demo režimu je registrace hned aktivní, ať jde jízdu vyzkoušet. Na serveru zůstane ve stavu Čeká na ověření, dokud ji správce neschválí."
        : "Po odeslání je stav Čeká na ověření. Jezdit půjde až po schválení správcem."}</p>
      ${field("Beru na vědomí, že aplikace je bezplatný nástroj, údaje o jízdách jsou neměnné a za přepravu odpovídám já jako dopravce.", "acceptPlatform", { type: "checkbox" })}
      <p class="hint">Evidence tržeb (EET 2.0) se při registraci nezapíná. Později ji lze přidat v profilu. Dokud je vypnutá, v jízdě ani v e-mailu se neobjeví.</p>`;
  }
  const next = skipAccountStep()
    ? ["", "Pokračovat na řidiče a vozidlo", "", "Pokračovat ke kontrole", "Odeslat registraci k ověření"][step]
    : ["", "Pokračovat na účet", "Pokračovat na řidiče a vozidlo", "Pokračovat ke kontrole", "Odeslat registraci k ověření"][step];
  const submitting = S.busy && step === 4;
  const backView = S.bundle?.me ? "incomplete" : "login";
  return shell(`Registrace / ${step} ze 4`, `
    <div class="steps" aria-hidden="true">${[1, 2, 3, 4].map((n) => `<span class="${n <= step ? "on" : ""}"></span>`).join("")}</div>
    <h1>${titles[step]}</h1>
    ${skipAccountStep() && step === 1 ? `<p class="hint">E-mail je potvrzený. Doplňte údaje dopravce. Pokud jste je zadávali v jiném zařízení, je potřeba je vyplnit znovu.</p>` : ""}
    ${body}
    <button type="button" class="btn xl" data-act="${step === 4 ? "reg-submit" : "reg-next"}" ${submitting ? "disabled" : ""}>${submitting ? "Odesílám…" : next}</button>
    ${submitting ? "" : (step > 1 ? `<button type="button" class="btn ghost" data-act="reg-back">Zpět</button>` : `<button type="button" class="btn ghost" data-act="go" data-view="${backView}">Zpět na přihlášení</button>`)}`);
}

function viewRegisterSent() {
  const email = S.regEmail || S.draft.loginEmail || S.draft.email || "";
  return shell("Registrace", `
    <h1>Registrace odeslána</h1>
    <p>Na e-mail <strong>${esc(email)}</strong> jsme poslali odkaz pro potvrzení. Klikněte na něj a pak se přihlaste – registrace se dokončí automaticky.</p>
    <p class="hint">Pokud e-mail nevidíte, zkontrolujte i složku spam.</p>
    <button type="button" class="btn xl" data-act="go" data-view="login">Zpět na přihlášení</button>`);
}

function viewFinishing() {
  return shell("Registrace", `
    <h1>Dokončuji registraci…</h1>
    <p class="hint">Ukládám údaje dopravce, řidiče a vozidla. Chvíli počkejte.</p>`);
}

function viewIncomplete() {
  const email = S.bundle?.me?.email || "";
  return shell("Dokončení registrace", `
    <h1>Dokončete registraci</h1>
    <p>Účet je potvrzený${email ? ` (${esc(email)})` : ""}, ale údaje dopravce, řidiče a vozidla ještě nejsou uložené.</p>
    <p class="hint">Pokud jste registraci začínali v tomto zařízení, údaje se doplní automaticky. Jinak je vyplňte znovu.</p>
    <button type="button" class="btn xl" data-act="continue-registration">Pokračovat v registraci</button>
    <button type="button" class="btn ghost" data-act="retry-pending">Zkusit znovu</button>
    <button type="button" class="btn ghost" data-act="logout">Odhlásit</button>`);
}

function viewSetPin() {
  return shell("Nastavení PIN", `
    <h1>Nastavte si PIN</h1>
    <p class="hint">PIN zadáte, když vám zákazník vrátí telefon. Jsou to 4 číslice.</p>
    ${field("PIN (4 číslice)", "pin", { mode: "numeric", ac: "off" })}
    ${field("PIN znovu", "pin2", { mode: "numeric", ac: "off" })}
    <button type="button" class="btn xl" data-act="save-first-pin"${S.busy ? " disabled" : ""}>${S.busy ? "Ukládám…" : "Uložit PIN"}</button>`);
}

function acceptedOffer(b) {
  return b.pending || b.offer;
}

function viewOffer() {
  const method = S.draft.paymentMethod || "hotovost";
  return shell("Režim řidiče", `
    <h1>Zadej trasu</h1>
    <label class="card c1 incard"><span class="lbl">Odkud</span><input data-field="from" value="${esc(S.draft.from || "")}" autocomplete="off"></label>
    <label class="card c2 incard"><span class="lbl">Kam</span><input data-field="to" value="${esc(S.draft.to || "")}" autocomplete="off"></label>
    <label class="card c3 incard"><span class="lbl">Dohodnutá konečná cena v Kč</span><input class="price-in" data-field="priceKc" inputmode="numeric" value="${esc(S.draft.priceKc || "")}" placeholder="850"></label>
    <h2>Způsob platby</h2>
    ${payOptions(method)}
    <p class="hint">Zákazník uvidí konečnou cenu a trasu ještě před objednáním. Jízdu nelze zahájit dřív.</p>
    <button type="button" class="btn xl" data-act="create-offer">Zkontrolovat nabídku</button>
    <button type="button" class="btn ghost" data-act="go" data-view="home">Zpět</button>`);
}

function viewHandoff() {
  const b = rideBy();
  if (!b) return viewHome();
  const offer = acceptedOffer(b);
  const change = !!b.pending;
  return shell(change ? "Změna nabídky" : "Režim řidiče", `
    <h1>${change ? "Změna čeká na zákazníka" : "Předej telefon"}</h1>
    ${change ? `<p class="old">Dosud platí ${formatKc(b.offer.priceKc)} · ${esc(b.offer.fromPlace)} → ${esc(b.offer.toPlace)}</p>` : ""}
    ${card("Odkud", esc(offer.fromPlace), "c1")}
    ${card("Kam", esc(offer.toPlace), "c2")}
    ${card("Dohodnutá konečná cena", `${formatKc(offer.priceKc)}<small>${esc(PAY_INFO[offer.paymentMethod]?.label || paymentLabel(offer.paymentMethod))}</small>`, "c3")}
    ${kontrolBox(b, "offer")}
    <p class="hint">${change ? "Nová cena a trasa začnou platit, až je zákazník znovu objedná. Do té doby platí původní objednávka." : "Stav: čeká na zákazníka. Objednávka ještě nevznikla. Telefon zamkne režim řidiče, zpět se dostanete PINem."}</p>
    <button type="button" class="btn xl" data-act="to-customer">Otevřít pro zákazníka</button>
    ${change ? `<button type="button" class="btn ghost" data-act="discard-change">Zrušit návrh změny</button>` : `<button type="button" class="btn ghost" data-act="go" data-view="ask-cancel">Zrušit nabídku</button>`}`);
}

function partyBlock(s) {
  return `<div class="infobox">
    <div><span>Dopravce</span><strong>${esc(s.carrierName)}</strong></div>
    <div><span>IČO</span><strong>${esc(s.ico)}</strong></div>
    <div><span>Sídlo</span><strong>${esc(s.sidlo)}</strong></div>
    <div><span>Řidič</span><strong>${esc(s.driverName)}</strong></div>
    <div><span>Vozidlo</span><strong>${esc(s.make)} ${esc(s.model)}</strong></div>
    <div><span>RZ</span><strong class="rz">${esc(s.rz)}</strong></div>
    ${s.email || s.phone ? `<div><span>Kontakt a reklamace</span><strong>${esc([s.email, s.phone].filter(Boolean).join(", "))}</strong></div>` : ""}
  </div>`;
}


function kontrolRow(label, value) {
  if (!value) return "";
  return `<div><span>${esc(label)}</span><strong>${value}</strong></div>`;
}

// Kompaktní přehled pro kontrolu objednávky (čas, dopravce, trasa, cena).
function kontrolBox(b, phase, full) {
  const offer = acceptedOffer(b) || b.offer;
  if (!offer) return "";
  const s = offer.snapshot || {};
  const ordered = phase === "ordered" && b.order;
  const timeLabel = ordered ? "Čas objednání" : "Čas vytvoření nabídky";
  const timeIso = ordered ? b.order.orderedAt : offer.serverCreatedAt;
  const timeSrc = ordered ? b.order.timeSource : offer.timeSource;
  const pay = PAY_INFO[offer.paymentMethod]?.label || paymentLabel(offer.paymentMethod);
  return `<div class="kontrol" aria-label="Kontrolní údaje">
    <h2>Kontrolní údaje</h2>
    ${kontrolRow(timeLabel, esc(formatWhen(timeIso, timeSrc)))}
    ${ordered && b.order.orderNumber ? kontrolRow("Číslo objednávky", esc(b.order.orderNumber)) : ""}
    ${kontrolRow("Dopravce", esc(s.carrierName || ""))}
    ${kontrolRow("IČO", esc(s.ico || ""))}
    ${full ? kontrolRow("Sídlo", esc(s.sidlo || "")) : ""}
    ${kontrolRow("Řidič", esc(s.driverName || ""))}
    ${full ? kontrolRow("Vozidlo", esc([s.make, s.model].filter(Boolean).join(" "))) : ""}
    ${kontrolRow("SPZ vozidla", s.rz ? `<span class="rz">${esc(s.rz)}</span>` : "")}
    ${full && (s.email || s.phone) ? kontrolRow("Kontakt a reklamace", esc([s.email, s.phone].filter(Boolean).join(", "))) : ""}
    ${kontrolRow("Trasa", `${esc(offer.fromPlace || "")} → ${esc(offer.toPlace || "")}`)}
    ${kontrolRow("Dohodnutá konečná cena", formatKc(offer.priceKc))}
    ${kontrolRow("Způsob platby", esc(pay || ""))}
  </div>`;
}

// Aktuální podmínky: z databáze (vzdálený režim), jinak z js/terms.js.
function currentTerms() {
  const id = S.bundle?.termsVersion || TERMS_VERSION;
  const known = TERMS_VERSIONS[id];
  const body = S.bundle?.terms?.length ? S.bundle.terms : (known?.body || TERMS_PARAS);
  const label = known?.label || S.bundle?.termsTitle || `verze ${id}`;
  const validFrom = S.bundle?.termsValidFrom || known?.validFrom || "";
  return { id, body, label, validFrom, title: known?.title || "Obchodní podmínky" };
}

function termsHead(t) {
  return `<div class="termshead">
    <p class="termsver">${esc(t.title)}</p>
    <p class="termsmeta">${esc(t.label)}${t.validFrom ? ` <span>|</span> platí pro objednávky od ${esc(t.validFrom)}` : ""}</p>
  </div>`;
}

// QR kód a adresa veřejné stránky s podmínkami: zákazník si je uloží do svého telefonu.
function termsSave() {
  const url = new URL(TERMS_PAGE, location.href).href;
  return `<div class="termssave">
    <img src="qr-podminky.png" width="132" height="132" alt="QR kód s odkazem na obchodní podmínky">
    <div><strong>Uložit podmínky do svého telefonu</strong>
      <span>Naskenujte QR kód. Stránka obsahuje jen podmínky a jde uložit nebo vytisknout.</span>
      <span class="url">${esc(url.replace(/^https:\/\//, ""))}</span></div>
  </div>`;
}

function privacyDetails() {
  return `<details class="privacy"><summary>Informace o zpracování osobních údajů</summary>
    ${PRIVACY_PARAS.map((p) => `<h3>${esc(p.h)}</h3><p>${esc(p.p)}</p>`).join("")}</details>`;
}

function termsInline() {
  const t = currentTerms();
  return `<h2 class="sec">Obchodní podmínky</h2>
    ${termsHead(t)}
    <div class="terms-box" tabindex="0" role="region" aria-label="Obchodní podmínky, ${esc(t.label)}">${termsHtml(t.body, esc)}</div>
    <button type="button" class="btn ghost" data-act="show-terms" data-back="order">Číst podmínky na celé obrazovce</button>
    ${termsSave()}
    <p class="hint">Celé znění podmínek vám přijde také e-mailem spolu s potvrzením o přepravě.</p>
    ${privacyDetails()}`;
}

function viewCustomer() {
  const b = rideBy();
  const offer = acceptedOffer(b);
  return shell("Režim zákazníka", `
    <h1>Vaše jízda</h1>
    <p class="route">${esc(offer.fromPlace)} → ${esc(offer.toPlace)}</p>
    <div class="price">${formatKc(offer.priceKc)}</div>
    <p class="pricemeta">Konečná cena <span>|</span> ${esc(PAY_INFO[offer.paymentMethod]?.label || paymentLabel(offer.paymentMethod))}</p>
    ${kontrolBox(b, "offer", true)}
    ${offer.version > 1 ? `<div class="alert wait">Toto je změna oproti původní objednávce. Bez vašeho souhlasu platí původní cena a trasa.</div>` : ""}
    <button type="button" class="btn xl" data-act="go" data-view="order">Pokračovat k objednávce</button>
    <button type="button" class="btn ghost" data-act="show-terms" data-back="customer">Celý text podmínek a údajů</button>
    <button type="button" class="btn ghost" data-act="to-pin">Vrátit telefon řidiči</button>`);
}

function viewOrder() {
  const b = rideBy();
  const offer = acceptedOffer(b);
  const ready = S.draft.consentTerms === true && S.draft.consentPrice === true && validEmail(S.draft.email);
  const ordering = S.busy && S.busyAct === "place-order";
  const orderLabel = `Objednávám jízdu za ${formatKc(offer.priceKc)}`;
  return shell("Potvrzení objednávky", `
    <h1>Objednávka jízdy</h1>
    <p class="route">${esc(offer.fromPlace)} → ${esc(offer.toPlace)}</p>
    <div class="price sm">${formatKc(offer.priceKc)}</div>
    ${kontrolBox(b, "offer", true)}
    <form data-act="place-order" autocomplete="off">
      <label>E-mail pro potvrzení<input class="light-in" type="email" data-field="email" inputmode="email" autocomplete="email" value="${esc(S.draft.email || "")}" placeholder="vas@email.cz"></label>
      <p class="hint">E-mail si zkontrolujte. Po objednání už nejde přepsat.</p>
      <label class="consent"><input type="checkbox" data-field="consentTerms" ${S.draft.consentTerms ? "checked" : ""}><span>Souhlasím s obchodními podmínkami</span></label>
      <label class="consent"><input type="checkbox" data-field="consentPrice" ${S.draft.consentPrice ? "checked" : ""}><span>Souhlasím se smluvní cenou a danou trasou přepravy</span></label>
      <p class="paynote">Klepnutím na tlačítko objednáváte placenou přepravu. Vzniká vám povinnost zaplatit konečnou cenu ${formatKc(offer.priceKc)}.</p>
      <p class="hint" id="order-need">${ready ? "" : "Tlačítko se zpřístupní po vyplnění e-mailu a zaškrtnutí obou souhlasů."}</p>
      <button class="btn xl" id="order-btn" type="submit" ${ready && !S.busy ? "" : "disabled"}>${ordering ? spinLabel("Ukládám objednávku…") : orderLabel}</button>
    </form>
    <p class="hint">Celé obchodní podmínky si před souhlasem přečtěte v rámečku níže, nebo je otevřete na celé obrazovce.</p>
    ${termsInline()}
    <button type="button" class="btn ghost" data-act="go" data-view="customer">Zpět na kontrolu</button>
    <p class="hint">Objednávka se uloží s časem serveru ještě před zahájením jízdy. Bez ní jízdu nelze zahájit.</p>`);
}

function viewTerms() {
  const t = currentTerms();
  return shell(S.customerLock ? "Režim zákazníka" : "Obchodní podmínky", `
    <h1>Obchodní podmínky</h1>
    ${termsHead(t)}
    <div class="terms">${termsHtml(t.body, esc)}</div>
    ${termsSave()}
    ${privacyDetails()}
    <button type="button" class="btn" data-act="go" data-view="${esc(S.termsBack || "order")}">Zpět</button>`);
}

function viewPin() {
  const n = (S.draft.pin || "").length;
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  const checking = S.busy && S.busyAct === "check-pin";
  return shell("PIN řidiče", `
    <h1>Zpět pro řidiče</h1>
    <p class="hint">${checking ? "Ověřuji PIN…" : "Pro návrat do režimu řidiče zadejte čtyřmístný PIN."}</p>
    <div class="dots${S.pinShake ? " shake" : ""}" aria-label="Zadané číslice">${[0, 1, 2, 3].map((i) => `<span class="${i < n ? "on" : ""}"></span>`).join("")}</div>
    <div class="pad">${keys.map((k) => k === "" ? "<span></span>" : `<button type="button" class="key" data-act="pin-key" data-key="${k === "⌫" ? "del" : k}" aria-label="${k === "⌫" ? "Smazat" : k}" ${checking ? "disabled" : ""}>${k}</button>`).join("")}</div>`);
}

function viewReady() {
  const b = rideBy();
  const s = b.offer.snapshot;
  return shell("Před zahájením jízdy", `
    <h1>Jízda objednána</h1>
    ${card("Číslo objednávky", esc(b.order?.orderNumber || ""), "c1")}
    ${card("Potvrzeno zákazníkem", esc(formatWhen(b.order.orderedAt, b.order.timeSource)), "c2")}
    ${card("Dohodnutá konečná cena", `${formatKc(b.offer.priceKc)}<small>${esc(b.offer.fromPlace)} → ${esc(b.offer.toPlace)} · ${esc(PAY_INFO[b.offer.paymentMethod]?.label || paymentLabel(b.offer.paymentMethod))}</small>`, "c3")}
    ${partyBlock(s)}
    ${kontrolBox(b, "ordered")}
    ${b.pending ? `<div class="alert wait">Čeká souhlas zákazníka se změnou. Jízdu zatím nespouštějte.</div><button type="button" class="btn" data-act="go" data-view="handoff">Předejte telefon znovu</button>` : `<button type="button" class="btn xl go" data-act="start-ride">Začít jízdu</button>`}
    <button type="button" class="btn ghost" data-act="go-change">Změnit trasu nebo cenu</button>
    <button type="button" class="btn ghost" data-act="go" data-view="ask-cancel">Zrušit před jízdou</button>`);
}

function viewRiding() {
  const b = rideBy();
  return shell("Režim řidiče", `
    <h1>Probíhá jízda</h1>
    ${card("Trasa", `${esc(b.offer.fromPlace)} → ${esc(b.offer.toPlace)}`, "c1")}
    ${card("Dohodnutá konečná cena", formatKc(b.offer.priceKc), "c2")}
    ${card("Začátek jízdy", `${esc(formatWhen(b.ride.startedAt, b.ride.timeSource))}<small class="clock" id="clock"></small>`, "c3")}
    ${b.pending ? `<div class="alert wait">Změna ještě není potvrzená. Platí původní cena ${formatKc(b.offer.priceKc)}.</div><button type="button" class="btn" data-act="go" data-view="handoff">Předejte telefon ke souhlasu</button>` : ""}
    <button type="button" class="btn xl" data-act="go" data-view="end-ask">Ukončit jízdu</button>
    <button type="button" class="btn ghost" data-act="go-change">Změnit trasu nebo cenu</button>`);
}

function viewEndAsk() {
  return shell("Režim řidiče", `
    <h1>Opravdu ukončit jízdu?</h1>
    <p class="hint">Po ukončení se vystaví potvrzení o přepravě. Čas ukončení je čas serveru a nejde ho přepsat.</p>
    <button type="button" class="btn xl stop" data-act="end-ride">Ano, ukončit jízdu</button>
    <button type="button" class="btn ghost" data-act="go" data-view="riding">Ne, pokračovat</button>`);
}

function viewPay() {
  const b = rideBy();
  const method = b.payment.method;
  const texts = {
    hotovost: "Až zákazník předá hotovost, potvrďte převzetí.",
    karta: "Platba kartou se v této verzi jen zaznamená. Terminál si obsluhujete sami. Až je platba provedená, označte ji.",
    qr: "QR platba se v této verzi jen zaznamená. Převod si hlídáte na účtu. Až peníze dorazí, označte platbu.",
    faktura: "Fakturu vystavíte mimo aplikaci. Až úhradu zaznamenáte, označte ji tady.",
  };
  return shell("Po dokončení přepravy", `
    <h1>Úhrada jízdy</h1>
    <p class="badge wait">Čeká na platbu</p>
    <div class="price">${formatKc(b.payment.amountKc)}</div>
    ${card("Způsob platby", `${esc(PAY_INFO[method]?.label || paymentLabel(method))}<small>${esc(PAY_INFO[method]?.sub || "")}</small>`, "c3")}
    ${kontrolBox(b, "ordered")}
    <p class="hint">${texts[method] || ""} Způsob platby je daný objednávkou a nejde ho už změnit.</p>
    <button type="button" class="btn xl" data-act="mark-paid">${method === "hotovost" ? "Hotovost převzata" : "Označit jako zaplaceno"}</button>`);
}

function eetBlock(eet) {
  if (!eet) return "";
  if (eet.pok) {
    return `<div class="eet"><p>EET zkušební kód</p><strong>${esc(eet.pok)}</strong><p class="hint">Není to kód z Finanční správy. Napojení se připravuje.</p></div>`;
  }
  if (eet.status === "queued") return `<div class="alert wait">EET čeká na odeslání. Potvrzení o přepravě na tom nezávisí.</div>`;
  if (eet.error) return `<div class="alert wait">${esc(eet.error)}</div>`;
  return `<div class="alert wait">EET je zapnuté, kód zatím není. Jízda tím není blokovaná.</div>`;
}

function viewConfirm() {
  const b = rideBy();
  if (!b?.confirmation) return viewHome();
  const view = confirmationView(S.bundle.db, b.confirmation);
  const email = emailStatusView(b.delivery);
  const paid = b.payment?.status === "paid";
  const tone = email.kind === "sent" ? "ok" : email.kind === "failed" ? "bad" : "wait";
  const at = b.delivery?.attemptedAt ? pragueParts(b.delivery.attemptedAt).time : "";
  return shell("Potvrzení o přepravě", `
    <h1>Jízda dokončena</h1>
    <p class="badge ${paid ? "ok" : "wait"}">${paid ? "Zaplaceno" : "Čeká na platbu"}</p>
    <div class="infobox mail ${tone}" id="email-status"><div><span>${email.kind === "sent" ? "E-mail odeslán" : email.kind === "failed" ? "E-mail neodešel" : "E-mail"}${at ? ` | ${esc(at)}` : ""}</span><strong>${esc(b.confirmation.customerEmail || b.delivery?.to || "")}</strong></div>${email.kind === "sent" ? "" : `<p>${esc(email.text)}</p>`}</div>
    ${email.kind === "sent" ? "" : `<button type="button" class="btn" data-act="resend-email">Odeslat znovu</button>`}
    ${kontrolBox(b, "ordered")}
    <dl class="infobox">${view.lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <p class="hint">Vystaveno ${esc(formatWhen(b.confirmation.createdAt, b.confirmation.timeSource))}. Záznam je neměnný.</p>
    ${eetBlock(view.eet)}
    <button type="button" class="btn xl" data-act="go" data-view="home">Domů</button>
    <button type="button" class="btn ghost" data-act="go" data-view="history">Otevřít detail / export</button>`);
}

function viewInspect() {
  const today = pragueParts(new Date().toISOString()).key;
  const rows = S.bundle.rides.filter((r) => r.confirmation && pragueParts(r.confirmation.createdAt).key === today);
  return shell("Pro kontrolu", `
    <h1>Dnešní potvrzení</h1>
    <p class="hint">Potvrzení o přepravě má být u řidiče k nahlédnutí po zbytek dne.</p>
    ${rows.length ? rows.map((r) => `<button type="button" class="card-btn c1" data-act="open-ride" data-id="${r.ride.id}"><span class="lbl">Evidenční číslo</span><strong>${esc(r.confirmation.evidencniCislo)}</strong><span>${esc(r.offer.fromPlace)} → ${esc(r.offer.toPlace)}</span><span class="accent">${formatKc(r.offer.priceKc)}</span></button>`).join("") : `<p class="empty">Dnes není žádné potvrzení k předložení.</p>`}
    <button type="button" class="btn ghost" data-act="go" data-view="home">Domů</button>`);
}

function viewHistory() {
  const month = S.draft.historyMonth || pragueParts(new Date().toISOString()).key.slice(0, 7);
  const rows = S.bundle.rides.filter((r) => r.confirmation && pragueParts(r.confirmation.createdAt).key.startsWith(month));
  const sums = paymentSums(rows);
  return shell("Režim řidiče", `
    <h1>Historie jízd</h1>
    <label>Měsíc<input type="month" data-field="historyMonth" value="${esc(month)}"></label>
    <div class="sumgrid">
      ${card("Hotovost", formatKc(sums.hotovost || 0), "c1")}
      ${card("Karta", formatKc(sums.karta || 0), "c2")}
      ${card("QR", formatKc(sums.qr || 0), "c3")}
      ${card("Faktura", formatKc(sums.faktura || 0), "c1")}
    </div>
    ${card("Z toho zaplaceno", formatKc(sums.paid || 0), "c2")}
    ${rows.length ? rows.map(rideCard).join("") : `<p class="empty">V tomto měsíci není žádné potvrzení.</p>`}
    <button type="button" class="btn" data-act="export-csv">Export CSV</button>
    <p class="hint">Soubor je oddělený středníkem, aby ho otevřel český Excel. Potvrzení se nemažou, uchování je nejméně 3 roky.</p>
    <button type="button" class="btn ghost" data-act="go" data-view="home">Domů</button>`);
}

function viewProfile() {
  if (!canShowDriverHome(S.bundle) && S.bundle?.me?.role !== "admin") return viewIncomplete();
  const b = S.bundle;
  if (!S.draft._profile) {
    Object.assign(S.draft, {
      _profile: 1, name: b.carrier.name, dic: b.carrier.dic, vatPayer: b.carrier.vatPayer,
      street: b.carrier.street, city: b.carrier.city, zip: b.carrier.zip, iban: b.carrier.iban,
      email: b.carrier.email, phone: b.carrier.phone, firstName: b.driver.firstName, lastName: b.driver.lastName,
      licenceNumber: b.driver.licenceNumber, licenceUntil: (b.driver.licenceUntil || "").slice(0, 10),
      rz: b.vehicle.rz, make: b.vehicle.make, model: b.vehicle.model, registryNote: b.vehicle.registryNote || "",
      eetEnabled: !!b.eet.enabled, dicEic: b.eet.dicEic || "", evidencniJednotka: b.eet.evidencniJednotka || "",
      zarizeni: b.eet.zarizeni || "SVEZEMETE-1", simulateOffline: !!b.eet.simulateOffline,
    });
  }
  const eetOn = S.draft.eetEnabled === true;
  return shell("Režim řidiče", `
    <h1>Můj profil</h1>
    ${card("IČO", esc(b.carrier.ico), "c1")}
    ${card("Stav registrace", esc(STATUS_CARRIER[b.carrier.status] || ""), "c3")}
    <p class="hint">Úpravy profilu nemění už uložené nabídky a potvrzení. Ty zůstávají, jak je zákazník viděl.</p>
    <h2>Údaje dopravce</h2>
    ${field("Jméno nebo firma", "name")}${field("DIČ", "dic")}${field("Plátce DPH", "vatPayer", { type: "checkbox" })}
    ${field("Ulice", "street")}<div class="row2">${field("PSČ", "zip")}${field("Město", "city")}</div>
    ${field("IBAN", "iban")}${field("E-mail", "email", { type: "email" })}${field("Telefon", "phone")}
    <h2>Řidič a vozidlo</h2>
    <div class="row2">${field("Jméno řidiče", "firstName")}${field("Příjmení", "lastName")}</div>
    ${field("Oprávnění řidiče taxislužby", "licenceNumber")}${field("Platnost", "licenceUntil", { type: "date" })}
    ${field("RZ", "rz")}<div class="row2">${field("Značka", "make")}${field("Model", "model")}</div>
    <button type="button" class="btn" data-act="save-profile">Uložit profil</button>
    <h2>Nový PIN</h2>
    ${field("Nový PIN", "newPin", { mode: "numeric" })}${field("Nový PIN znovu", "newPin2", { mode: "numeric" })}
    <button type="button" class="btn ghost" data-act="save-pin">Změnit PIN</button>
    <h2>Evidence tržeb (EET 2.0)</h2>
    <label class="consent"><input type="checkbox" data-field="eetEnabled" ${eetOn ? "checked" : ""}><span>Zapnout evidenci tržeb</span></label>
    ${eetOn ? `
      <p class="hint">Vyplňte svoje údaje z DIS+. Dokud evidenci nezapnete, v jízdě, platbě ani v e-mailu se neobjeví. Zapnutí nic neblokuje.</p>
      <div class="alert wait">Napojení na Finanční správu je zatím jen příprava. Zpráva se nikam neodesílá, vznikne jen zkušební kód nebo záznam ve frontě.</div>
      ${field("DIČ / EIČ", "dicEic")}${field("Evidenční jednotka (vozidlo)", "evidencniJednotka")}${field("Označení pokladního zařízení", "zarizeni")}
      <label>Certifikát .p12<input id="cert-file" type="file" accept=".p12,application/x-pkcs12"></label>
      <p class="hint">${b.eet.certUploaded ? `Uložený soubor: ${esc(b.eet.certFilename || "certifikát")}` : "Certifikát zatím není nahraný."} ${S.backend.mode === "demo" ? "V demo režimu se soubor ani heslo neukládají." : "Na serveru se soubor i heslo uloží šifrovaně a řidič je zpět neuvidí."}</p>
      ${field("Heslo certifikátu", "certPassword", { type: "password", ac: "off" })}
      <label class="consent"><input type="checkbox" data-field="simulateOffline" ${S.draft.simulateOffline ? "checked" : ""}><span>Zkouška offline fronty (nevracet kód, jen zařadit)</span></label>
      <button type="button" class="btn" data-act="save-eet">Uložit nastavení EET</button>
      ${queuedEet() ? `<button type="button" class="btn ghost" data-act="flush-eet">Odeslat čekající EET (zkušební)</button>` : ""}
    ` : `<p class="hint">Evidence je vypnutá. Jízdy, platby ani e-maily ji nepoužívají. Až budete mít údaje z DIS+ a pokladní certifikát, zapněte ji tady.</p>`}
    ${S.backend.mode === "demo" ? `<button type="button" class="btn ghost" data-act="go" data-view="reset-ask">Smazat demo data v tomto prohlížeči</button>` : ""}
    <button type="button" class="btn ghost" data-act="go" data-view="home">Domů</button>`);
}

function viewChange() {
  const b = rideBy();
  const method = S.draft.paymentMethod || b.offer.paymentMethod;
  return shell("Změna nabídky", `
    <h1>Změnit trasu nebo cenu</h1>
    <p class="old">Teď platí ${formatKc(b.offer.priceKc)} · ${esc(b.offer.fromPlace)} → ${esc(b.offer.toPlace)}</p>
    <label class="card c1 incard"><span class="lbl">Odkud</span><input data-field="from" value="${esc(S.draft.from || b.offer.fromPlace)}"></label>
    <label class="card c2 incard"><span class="lbl">Kam</span><input data-field="to" value="${esc(S.draft.to || b.offer.toPlace)}"></label>
    <label class="card c3 incard"><span class="lbl">Nová konečná cena v Kč</span><input class="price-in" data-field="priceKc" inputmode="numeric" value="${esc(S.draft.priceKc || b.offer.priceKc)}"></label>
    <h2>Způsob platby</h2>
    ${payOptions(method)}
    <p class="hint">Původní objednávka zůstane uložená. Nová cena začne platit, až ji zákazník znovu objedná.</p>
    <button type="button" class="btn xl" data-act="save-change">Předat zákazníkovi ke souhlasu</button>
    <button type="button" class="btn ghost" data-act="open-ride" data-id="${b.ride.id}">Zpět</button>`);
}

function viewAskCancel() {
  return shell("Režim řidiče", `
    <h1>Opravdu zrušit?</h1>
    <p class="hint">Jízda ještě nezačala. Záznam zrušení zůstane, nesmaže se.</p>
    <button type="button" class="btn xl stop" data-act="cancel-ride">Ano, zrušit</button>
    <button type="button" class="btn ghost" data-act="open-ride" data-id="${S.rideId}">Ne</button>`);
}

function viewReset() {
  return shell("Demo data", `
    <h1>Smazat demo data?</h1>
    <p class="hint">Smaže se jen obsah tohoto prohlížeče. Na žádný server se nic neposlalo.</p>
    <button type="button" class="btn xl stop" data-act="reset-demo">Ano, smazat demo</button>
    <button type="button" class="btn ghost" data-act="go" data-view="profile">Ne</button>`);
}

function viewAdmin() {
  const a = S.bundle.admin;
  return shell("Režim správce", `
    <h1>Správce platformy</h1>
    <p class="hint">Vidíte všechny dopravce. Každý řidič ve své aplikaci vidí jen svoje jízdy.</p>
    <h2>Registrace</h2>
    ${a.carriers.length ? a.carriers.map((c) => `<div class="card-btn c3" style="cursor:default">
      <strong>${esc(c.name)}</strong>
      <span>IČO ${esc(c.ico)} · <span class="accent">${esc(STATUS_CARRIER[c.status] || c.status)}</span></span>
      <span>${esc(c.driver ? `${c.driver.firstName} ${c.driver.lastName}` : "")} · ${esc(c.vehicle?.rz || "")}</span>
      <span>EET: ${c.eet?.enabled ? "zapnuto" : "vypnuto"}</span>
      ${c.status !== "active" ? `<button type="button" class="btn" data-act="set-status" data-id="${c.id}" data-status="active">Schválit</button>` : ""}
      ${c.status !== "suspended" ? `<button type="button" class="btn ghost" data-act="set-status" data-id="${c.id}" data-status="suspended">Pozastavit</button>` : ""}
    </div>`).join("") : `<p class="empty">Zatím žádný dopravce.</p>`}
    <h2>Jízdy</h2>
    ${S.bundle.rides.slice(0, 20).map(rideCard).join("") || `<p class="empty">Žádné jízdy.</p>`}
    <h2>Chyby e-mailů</h2>
    ${a.failed.length ? a.failed.map((d) => `<p>${esc(d.to)} · ${esc(d.error || "chyba")}</p>`).join("") : `<p class="empty">Žádná chyba odeslání.</p>`}
    <h2>Audit</h2>
    <p class="hint">Poslední záznamy. Hesla, PIN ani certifikát se sem neukládají.</p>
    ${(a.audit || []).slice(0, 15).map((e) => `<p>${esc(pragueParts(e.ts).both)} · ${esc(e.table)} · ${esc(e.op)}</p>`).join("") || `<p class="empty">Zatím prázdné.</p>`}
    <p class="hint">Platné obchodní podmínky: ${esc(currentTerms().label)} (id ${esc(currentTerms().id)}). Starší verze se nemění, objednávka si pamatuje tu, kterou zákazník viděl.</p>`, true);
}

function render() {
  try {
  document.body.classList.toggle("light", !S.night);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", S.night ? "#07070c" : "#f4f5fb");
  const view = viewNow();
  const screens = {
    boot: () => shell("Načítání", "<h1>Načítám…</h1>"),
    unconfigured: viewUnconfigured,
    login: viewLogin,
    forgot: viewForgot,
    "new-password": viewNewPassword,
    register: viewRegister,
    "register-sent": viewRegisterSent,
    finishing: viewFinishing,
    incomplete: viewIncomplete,
    "set-pin": viewSetPin,
    home: viewHome,
    offer: viewOffer,
    quick: viewQuick,
    price: viewPrice,
    handoff: viewHandoff,
    customer: viewCustomer,
    order: viewOrder,
    terms: viewTerms,
    pin: viewPin,
    ready: viewReady,
    riding: viewRiding,
    "end-ask": viewEndAsk,
    pay: viewPay,
    confirm: viewConfirm,
    inspect: viewInspect,
    history: viewHistory,
    profile: viewProfile,
    change: viewChange,
    "ask-cancel": viewAskCancel,
    "reset-ask": viewReset,
  };
  const html = (screens[view] || viewLogin)();
    if (!html) throw new Error("Obrazovka je prázdná.");
    $("app").innerHTML = html;
    armClock();
  } catch (err) {
    console.error(err);
    const app = $("app");
    if (!app) return;
    app.innerHTML = `<div class="app"><header>
      <div class="brand"><div class="mark" aria-hidden="true">S</div><div class="nm">SvezemeTě</div></div>
    </header><div class="rule" aria-hidden="true"></div><main>
      <p class="mode">Chyba</p>
      <h1>Obrazovka se nenačetla</h1>
      <p class="hint">${esc(asCzechError(err))}</p>
      <button type="button" class="btn xl" data-act="retry-boot">Zkusit znovu</button>
      <button type="button" class="btn ghost" data-act="logout">Odhlásit</button>
    </main></div>`;
  }
}

let clockTimer;
function armClock() {
  clearInterval(clockTimer);
  const el = $("clock");
  const b = rideBy();
  if (!el || !b?.ride.startedAt) return;
  const tick = () => {
    const sec = Math.max(0, Math.floor((Date.now() - new Date(b.ride.startedAt).getTime()) / 1000));
    el.textContent = `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, "0")} s`;
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

function openRide(id) {
  S.customerLock = false;
  S.rideId = id;
  const b = rideBy(id);
  if (!b) return go("home");
  if (b.ride.status === "awaiting_customer") return go("handoff");
  if (b.ride.status === "ordered") return go("ready");
  if (b.ride.status === "in_progress") return go("riding");
  if (b.ride.status === "completed" && !b.delivery) return go("pay");
  if (b.ride.status === "completed") return go("confirm");
  return go("home");
}

function numPrice(v) {
  return Math.round(Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")));
}

async function run(act, el) {
  const lock = !["pin-key", "toggle-night"].includes(act);
  if (lock && S.busy) return;
  if (lock) pullDraft();
  if (lock) S.error = "";
  if (lock && act !== "ares") S.info = "";
  if (lock && !["reg-next", "reg-submit"].includes(act)) S.fieldErrors = {};
  if (lock) {
    S.busy = true;
    S.busyAct = act;
    showBusy(el, act);
  }
  try {
    await actions[act]?.(el);
  } catch (err) {
    console.error(err);
    S.error = asCzechError(err);
    render();
  } finally {
    if (lock) {
      S.busy = false;
      S.busyAct = "";
      const stillHere = el && document.body.contains(el);
      if (stillHere || ["register", "set-pin", "finishing", "incomplete", "login", "order", "pin"].includes(S.view)) render();
    }
  }
}

const actions = {
  async "toggle-night"() {
    S.night = !S.night;
    localStorage.setItem("svezemete.theme", S.night ? "dark" : "light");
    render();
  },
  async go(el) {
    const view = el.dataset.view;
    if (view === "order" && S.view === "customer") {
      S.draft.consentTerms = false;
      S.draft.consentPrice = false;
    }
    if (view === "profile") delete S.draft._profile;
    go(view);
  },
  async "go-register"() { S.regStep = 1; S.draft = { noTaximeter: true }; S.fieldErrors = {}; go("register"); },
  async "go-forgot"() { go("forgot", { keepDraft: true }); },
  async "forgot-send"() {
    const email = String(S.draft.loginEmail || "").trim();
    if (!email) throw new Error("Vyplňte e-mail.");
    if (!validEmail(email)) throw new Error("Zadejte platný e-mail.");
    await S.backend.resetPassword(email);
    S.info = "Pokud je účet založený, poslali jsme odkaz k nastavení nového hesla. Zkontrolujte schránku.";
    go("login", { keepDraft: true });
  },
  async "set-new-password"() {
    const password = String(S.draft.password || "");
    const password2 = String(S.draft.password2 || "");
    if (password.length < 8) throw new Error("Heslo musí mít alespoň 8 znaků.");
    if (password !== password2) throw new Error("Hesla se neshodují.");
    await S.backend.updatePassword(password);
    clearRecovering();
    if (location.hash) history.replaceState(null, "", appBaseUrl());
    S.draft = {};
    S.info = "Nové heslo je uložené. Můžete se přihlásit.";
    await S.backend.logout();
    S.bundle = null;
    go("login");
  },
  async "cancel-recovery"() {
    clearRecovering();
    if (location.hash) history.replaceState(null, "", appBaseUrl());
    await S.backend.logout();
    S.bundle = null;
    S.draft = {};
    go("login");
  },
  async "go-offer"() {
    if (S.backend.mode !== "demo" && S.bundle?.carrier?.status !== "active") {
      throw new Error("Účet čeká na ověření. Jízdu založíte až po schválení správcem.");
    }
    S.draft = { paymentMethod: "hotovost", from: S.view === "quick" ? (S.draft.from || "") : "" };
    go("offer");
  },
  async "go-quick"() {
    if (S.backend.mode !== "demo" && S.bundle?.carrier?.status !== "active") {
      throw new Error("Účet čeká na ověření. Jízdu založíte až po schválení správcem.");
    }
    S.draft = { paymentMethod: "hotovost", from: lastStart() };
    go("quick");
  },
  async "pick-fav"(el) {
    const f = favouriteRoutes()[Number(el.dataset.i)];
    if (!f) return;
    // Nástup z obrazovky (pokud ho řidič upravil) má přednost před uloženou trasou.
    const from = String(S.draft.from || "").trim();
    S.draft = { from: from || f.from, to: f.to, priceKc: String(f.price), paymentMethod: f.method || "hotovost" };
    go("price");
  },
  async "quick-other"() {
    S.draft = { from: S.draft.from || "", to: "", priceKc: "", paymentMethod: S.draft.paymentMethod || "hotovost" };
    go("price");
    const el = document.querySelector('[data-field="from"]')?.value ? document.querySelector('[data-field="to"]') : document.querySelector('[data-field="from"]');
    el?.focus();
  },
  async "pick-pay"(el) {
    S.draft.paymentMethod = el.dataset.method;
    render();
  },
  async "go-change"() { S.draft = {}; go("change"); },
  async "fill-demo"() {
    const { ...rest } = SAMPLE;
    Object.assign(S.draft, rest);
    delete S.draft.acceptPlatform;
    S.info = "Ukázkové údaje jsou vyplněné. Heslo je demo1234 a PIN je 1234. Můžete je změnit.";
    render();
  },
  async "reg-next"() {
    const fields = registrationFieldErrors(S.draft, S.regStep, { skipAccount: skipAccountStep() });
    if (Object.keys(fields).length) { showStepErrors(fields); return; }
    S.fieldErrors = {};
    if (S.regStep === 1 && !S.draft.loginEmail) S.draft.loginEmail = S.draft.email;
    S.regStep += 1;
    if (skipAccountStep() && S.regStep === 2) S.regStep = 3;
    go("register", { keepDraft: true });
  },
  async "reg-back"() {
    S.fieldErrors = {};
    S.regStep = Math.max(1, S.regStep - 1);
    if (skipAccountStep() && S.regStep === 2) S.regStep = 1;
    go("register", { keepDraft: true });
  },
  async "reg-submit"() {
    const opts = { skipAccount: skipAccountStep() };
    for (const n of [1, 2, 3, 4]) {
      const fields = registrationFieldErrors(S.draft, n, opts);
      if (Object.keys(fields).length) {
        S.regStep = n;
        showStepErrors(fields);
        return;
      }
    }
    S.fieldErrors = {};
    const result = await S.backend.register({ ...S.draft });
    if (result?.pendingConfirm) {
      S.regEmail = result.email;
      S.regStep = 1;
      go("register-sent", { keepDraft: true });
      return;
    }
    S.bundle = result;
    S.draft = {};
    S.regStep = 1;
    if (!recordsReady(S.bundle)) { go("incomplete"); return; }
    if (S.bundle.driver && S.bundle.driver.hasPin === false) { go("set-pin"); return; }
    S.info = S.bundle.carrier.status === "active" ? "Registrace je hotová. Můžete zadat první jízdu." : "Registrace čeká na ověření správcem.";
    go("home");
  },
  async login() {
    const email = String(S.draft.loginEmail || "").trim();
    const password = String(S.draft.password || "");
    if (!email || !password) throw new Error("Vyplňte e-mail a heslo.");
    if (!validEmail(email)) throw new Error("Zadejte platný e-mail.");
    S.bundle = await S.backend.login(email, password);
    S.draft = {};
    goAfterLogin();
  },
  async "continue-registration"() {
    const email = S.bundle?.me?.email || "";
    S.regStep = 1;
    S.draft = { ...(readPending() || {}), noTaximeter: true, email: S.draft.email || email, loginEmail: S.draft.loginEmail || email };
    delete S.draft.password;
    delete S.draft.password2;
    S.fieldErrors = {};
    go("register", { keepDraft: true });
  },
  async "retry-pending"() {
    await finishSessionRegistration();
  },
  async "retry-boot"() {
    S.error = "";
    await finishSessionRegistration();
  },
  async "save-first-pin"() {
    const pin = String(S.draft.pin || "");
    const pin2 = String(S.draft.pin2 || "");
    if (!pin) throw new Error("Vyplňte PIN.");
    if (!/^\d{4}$/.test(pin)) throw new Error("PIN jsou 4 číslice.");
    if (pin !== pin2) throw new Error("PIN se neshoduje.");
    await S.backend.changePin(pin);
    if (S.bundle?.driver) S.bundle.driver.hasPin = true;
    await refresh();
    S.draft = {};
    S.info = "PIN je nastavený. Můžete zadat první jízdu, jakmile správce registraci schválí, nebo hned, pokud je účet aktivní.";
    go("home");
  },
  async "pick-user"(el) { S.draft.loginEmail = el.dataset.email; render(); },
  async "demo-admin"() { S.bundle = await S.backend.loginAdmin(); go("home"); },
  async logout() {
    S.customerLock = false;
    clearRecovering();
    await S.backend.logout();
    S.bundle = null;
    S.draft = {};
    go("login");
  },
  async "use-demo"() { throw new Error("Demo režim se zapíná jen v config.js hodnotou demo: true."); },
  async "use-remote"() { location.reload(); },
  async ares() { await lookupAres(); },
  async "create-offer"() {
    const res = await S.backend.createOffer({
      from: S.draft.from, to: S.draft.to, priceKc: numPrice(S.draft.priceKc), paymentMethod: S.draft.paymentMethod || "hotovost",
    });
    await refresh();
    S.rideId = res.rideId;
    S.draft = {};
    go("handoff");
  },
  async "to-customer"() { S.customerLock = true; S.draft.consentTerms = false; S.draft.consentPrice = false; go("customer"); },
  async "to-pin"() { S.customerLock = true; S.draft.pin = ""; go("pin"); },
  async "show-terms"(el) { S.termsBack = el.dataset.back || "order"; go("terms", { keepDraft: true }); },
  async "place-order"() {
    const termsVersion = currentTerms().id;
    try {
      await S.backend.placeOrder({
        rideId: S.rideId, email: S.draft.email, consentTerms: S.draft.consentTerms === true, consentPrice: S.draft.consentPrice === true,
        termsVersion,
      });
    } catch (err) {
      if (/podmínky se mezitím změnily/i.test(err?.message || "")) {
        // Nové znění: zobrazit ho a nechat zákazníka souhlasit znovu.
        await refresh().catch(() => {});
        S.draft.consentTerms = false;
        S.draft.consentPrice = false;
      }
      throw err;
    }
    await refresh();
    S.draft.pin = "";
    S.info = "Objednávka je uložená. Vraťte telefon řidiči.";
    go("pin");
  },
  async "pin-key"(el) {
    if (S.busy) return;
    const key = el.dataset.key;
    let pin = S.draft.pin || "";
    if (key === "del") pin = pin.slice(0, -1);
    else if (pin.length < 4) pin += key;
    S.draft.pin = pin;
    S.pinShake = false;
    if (pin) S.info = "";
    render();
    if (S.draft.pin.length === 4) await submitPin();
  },
  async "start-ride"() {
    await S.backend.startRide(S.rideId);
    await refresh();
    go("riding");
  },
  async "end-ride"() {
    await S.backend.endRide(S.rideId);
    await refresh();
    go("pay");
  },
  async "mark-paid"() { await finishPayment(); },
  async "resend-email"() {
    const b = rideBy();
    const result = await S.backend.sendEmail(b.confirmation.id);
    await refresh();
    if (result && result.sent === false && result.error) S.info = result.error;
    go("confirm");
  },
  async "cancel-ride"() {
    await S.backend.cancelRide(S.rideId);
    await refresh();
    go("home");
  },
  async "save-change"() {
    await S.backend.proposeChange(S.rideId, {
      from: S.draft.from, to: S.draft.to, priceKc: numPrice(S.draft.priceKc), paymentMethod: S.draft.paymentMethod,
    });
    await refresh();
    S.draft = {};
    go("handoff");
  },
  async "discard-change"() {
    await S.backend.discardChange(S.rideId);
    await refresh();
    openRide(S.rideId);
  },
  async "open-ride"(el) { openRide(el.dataset.id); },
  async "save-profile"() {
    await S.backend.saveProfile({ ...S.draft });
    await refresh();
    delete S.draft._profile;
    S.info = "Profil je uložený. Starší jízdy se tím nemění.";
    go("profile");
  },
  async "save-pin"() {
    if (S.draft.newPin !== S.draft.newPin2) throw new Error("PIN se neshoduje.");
    await S.backend.changePin(S.draft.newPin);
    S.draft.newPin = "";
    S.draft.newPin2 = "";
    S.info = "PIN je změněný.";
    render();
  },
  async "save-eet"() {
    const patch = {
      enabled: S.draft.eetEnabled === true,
      dicEic: S.draft.dicEic, evidencniJednotka: S.draft.evidencniJednotka, zarizeni: S.draft.zarizeni,
      simulateOffline: S.draft.simulateOffline === true, certFilename: S.draft.certFilename || "",
      certBase64: S.draft.certBase64 || "", certPassword: S.draft.certPassword || "",
    };
    const note = await S.backend.saveEet(patch);
    S.draft.certPassword = "";
    S.draft.certBase64 = "";
    delete S.draft._profile;
    await refresh();
    S.info = note || (patch.enabled ? "Evidence tržeb je zapnutá. V jízdě se objeví jen zkušební stav." : "Evidence tržeb je vypnutá.");
    go("profile");
  },
  async "flush-eet"() {
    await S.backend.flushEet();
    await refresh();
    S.info = "Čekající zkušební zprávy EET jsou odbavené. Na Finanční správu se nic neposlalo.";
    render();
  },
  async "export-csv"() {
    const csv = await S.backend.exportCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `svezemete-${pragueParts(new Date().toISOString()).key}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    S.info = "Soubor CSV je stažený.";
    render();
  },
  async "set-status"(el) {
    await S.backend.setStatus(el.dataset.id, el.dataset.status);
    await refresh();
    go("home");
  },
  async "reset-demo"() {
    await S.backend.reset();
    S.bundle = null;
    S.draft = {};
    go("login");
  },
  async "bootstrap-admin"() {
    await S.backend.bootstrapAdmin({ name: S.draft.adminName, email: S.draft.adminEmail, password: S.draft.adminPassword });
    S.info = "Účet správce je založený. Přihlaste se.";
    go("login");
  },
};

async function submitPin() {
  if (Date.now() < S.pinLockedUntil) {
    S.draft.pin = "";
    S.info = "";
    S.pinShake = true;
    S.error = "Příliš mnoho pokusů. Počkejte půl minuty.";
    render();
    return;
  }
  S.busy = true;
  S.busyAct = "check-pin";
  S.info = "";
  render();
  let ok = false;
  try {
    ok = await S.backend.checkPin(S.draft.pin);
  } finally {
    S.busy = false;
    S.busyAct = "";
  }
  if (!ok) {
    S.pinTries += 1;
    S.draft.pin = "";
    S.info = "";
    S.pinShake = true;
    S.error = S.pinTries >= 5 ? "Pětkrát špatný PIN. Počkejte 30 sekund." : "Špatný PIN.";
    if (S.pinTries >= 5) { S.pinLockedUntil = Date.now() + 30000; S.pinTries = 0; }
    render();
    return;
  }
  S.customerLock = false;
  S.pinTries = 0;
  S.pinShake = false;
  S.draft.pin = "";
  S.error = "";
  S.info = "";
  openRide(S.rideId);
}

async function finishPayment() {
  const before = rideBy();
  await S.backend.markPaid(before.ride.id);
  await refresh();
  const b = rideBy();
  if (S.bundle.eet?.enabled && b.payment) {
    try { await S.backend.recordEet(b.payment.id); }
    catch (err) { S.info = "EET se nepodařilo zařadit. Jízda tím není blokovaná."; }
  }
  let mail;
  try { mail = await S.backend.sendEmail(b.confirmation.id); }
  catch (err) { S.error = err.message || "E-mail se nepodařilo odeslat."; }
  await refresh();
  if (mail && mail.sent === false && mail.error) S.info = [S.info, mail.error].filter(Boolean).join(" ");
  go("confirm");
}

async function lookupAres() {
  const ico = String(S.draft.ico || "").replace(/\s/g, "");
  if (!validIco(ico)) throw new Error("Nejdřív zadejte platné IČO.");
  S.info = "Načítám z ARES…";
  render();
  try {
    let data = null;
    try {
      const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, { headers: { Accept: "application/json" } });
      if (res.ok) data = await res.json();
    } catch { /* CORS nebo síť */ }
    if (!data && S.backend.ares) data = await S.backend.ares(ico);
    if (!data) throw new Error("bez odpovědi");
    const s = data.sidlo || data;
    if (data.obchodniJmeno) S.draft.name = data.obchodniJmeno;
    if (data.name && !data.obchodniJmeno) S.draft.name = data.name;
    if (data.dic) S.draft.dic = data.dic;
    const street = data.street || [s.nazevUlice, s.cisloDomovni, s.cisloOrientacni].filter(Boolean).join(" ");
    if (street) S.draft.street = street;
    if (s.nazevObce || data.city) S.draft.city = s.nazevObce || data.city;
    if (s.psc || data.zip) S.draft.zip = String(s.psc || data.zip);
    S.info = "Údaje z ARES jsou předvyplněné. Zkontrolujte je a případně opravte.";
    S.error = "";
  } catch {
    S.info = "";
    S.error = "ARES se nepodařilo načíst. Vyplňte údaje ručně.";
  }
  render();
}

function makeBundle(db, session, mode, terms) {
  if (!session) return null;
  // terms = řádek z tabulky terms_versions (vzdálený režim) nebo null (demo: js/terms.js).
  const base = {
    mode, db,
    terms: Array.isArray(terms?.body) ? terms.body : null,
    termsVersion: terms?.id || TERMS_VERSION,
    termsTitle: terms?.title || "",
    termsValidFrom: terms?.published_at ? pragueParts(terms.published_at).date || "" : "",
  };
  if (session.role === "admin") {
    return {
      ...base,
      me: { id: session.userId, role: "admin", name: mode === "demo" ? "Správce (demo)" : "Správce platformy", email: session.email || "" },
      carrier: null, driver: null, vehicle: null, eet: { enabled: false },
      rides: ridesFor(db, null),
      admin: {
        carriers: db.carriers.map((c) => ({
          ...c,
          driver: db.drivers.find((d) => d.carrierId === c.id) || null,
          vehicle: db.vehicles.find((v) => v.carrierId === c.id) || null,
          eet: db.eetSettings.find((e) => e.carrierId === c.id) || { enabled: false },
        })),
        failed: db.deliveries.filter((d) => d.status === "failed"),
        audit: [...db.audit].reverse().slice(0, 40),
      },
    };
  }
  const carrier = db.carriers.find((c) => c.id === session.carrierId) || db.carriers.find((c) => c.ownerId === session.userId) || null;
  const driverRow = db.drivers.find((d) => d.userId === session.userId) || (carrier ? db.drivers.find((d) => d.carrierId === carrier.id) : null);
  const vehicle = (carrier && db.vehicles.find((v) => v.carrierId === carrier.id)) || null;
  const eet = (carrier && db.eetSettings.find((e) => e.carrierId === carrier.id)) || { enabled: false };
  const user = db.users.find((u) => u.id === session.userId);
  const driver = driverRow ? { ...driverRow, hasPin: driverRow.hasPin === true || !!driverRow.pinHash, pinHash: undefined } : null;
  if (driver) delete driver.pinHash;
  return {
    ...base,
    me: { id: session.userId, role: "driver", name: carrier?.name || user?.name || "", email: user?.email || session.email || "" },
    carrier, driver, vehicle, eet, rides: ridesFor(db, carrier?.id || session.carrierId), admin: null,
  };
}

function demoBackend() {
  const KEY = "svezemete.demo.v1";
  let db = rehydrate(JSON.parse(localStorage.getItem(KEY) || "null"));
  const persist = () => localStorage.setItem(KEY, JSON.stringify(db));
  const read = () => { try { return JSON.parse(sessionStorage.getItem("svezemete.session") || "null"); } catch { return null; } };
  const write = (s) => { if (s) sessionStorage.setItem("svezemete.session", JSON.stringify(s)); else sessionStorage.removeItem("svezemete.session"); };
  const actor = () => {
    const s = read();
    if (!s || s.role !== "driver") throw new Error("Nejste přihlášený řidič.");
    return s;
  };
  return {
    mode: "demo",
    async load() { return makeBundle(db, read(), "demo"); },
    roster() { return db.users.filter((u) => u.role === "driver").map((u) => ({ name: u.name, email: u.email })); },
    async register(input) {
      const reg = await registerDriver(db, input, { activate: true });
      persist();
      write({ role: "driver", userId: reg.user.id, carrierId: reg.carrier.id });
      return makeBundle(db, read(), "demo");
    },
    async login(email, password) {
      const user = await loginDemo(db, email, password);
      write({ role: "driver", userId: user.id, carrierId: user.carrierId });
      return makeBundle(db, read(), "demo");
    },
    async loginAdmin() { write({ role: "admin", userId: "demo-admin" }); return makeBundle(db, read(), "demo"); },
    async logout() { write(null); },
    async completePending() { return makeBundle(db, read(), "demo"); },
    async resetPassword() { throw new Error("Obnova hesla je v ukázkovém režimu vypnutá."); },
    async updatePassword() { throw new Error("Obnova hesla je v ukázkovém režimu vypnutá."); },
    async checkPin(pin) { return checkPinDemo(db, read().userId, pin); },
    async changePin(pin) { await setPin(db, actor(), pin); persist(); },
    async createOffer(input) { const r = await createOffer(db, actor(), input); persist(); return { rideId: r.ride.id }; },
    async placeOrder(input) { placeOrder(db, null, { ...input, userAgent: navigator.userAgent }); persist(); },
    async startRide(id) { startRide(db, actor(), id); persist(); },
    async endRide(id) { endRide(db, actor(), id); persist(); },
    async markPaid(id) { markPaid(db, actor(), id); persist(); },
    async cancelRide(id) { cancelRide(db, actor(), id, "Zrušeno před jízdou"); persist(); },
    async proposeChange(id, input) { await proposeChange(db, actor(), id, input); persist(); },
    async discardChange(id) { discardChange(db, actor(), id); persist(); },
    async recordEet(paymentId) { const r = recordEet(db, actor(), paymentId); persist(); return r; },
    async flushEet() { flushEet(db, actor()); persist(); },
    async sendEmail(confirmationId) { recordSimulatedEmail(db, confirmationId); persist(); return { sent: false, simulated: true }; },
    async saveProfile(patch) { updateProfile(db, actor(), patch); persist(); },
    async saveEet(patch) {
      setEet(db, actor(), { ...patch, certUploaded: !!patch.certFilename });
      persist();
      return S.backend && patch.certPassword ? "Heslo certifikátu se v demo režimu neukládá. Na serveru se uloží šifrovaně." : "";
    },
    async setStatus(id, status) { setCarrierStatus(db, { role: "admin", userId: "demo-admin" }, id, status); persist(); },
    async exportCsv() { return toCsv(db, actor().carrierId); },
    async reset() { db = createEmptyDb(); persist(); write(null); },
    async bootstrapAdmin() { throw new Error("V demo režimu použijte tlačítko Vstoupit jako správce."); },
  };
}

const mapRow = {
  carrier: (r) => ({ id: r.id, ownerId: r.owner_id, name: r.name, ico: r.ico, dic: r.dic || "", vatPayer: !!r.vat_payer, street: r.street || "", city: r.city || "", zip: r.zip || "", sidlo: r.sidlo || "", iban: r.iban || "", email: r.email || "", phone: r.phone || "", concessionNumber: r.concession_number || "", concessionUntil: r.concession_until || "", status: r.status, createdAt: r.created_at }),
  driver: (r) => ({ id: r.id, carrierId: r.carrier_id, userId: r.user_id, firstName: r.first_name, lastName: r.last_name, licenceNumber: r.licence_number, licenceUntil: r.licence_until || "", hasPin: !!r.pin_hash }),
  vehicle: (r) => ({ id: r.id, carrierId: r.carrier_id, rz: r.rz, make: r.make, model: r.model, registryNote: r.registry_note || "", noTaximeter: r.no_taximeter !== false }),
  eet: (r) => ({ carrierId: r.carrier_id, enabled: !!r.enabled, dicEic: r.dic_eic || "", evidencniJednotka: r.evidencni_jednotka || "", zarizeni: r.zarizeni || "SVEZEMETE-1", simulateOffline: !!r.simulate_offline, certUploaded: !!r.cert_uploaded, certFilename: r.cert_filename || "" }),
  ride: (r) => ({ id: r.id, carrierId: r.carrier_id, status: r.status, currentOfferId: r.current_offer_id, pendingOfferId: r.pending_offer_id, startedAt: r.started_at, endedAt: r.ended_at, cancelReason: r.cancel_reason || "", createdAt: r.created_at, timeSource: r.time_source || "database" }),
  offer: (r) => ({ id: r.id, carrierId: r.carrier_id, rideId: r.ride_id, groupId: r.group_id, version: r.version, fromPlace: r.from_place, toPlace: r.to_place, priceKc: r.price_kc, paymentMethod: r.payment_method, snapshot: r.snapshot, contentHash: r.content_hash, termsVersionId: r.terms_version_id, serverCreatedAt: r.server_created_at, timeSource: r.time_source || "database" }),
  order: (r) => ({ id: r.id, carrierId: r.carrier_id, rideId: r.ride_id, offerId: r.offer_id, orderNumber: r.order_number, customerEmail: r.customer_email, consentTerms: !!r.consent_terms, consentPriceRoute: !!r.consent_price_route, orderedAt: r.ordered_at, timeSource: r.time_source || "database" }),
  payment: (r) => ({ id: r.id, carrierId: r.carrier_id, rideId: r.ride_id, method: r.method, amountKc: r.amount_kc, status: r.status, confirmedAt: r.confirmed_at }),
  confirmation: (r) => ({ id: r.id, carrierId: r.carrier_id, rideId: r.ride_id, orderId: r.order_id, evidencniCislo: r.evidencni_cislo, customerEmail: r.customer_email, body: r.body, createdAt: r.created_at, timeSource: r.time_source || "database" }),
  delivery: (r) => ({ id: r.id, confirmationId: r.confirmation_id, carrierId: r.carrier_id, status: r.status, error: r.error || "", to: r.email_to, attemptedAt: r.attempted_at }),
  eetMsg: (r) => ({ id: r.id, carrierId: r.carrier_id, paymentId: r.payment_id, rideId: r.ride_id, status: r.status, pok: r.pok, error: r.error || "", attempt: r.attempt, stub: r.stub !== false }),
};

async function loadSdk() {
  if (window.supabase?.createClient) return window.supabase;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Nepodařilo se načíst knihovnu Supabase."));
    document.head.appendChild(s);
  });
  return window.supabase;
}

function remoteBackend() {
  let sb = null;
  let session = null;
  let cache = createEmptyDb();
  let terms = null;
  const must = async (q) => { const { data, error } = await q; if (error) throw new Error(friendly(error)); return data; };
  function friendly(error) {
    const msg = error?.message || "Operace se nepovedla.";
    if (error?.code === "23505") return "Dopravce s tímto IČO nebo e-mailem už existuje.";
    if (/schema|relation|function/i.test(msg)) return "Databáze ještě nemá schéma SvezemeTě. Spusťte setup/schema.sql podle README.";
    const mapped = authErrorCs(error);
    if (mapped !== "Něco se nepovedlo. Zkuste to znovu.") return mapped;
    if (/[áčďéěíňóřšťúůýž]/i.test(msg) || /IČO|PIN|PSČ/.test(msg)) return msg;
    return "Něco se nepovedlo. Zkuste to znovu.";
  }
  async function pull() {
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) { session = null; cache = createEmptyDb(); return; }
    const profile = await must(sb.from("profiles").select("*").eq("id", auth.user.id).maybeSingle());
    if (!profile) throw new Error("Chybí profil. Zkuste se odhlásit a registrovat znovu.");
    const admin = profile.role === "admin";
    const carrierFilter = admin ? (q) => q : (q) => q.eq("carrier_id", profile.carrier_id);
    const carriers = (await must(sb.from("carriers").select("*"))).map(mapRow.carrier);
    const drivers = (await must(sb.from("drivers").select("*"))).map(mapRow.driver);
    const vehicles = (await must(sb.from("vehicles").select("*"))).map(mapRow.vehicle);
    const eetSettings = (await must(sb.from("eet_settings").select("*"))).map(mapRow.eet);
    let rides = [], offers = [], orders = [], payments = [], confirmations = [], deliveries = [], eetMessages = [], audit = [];
    if (profile.carrier_id || admin) {
      rides = (await must(carrierFilter(sb.from("rides").select("*")))).map(mapRow.ride);
      offers = (await must(carrierFilter(sb.from("offers").select("*")))).map(mapRow.offer);
      orders = (await must(carrierFilter(sb.from("orders").select("*")))).map(mapRow.order);
      payments = (await must(carrierFilter(sb.from("payments").select("*")))).map(mapRow.payment);
      confirmations = (await must(carrierFilter(sb.from("confirmations").select("*")))).map(mapRow.confirmation);
      deliveries = (await must(carrierFilter(sb.from("deliveries").select("*")))).map(mapRow.delivery);
      eetMessages = (await must(carrierFilter(sb.from("eet_messages").select("*")))).map(mapRow.eetMsg);
    }
    if (admin) {
      const a = await sb.from("audit_log").select("*").order("ts", { ascending: false }).limit(40);
      audit = (a.data || []).map((r) => ({ id: r.id, ts: r.ts, table: r.table_name, op: r.op, rowId: r.row_id }));
    }
    cache = { users: [], carriers, drivers, vehicles, offers, orders, rides, payments, confirmations, deliveries, eetSettings, eetMessages, audit };
    session = { role: profile.role, userId: profile.id, carrierId: profile.carrier_id, email: profile.email };
    const t = await sb.from("terms_versions").select("*").order("published_at", { ascending: false }).limit(1);
    terms = t.data?.[0] || null;
  }
  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw new Error(friendly(error));
    return data;
  }
  let completing = null;
  async function completePending() {
    if (completing) return completing;
    completing = (async () => {
      if (!session) await pull();
      if (!session || session.role !== "driver") return makeBundle(cache, session, "remote", terms);
      if (session.carrierId && cache.drivers.some((d) => d.userId === session.userId) && cache.vehicles.some((v) => v.carrierId === session.carrierId)) {
        clearPending();
        return makeBundle(cache, session, "remote", terms);
      }
      const pending = readPending();
      if (!pending) return makeBundle(cache, session, "remote", terms);
      await finishRemote(sb, pending, session.userId);
      await pull();
      if (session.carrierId) clearPending();
      return makeBundle(cache, session, "remote", terms);
    })();
    try { return await completing; }
    finally { completing = null; }
  }
  return {
    mode: "remote",
    async init() {
      const sdk = await loadSdk();
      const c = window.SVEZEME_CONFIG;
      sb = sdk.createClient(c.supabaseUrl, c.supabaseAnonKey);
      sb.auth.onAuthStateChange((event) => {
        if (event !== "PASSWORD_RECOVERY") return;
        markRecovering();
        S.draft = {};
        S.error = "";
        if (S.view !== "new-password") go("new-password");
      });
      if (recoveryInUrl()) markRecovering();
      const { data } = await sb.auth.getSession();
      if (data.session && !S.recovering) await pull().catch((e) => { S.error = asCzechError(e); });
    },
    async load() { if (session) await pull(); return makeBundle(cache, session, "remote", terms); },
    async completePending() { return completePending(); },
    async register(input) {
      const email = String(input.loginEmail || input.email).trim().toLowerCase();
      if (session?.userId && session.role === "driver") {
        writePending(input);
        await finishRemote(sb, input, session.userId);
        await pull();
        if (session.carrierId) clearPending();
        return makeBundle(cache, session, "remote", terms);
      }
      const { data, error } = await sb.auth.signUp({ email, password: input.password, options: { data: { name: input.name }, emailRedirectTo: appBaseUrl() } });
      if (error) throw new Error(authErrorCs(error));
      if (!data.session) {
        writePending(input);
        return { pendingConfirm: true, email };
      }
      writePending(input);
      await finishRemote(sb, input, data.session.user.id);
      await pull();
      if (session?.carrierId) clearPending();
      return makeBundle(cache, session, "remote", terms);
    },
    async login(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password });
      if (error) throw new Error(authErrorCs(error));
      await pull();
      return completePending();
    },
    async logout() { await sb.auth.signOut(); session = null; },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: appBaseUrl() });
      if (error) throw new Error(authErrorCs(error));
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new Error(authErrorCs(error));
    },
    async checkPin(pin) { return rpc("check_pin", { p_pin: pin }); },
    async changePin(pin) { await rpc("set_pin", { p_pin: pin }); },
    async createOffer(input) { const d = await rpc("create_offer", { p_from: input.from, p_to: input.to, p_price: input.priceKc, p_method: input.paymentMethod }); return { rideId: d.rideId }; },
    async placeOrder(input) { await rpc("place_order", { p_ride: input.rideId, p_email: input.email, p_terms: input.consentTerms, p_price: input.consentPrice, p_agent: navigator.userAgent, p_terms_version: input.termsVersion }); },
    async startRide(id) { await rpc("start_ride", { p_ride: id }); },
    async endRide(id) { await rpc("end_ride", { p_ride: id }); },
    async markPaid(id) { await rpc("mark_paid", { p_ride: id }); },
    async cancelRide(id) { await rpc("cancel_ride", { p_ride: id, p_reason: "Zrušeno před jízdou" }); },
    async proposeChange(id, input) { await rpc("propose_change", { p_ride: id, p_from: input.from, p_to: input.to, p_price: input.priceKc, p_method: input.paymentMethod }); },
    async discardChange(id) { await rpc("discard_change", { p_ride: id }); },
    async recordEet(paymentId) {
      const { data, error } = await sb.functions.invoke("eet-submit", { body: { paymentId } });
      if (error) return { skipped: false, error: "Modul EET teď neodpověděl. Jízda není blokovaná.", stub: true };
      return data;
    },
    async flushEet() { await sb.functions.invoke("eet-submit", { body: { flush: true } }); },
    async sendEmail(confirmationId) {
      const { data, error } = await sb.functions.invoke("send-confirmation", { body: { confirmationId } });
      if (error) {
        let msg = "E-mail se nepodařilo odeslat.";
        try { const b = await error.context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return data || { sent: false, error: "E-mail se nepodařilo odeslat." };
    },
    async saveProfile(patch) {
      const cid = session.carrierId;
      await must(sb.from("carriers").update({
        name: patch.name, dic: patch.dic || "", vat_payer: !!patch.vatPayer, street: patch.street, city: patch.city,
        zip: patch.zip, iban: String(patch.iban || "").replace(/\s/g, "").toUpperCase(), email: patch.email, phone: patch.phone,
      }).eq("id", cid));
      await must(sb.from("drivers").update({
        first_name: patch.firstName, last_name: patch.lastName, licence_number: patch.licenceNumber, licence_until: parseCsDate(patch.licenceUntil) || null,
      }).eq("user_id", session.userId));
      await must(sb.from("vehicles").update({
        rz: patch.rz, make: patch.make, model: patch.model, registry_note: patch.registryNote || "",
      }).eq("carrier_id", cid));
    },
    async saveEet(patch) {
      const body = { ...patch };
      const { data, error } = await sb.functions.invoke("eet-settings", { body });
      if (!error && !data?.error) return data?.note || "";
      if (patch.certBase64) throw new Error(data?.error || error?.message || "Certifikát se nepodařilo uložit.");
      await must(sb.from("eet_settings").upsert({
        carrier_id: session.carrierId, enabled: !!patch.enabled, dic_eic: patch.dicEic || "",
        evidencni_jednotka: patch.evidencniJednotka || "", zarizeni: patch.zarizeni || "SVEZEMETE-1",
        simulate_offline: !!patch.simulateOffline,
      }));
      return "Údaje EET jsou uložené. Nahrání certifikátu vyžaduje nasazenou funkci eet-settings a klíč EET_VAULT_KEY.";
    },
    async setStatus(id, status) { await rpc("set_carrier_status", { p_carrier: id, p_status: status }); },
    async exportCsv() { await pull(); return toCsv(cache, session.carrierId); },
    async reset() { throw new Error("Na serveru se data nemažou."); },
    async bootstrapAdmin(input) {
      const { data, error } = await sb.functions.invoke("bootstrap-admin", { body: input });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Správce se nepodařilo založit.");
    },
    async ares(ico) {
      const { data, error } = await sb.functions.invoke("ares", { body: { ico } });
      if (error || data?.error) return null;
      return data;
    },
  };
}

async function finishRemote(sb, input, userId) {
  const ico = String(input.ico || "").replace(/\s/g, "");
  const existing = await sb.from("carriers").select("id").eq("owner_id", userId).maybeSingle();
  if (existing.error) throw new Error(asCzechError(existing.error));
  let cid = existing.data?.id;
  if (!cid) {
    const ins = await sb.from("carriers").insert({
      owner_id: userId, name: String(input.name || "").trim(), ico, dic: input.dic || "", vat_payer: !!input.vatPayer,
      street: input.street, city: input.city, zip: input.zip, iban: String(input.iban || "").replace(/\s/g, "").toUpperCase(),
      email: input.email, phone: input.phone, concession_number: input.concessionNumber || "",
      concession_until: parseCsDate(input.concessionUntil) || null,
    }).select("id").single();
    if (ins.error) throw new Error(ins.error.code === "23505" ? "Dopravce s tímto IČO už existuje." : asCzechError(ins.error));
    cid = ins.data.id;
  }
  const haveDriver = await sb.from("drivers").select("id").eq("user_id", userId).maybeSingle();
  if (haveDriver.error) throw new Error(asCzechError(haveDriver.error));
  if (!haveDriver.data) {
    const d = await sb.from("drivers").insert({
      carrier_id: cid, user_id: userId, first_name: String(input.firstName || "").trim(), last_name: String(input.lastName || "").trim(),
      licence_number: String(input.licenceNumber || "").trim(), licence_until: parseCsDate(input.licenceUntil) || null,
    });
    if (d.error) throw new Error(asCzechError(d.error));
  }
  const haveVehicle = await sb.from("vehicles").select("id").eq("carrier_id", cid).maybeSingle();
  if (haveVehicle.error) throw new Error(asCzechError(haveVehicle.error));
  if (!haveVehicle.data) {
    const v = await sb.from("vehicles").insert({
      carrier_id: cid, rz: String(input.rz || "").toUpperCase().trim(), make: String(input.make || "").trim(), model: String(input.model || "").trim(),
      registry_note: input.registryNote || "", no_taximeter: true,
    });
    if (v.error) throw new Error(asCzechError(v.error));
  }
  const haveEet = await sb.from("eet_settings").select("carrier_id").eq("carrier_id", cid).maybeSingle();
  if (!haveEet.data) await sb.from("eet_settings").insert({ carrier_id: cid, enabled: false });
  const pin = String(input.pin || "");
  if (/^\d{4}$/.test(pin)) {
    const res = await sb.rpc("set_pin", { p_pin: pin });
    if (res.error) console.error(res.error);
  }
}

function bind() {
  const root = $("app");
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    // Formulář (přihlášení, objednávka) se spouští jen tlačítkem Odeslat, ne klepnutím do pole.
    if (!btn || btn.tagName === "FORM" || btn.type === "submit") return;
    e.preventDefault();
    run(btn.dataset.act, btn);
  });
  root.addEventListener("submit", (e) => {
    const form = e.target.closest("form[data-act]");
    if (!form) return;
    e.preventDefault();
    run(form.dataset.act, form);
  });
  root.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.dataset?.field) return;
    S.draft[el.dataset.field] = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "checkbox" && el.checked && S.fieldErrors?.[el.dataset.field]) {
      delete S.fieldErrors[el.dataset.field];
      const label = el.closest("label");
      label?.classList.remove("has-error");
      label?.querySelector(".field-error")?.remove();
      el.removeAttribute("aria-invalid");
      el.removeAttribute("aria-describedby");
    }
    const btn = $("order-btn");
    const ready = S.draft.consentTerms === true && S.draft.consentPrice === true && validEmail(S.draft.email);
    if (btn) btn.disabled = !ready;
    const need = $("order-need");
    if (need) need.textContent = ready ? "" : "Tlačítko se zpřístupní po vyplnění e-mailu a zaškrtnutí obou souhlasů.";
  });
  root.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.dataset?.field === "eetEnabled") {
      S.draft.eetEnabled = el.checked;
      S.draft._profile = 1;
      render();
    }
    if (el.dataset?.field === "historyMonth") {
      S.draft.historyMonth = el.value;
      render();
    }
    if (el.id === "cert-file" && el.files?.[0]) {
      const file = el.files[0];
      if (!file.name.toLowerCase().endsWith(".p12")) { S.error = "Vyberte soubor certifikátu .p12."; render(); return; }
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      S.draft.certBase64 = btoa(bin);
      S.draft.certFilename = file.name;
      S.info = `Soubor ${file.name} je připravený k uložení.`;
      render();
    }
  });
}

async function boot() {
  bind();
  document.body.classList.toggle("light", !S.night);
  const hasServer = configured();
  if (!hasServer && !demoAllowed()) {
    S.backend = null;
    S.bundle = null;
    S.view = "unconfigured";
    render();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
    return;
  }
  S.backend = hasServer ? remoteBackend() : demoBackend();
  S.view = "boot";
  render();
  try { if (S.backend.init) await S.backend.init(); } catch (err) { S.error = asCzechError(err); }
  try { S.bundle = await S.backend.load(); } catch (err) { S.error = asCzechError(err); S.bundle = null; }
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem("svezemete.ui") || "null"); } catch { /* ignore */ }
  try { if (sessionStorage.getItem("svezemete.recovery") === "1") S.recovering = true; } catch { /* ignore */ }
  if (S.recovering || recoveryInUrl()) {
    markRecovering();
    S.view = "new-password";
    S.customerLock = false;
  } else if (S.bundle?.me) {
    S.rideId = saved?.rideId || null;
    S.customerLock = !!saved?.customerLock;
    S.regStep = saved?.regStep || 1;
    if (S.bundle.me.role === "driver" && !recordsReady(S.bundle) && readPending() && S.backend.completePending) {
      S.view = "finishing";
      render();
      try { S.bundle = await S.backend.completePending(); } catch (err) { S.error = asCzechError(err); }
    }
    const restored = saved?.view && !["login", "boot", "unconfigured", "forgot", "new-password", "register", "register-sent", "finishing", "incomplete", "set-pin"].includes(saved.view) ? saved.view : "home";
    S.view = postLoginView(loginState(restored));
    if (!rideBy() && ["handoff", "customer", "order", "pin", "ready", "riding", "pay", "confirm", "change", "end-ask"].includes(S.view)) {
      S.view = postLoginView(loginState("home"));
    }
  } else {
    S.customerLock = false;
    S.view = "login";
  }
  render();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }
}

boot();
