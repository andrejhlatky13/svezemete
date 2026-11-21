/**
 * Obchodní podmínky. Každá verze je neměnná: objednávka si pamatuje id verze, se kterou zákazník souhlasil.
 * Stejný text je v databázi (tabulka terms_versions, migrace setup/migrations/2026-11-21-005-terms-v2-1.sql).
 * Položka s k: "part" je nadpis části, k: "note" je poznámka pod částí.
 */
export const TERMS_VERSION = "2.1";

export const TERMS_VERSIONS = {
  "2.1": {
    id: "2.1",
    title: "Obchodní podmínky SvezemeTě",
    label: "verze 2.1 ze dne 12. 11. 2026",
    validFrom: "21. 11. 2026",
    body: [
  {
    "k": "part",
    "h": "Část 1 ze 4: Elektronická objednávka přepravy",
    "p": ""
  },
  {
    "h": "1. Dopravce a působnost podmínek",
    "p": "Provozovatelem aplikace SvezemeTě je Tomáš Pavlinský, IČO 05964393, se sídlem Květná 279, 747 57 Slavkov. Kontakt pro záležitosti aplikace: info@svezemete.cz, +420 733 304 404. Smlouvu o přepravě zákazník uzavírá s dopravcem uvedeným v nabídce. Tento dopravce zajišťuje přepravu, vystavuje potvrzení a vyřizuje reklamace přepravy."
  },
  {
    "h": "2. Nabídka a uzavření smlouvy o přepravě",
    "p": "Řidič připraví nabídku se sjednanou trasou, místem a časem nástupu, konečnou cenou a způsobem úhrady. Zákazník před objednáním obdrží údaje dopravce, celé jméno řidiče, RZ, značku a model vozidla a může si přečíst a uložit tyto podmínky. Před potvrzením může opravit údaje nebo nabídku odmítnout. Konkrétní dohoda o jízdě má přednost před těmito podmínkami."
  },
  {
    "h": "3. Potvrzení zákazníkem a povinnost zaplatit",
    "p": "Smlouva o přepravě se v navrženém postupu uzavírá osobním stisknutím tlačítka „Objednávám jízdu za [částka] Kč“ zákazníkem a úspěšným zaznamenáním objednávky systémem. Zákazník tím objednává placenou přepravu za uvedenou konečnou cenu. Před tímto úkonem musí být dostupný celý text podmínek. Zákazník samostatně zaškrtne dvě předem nezaškrtnutá povinná pole: „Souhlasím s obchodními podmínkami“ a „Souhlasím se smluvní cenou a danou trasou přepravy“. Bez obou souhlasů nelze objednávku potvrdit. Pouhé vyplnění nabídky řidičem objednávku zákazníka nenahrazuje. Řidič nesmí souhlas provést za zákazníka."
  },
  {
    "h": "4. Telefon řidiče a záznam objednávky",
    "p": "Návrh počítá s tím, že zákazník nabídku zkontroluje a objednávku osobně provede na telefonu řidiče před zahájením jízdy. Přípustnost tohoto konkrétního postupu je předmětem posouzení příslušného orgánu. Aplikace má uložit číslo a obsah objednávky, konečnou cenu, čas zákaznického úkonu, stav obou souhlasů a verzi podmínek. Záznam kliknutí sám nezaručuje, kdo úkon provedl; zákonná práva zákazníka na zpochybnění objednávky tím nejsou omezena."
  },
  {
    "h": "4a. Označení vozidla bez taxametru",
    "p": "Řidič nesmí při poskytování přepravy použít vozidlo bez taxametru označené střešní svítilnou TAXI, nápisem TAXI nebo jiným způsobem zaměnitelným s tímto označením. Nestačí svítilnu pouze vypnout. Dodržení zákazu zajistí také dopravce. Vozidlo však musí být zapsáno v evidenci vozidel taxislužby a označeno předepsanou evidenční nálepkou; průkaz řidiče taxislužby musí být pro cestující viditelný a čitelný. Právní základ: § 21 odst. 7 písm. b) a § 21d odst. 1, 3 a 5 zákona č. 111/1994 Sb."
  },
  {
    "k": "note",
    "h": "",
    "p": "Podmínky upravují smluvní vztah vznikající elektronickou objednávkou. Nejde o samostatnou písemnou smlouvu pro režim § 21 odst. 5 zákona o silniční dopravě."
  },
  {
    "k": "part",
    "h": "Část 2 ze 4: Cena, platba a průběh jízdy",
    "p": ""
  },
  {
    "h": "5. Konečná cena a úhrada",
    "p": "Cena zobrazená před objednáním je konečná cena sjednané přepravy, včetně všech daní a povinných nákladů. Zahrnuje běžné dopravní zdržení a nutnou objížďku, pokud zákazník nezmění rozsah služby. Další poplatky nelze přičítat jednostranně. Zákazník před objednáním vybere způsob úhrady z možností dopravce: hotově po jízdě, kartou přes terminál řidiče nebo online, QR bankovním převodem, případně na fakturu po schválení dopravcem. U faktury se předem dohodne splatnost a doplní fakturační údaje. QR kód, vystavená faktura ani zahájená karetní transakce samy neprokazují zaplacení. Stav úhrady se eviduje zvlášť podle skutečného přijetí peněz nebo potvrzení platební služby. Zákazník před objednáním vidí upozornění, že vzniká povinnost zaplatit."
  },
  {
    "h": "6. Změna trasy, zastávky a čekání",
    "p": "Zákazník může navrhnout změnu cíle, další zastávku nebo čekání. Pokud mění rozsah služby nebo cenu, dopravce nejprve sdělí novou konečnou cenu a změnu uskuteční až po doložitelném souhlasu zákazníka. Změna se zaznamená v historii objednávky a promítne do potvrzení po jízdě. Bez souhlasu s novou cenou platí původní dohoda. Za čekání ani zastávky se neúčtuje dodatečná částka, která nebyla předem výslovně dohodnuta."
  },
  {
    "h": "7. Zrušení objednávky a předčasné ukončení",
    "p": "V tomto návrhu může zákazník jízdu před zahájením zrušit bez storno poplatku, prostřednictvím řidiče nebo kontaktem dopravce. Není sjednán poplatek za nedostavení se. Pokud zákazník po zahájení požádá o ukončení jízdy, vozidlo zastaví na nejbližším bezpečném a dovoleném místě; cena se přiměřeně sníží podle skutečně poskytnuté části přepravy, nejvýše do původní ceny. Zruší-li jízdu dopravce před zahájením, bezodkladně vrátí případnou zálohu. Tím nejsou dotčeny zákonné nároky zákazníka."
  },
  {
    "h": "8. Bezpečnost, zavazadla a odpovědnost",
    "p": "Dopravce poskytne přepravu bezpečně a s odbornou péčí. Cestující dodržuje bezpečnostní pokyny, používá předepsané zádržné systémy a nesmí ohrožovat řidiče ani jiné osoby. Dětskou sedačku, větší zavazadla, zvíře nebo zvláštní potřeby je vhodné domluvit předem. Řidič může odmítnout nebo bezpečně ukončit přepravu, pokud by její provedení bylo protiprávní nebo představovalo konkrétní bezpečnostní riziko. Samotné zdravotní postižení není důvodem odmítnutí. Odpovědnost dopravce i cestujícího se řídí zákonem; nevzniká automatická paušální pokuta za znečištění. Případná náhrada škody musí mít právní základ a prokázaný rozsah."
  },
  {
    "h": "9. Potvrzení o přepravě a technická chyba",
    "p": "Zákazník zadá funkční e-mail a před objednáním může opravit překlep. Dopravce bezprostředně po ukončení zašle zákonné potvrzení o přepravě s číslem, údaji dopravce, řidiče a vozidla, datem, časy, výchozím a cílovým místem a konečnou cenou. Přiloží též sjednanou verzi podmínek. Chyba odeslání se neoznačí za úspěch a dopravce ji bezodkladně řeší. Tyto podmínky nenahrazují zákonnou povinnost potvrzení zaslat. Pokud nelze před jízdou řádně zaznamenat objednávku, nesmí být jízda v tomto režimu zahájena."
  },
  {
    "k": "part",
    "h": "Část 3 ze 4: Reklamace a další ujednání",
    "p": ""
  },
  {
    "h": "10. Reklamace a práva z vadné přepravy",
    "p": "Reklamaci lze uplatnit u dopravce v jeho sídle nebo na jeho reklamačním e-mailu uvedeném v nabídce. Pro dohledání pomůže číslo objednávky nebo datum a trasa; zákazník popíše závadu a požadované řešení. Dopravce vydá písemné potvrzení o přijetí, obsahu a požadovaném způsobu vyřízení. Reklamaci vyřídí a spotřebitele o výsledku informuje nejpozději do 30 dnů, pokud se výslovně nedohodnou na delší lhůtě; vydá potvrzení o vyřízení nebo písemné odůvodnění zamítnutí. Zákonná práva včetně případné přiměřené slevy, vrácení ceny nebo náhrady škody nejsou omezena. Reklamaci není nutné uplatnit již při jízdě."
  },
  {
    "h": "11. Zrušení a odstoupení od smlouvy",
    "p": "Na smlouvy o přepravě osob se podle § 1840 písm. h) občanského zákoníku nevztahuje obecné čtrnáctidenní právo odstoupit od distanční smlouvy bez udání důvodu. Tím není omezeno bezplatné zrušení před zahájením podle článku 7 ani právo odstoupit nebo uplatnit jiný nárok v případech stanovených zákonem, zejména při porušení smlouvy dopravcem."
  },
  {
    "h": "12. Mimosoudní řešení spotřebitelských sporů",
    "p": "Pokud se spotřebitelský spor nepodaří vyřešit přímo s dopravcem, může spotřebitel podat návrh na mimosoudní řešení u České obchodní inspekce, prostřednictvím informací a formuláře na https://coi.gov.cz/informace-o-adr/. Návrh lze podat nejpozději do jednoho roku ode dne prvního uplatnění daného práva u dopravce. Právo obrátit se na soud tím není dotčeno."
  },
  {
    "h": "13. Osobní údaje",
    "p": "Dopravce uvedený v nabídce používá údaje objednávky a e-mail pro sjednání a splnění přepravy a zaslání potvrzení; zákonné potvrzení uchovává nejméně 3 roky. Další uchování se odvíjí od konkrétní zákonné povinnosti nebo přiměřené ochrany právních nároků. Souhlas s obchodními podmínkami není souhlasem s marketingem. Úplná informace podle čl. 13 GDPR, včetně příjemců, dob uložení a práv zákazníka, musí být před sběrem údajů samostatně dostupná v rozhraní; tyto podmínky ji nenahrazují."
  },
  {
    "h": "14. Znění podmínek a závěrečná ustanovení",
    "p": "Pro objednávku platí znění, které zákazník obdržel před objednáním. Pozdější změny se na již uzavřenou smlouvu zpětně nevztahují. Podmínky se vykládají podle českého práva při zachování kogentní ochrany spotřebitele. Neplatnost jednotlivého ujednání neodnímá zákazníkovi jeho zákonná práva."
  },
  {
    "k": "part",
    "h": "Část 4 ze 4: Podmínky provozu taxislužby – povinnosti dopravce a řidiče",
    "p": ""
  },
  {
    "h": "15. Zákonné předpoklady poskytování přepravy",
    "p": "Dopravce a řidič jsou povinni po celou dobu poskytování přepravy splňovat všechny použitelné požadavky právních předpisů. Níže uvedený přehled není vyčerpávající. Elektronická objednávka ani její potvrzení zákazníkem nenahrazují oprávnění k podnikání, oprávnění řidiče, evidenci vozidla, jeho technickou způsobilost ani pojištění."
  },
  {
    "h": "15.1 Dopravce a oprávnění k podnikání",
    "p": "Dopravce musí mít platnou koncesi pro příslušný druh silniční motorové osobní dopravy. Přepravu smí zajišťovat pouze prostřednictvím řidiče, který splňuje zákonné předpoklady a má k dopravci zákonem požadovaný vztah; dopravce může být řidičem sám. Musí být dodrženy také další použitelné provozní, evidenční a pracovněprávní povinnosti."
  },
  {
    "h": "15.2 Řidič a průkaz řidiče taxislužby",
    "p": "Řidič musí mít platné řidičské oprávnění příslušné skupiny a platné oprávnění řidiče taxislužby doložené příslušným průkazem. Musí splňovat podmínky spolehlivosti, zdravotní způsobilosti a další zákonné požadavky a nesmí mít zákaz řízení ani jinou překážku výkonu činnosti. Při nabízení a poskytování přepravy musí být průkaz řidiče taxislužby ve vozidle umístěn tak, aby byl z místa cestujícího viditelný a čitelný."
  },
  {
    "h": "15.3 Evidence vozidla a evidenční nálepka",
    "p": "Použité vozidlo musí být řádně registrované a zapsané v evidenci vozidel taxislužby pro dopravce, který přepravu poskytuje. Údaje v příslušných registrech musí odpovídat skutečnosti. Vozidlo musí být označeno platnou evidenční nálepkou vydanou pro toto vozidlo a umístěnou předepsaným způsobem. Tato povinnost platí i pro jízdy na elektronickou objednávku bez taxametru. Zákaz střešní svítilny a označení TAXI podle článku 4a tím není dotčen."
  },
  {
    "h": "15.4 Technická způsobilost, STK a výbava",
    "p": "Vozidlo musí být technicky způsobilé k provozu, bezpečné a řádně udržované, s předepsanou výbavou a pneumatikami odpovídajícími zákonným požadavkům. Musí mít platnou pravidelnou technickou prohlídku ve lhůtě platné pro taxislužbu; u běžného osobního vozidla taxislužby jde o roční interval. Měření emisí musí být platné, pokud mu daný druh vozidla podléhá. Platná STK neumožňuje provoz s aktuální závadou, pro kterou je vozidlo technicky nezpůsobilé nebo nebezpečné."
  },
  {
    "h": "15.5 Platné pojištění a kontrola před jízdou",
    "p": "Provozovatel vozidla musí zajistit nepřetržitě platné povinné pojištění odpovědnosti z provozu vozidla. Při sjednání a změnách pojištění musí pravdivě uvést jeho skutečné použití pro taxislužbu a splnit související smluvní povinnosti vůči pojistiteli. Havarijní pojištění tyto podmínky nevyžadují. Dopravce a řidič ověří splnění příslušných povinností před nasazením vozidla a průběžně hlídají platnost dokladů. Není-li některý zákonný předpoklad splněn, přeprava nesmí být zahájena; vznikne-li překážka za jízdy, postupuje se bezpečně a v souladu se zákonem."
  },
  {
    "k": "note",
    "h": "",
    "p": "Právní podklad: zákon č. 111/1994 Sb., zejména § 4 a § 21 až 21d; zákon č. 56/2001 Sb., zejména § 37 až 40; zákon č. 30/2024 Sb.; související prováděcí a dopravní předpisy v účinném znění. Tento přehled neposuzuje splnění podmínek konkrétním dopravcem nebo vozidlem."
  }
],
  },
  "2026-11-19": {
    id: "2026-11-19",
    title: "Obchodní podmínky přepravy",
    label: "verze 2026-11-19",
    validFrom: "19. 11. 2026",
    body: [
  { h: "1. Smluvní strany", p: "Přepravní smlouvu uzavírá zákazník přímo s dopravcem uvedeným na této obrazovce (jméno nebo firma, sídlo, IČO). Aplikace SvezemeTě je bezplatný nástroj pro řidiče. Neúčtuje provizi ani poplatek a není zprostředkovatelem taxislužby podle § 2 odst. 10 zákona č. 111/1994 Sb." },
  { h: "2. Jak vznikne objednávka", p: "Zákazník objednává elektronicky na zařízení řidiče, jinak než hlasovou službou, ještě před zahájením jízdy (§ 21 odst. 6 zákona č. 111/1994 Sb.). Objednávka vznikne až klepnutím na tlačítko „Objednávám jízdu za … Kč“, po zobrazení konečné ceny a trasy a po zaškrtnutí obou souhlasů. Čas objednání je čas serveru. Bez uložené objednávky nelze jízdu zahájit." },
  { h: "3. Cena a trasa", p: "Částka na obrazovce je konečná smluvní cena za uvedenou trasu. Změna trasy nebo ceny se smí provést jen tehdy, když s ní zákazník předem znovu souhlasí stejným způsobem. Do té doby platí původní objednávka." },
  { h: "4. Údaje před jízdou", p: "Před zahájením jízdy zákazník vidí dopravce (jméno, sídlo, IČO), jméno řidiče a vozidlo (registrační značka, tovární značka a obchodní označení)." },
  { h: "5. Potvrzení o přepravě", p: "Hned po ukončení jízdy odešle dopravce potvrzení na e-mail zákazníka. Potvrzení obsahuje evidenční číslo, dopravce a IČO, jméno řidiče, registrační značku, datum, čas zahájení a ukončení, místo nástupu a výstupu, konečnou cenu a způsob platby (vyhláška č. 478/2000 Sb., § 12 odst. 4). Dopravce potvrzení uchová nejméně 3 roky. Záznam objednávky ani potvrzení nelze zpětně přepsat ani smazat." },
  { h: "6. Platba", p: "Způsob platby je dohodnutý v objednávce. Hotovost přebírá řidič ve voze a v aplikaci potvrdí její převzetí. Platba kartou, QR převodem nebo na fakturu se v této verzi aplikace jen zaznamená; samotné provedení platby zajistí dopravce svým zařízením nebo dokladem." },
  { h: "7. Vozidlo bez taxametru", p: "Je-li přeprava sjednána tímto způsobem, vozidlo nemusí mít taxametr. Nesmí pak být označeno střešní svítilnou ani nápisem TAXI (§ 21 odst. 7 písm. b) a § 21d odst. 5 zákona č. 111/1994 Sb.)." },
  { h: "8. Zrušení", p: "Než se jízda zahájí, může ji zákazník nebo řidič zrušit. Zrušení se zaznamená a původní záznam zůstane. Po zahájení se jízda ukončí a vystaví se potvrzení." },
  { h: "9. Závěr", p: "Objednáním zákazník potvrzuje, že si přečetl tyto podmínky a že souhlasí s konečnou cenou a danou trasou." },
],
  },
};

export const TERMS_PARAS = TERMS_VERSIONS[TERMS_VERSION].body;

/** Popis verze pro zobrazení, např. „verze 2.1 ze dne 12. 11. 2026“. */
export function termsLabel(id) {
  return TERMS_VERSIONS[id]?.label || `verze ${id}`;
}

/** Veřejná stránka jen s podmínkami (bez aplikace). */
export const TERMS_PAGE = "podminky.html";

/** HTML podmínek: nadpisy částí, článků a poznámky. esc = funkce pro escapování. */
export function termsHtml(paras, esc) {
  return paras.map((p) => {
    if (p.k === "part") return `<h2 class="tpart">${esc(p.h)}</h2>`;
    if (p.k === "note") return `<p class="tnote">${esc(p.p)}</p>`;
    return `<h3>${esc(p.h)}</h3><p>${esc(p.p)}</p>`;
  }).join("");
}

export const PRIVACY_PARAS = [
  { h: "Kdo údaje spravuje", p: "Správcem údajů o této jízdě je dopravce, jehož jméno, sídlo a IČO jsou na obrazovce. Aplikaci technicky provozuje správce platformy. K jízdám řidiče přistupuje jen kvůli provozu systému a každý takový přístup se zapisuje." },
  { h: "Proč e-mail", p: "E-mail se použije k zaslání potvrzení o přepravě a k uchování záznamu, který ukládá zákon (zákon č. 111/1994 Sb. a vyhláška č. 478/2000 Sb.). Záznam se uchovává nejméně 3 roky a nelze ho zpětně měnit." },
  { h: "Co s údaji neděláme", p: "Údaje se neprodávají. O přístup nebo opravu kontaktního e-mailu požádejte dopravce na adrese uvedené v potvrzení. Samotný text už odeslaného potvrzení přepsat nejde." },
];
