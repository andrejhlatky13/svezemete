/**
 * Pravidla jízdy SvezemeTě. Čistá logika bez obrazovky.
 * Demo i testy používají stejné přechody stavů. Server je vynucuje znovu v SQL.
 */
import { TERMS_VERSION } from "./terms.js";

export const PAYMENT_METHODS = [
  { id: "hotovost", label: "Hotovost" },
  { id: "karta", label: "Karta" },
  { id: "qr", label: "QR převod" },
  { id: "faktura", label: "Faktura" },
];

const METHOD_IDS = new Set(PAYMENT_METHODS.map((p) => p.id));

export function paymentLabel(id) {
  return PAYMENT_METHODS.find((p) => p.id === id)?.label || String(id || "");
}

export function formatKc(n) {
  const v = Math.round(Number(n) || 0);
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(v) + "\u00a0Kč";
}

export function validIco(ico) {
  const s = String(ico || "").replace(/\s/g, "");
  if (!/^\d{8}$/.test(s)) return false;
  const w = [8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(s[i]) * w[i];
  const r = sum % 11;
  const check = r === 0 ? 1 : r === 1 ? 0 : 11 - r;
  return check === Number(s[7]);
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function validIban(iban) {
  const s = String(iban || "").replace(/\s/g, "").toUpperCase();
  return /^CZ\d{22}$/.test(s);
}

export function normalizeIban(iban) {
  return String(iban || "").replace(/\s/g, "").toUpperCase();
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashDemoSecret(text) {
  return sha256Hex("svezemete-demo-v1|" + String(text));
}

export function uid() {
  return crypto.randomUUID();
}

export function nowIso(db) {
  const n = db && typeof db._now === "function" ? db._now() : new Date();
  return (n instanceof Date ? n : new Date(n)).toISOString();
}

export function pragueParts(iso) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit",
  }).format(d);
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  return { date, time, both: `${date} ${time}`, key };
}

export function formatWhen(iso, timeSource) {
  if (!iso) return "";
  const base = pragueParts(iso).both;
  if (timeSource === "demo-device") return `${base} (simulace času serveru)`;
  return `${base} (čas serveru)`;
}

export function createEmptyDb() {
  return {
    users: [],
    carriers: [],
    drivers: [],
    vehicles: [],
    offers: [],
    orders: [],
    rides: [],
    payments: [],
    confirmations: [],
    deliveries: [],
    eetSettings: [],
    eetMessages: [],
    audit: [],
  };
}

function stripSecrets(row) {
  if (!row || typeof row !== "object") return row;
  const clone = { ...row };
  for (const k of ["passwordHash", "pinHash", "certPassword", "password", "certBytes", "password_ciphertext", "cert_ciphertext"]) {
    delete clone[k];
  }
  return clone;
}

function audit(db, table, op, row, actorId) {
  const entry = Object.freeze({
    id: uid(),
    ts: nowIso(db),
    table,
    op,
    rowId: row?.id || row?.carrierId || null,
    actorId: actorId || null,
    row: Object.freeze(stripSecrets(row)),
  });
  db.audit.push(entry);
}

function freezePush(list, row) {
  const frozen = Object.freeze(row);
  list.push(frozen);
  return frozen;
}

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

function carrierOf(db, id) {
  return db.carriers.find((c) => c.id === id) || null;
}

function rideOf(db, id) {
  return db.rides.find((r) => r.id === id) || null;
}

function offerOf(db, id) {
  return db.offers.find((o) => o.id === id) || null;
}

function ownRide(db, actor, rideId) {
  const ride = rideOf(db, rideId);
  must(ride, "Jízda neexistuje.");
  must(actor && actor.role === "driver" && actor.carrierId === ride.carrierId, "Tuto jízdu může vést jen její dopravce.");
  const carrier = carrierOf(db, ride.carrierId);
  must(carrier && carrier.status === "active", "Účet dopravce není aktivní.");
  return ride;
}

function replaceRide(db, ride, patch, actorId) {
  const i = db.rides.findIndex((r) => r.id === ride.id);
  const next = { ...db.rides[i], ...patch };
  db.rides[i] = next;
  audit(db, "rides", "UPDATE", { id: next.id, status: next.status, currentOfferId: next.currentOfferId, pendingOfferId: next.pendingOfferId }, actorId);
  return next;
}

function sidloOf(input) {
  const street = String(input.street || "").trim();
  const zip = String(input.zip || "").trim();
  const city = String(input.city || "").trim();
  return [street, [zip, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export function registrationErrors(input, step) {
  const e = [];
  const need = (n) => step == null || step === n;
  if (need(1)) {
    if (!String(input.name || "").trim()) e.push("Vyplňte jméno nebo název firmy.");
    if (!validIco(input.ico)) e.push("IČO musí mít 8 číslic a platnou kontrolní číslici.");
    if (input.vatPayer && !String(input.dic || "").trim()) e.push("U plátce DPH vyplňte DIČ.");
    if (!String(input.street || "").trim() || !String(input.city || "").trim() || !String(input.zip || "").trim()) e.push("Vyplňte sídlo: ulici, PSČ i město.");
    if (!validIban(input.iban)) e.push("Bankovní účet zadejte jako české IBAN (CZ a 22 číslic).");
    if (!validEmail(input.email)) e.push("Vyplňte platný e-mail dopravce.");
    if (String(input.phone || "").replace(/\D/g, "").length < 9) e.push("Vyplňte telefon.");
  }
  if (need(2)) {
    if (!validEmail(input.loginEmail || input.email)) e.push("Vyplňte přihlašovací e-mail.");
    if (String(input.password || "").length < 8) e.push("Heslo musí mít alespoň 8 znaků.");
    if (input.password !== input.password2) e.push("Hesla se neshodují.");
    if (!/^\d{4}$/.test(String(input.pin || ""))) e.push("PIN pro návrat z režimu zákazníka jsou 4 číslice.");
    if (input.pin !== input.pin2) e.push("PIN se neshoduje.");
  }
  if (need(3)) {
    if (!String(input.firstName || "").trim() || !String(input.lastName || "").trim()) e.push("Vyplňte jméno a příjmení řidiče.");
    if (!String(input.licenceNumber || "").trim()) e.push("Vyplňte číslo oprávnění řidiče taxislužby.");
    if (!input.licenceUntil) e.push("Vyplňte platnost oprávnění řidiče taxislužby.");
    if (String(input.rz || "").replace(/\s/g, "").length < 5) e.push("Vyplňte registrační značku vozidla.");
    if (!String(input.make || "").trim() || !String(input.model || "").trim()) e.push("Vyplňte tovární značku a obchodní označení vozidla.");
    if (input.noTaximeter === false) e.push("Tato verze je jen pro jízdu bez taxametru podle § 21 odst. 6. Vozidlo nesmí mít střešní svítilnu ani nápis TAXI.");
  }
  if (need(4)) {
    if (input.acceptPlatform !== true) e.push("Pro odeslání registrace je potřeba souhlas s použitím aplikace.");
  }
  return e;
}

export async function registerDriver(db, input, { activate = true } = {}) {
  const errors = [1, 2, 3, 4].flatMap((s) => registrationErrors(input, s));
  must(!errors.length, errors[0]);
  const email = String(input.loginEmail || input.email).trim().toLowerCase();
  must(!db.users.some((u) => u.email === email), "Účet s tímto e-mailem už v tomto prohlížeči je.");
  const ico = String(input.ico).replace(/\s/g, "");
  must(!db.carriers.some((c) => c.ico === ico), "Dopravce s tímto IČO už existuje.");
  const userId = uid();
  const carrierId = uid();
  const passwordHash = await hashDemoSecret(input.password);
  const pinHash = await hashDemoSecret(input.pin);
  const user = {
    id: userId, email, passwordHash, role: "driver", carrierId, name: String(input.name).trim(),
  };
  const carrier = {
    id: carrierId,
    ownerId: userId,
    name: String(input.name).trim(),
    ico,
    dic: String(input.dic || "").trim(),
    vatPayer: !!input.vatPayer,
    street: String(input.street).trim(),
    city: String(input.city).trim(),
    zip: String(input.zip).trim(),
    sidlo: sidloOf(input),
    iban: normalizeIban(input.iban),
    email: String(input.email).trim(),
    phone: String(input.phone).trim(),
    concessionNumber: String(input.concessionNumber || "").trim(),
    concessionUntil: input.concessionUntil || "",
    status: activate ? "active" : "pending",
    createdAt: nowIso(db),
  };
  const driver = {
    id: uid(),
    carrierId,
    userId,
    firstName: String(input.firstName).trim(),
    lastName: String(input.lastName).trim(),
    licenceNumber: String(input.licenceNumber).trim(),
    licenceUntil: input.licenceUntil,
    pinHash,
  };
  const vehicle = {
    id: uid(),
    carrierId,
    rz: String(input.rz).toUpperCase().replace(/\s+/g, " ").trim(),
    make: String(input.make).trim(),
    model: String(input.model).trim(),
    registryNote: String(input.registryNote || "").trim(),
    noTaximeter: true,
  };
  const eet = defaultEet(carrierId);
  db.users.push(user);
  db.carriers.push(carrier);
  db.drivers.push(driver);
  db.vehicles.push(vehicle);
  db.eetSettings.push(eet);
  audit(db, "carriers", "INSERT", carrier, userId);
  audit(db, "drivers", "INSERT", { id: driver.id, event: "registrace" }, userId);
  return { user: stripSecrets(user), carrier, driver: stripSecrets(driver), vehicle, eet };
}

function defaultEet(carrierId) {
  return {
    carrierId,
    enabled: false,
    dicEic: "",
    evidencniJednotka: "",
    zarizeni: "SVEZEMETE-1",
    simulateOffline: false,
    certUploaded: false,
    certFilename: "",
  };
}

export async function loginDemo(db, email, password) {
  const user = db.users.find((u) => u.email === String(email || "").trim().toLowerCase());
  must(user, "Nesprávný e-mail nebo heslo.");
  const hash = await hashDemoSecret(password);
  must(user.passwordHash === hash, "Nesprávný e-mail nebo heslo.");
  return stripSecrets(user);
}

export async function checkPin(db, userId, pin) {
  const driver = db.drivers.find((d) => d.userId === userId);
  if (!driver) return false;
  const hash = await hashDemoSecret(pin);
  return driver.pinHash === hash;
}

export async function setPin(db, actor, pin) {
  must(/^\d{4}$/.test(String(pin || "")), "PIN jsou 4 číslice.");
  const driver = db.drivers.find((d) => d.userId === actor.userId);
  must(driver && driver.carrierId === actor.carrierId, "Řidič nenalezen.");
  driver.pinHash = await hashDemoSecret(pin);
  audit(db, "drivers", "UPDATE", { id: driver.id, event: "pin_set" }, actor.userId);
}

function snapshot(db, carrierId) {
  const c = carrierOf(db, carrierId);
  const d = db.drivers.find((x) => x.carrierId === carrierId);
  const v = db.vehicles.find((x) => x.carrierId === carrierId);
  must(c && d && v, "Chybí údaje dopravce, řidiče nebo vozidla.");
  return Object.freeze({
    carrierName: c.name,
    ico: c.ico,
    dic: c.dic,
    sidlo: c.sidlo,
    email: c.email,
    phone: c.phone,
    driverName: `${d.firstName} ${d.lastName}`.trim(),
    licenceNumber: d.licenceNumber,
    rz: v.rz,
    make: v.make,
    model: v.model,
    noTaximeter: true,
  });
}

async function makeOffer(db, ride, input, version, groupId) {
  const from = String(input.from || "").trim();
  const to = String(input.to || "").trim();
  const priceKc = Math.round(Number(input.priceKc));
  const paymentMethod = input.paymentMethod;
  must(from.length >= 2 && to.length >= 2, "Vyplňte, odkud a kam jedete.");
  must(Number.isFinite(priceKc) && priceKc > 0 && priceKc <= 1000000, "Zadejte konečnou cenu v korunách.");
  must(METHOD_IDS.has(paymentMethod), "Vyberte způsob platby.");
  const snap = snapshot(db, ride.carrierId);
  const serverCreatedAt = nowIso(db);
  const draft = {
    version, fromPlace: from, toPlace: to, priceKc, paymentMethod,
    snapshot: snap, serverCreatedAt,
  };
  const contentHash = await sha256Hex([
    version, from, to, priceKc, paymentMethod, snap.ico, snap.rz, snap.driverName, serverCreatedAt,
  ].join("|"));
  const offer = freezePush(db.offers, {
    id: uid(),
    carrierId: ride.carrierId,
    rideId: ride.id,
    groupId,
    version,
    fromPlace: from,
    toPlace: to,
    priceKc,
    paymentMethod,
    snapshot: snap,
    contentHash,
    termsVersionId: TERMS_VERSION,
    serverCreatedAt,
    timeSource: "demo-device",
  });
  audit(db, "offers", "INSERT", offer, ride.carrierId);
  return offer;
}

export async function createOffer(db, actor, input) {
  must(actor?.role === "driver", "Nabídku zakládá řidič.");
  const carrier = carrierOf(db, actor.carrierId);
  must(carrier && carrier.status === "active", "Účet není aktivní. Dokud správce registraci neschválí, jízdu založit nejde.");
  const ride = {
    id: uid(),
    carrierId: actor.carrierId,
    driverId: db.drivers.find((d) => d.carrierId === actor.carrierId)?.id || null,
    vehicleId: db.vehicles.find((v) => v.carrierId === actor.carrierId)?.id || null,
    status: "awaiting_customer",
    currentOfferId: null,
    pendingOfferId: null,
    startedAt: null,
    endedAt: null,
    cancelReason: "",
    createdAt: nowIso(db),
    timeSource: "demo-device",
  };
  db.rides.push(ride);
  const offer = await makeOffer(db, ride, input, 1, uid());
  ride.currentOfferId = offer.id;
  audit(db, "rides", "INSERT", { id: ride.id, status: ride.status, currentOfferId: offer.id }, actor.userId);
  return { ride: { ...ride }, offer };
}

export async function proposeChange(db, actor, rideId, input) {
  const ride = ownRide(db, actor, rideId);
  must(["ordered", "in_progress"].includes(ride.status), "Trasu a cenu lze měnit u objednané jízdy, a zákazník musí změnu potvrdit ještě předtím, než začne platit.");
  must(!ride.pendingOfferId, "Už čekáte na souhlas zákazníka s předchozím návrhem. Nejdřív ho potvrďte, nebo návrh zrušte.");
  const current = offerOf(db, ride.currentOfferId);
  const offer = await makeOffer(db, ride, input, current.version + 1, current.groupId);
  const next = replaceRide(db, ride, { pendingOfferId: offer.id }, actor.userId);
  return { ride: next, offer };
}

export function discardChange(db, actor, rideId) {
  const ride = ownRide(db, actor, rideId);
  must(ride.pendingOfferId, "Žádná změna nečeká na souhlas.");
  return replaceRide(db, ride, { pendingOfferId: null }, actor.userId);
}

export function placeOrder(db, actor, { rideId, email, consentTerms, consentPrice, userAgent }) {
  const ride = rideOf(db, rideId);
  must(ride, "Jízda neexistuje.");
  must(consentTerms === true && consentPrice === true, "Bez obou souhlasů nelze jízdu objednat.");
  must(validEmail(email), "Zadejte e-mail, kam pošleme potvrzení.");
  const offerId = ride.pendingOfferId || (ride.status === "awaiting_customer" ? ride.currentOfferId : null);
  must(offerId, "Teď není co objednat.");
  const offer = offerOf(db, offerId);
  must(offer, "Nabídka neexistuje.");
  must(!db.orders.some((o) => o.offerId === offer.id), "Tato nabídka už byla objednaná.");
  if (!ride.pendingOfferId) must(ride.status === "awaiting_customer", "Objednávku teď nelze podat.");
  const year = Number(pragueParts(nowIso(db)).key.slice(0, 4));
  const n = db.orders.filter((o) => o.carrierId === ride.carrierId && o.orderNumber.startsWith(`ST-${year}-`)).length + 1;
  const order = freezePush(db.orders, {
    id: uid(),
    carrierId: ride.carrierId,
    rideId: ride.id,
    offerId: offer.id,
    orderNumber: `ST-${year}-${String(n).padStart(6, "0")}`,
    customerEmail: String(email).trim(),
    consentTerms: true,
    consentPriceRoute: true,
    termsVersionId: TERMS_VERSION,
    orderedAt: nowIso(db),
    timeSource: "demo-device",
    userAgent: userAgent || "",
  });
  audit(db, "orders", "INSERT", order, null);
  if (ride.pendingOfferId) {
    replaceRide(db, ride, { currentOfferId: offer.id, pendingOfferId: null }, actor?.userId || null);
  } else {
    replaceRide(db, ride, { status: "ordered" }, null);
  }
  return { order, ride: rideOf(db, ride.id) };
}

export function startRide(db, actor, rideId) {
  const ride = ownRide(db, actor, rideId);
  must(!ride.pendingOfferId, "Nejdřív musí zákazník potvrdit novou cenu a trasu, nebo návrh změny zrušte.");
  must(ride.status === "ordered", "Jízdu lze zahájit jen po objednávce zákazníka.");
  const order = db.orders.find((o) => o.offerId === ride.currentOfferId);
  must(order, "Jízdu nelze zahájit před objednávkou zákazníka.");
  const startedAt = nowIso(db);
  must(new Date(startedAt).getTime() >= new Date(order.orderedAt).getTime(), "Čas zahájení je před objednávkou.");
  return replaceRide(db, ride, { status: "in_progress", startedAt }, actor.userId);
}

export function cancelRide(db, actor, rideId, reason) {
  const ride = ownRide(db, actor, rideId);
  must(["awaiting_customer", "ordered"].includes(ride.status), "Po zahájení jízdy už objednávku nezrušíte. Jízdu ukončete.");
  return replaceRide(db, ride, { status: "cancelled", pendingOfferId: null, cancelReason: String(reason || "Zrušeno před jízdou") }, actor.userId);
}

function buildBody(db, ride, offer, order, endedAt) {
  const s = offer.snapshot;
  const start = pragueParts(ride.startedAt);
  const end = pragueParts(endedAt);
  return Object.freeze({
    evidencniCislo: order.orderNumber,
    carrierName: s.carrierName,
    sidlo: s.sidlo,
    ico: s.ico,
    driverName: s.driverName,
    rz: s.rz,
    make: s.make,
    model: s.model,
    date: start.date,
    startedAt: start.both,
    endedAt: end.both,
    startedAtIso: ride.startedAt,
    endedAtIso: endedAt,
    from: offer.fromPlace,
    to: offer.toPlace,
    priceKc: offer.priceKc,
    paymentMethod: offer.paymentMethod,
    paymentLabel: paymentLabel(offer.paymentMethod),
    termsVersionId: order.termsVersionId,
    contentHash: offer.contentHash,
    timeSource: "demo-device",
    orderedAt: pragueParts(order.orderedAt).both,
    orderedAtIso: order.orderedAt,
    offerCreatedAt: pragueParts(offer.serverCreatedAt).both,
    offerCreatedAtIso: offer.serverCreatedAt,
  });
}

export function endRide(db, actor, rideId) {
  const ride = ownRide(db, actor, rideId);
  must(ride.status === "in_progress", "Ukončit lze jen probíhající jízdu.");
  must(!ride.pendingOfferId, "Nejdřív zákazník potvrdí změnu ceny a trasy, nebo návrh zrušte. Jinak by nebylo jasné, jaká cena platí.");
  const offer = offerOf(db, ride.currentOfferId);
  const order = db.orders.find((o) => o.offerId === offer.id);
  must(order, "Chybí objednávka zákazníka.");
  const endedAt = nowIso(db);
  const next = replaceRide(db, ride, { status: "completed", endedAt }, actor.userId);
  const payment = {
    id: uid(),
    carrierId: ride.carrierId,
    rideId: ride.id,
    method: offer.paymentMethod,
    amountKc: offer.priceKc,
    status: "pending",
    confirmedAt: null,
    confirmedBy: null,
  };
  db.payments.push(payment);
  audit(db, "payments", "INSERT", payment, actor.userId);
  const confirmation = freezePush(db.confirmations, {
    id: uid(),
    carrierId: ride.carrierId,
    rideId: ride.id,
    orderId: order.id,
    evidencniCislo: order.orderNumber,
    customerEmail: order.customerEmail,
    body: buildBody(db, next, offer, order, endedAt),
    createdAt: endedAt,
    timeSource: "demo-device",
  });
  audit(db, "confirmations", "INSERT", confirmation, actor.userId);
  return { ride: next, payment, confirmation };
}

export function markPaid(db, actor, rideId) {
  const ride = ownRide(db, actor, rideId);
  must(ride.status === "completed", "Platbu lze potvrdit až po ukončení jízdy.");
  const payment = db.payments.find((p) => p.rideId === rideId);
  must(payment, "Platba neexistuje.");
  if (payment.status === "paid") return payment;
  payment.status = "paid";
  payment.confirmedAt = nowIso(db);
  payment.confirmedBy = actor.userId;
  audit(db, "payments", "UPDATE", { id: payment.id, status: "paid", amountKc: payment.amountKc, method: payment.method }, actor.userId);
  return payment;
}

export function recordSimulatedEmail(db, confirmationId) {
  const confirmation = db.confirmations.find((c) => c.id === confirmationId);
  must(confirmation, "Potvrzení neexistuje.");
  const delivery = freezePush(db.deliveries, {
    id: uid(),
    confirmationId,
    carrierId: confirmation.carrierId,
    status: "simulated",
    provider: "demo",
    providerId: null,
    error: "",
    to: confirmation.customerEmail,
    attemptedAt: nowIso(db),
  });
  audit(db, "deliveries", "INSERT", delivery, null);
  return delivery;
}

export function setEet(db, actor, patch) {
  must(actor?.role === "driver", "Nastavení EET patří řidiči.");
  let row = db.eetSettings.find((e) => e.carrierId === actor.carrierId);
  if (!row) {
    row = defaultEet(actor.carrierId);
    db.eetSettings.push(row);
  }
  row.enabled = !!patch.enabled;
  row.dicEic = String(patch.dicEic || "").trim();
  row.evidencniJednotka = String(patch.evidencniJednotka || "").trim();
  row.zarizeni = String(patch.zarizeni || "SVEZEMETE-1").trim() || "SVEZEMETE-1";
  row.simulateOffline = !!patch.simulateOffline;
  if (patch.certFilename) row.certFilename = String(patch.certFilename);
  if (patch.certUploaded === true) row.certUploaded = true;
  delete row.certPassword;
  delete row.certBytes;
  audit(db, "eet_settings", "UPDATE", {
    carrierId: row.carrierId, enabled: row.enabled, dicEic: row.dicEic,
    evidencniJednotka: row.evidencniJednotka, zarizeni: row.zarizeni, certUploaded: row.certUploaded,
  }, actor.userId);
  return { ...row };
}

/** Zkušební evidence. Na Finanční správu se nic neposílá. Při vypnutém EET se nic nezapíše. */
export function recordEet(db, actor, paymentId, { offline = false } = {}) {
  const payment = db.payments.find((p) => p.id === paymentId);
  must(payment, "Platba neexistuje.");
  must(actor.carrierId === payment.carrierId, "Cizí platba.");
  const eet = db.eetSettings.find((e) => e.carrierId === payment.carrierId);
  if (!eet || !eet.enabled) return { skipped: true };
  const confirmation = db.confirmations.find((c) => c.rideId === payment.rideId);
  const attempt = db.eetMessages.filter((m) => m.paymentId === payment.id).length + 1;
  const base = {
    id: uid(),
    carrierId: payment.carrierId,
    paymentId: payment.id,
    rideId: payment.rideId,
    poradoveCislo: confirmation?.evidencniCislo || "",
    amountKc: payment.amountKc,
    trzbaAt: payment.confirmedAt || nowIso(db),
    attempt,
    createdAt: nowIso(db),
    stub: true,
    firstSend: attempt === 1,
  };
  let row;
  if (offline || eet.simulateOffline) {
    row = { ...base, status: "queued", pok: null, error: "" };
  } else if (!eet.dicEic || !eet.evidencniJednotka || !eet.zarizeni) {
    row = { ...base, status: "error", pok: null, error: "Neúplné nastavení EET. Jízda tím není blokovaná." };
  } else {
    row = { ...base, status: "stub_ok", pok: "STUB-" + uid().slice(0, 8).toUpperCase(), error: "" };
  }
  freezePush(db.eetMessages, row);
  audit(db, "eet_messages", "INSERT", { id: row.id, status: row.status, stub: true, pok: row.pok ? "ano" : "ne" }, actor.userId);
  return { skipped: false, queued: row.status === "queued", pok: row.pok, error: row.error, stub: true, status: row.status };
}

export function flushEet(db, actor) {
  const eet = db.eetSettings.find((e) => e.carrierId === actor.carrierId);
  if (!eet || !eet.enabled) return [];
  const queued = db.eetMessages.filter((m) => m.carrierId === actor.carrierId && m.status === "queued");
  const done = [];
  for (const m of queued) {
    const newer = db.eetMessages.some((x) => x.paymentId === m.paymentId && x.attempt > m.attempt);
    if (newer) continue;
    const row = freezePush(db.eetMessages, {
      ...m,
      id: uid(),
      attempt: m.attempt + 1,
      createdAt: nowIso(db),
      status: "stub_ok",
      pok: "STUB-" + uid().slice(0, 8).toUpperCase(),
      error: "",
      firstSend: false,
      stub: true,
    });
    done.push(row);
  }
  return done;
}

export function updateProfile(db, actor, patch) {
  const carrier = carrierOf(db, actor.carrierId);
  must(carrier && actor.role === "driver", "Profil nenalezen.");
  const fields = ["name", "dic", "phone", "email", "street", "city", "zip", "iban", "concessionNumber", "concessionUntil"];
  for (const f of fields) if (patch[f] != null) carrier[f] = String(patch[f]).trim();
  if (patch.vatPayer != null) carrier.vatPayer = !!patch.vatPayer;
  if (patch.iban) {
    must(validIban(patch.iban), "IBAN nemá tvar českého účtu.");
    carrier.iban = normalizeIban(patch.iban);
  }
  if (patch.email) must(validEmail(patch.email), "E-mail dopravce není platný.");
  carrier.sidlo = sidloOf(carrier);
  const driver = db.drivers.find((d) => d.carrierId === actor.carrierId);
  const vehicle = db.vehicles.find((v) => v.carrierId === actor.carrierId);
  if (patch.firstName) driver.firstName = String(patch.firstName).trim();
  if (patch.lastName) driver.lastName = String(patch.lastName).trim();
  if (patch.licenceNumber) driver.licenceNumber = String(patch.licenceNumber).trim();
  if (patch.licenceUntil) driver.licenceUntil = patch.licenceUntil;
  if (patch.rz) vehicle.rz = String(patch.rz).toUpperCase().trim();
  if (patch.make) vehicle.make = String(patch.make).trim();
  if (patch.model) vehicle.model = String(patch.model).trim();
  if (patch.registryNote != null) vehicle.registryNote = String(patch.registryNote).trim();
  audit(db, "carriers", "UPDATE", { id: carrier.id, event: "profil", name: carrier.name, ico: carrier.ico }, actor.userId);
  return { carrier, driver: stripSecrets(driver), vehicle };
}

export function setCarrierStatus(db, actor, carrierId, status) {
  must(actor?.role === "admin", "Jen správce může měnit stav registrace.");
  must(["pending", "active", "suspended"].includes(status), "Neznámý stav.");
  const carrier = carrierOf(db, carrierId);
  must(carrier, "Dopravce nenalezen.");
  carrier.status = status;
  audit(db, "carriers", "UPDATE", { id: carrier.id, status }, actor.userId);
  return carrier;
}

export function confirmationLines(body) {
  const lines = [
    ["Evidenční číslo", body.evidencniCislo],
    ["Dopravce", body.carrierName],
    ["Sídlo", body.sidlo],
    ["IČO", body.ico],
    ["Řidič", body.driverName],
    ["Registrační značka", body.rz],
    ["Vozidlo", `${body.make} ${body.model}`.trim()],
    ["Datum", body.date],
    body.orderedAt ? ["Čas objednání", body.orderedAt] : null,
    body.offerCreatedAt ? ["Čas vytvoření nabídky", body.offerCreatedAt] : null,
    ["Zahájení", body.startedAt],
    ["Ukončení", body.endedAt],
    ["Odkud", body.from],
    ["Kam", body.to],
    ["Konečná cena", formatKc(body.priceKc)],
    ["Způsob platby", body.paymentLabel || paymentLabel(body.paymentMethod)],
  ];
  return lines.filter((row) => row && row[1] != null && row[1] !== "");
}

export function latestEet(db, rideId) {
  const rows = db.eetMessages.filter((m) => m.rideId === rideId);
  return rows.length ? rows[rows.length - 1] : null;
}

export function confirmationView(db, confirmation) {
  const eet = db.eetSettings.find((e) => e.carrierId === confirmation.carrierId);
  const lines = confirmationLines(confirmation.body);
  const view = {
    lines,
    email: confirmation.customerEmail,
    timeSource: confirmation.timeSource,
    createdAt: confirmation.createdAt,
    eet: null,
  };
  if (eet?.enabled) {
    const last = latestEet(db, confirmation.rideId);
    view.eet = {
      enabled: true,
      stub: true,
      pok: last?.pok || null,
      status: last?.status || "not_sent",
      error: last?.error || "",
    };
  }
  return view;
}

export function emailStatusView(delivery) {
  if (!delivery) return { kind: "none", text: "E-mail se zatím neodeslal." };
  if (delivery.status === "sent") return { kind: "sent", text: "E-mail odeslán" };
  if (delivery.status === "simulated") {
    return {
      kind: "simulated",
      text: `Simulace: potvrzení se v demo režimu neodesílá. Na ostrém serveru by odešlo na ${delivery.to}.`,
    };
  }
  return { kind: "failed", text: `E-mail se nepodařilo odeslat. ${delivery.error || "Zkuste to znovu."}`.trim() };
}

export function rideBundle(db, ride) {
  const offer = offerOf(db, ride.currentOfferId);
  const pending = ride.pendingOfferId ? offerOf(db, ride.pendingOfferId) : null;
  const orders = db.orders.filter((o) => o.rideId === ride.id);
  const order = orders.find((o) => o.offerId === ride.currentOfferId) || null;
  const payment = db.payments.find((p) => p.rideId === ride.id) || null;
  const confirmation = db.confirmations.find((c) => c.rideId === ride.id) || null;
  const deliveries = confirmation ? db.deliveries.filter((d) => d.confirmationId === confirmation.id) : [];
  const delivery = deliveries.length ? deliveries[deliveries.length - 1] : null;
  return { ride, offer, pending, orders, order, payment, confirmation, delivery };
}

export function ridesFor(db, carrierId) {
  return db.rides
    .filter((r) => !carrierId || r.carrierId === carrierId)
    .map((r) => rideBundle(db, r))
    .sort((a, b) => String(b.ride.createdAt).localeCompare(String(a.ride.createdAt)));
}

export function paymentSums(bundles) {
  const sums = { hotovost: 0, karta: 0, qr: 0, faktura: 0, paid: 0 };
  for (const b of bundles) {
    if (b.ride.status !== "completed" || !b.offer) continue;
    sums[b.offer.paymentMethod] = (sums[b.offer.paymentMethod] || 0) + b.offer.priceKc;
    if (b.payment?.status === "paid") sums.paid += b.payment.amountKc;
  }
  return sums;
}

function csvCell(v) {
  const s = String(v ?? "");
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(db, carrierId) {
  const eetOn = !!db.eetSettings.find((e) => e.carrierId === carrierId && e.enabled);
  const header = [
    "Číslo objednávky", "Datum", "Čas objednání", "Zahájení", "Ukončení", "Odkud", "Kam", "Konečná cena (Kč)",
    "Způsob platby", "Stav platby", "Dopravce", "IČO", "Řidič", "RZ", "Značka", "Model",
    "E-mail zákazníka", "Stav potvrzení",
  ];
  if (eetOn) header.push("EET kód (zkušební)");
  const lines = [header.join(";")];
  for (const b of ridesFor(db, carrierId)) {
    if (!b.confirmation) continue;
    const body = b.confirmation.body;
    const email = emailStatusView(b.delivery);
    const emailCol = email.kind === "sent" ? "odesláno" : email.kind === "simulated" ? "simulace" : email.kind === "failed" ? "chyba" : "neodesláno";
    const pay = b.payment?.status === "paid" ? "ZAPLACENO" : "ČEKÁ NA PLATBU";
    const row = [
      body.evidencniCislo, body.date, body.orderedAt || "", body.startedAt, body.endedAt, body.from, body.to, body.priceKc,
      body.paymentLabel, pay, body.carrierName, body.ico, body.driverName, body.rz, body.make, body.model,
      b.confirmation.customerEmail, emailCol,
    ];
    if (eetOn) row.push(latestEet(db, b.ride.id)?.pok || "");
    lines.push(row.map(csvCell).join(";"));
  }
  return "\uFEFF" + lines.join("\r\n");
}

function deepFreeze(obj) {
  if (!obj || typeof obj !== "object" || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const v of Object.values(obj)) if (v && typeof v === "object") deepFreeze(v);
  return obj;
}

export function rehydrate(db) {
  if (!db || !Array.isArray(db.users)) return createEmptyDb();
  for (const key of ["users", "carriers", "drivers", "vehicles", "offers", "orders", "rides", "payments", "confirmations", "deliveries", "eetSettings", "eetMessages", "audit"]) {
    if (!Array.isArray(db[key])) db[key] = [];
  }
  for (const row of [...db.offers, ...db.orders, ...db.confirmations, ...db.deliveries, ...db.eetMessages]) deepFreeze(row);
  for (const c of db.carriers) {
    if (!db.eetSettings.some((e) => e.carrierId === c.id)) db.eetSettings.push(defaultEet(c.id));
  }
  return db;
}

export const RIDE_LABEL = {
  awaiting_customer: "Čeká na zákazníka",
  ordered: "Objednáno",
  in_progress: "Jízda probíhá",
  completed: "Ukončeno",
  cancelled: "Zrušeno",
};

export const STATUS_CARRIER = {
  pending: "Čeká na ověření",
  active: "Aktivní",
  suspended: "Pozastaveno",
};
