# Fotbaliada

## Popis

Fotbaliada je jednoduchá webová aplikace určená pro fanoušky fotbalu, kteří si chtějí vzájemně tipovat výsledky zápasů a sledovat své skóre. Aplikace umožňuje dvěma hráčům (Karlos a Kuba) zadávat tipy na jednotlivé zápasy a vyhodnocovat je podle skutečných výsledků. 

### Hlavní funkce

- **Zápasy a tipy**: Uživatelé mohou vidět seznam zápasů a zadávat své tipy na výsledky.
- **Tabulka bodů**: Aplikace zobrazuje aktuální body pro každého hráče, které se aktualizují na základě správnosti jejich tipů.
- **Firebase integrace**: Aplikace ukládá tipy a body do databáze Firebase, což umožňuje sledování a ukládání dat v reálném čase.
- **Reset bodů**: Hráči mohou resetovat své body, pokud chtějí začít znovu.

### Technické detaily

- Používá HTML, CSS (s Bootstrap pro styling) a JavaScript.
- Zápasy jsou načítány ze souboru `matches.txt`, kde jsou uspořádány podle kol.
- Aplikace využívá Firebase k ukládání a načítání tipů a bodů, což zajišťuje, že data jsou vždy aktuální pro všechny uživatele.

### Jak spustit

1. Klonujte repozitář.
2. Otevřete `index.html` v prohlížeči.
3. Ujistěte se, že máte platný Firebase projekt a správně nakonfigurujte Firebase SDK.

### Příspěvky

Pokud byste chtěli přispět k vývoji aplikace, neváhejte vytvořit pull request nebo reportovat problémy.

---

Tato aplikace je ideální pro skupiny přátel, kteří chtějí zábavnou formou sledovat fotbalové zápasy a soutěžit v tipování.
