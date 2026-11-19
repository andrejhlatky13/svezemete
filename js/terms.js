/** Obchodní podmínky přepravy, verze uložená i v setup/schema.sql. */
export const TERMS_VERSION = "2026-11-19";

export const TERMS_PARAS = [
  { h: "1. Smluvní strany", p: "Přepravní smlouvu uzavírá zákazník přímo s dopravcem uvedeným na této obrazovce (jméno nebo firma, sídlo, IČO). Aplikace SvezemeTě je bezplatný nástroj pro řidiče. Neúčtuje provizi ani poplatek a není zprostředkovatelem taxislužby podle § 2 odst. 10 zákona č. 111/1994 Sb." },
  { h: "2. Jak vznikne objednávka", p: "Zákazník objednává elektronicky na zařízení řidiče, jinak než hlasovou službou, ještě před zahájením jízdy (§ 21 odst. 6 zákona č. 111/1994 Sb.). Objednávka vznikne až klepnutím na tlačítko „Objednávám jízdu za … Kč“, po zobrazení konečné ceny a trasy a po zaškrtnutí obou souhlasů. Čas objednání je čas serveru. Bez uložené objednávky nelze jízdu zahájit." },
  { h: "3. Cena a trasa", p: "Částka na obrazovce je konečná smluvní cena za uvedenou trasu. Změna trasy nebo ceny se smí provést jen tehdy, když s ní zákazník předem znovu souhlasí stejným způsobem. Do té doby platí původní objednávka." },
  { h: "4. Údaje před jízdou", p: "Před zahájením jízdy zákazník vidí dopravce (jméno, sídlo, IČO), jméno řidiče a vozidlo (registrační značka, tovární značka a obchodní označení)." },
  { h: "5. Potvrzení o přepravě", p: "Hned po ukončení jízdy odešle dopravce potvrzení na e-mail zákazníka. Potvrzení obsahuje evidenční číslo, dopravce a IČO, jméno řidiče, registrační značku, datum, čas zahájení a ukončení, místo nástupu a výstupu, konečnou cenu a způsob platby (vyhláška č. 478/2000 Sb., § 12 odst. 4). Dopravce potvrzení uchová nejméně 3 roky. Záznam objednávky ani potvrzení nelze zpětně přepsat ani smazat." },
  { h: "6. Platba", p: "Způsob platby je dohodnutý v objednávce. Hotovost přebírá řidič ve voze a v aplikaci potvrdí její převzetí. Platba kartou, QR převodem nebo na fakturu se v této verzi aplikace jen zaznamená; samotné provedení platby zajistí dopravce svým zařízením nebo dokladem." },
  { h: "7. Vozidlo bez taxametru", p: "Je-li přeprava sjednána tímto způsobem, vozidlo nemusí mít taxametr. Nesmí pak být označeno střešní svítilnou ani nápisem TAXI (§ 21 odst. 7 písm. b) a § 21d odst. 5 zákona č. 111/1994 Sb.)." },
  { h: "8. Zrušení", p: "Než se jízda zahájí, může ji zákazník nebo řidič zrušit. Zrušení se zaznamená a původní záznam zůstane. Po zahájení se jízda ukončí a vystaví se potvrzení." },
  { h: "9. Závěr", p: "Objednáním zákazník potvrzuje, že si přečetl tyto podmínky a že souhlasí s konečnou cenou a danou trasou." },
];

export const PRIVACY_PARAS = [
  { h: "Kdo údaje spravuje", p: "Správcem údajů o této jízdě je dopravce, jehož jméno, sídlo a IČO jsou na obrazovce. Aplikaci technicky provozuje správce platformy. K jízdám řidiče přistupuje jen kvůli provozu systému a každý takový přístup se zapisuje." },
  { h: "Proč e-mail", p: "E-mail se použije k zaslání potvrzení o přepravě a k uchování záznamu, který ukládá zákon (zákon č. 111/1994 Sb. a vyhláška č. 478/2000 Sb.). Záznam se uchovává nejméně 3 roky a nelze ho zpětně měnit." },
  { h: "Co s údaji neděláme", p: "Údaje se neprodávají. O přístup nebo opravu kontaktního e-mailu požádejte dopravce na adrese uvedené v potvrzení. Samotný text už odeslaného potvrzení přepsat nejde." },
];
