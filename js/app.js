import { TERMS_PARAS, PRIVACY_PARAS, TERMS_VERSION } from "./terms.js";
import {
  PAYMENT_METHODS, RIDE_LABEL, STATUS_CARRIER, paymentLabel, formatKc, formatWhen, pragueParts,
  validEmail, validIco, registrationErrors, createEmptyDb, rehydrate, registerDriver, loginDemo,
  checkPin as checkPinDemo, createOffer, placeOrder, startRide, endRide, markPaid, recordEet,
  setEet, proposeChange, discardChange, cancelRide, confirmationView, emailStatusView,
  recordSimulatedEmail, toCsv, paymentSums, ridesFor, updateProfile, setCarrierStatus, flushEet, setPin,
} from "./engine.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = (id) => document.getElementById(id);
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
  night: localStorage.getItem("svezemete.night") === "1",
  view: "boot",
  draft: {},
  error: "",
  info: "",
  rideId: null,
  customerLock: false,
  pinTries: 0,
  pinLockedUntil: 0,
  busy: false,
  bundle: null,
  backend: null,
  regStep: 1,
  termsBack: "order",
};

function configured() {
  const c = window.SVEZEME_CONFIG || {};
  const url = String(c.supabaseUrl || "");
  const key = String(c.supabaseAnonKey || "");
  return url.startsWith("https://") && !url.includes("__SB") && key.length > 20 && !key.includes("__SB");
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
  S.view = view;
  try {
    sessionStorage.setItem("svezemete.ui", JSON.stringify({
      view: S.view, rideId: S.rideId, customerLock: S.customerLock, regStep: S.regStep,
    }));
  } catch { /* ignore */ }
  render();
}

async function refresh() {
  S.bundle = await S.backend.load();
}

function viewNow() {
  if (S.customerLock && !["customer", "order", "terms", "pin"].includes(S.view)) return "pin";
  return S.view;
}

function shell(title, body, wide) {
  const who = S.bundle?.me;
  return `<div class="app${wide ? " wide" : ""}">
    <header>
      <div class="brand"><div class="mark" aria-hidden="true">ST</div><div><div class="nm">SvezemeTě</div><div class="sub">${esc(title)}</div></div></div>
      <div class="tools">
        ${S.customerLock ? "" : `<button type="button" class="tool" data-act="toggle-night">${S.night ? "Den" : "Noc"}</button>`}
        ${who && !S.customerLock ? `<button type="button" class="tool" data-act="logout">Odhlásit</button>` : ""}
      </div>
    </header>
    ${S.backend?.mode === "demo" ? `<div class="banner">DEMO REŽIM. Data zůstávají jen v tomto prohlížeči. E-mail se neodesílá a čas objednávky je simulace času serveru.</div>` : ""}
    <main>
      ${S.error ? `<div class="alert bad" role="alert">${esc(S.error)}</div>` : ""}
      ${S.info ? `<div class="alert ok" role="status">${esc(S.info)}</div>` : ""}
      ${body}
    </main>
  </div>`;
}

function rideCard(b) {
  return `<button type="button" class="card-btn" data-act="open-ride" data-id="${b.ride.id}">
    <span class="badge">${esc(RIDE_LABEL[b.ride.status] || b.ride.status)}</span>
    <strong>${esc(b.offer?.fromPlace || "Nabídka")} → ${esc(b.offer?.toPlace || "")}</strong>
    <span>${b.offer ? formatKc(b.offer.priceKc) : ""} · ${esc(paymentLabel(b.offer?.paymentMethod))}</span>
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

function viewHome() {
  if (S.bundle.me.role === "admin") return viewAdmin();
  const b = S.bundle;
  if (b.carrier.status !== "active") {
    return shell("Účet", `
      <h1>${esc(b.carrier.name)}</h1>
      <p class="badge wait">${esc(STATUS_CARRIER[b.carrier.status] || b.carrier.status)}</p>
      <p>Než správce registraci schválí, jízdu založit nejde. Údaje jsou uložené a můžete si je zkontrolovat.</p>
      <button type="button" class="btn" data-act="go" data-view="profile">Můj profil</button>`);
  }
  const today = pragueParts(new Date().toISOString()).key;
  const todays = b.rides.filter((r) => r.ride.status !== "cancelled" && pragueParts(r.ride.createdAt).key === today);
  const unfinished = b.rides.filter((r) => r.ride.status === "completed" && !r.delivery);
  return shell("Řidič", `
    <p class="hello">${esc(b.driver.firstName)} · ${esc(b.vehicle.rz)}</p>
    <button type="button" class="btn xl" data-act="go-offer">Nová jízda</button>
    ${unfinished.map((r) => `<button type="button" class="btn dark" data-act="open-ride" data-id="${r.ride.id}">Dokončit platbu a potvrzení<br>${esc(r.offer.fromPlace)} → ${esc(r.offer.toPlace)}</button>`).join("")}
    ${queuedEet() ? `<div class="alert wait">EET čeká na odeslání. Jízdy jedou dál.</div><button type="button" class="btn ghost" data-act="flush-eet">Odeslat čekající EET (zkušební)</button>` : ""}
    <button type="button" class="btn ghost" data-act="go" data-view="inspect">Pro kontrolu</button>
    <h2>Dnešní jízdy</h2>
    ${todays.length ? todays.map(rideCard).join("") : `<p class="empty">Dnes ještě žádná jízda. Klepněte na Nová jízda.</p>`}
    <button type="button" class="btn ghost" data-act="go" data-view="history">Historie a export</button>
    <button type="button" class="btn ghost" data-act="go" data-view="profile">Můj profil</button>`);
}

function viewLogin() {
  const demo = S.backend.mode === "demo";
  const roster = demo ? S.backend.roster() : [];
  return shell("Přihlášení", `
    <h1>Vítejte</h1>
    <p>Elektronická objednávka taxislužby pro samostatné řidiče. Každý řidič je svůj dopravce. Aplikace je zdarma a v této verzi nemá dispečink.</p>
    <button type="button" class="btn xl" data-act="go-register">Registrovat se jako řidič</button>
    <h2>Už mám účet</h2>
    <form data-act="login" autocomplete="on">
      <label>E-mail<input type="email" data-field="loginEmail" autocomplete="username" value="${esc(S.draft.loginEmail || "")}"></label>
      <label>Heslo<input type="password" data-field="password" autocomplete="current-password"></label>
      <button class="btn" type="submit">Přihlásit</button>
    </form>
    ${roster.length ? `<h2>Účty v tomto prohlížeči</h2>${roster.map((u) => `<button type="button" class="card-btn" data-act="pick-user" data-email="${esc(u.email)}"><strong>${esc(u.name)}</strong><span>${esc(u.email)}</span></button>`).join("")}<p class="hint">Jen demo v tomto prohlížeči. Hesla se tu nezobrazují.</p>` : ""}
    ${demo ? `<button type="button" class="btn ghost" data-act="demo-admin">Vstoupit jako správce (demo)</button>` : `<form data-act="bootstrap-admin"><h2>První správce</h2><p class="hint">Jen dokud žádný správce není. Pak už účet založí jen on.</p><label>Jméno<input data-field="adminName"></label><label>E-mail<input type="email" data-field="adminEmail"></label><label>Heslo<input type="password" data-field="adminPassword"></label><button class="btn ghost" type="submit">Založit účet správce</button></form>`}
    ${configured() && demo ? `<button type="button" class="btn ghost" data-act="use-remote">Přepnout na server</button>` : ""}
    ${!demo ? `<button type="button" class="btn ghost" data-act="use-demo">Vyzkoušet demo bez serveru</button>` : ""}`);
}

function field(label, name, opts = {}) {
  const val = S.draft[name] ?? "";
  const type = opts.type || "text";
  if (type === "checkbox") {
    const on = opts.defaultOn ? S.draft[name] !== false : S.draft[name] === true;
    return `<label class="consent"><input type="checkbox" data-field="${name}" ${on ? "checked" : ""}><span>${label}</span></label>`;
  }
  return `<label>${label}<input type="${type}" data-field="${name}" value="${esc(val)}" ${opts.mode ? `inputmode="${opts.mode}"` : ""} ${opts.ac ? `autocomplete="${opts.ac}"` : ""} ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ""}></label>`;
}

function viewRegister() {
  const step = S.regStep;
  const titles = ["", "Údaje dopravce", "Účet", "Řidič a vozidlo", "Odeslat k ověření"];
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
      ${field("Číslo oprávnění řidiče taxislužby", "licenceNumber")}
      ${field("Platnost oprávnění", "licenceUntil", { type: "date" })}
      ${field("Registrační značka", "rz")}<div class="row2">${field("Tovární značka", "make")}${field("Obchodní označení", "model")}</div>
      ${field("Výpis z evidence vozidel taxislužby", "registryNote", { placeholder: "číslo nebo poznámka" })}
      ${field("Koncese (číslo, pokud ho máte u sebe)", "concessionNumber")}
      ${field("Platnost koncese", "concessionUntil", { type: "date" })}
      ${field("Jezdím bez taxametru, jen na elektronickou objednávku (§ 21 odst. 6). Vozidlo nemá střešní svítilnu ani nápis TAXI.", "noTaximeter", { type: "checkbox", defaultOn: true })}`;
  } else {
    const d = S.draft;
    body = `<p><strong>${esc(d.name || "")}</strong><br>IČO ${esc(d.ico || "")}<br>${esc([d.street, d.zip, d.city].filter(Boolean).join(", "))}</p>
      <p>Řidič ${esc(d.firstName || "")} ${esc(d.lastName || "")}<br>Vozidlo ${esc(d.make || "")} ${esc(d.model || "")} · ${esc(d.rz || "")}</p>
      <p>Přihlášení ${esc(d.loginEmail || d.email || "")}</p>
      ${S.backend.mode === "demo"
        ? `<div class="alert wait">V demo režimu je registrace hned aktivní, ať jde jízdu vyzkoušet. Na serveru zůstane ve stavu Čeká na ověření, dokud ji správce neschválí.</div>`
        : `<div class="alert wait">Po odeslání je stav Čeká na ověření. Jezdit půjde až po schválení správcem.</div>`}
      ${field("Beru na vědomí, že aplikace je bezplatný nástroj, údaje o jízdách jsou neměnné a za přepravu odpovídám já jako dopravce.", "acceptPlatform", { type: "checkbox" })}
      <p class="hint">Evidence tržeb (EET 2.0) se při registraci nezapíná. Později ji lze přidat v profilu. Dokud je vypnutá, v jízdě ani v e-mailu se neobjeví.</p>`;
  }
  return shell("Registrace", `
    <div class="steps">${[1, 2, 3, 4].map((n) => `<span class="${n === step ? "on" : ""}">${n}</span>`).join("")}</div>
    <h1>${titles[step]}</h1>
    <p class="hint">Krok ${step} ze 4</p>
    ${body}
    <button type="button" class="btn xl" data-act="${step === 4 ? "reg-submit" : "reg-next"}">${step === 4 ? "Odeslat registraci" : "Pokračovat"}</button>
    ${step > 1 ? `<button type="button" class="btn ghost" data-act="reg-back">Zpět</button>` : `<button type="button" class="btn ghost" data-act="go" data-view="login">Zpět na přihlášení</button>`}`);
}

function acceptedOffer(b) {
  return b.pending || b.offer;
}

function viewOffer() {
  const method = S.draft.paymentMethod || "hotovost";
  return shell("Nová jízda", `
    <h1>Zadejte trasu a cenu</h1>
    <p>Zákazník uvidí konečnou cenu a trasu ještě před objednáním. Jízdu nelze zahájit dřív.</p>
    <label>Odkud<input data-field="from" value="${esc(S.draft.from || "")}" autocomplete="off"></label>
    <label>Kam<input data-field="to" value="${esc(S.draft.to || "")}" autocomplete="off"></label>
    <label>Konečná cena v Kč<input class="price-in" data-field="priceKc" inputmode="numeric" value="${esc(S.draft.priceKc || "")}" placeholder="850"></label>
    <label>Způsob platby<select data-field="paymentMethod">${PAYMENT_METHODS.map((p) => `<option value="${p.id}" ${method === p.id ? "selected" : ""}>${p.label}</option>`).join("")}</select></label>
    <button type="button" class="btn xl" data-act="create-offer">Pokračovat</button>
    <button type="button" class="btn ghost" data-act="go" data-view="home">Zpět</button>`);
}

function viewHandoff() {
  const b = rideBy();
  if (!b) return viewHome();
  const offer = acceptedOffer(b);
  const change = !!b.pending;
  return shell(change ? "Změna" : "Zákazník", `
    <h1>${change ? "Změna čeká na zákazníka" : "Předejte telefon"}</h1>
    <p>${change ? "Nová cena a trasa začnou platit, až je zákazník znovu objedná. Do té doby platí původní objednávka." : "Stav: čeká na zákazníka. Objednávka ještě nevznikla."}</p>
    ${change ? `<p class="old">Dosud platí ${formatKc(b.offer.priceKc)} · ${esc(b.offer.fromPlace)} → ${esc(b.offer.toPlace)}</p>` : ""}
    <div class="price">${formatKc(offer.priceKc)}</div>
    <p class="route">${esc(offer.fromPlace)} → ${esc(offer.toPlace)}</p>
    <p style="text-align:center">${esc(paymentLabel(offer.paymentMethod))}</p>
    <button type="button" class="btn xl" data-act="to-customer">Zákazník je připraven</button>
    ${change ? `<button type="button" class="btn ghost" data-act="discard-change">Zrušit návrh změny</button>` : `<button type="button" class="btn ghost" data-act="go" data-view="ask-cancel">Zrušit nabídku</button>`}`);
}

function partyBlock(s) {
  return `<h2>Dopravce</h2><p><strong>${esc(s.carrierName)}</strong><br>${esc(s.sidlo)}<br>IČO ${esc(s.ico)}</p>
    <h2>Řidič</h2><p><strong>${esc(s.driverName)}</strong></p>
    <h2>Vozidlo</h2><p class="rz">${esc(s.rz)}</p><p>${esc(s.make)} ${esc(s.model)}</p>`;
}

function viewCustomer() {
  const b = rideBy();
  const offer = acceptedOffer(b);
  const s = offer.snapshot;
  return shell("Kontrola nabídky", `
    <p class="kicker">Konečná cena</p>
    <div class="price">${formatKc(offer.priceKc)}</div>
    <div class="routebox"><div><span>Odkud</span><strong>${esc(offer.fromPlace)}</strong></div><div><span>Kam</span><strong>${esc(offer.toPlace)}</strong></div></div>
    <p style="text-align:center">Platba: ${esc(paymentLabel(offer.paymentMethod))}</p>
    ${partyBlock(s)}
    ${offer.version > 1 ? `<div class="alert wait">Toto je změna oproti původní objednávce. Bez vašeho souhlasu platí původní cena a trasa.</div>` : ""}
    <button type="button" class="btn xl" data-act="go" data-view="order">Pokračovat k objednávce</button>
    <button type="button" class="btn ghost" data-act="show-terms" data-back="customer">Celý text podmínek a údajů</button>
    <button type="button" class="btn ghost" data-act="to-pin">Vrátit telefon řidiči</button>`);
}

function viewOrder() {
  const b = rideBy();
  const offer = acceptedOffer(b);
  const ready = S.draft.consentTerms === true && S.draft.consentPrice === true && validEmail(S.draft.email);
  return shell("Objednávka", `
    <div class="price sm">${formatKc(offer.priceKc)}</div>
    <p class="route">${esc(offer.fromPlace)} → ${esc(offer.toPlace)}</p>
    <form data-act="place-order" autocomplete="off">
      <label class="consent"><input type="checkbox" data-field="consentTerms" ${S.draft.consentTerms ? "checked" : ""}><span>Souhlasím s obchodními podmínkami</span></label>
      <label class="consent"><input type="checkbox" data-field="consentPrice" ${S.draft.consentPrice ? "checked" : ""}><span>Souhlasím se smluvní cenou a danou trasou</span></label>
      <label>E-mail pro potvrzení<input type="email" data-field="email" inputmode="email" autocomplete="email" value="${esc(S.draft.email || "")}" placeholder="vas@email.cz"></label>
      <p class="hint">E-mail si zkontrolujte. Po objednání už nejde přepsat.</p>
      <button class="btn xl" id="order-btn" type="submit" ${ready ? "" : "disabled"}>Objednávám jízdu za ${formatKc(offer.priceKc)}</button>
    </form>
    <button type="button" class="btn ghost" data-act="show-terms" data-back="order">Znovu zobrazit podmínky</button>
    <button type="button" class="btn ghost" data-act="go" data-view="customer">Zpět na kontrolu</button>
    <p class="hint">Objednávka se uloží s časem serveru ještě před zahájením jízdy. Bez ní jízdu nelze zahájit.</p>`);
}

function viewTerms() {
  const paras = (S.bundle?.terms?.length ? S.bundle.terms : TERMS_PARAS);
  return shell("Podmínky", `
    <h1>Obchodní podmínky</h1>
    <p class="hint">Verze ${esc(S.bundle?.termsVersion || TERMS_VERSION)}</p>
    <div class="terms">${paras.map((p) => `<h2>${esc(p.h)}</h2><p>${esc(p.p)}</p>`).join("")}
      <h2>Informace o osobních údajích</h2>
      ${PRIVACY_PARAS.map((p) => `<h2>${esc(p.h)}</h2><p>${esc(p.p)}</p>`).join("")}
    </div>
    <button type="button" class="btn" data-act="go" data-view="${esc(S.termsBack || "order")}">Zpět</button>`);
}

function viewPin() {
  const n = (S.draft.pin || "").length;
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return shell("PIN řidiče", `
    <h1>Vraťte telefon řidiči</h1>
    <p>Pro návrat do režimu řidiče zadejte čtyřmístný PIN.</p>
    <div class="dots" aria-label="Zadané číslice">${[0, 1, 2, 3].map((i) => `<span class="${i < n ? "on" : ""}"></span>`).join("")}</div>
    <div class="pad">${keys.map((k) => k === "" ? "<span></span>" : `<button type="button" class="key" data-act="pin-key" data-key="${k === "⌫" ? "del" : k}">${k}</button>`).join("")}</div>`);
}

function viewReady() {
  const b = rideBy();
  const s = b.offer.snapshot;
  return shell("Objednáno", `
    <p class="badge ok">Objednáno ${esc(b.order?.orderNumber || "")}</p>
    <div class="price">${formatKc(b.offer.priceKc)}</div>
    <p class="route">${esc(b.offer.fromPlace)} → ${esc(b.offer.toPlace)}</p>
    <h2>Před zahájením jízdy</h2>
    <p><strong>${esc(s.carrierName)}</strong><br>${esc(s.sidlo)}<br>IČO ${esc(s.ico)}</p>
    <p>Řidič <strong>${esc(s.driverName)}</strong></p>
    <p class="rz">${esc(s.rz)}</p>
    <p>${esc(s.make)} ${esc(s.model)}</p>
    <p class="hint">Objednáno ${esc(formatWhen(b.order.orderedAt, b.order.timeSource))}</p>
    ${b.pending ? `<div class="alert wait">Čeká souhlas zákazníka se změnou. Jízdu zatím nespouštějte.</div><button type="button" class="btn" data-act="go" data-view="handoff">Předejte telefon znovu</button>` : `<button type="button" class="btn xl go" data-act="start-ride">Začít jízdu</button>`}
    <button type="button" class="btn ghost" data-act="go-change">Změnit trasu nebo cenu</button>
    <button type="button" class="btn ghost" data-act="go" data-view="ask-cancel">Zrušit před jízdou</button>`);
}

function viewRiding() {
  const b = rideBy();
  return shell("Jízda probíhá", `
    <p class="badge go">Jízda probíhá</p>
    <div class="price sm">${formatKc(b.offer.priceKc)}</div>
    <p class="route">${esc(b.offer.fromPlace)} → ${esc(b.offer.toPlace)}</p>
    <p>Začátek ${esc(formatWhen(b.ride.startedAt, b.ride.timeSource))}</p>
    <p class="clock" id="clock"></p>
    ${b.pending ? `<div class="alert wait">Změna ještě není potvrzená. Platí původní cena ${formatKc(b.offer.priceKc)}.</div><button type="button" class="btn" data-act="go" data-view="handoff">Předejte telefon ke souhlasu</button>` : ""}
    <button type="button" class="btn xl stop" data-act="go" data-view="end-ask">Ukončit jízdu</button>
    <button type="button" class="btn ghost" data-act="go-change">Změnit trasu nebo cenu</button>`);
}

function viewEndAsk() {
  return shell("Ukončit jízdu", `
    <h1>Opravdu ukončit jízdu?</h1>
    <p>Po ukončení se vystaví potvrzení o přepravě. Čas ukončení je čas serveru a nejde ho přepsat.</p>
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
  return shell("Platba", `
    <p class="badge wait">ČEKÁ NA PLATBU</p>
    <div class="price">${formatKc(b.payment.amountKc)}</div>
    <p style="text-align:center">${esc(paymentLabel(method))}</p>
    <p>${texts[method] || ""}</p>
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
  return shell("Potvrzení", `
    <p class="badge ${paid ? "ok" : "wait"}">${paid ? "ZAPLACENO" : "ČEKÁ NA PLATBU"}</p>
    <h1>Potvrzení o přepravě</h1>
    <dl>${view.lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <p class="hint">Vystaveno ${esc(formatWhen(b.confirmation.createdAt, b.confirmation.timeSource))}. Záznam je neměnný.</p>
    <div class="alert ${tone}" id="email-status">${esc(email.text)}</div>
    ${email.kind === "sent" ? "" : `<button type="button" class="btn" data-act="resend-email">Odeslat znovu</button>`}
    ${eetBlock(view.eet)}
    <button type="button" class="btn ghost" data-act="go" data-view="home">Domů</button>`);
}

function viewInspect() {
  const today = pragueParts(new Date().toISOString()).key;
  const rows = S.bundle.rides.filter((r) => r.confirmation && pragueParts(r.confirmation.createdAt).key === today);
  return shell("Pro kontrolu", `
    <h1>Dnešní potvrzení</h1>
    <p>Potvrzení o přepravě má být u řidiče k nahlédnutí po zbytek dne.</p>
    ${rows.length ? rows.map((r) => `<button type="button" class="card-btn" data-act="open-ride" data-id="${r.ride.id}"><strong>${esc(r.confirmation.evidencniCislo)}</strong><span>${esc(r.offer.fromPlace)} → ${esc(r.offer.toPlace)}</span><span>${formatKc(r.offer.priceKc)}</span></button>`).join("") : `<p class="empty">Dnes není žádné potvrzení k předložení.</p>`}
    <button type="button" class="btn ghost" data-act="go" data-view="home">Domů</button>`);
}

function viewHistory() {
  const month = S.draft.historyMonth || pragueParts(new Date().toISOString()).key.slice(0, 7);
  const rows = S.bundle.rides.filter((r) => r.confirmation && pragueParts(r.confirmation.createdAt).key.startsWith(month));
  const sums = paymentSums(rows);
  return shell("Historie", `
    <h1>Historie jízd</h1>
    <label>Měsíc<input type="month" data-field="historyMonth" value="${esc(month)}"></label>
    <div class="sum">
      <div>Hotovost ${formatKc(sums.hotovost || 0)}</div>
      <div>Karta ${formatKc(sums.karta || 0)}</div>
      <div>QR ${formatKc(sums.qr || 0)}</div>
      <div>Faktura ${formatKc(sums.faktura || 0)}</div>
      <div><strong>Z toho zaplaceno ${formatKc(sums.paid || 0)}</strong></div>
    </div>
    ${rows.length ? rows.map(rideCard).join("") : `<p class="empty">V tomto měsíci není žádné potvrzení.</p>`}
    <button type="button" class="btn" data-act="export-csv">Export CSV</button>
    <p class="hint">Soubor je oddělený středníkem, aby ho otevřel český Excel. Potvrzení se nemažou, uchování je nejméně 3 roky.</p>
    <button type="button" class="btn ghost" data-act="go" data-view="home">Domů</button>`);
}

function viewProfile() {
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
  return shell("Profil", `
    <h1>Můj profil</h1>
    <p>IČO <strong>${esc(b.carrier.ico)}</strong> · ${esc(STATUS_CARRIER[b.carrier.status] || "")}</p>
    <p class="hint">Úpravy profilu nemění už uložené nabídky a potvrzení. Ty zůstávají, jak je zákazník viděl.</p>
    ${field("Jméno nebo firma", "name")}${field("DIČ", "dic")}${field("Plátce DPH", "vatPayer", { type: "checkbox" })}
    ${field("Ulice", "street")}<div class="row2">${field("PSČ", "zip")}${field("Město", "city")}</div>
    ${field("IBAN", "iban")}${field("E-mail", "email", { type: "email" })}${field("Telefon", "phone")}
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
      <p>Vyplňte svoje údaje z DIS+. Dokud evidenci nezapnete, v jízdě, platbě ani v e-mailu se neobjeví. Zapnutí nic neblokuje.</p>
      <div class="alert wait">Napojení na Finanční správu je zatím jen příprava. Zpráva se nikam neodesílá, vznikne jen zkušební kód nebo záznam ve frontě.</div>
      ${field("DIČ / EIČ", "dicEic")}${field("Evidenční jednotka (vozidlo)", "evidencniJednotka")}${field("Označení pokladního zařízení", "zarizeni")}
      <label>Certifikát .p12<input id="cert-file" type="file" accept=".p12,application/x-pkcs12"></label>
      <p class="hint">${b.eet.certUploaded ? `Uložený soubor: ${esc(b.eet.certFilename || "certifikát")}` : "Certifikát zatím není nahraný."} ${S.backend.mode === "demo" ? "V demo režimu se soubor ani heslo neukládají." : "Na serveru se soubor i heslo uloží šifrovaně a řidič je zpět neuvidí."}</p>
      ${field("Heslo certifikátu", "certPassword", { type: "password", ac: "off" })}
      <label class="consent"><input type="checkbox" data-field="simulateOffline" ${S.draft.simulateOffline ? "checked" : ""}><span>Zkouška offline fronty (nevracet kód, jen zařadit)</span></label>
      <button type="button" class="btn" data-act="save-eet">Uložit nastavení EET</button>
      ${queuedEet() ? `<button type="button" class="btn ghost" data-act="flush-eet">Odeslat čekající EET (zkušební)</button>` : ""}
    ` : `<p>Evidence je vypnutá. Jízdy, platby ani e-maily ji nepoužívají. Až budete mít údaje z DIS+ a pokladní certifikát, zapněte ji tady.</p>`}
    ${S.backend.mode === "demo" ? `<button type="button" class="btn ghost" data-act="go" data-view="reset-ask">Smazat demo data v tomto prohlížeči</button>` : ""}
    <button type="button" class="btn ghost" data-act="go" data-view="home">Domů</button>`);
}

function viewChange() {
  const b = rideBy();
  const method = S.draft.paymentMethod || b.offer.paymentMethod;
  return shell("Změna", `
    <h1>Změnit trasu nebo cenu</h1>
    <p>Původní objednávka zůstane uložená. Nová cena začne platit, až ji zákazník znovu objedná.</p>
    <p class="old">Teď platí ${formatKc(b.offer.priceKc)} · ${esc(b.offer.fromPlace)} → ${esc(b.offer.toPlace)}</p>
    <label>Odkud<input data-field="from" value="${esc(S.draft.from || b.offer.fromPlace)}"></label>
    <label>Kam<input data-field="to" value="${esc(S.draft.to || b.offer.toPlace)}"></label>
    <label>Nová konečná cena v Kč<input class="price-in" data-field="priceKc" inputmode="numeric" value="${esc(S.draft.priceKc || b.offer.priceKc)}"></label>
    <label>Způsob platby<select data-field="paymentMethod">${PAYMENT_METHODS.map((p) => `<option value="${p.id}" ${method === p.id ? "selected" : ""}>${p.label}</option>`).join("")}</select></label>
    <button type="button" class="btn xl" data-act="save-change">Předejte telefon ke souhlasu</button>
    <button type="button" class="btn ghost" data-act="open-ride" data-id="${b.ride.id}">Zpět</button>`);
}

function viewAskCancel() {
  return shell("Zrušit", `
    <h1>Opravdu zrušit?</h1>
    <p>Jízda ještě nezačala. Záznam zrušení zůstane, nesmaže se.</p>
    <button type="button" class="btn xl stop" data-act="cancel-ride">Ano, zrušit</button>
    <button type="button" class="btn ghost" data-act="open-ride" data-id="${S.rideId}">Ne</button>`);
}

function viewReset() {
  return shell("Demo data", `
    <h1>Smazat demo data?</h1>
    <p>Smaže se jen obsah tohoto prohlížeče. Na žádný server se nic neposlalo.</p>
    <button type="button" class="btn xl stop" data-act="reset-demo">Ano, smazat demo</button>
    <button type="button" class="btn ghost" data-act="go" data-view="profile">Ne</button>`);
}

function viewAdmin() {
  const a = S.bundle.admin;
  return shell("Správce", `
    <h1>Správce platformy</h1>
    <p>Vidíte všechny dopravce. Každý řidič ve své aplikaci vidí jen svoje jízdy.</p>
    <h2>Registrace</h2>
    ${a.carriers.length ? a.carriers.map((c) => `<div class="card-btn" style="cursor:default">
      <strong>${esc(c.name)}</strong>
      <span>IČO ${esc(c.ico)} · ${esc(STATUS_CARRIER[c.status] || c.status)}</span>
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
    <p class="hint">Verze podmínek ${esc(TERMS_VERSION)}. Starší verze se nemění, objednávka si pamatuje tu, kterou zákazník viděl.</p>`, true);
}

function render() {
  document.body.classList.toggle("night", S.night);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", S.night ? "#000000" : "#111111");
  const view = viewNow();
  const screens = {
    boot: () => shell("Načítání", "<h1>Načítám…</h1>"),
    login: viewLogin,
    register: viewRegister,
    home: viewHome,
    offer: viewOffer,
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
  $("app").innerHTML = (screens[view] || viewLogin)();
  armClock();
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
  if (S.busy) return;
  S.busy = true;
  try {
    if (!["pin-key", "toggle-night"].includes(act)) pullDraft();
    S.error = "";
    if (act !== "ares") S.info = "";
    await actions[act]?.(el);
  } catch (err) {
    console.error(err);
    S.error = err?.message || "Něco se nepovedlo.";
    render();
  } finally {
    S.busy = false;
  }
}

const actions = {
  async "toggle-night"() {
    S.night = !S.night;
    localStorage.setItem("svezemete.night", S.night ? "1" : "0");
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
  async "go-register"() { S.regStep = 1; S.draft = { noTaximeter: true }; go("register"); },
  async "go-offer"() { S.draft = { paymentMethod: "hotovost" }; go("offer"); },
  async "go-change"() { S.draft = {}; go("change"); },
  async "fill-demo"() {
    const { ...rest } = SAMPLE;
    Object.assign(S.draft, rest);
    delete S.draft.acceptPlatform;
    S.info = "Ukázkové údaje jsou vyplněné. Heslo je demo1234 a PIN je 1234. Můžete je změnit.";
    render();
  },
  async "reg-next"() {
    const errs = registrationErrors(S.draft, S.regStep);
    if (errs.length) throw new Error(errs[0]);
    if (S.regStep === 1 && !S.draft.loginEmail) S.draft.loginEmail = S.draft.email;
    S.regStep += 1;
    go("register", { keepDraft: true });
  },
  async "reg-back"() { S.regStep = Math.max(1, S.regStep - 1); go("register", { keepDraft: true }); },
  async "reg-submit"() {
    const errs = [1, 2, 3, 4].flatMap((n) => registrationErrors(S.draft, n));
    if (errs.length) throw new Error(errs[0]);
    S.bundle = await S.backend.register({ ...S.draft });
    S.draft = {};
    S.regStep = 1;
    S.info = S.bundle.carrier.status === "active" ? "Registrace je hotová. Můžete zadat první jízdu." : "Registrace čeká na ověření správcem.";
    go("home");
  },
  async login() {
    S.bundle = await S.backend.login(S.draft.loginEmail, S.draft.password);
    S.draft = {};
    go("home");
  },
  async "pick-user"(el) { S.draft.loginEmail = el.dataset.email; render(); },
  async "demo-admin"() { S.bundle = await S.backend.loginAdmin(); go("home"); },
  async logout() {
    S.customerLock = false;
    await S.backend.logout();
    S.bundle = null;
    S.draft = {};
    go("login");
  },
  async "use-demo"() { localStorage.setItem("svezemete.mode", "demo"); location.reload(); },
  async "use-remote"() { localStorage.setItem("svezemete.mode", "remote"); location.reload(); },
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
    await S.backend.placeOrder({
      rideId: S.rideId, email: S.draft.email, consentTerms: S.draft.consentTerms === true, consentPrice: S.draft.consentPrice === true,
    });
    await refresh();
    S.draft.pin = "";
    S.info = "Objednávka je uložená. Vraťte telefon řidiči.";
    go("pin");
  },
  async "pin-key"(el) {
    const key = el.dataset.key;
    let pin = S.draft.pin || "";
    if (key === "del") pin = pin.slice(0, -1);
    else if (pin.length < 4) pin += key;
    S.draft.pin = pin;
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
    S.error = "Příliš mnoho pokusů. Počkejte půl minuty.";
    render();
    return;
  }
  const ok = await S.backend.checkPin(S.draft.pin);
  if (!ok) {
    S.pinTries += 1;
    S.draft.pin = "";
    S.error = S.pinTries >= 5 ? "Pětkrát špatný PIN. Počkejte 30 sekund." : "Špatný PIN.";
    if (S.pinTries >= 5) { S.pinLockedUntil = Date.now() + 30000; S.pinTries = 0; }
    render();
    return;
  }
  S.customerLock = false;
  S.pinTries = 0;
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
  const base = { mode, db, terms: terms || null, termsVersion: TERMS_VERSION };
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
  const carrier = db.carriers.find((c) => c.id === session.carrierId);
  const driver = db.drivers.find((d) => d.userId === session.userId) || db.drivers.find((d) => d.carrierId === session.carrierId);
  const vehicle = db.vehicles.find((v) => v.carrierId === session.carrierId);
  const eet = db.eetSettings.find((e) => e.carrierId === session.carrierId) || { enabled: false };
  const user = db.users.find((u) => u.id === session.userId);
  return {
    ...base,
    me: { id: session.userId, role: "driver", name: carrier?.name || "", email: user?.email || session.email || "" },
    carrier, driver, vehicle, eet, rides: ridesFor(db, session.carrierId), admin: null,
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
  driver: (r) => ({ id: r.id, carrierId: r.carrier_id, userId: r.user_id, firstName: r.first_name, lastName: r.last_name, licenceNumber: r.licence_number, licenceUntil: r.licence_until || "" }),
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
    if (/schema|relation|function/i.test(msg)) return "Databáze ještě nemá schéma SvezemeTě. Spusťte setup/schema.sql podle README. " + msg;
    return msg;
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
    terms = t.data?.[0]?.body || null;
  }
  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw new Error(friendly(error));
    return data;
  }
  return {
    mode: "remote",
    async init() {
      const sdk = await loadSdk();
      const c = window.SVEZEME_CONFIG;
      sb = sdk.createClient(c.supabaseUrl, c.supabaseAnonKey);
      const { data } = await sb.auth.getSession();
      if (data.session) await pull().catch((e) => { S.error = e.message; });
    },
    async load() { if (session) await pull(); return makeBundle(cache, session, "remote", terms); },
    async register(input) {
      const email = String(input.loginEmail || input.email).trim().toLowerCase();
      const { data, error } = await sb.auth.signUp({ email, password: input.password, options: { data: { name: input.name } } });
      if (error) throw new Error(friendly(error));
      if (!data.session) {
        const pending = { ...input };
        localStorage.setItem("svezemete.pending", JSON.stringify(pending));
        throw new Error("Účet je založený, ale přihlášení ještě není aktivní. Vypněte v Supabase povinné potvrzení e-mailu (návod v README) a pak se přihlaste. Údaje registrace zatím drží tento prohlížeč.");
      }
      await finishRemote(sb, input, data.session.user.id);
      localStorage.removeItem("svezemete.pending");
      await pull();
      return makeBundle(cache, session, "remote", terms);
    },
    async login(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password });
      if (error) throw new Error(/invalid/i.test(error.message) ? "Nesprávný e-mail nebo heslo." : friendly(error));
      await pull();
      const pending = JSON.parse(localStorage.getItem("svezemete.pending") || "null");
      if (pending && session && !session.carrierId && session.role === "driver") {
        await finishRemote(sb, pending, session.userId);
        localStorage.removeItem("svezemete.pending");
        await pull();
      }
      return makeBundle(cache, session, "remote", terms);
    },
    async logout() { await sb.auth.signOut(); session = null; },
    async checkPin(pin) { return rpc("check_pin", { p_pin: pin }); },
    async changePin(pin) { await rpc("set_pin", { p_pin: pin }); },
    async createOffer(input) { const d = await rpc("create_offer", { p_from: input.from, p_to: input.to, p_price: input.priceKc, p_method: input.paymentMethod }); return { rideId: d.rideId }; },
    async placeOrder(input) { await rpc("place_order", { p_ride: input.rideId, p_email: input.email, p_terms: input.consentTerms, p_price: input.consentPrice, p_agent: navigator.userAgent }); },
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
        first_name: patch.firstName, last_name: patch.lastName, licence_number: patch.licenceNumber, licence_until: patch.licenceUntil || null,
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
  const ico = String(input.ico).replace(/\s/g, "");
  const ins = await sb.from("carriers").insert({
    owner_id: userId, name: input.name.trim(), ico, dic: input.dic || "", vat_payer: !!input.vatPayer,
    street: input.street, city: input.city, zip: input.zip, iban: String(input.iban).replace(/\s/g, "").toUpperCase(),
    email: input.email, phone: input.phone, concession_number: input.concessionNumber || "",
    concession_until: input.concessionUntil || null,
  }).select("id").single();
  if (ins.error) throw new Error(ins.error.code === "23505" ? "Dopravce s tímto IČO už existuje." : ins.error.message);
  const cid = ins.data.id;
  const d = await sb.from("drivers").insert({
    carrier_id: cid, user_id: userId, first_name: input.firstName.trim(), last_name: input.lastName.trim(),
    licence_number: input.licenceNumber.trim(), licence_until: input.licenceUntil || null,
  });
  if (d.error) throw new Error(d.error.message);
  const v = await sb.from("vehicles").insert({
    carrier_id: cid, rz: String(input.rz).toUpperCase().trim(), make: input.make.trim(), model: input.model.trim(),
    registry_note: input.registryNote || "", no_taximeter: true,
  });
  if (v.error) throw new Error(v.error.message);
  await sb.from("eet_settings").insert({ carrier_id: cid, enabled: false });
  const pin = await sb.rpc("set_pin", { p_pin: input.pin });
  if (pin.error) throw new Error(pin.error.message);
}

function bind() {
  const root = $("app");
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn || btn.type === "submit") return;
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
    const btn = $("order-btn");
    if (btn) btn.disabled = !(S.draft.consentTerms === true && S.draft.consentPrice === true && validEmail(S.draft.email));
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
  document.body.classList.toggle("night", S.night);
  const wantRemote = configured() && localStorage.getItem("svezemete.mode") !== "demo";
  S.backend = wantRemote ? remoteBackend() : demoBackend();
  if (!wantRemote) localStorage.setItem("svezemete.mode", "demo");
  try { if (S.backend.init) await S.backend.init(); } catch (err) { S.error = err.message; }
  S.bundle = await S.backend.load();
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem("svezemete.ui") || "null"); } catch { /* ignore */ }
  if (S.bundle) {
    S.view = saved?.view && saved.view !== "login" && saved.view !== "boot" ? saved.view : "home";
    S.rideId = saved?.rideId || null;
    S.customerLock = !!saved?.customerLock;
    S.regStep = saved?.regStep || 1;
    if (!rideBy() && ["handoff", "customer", "order", "pin", "ready", "riding", "pay", "confirm", "change", "end-ask"].includes(S.view)) S.view = "home";
  } else S.view = "login";
  render();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }
}

boot();
