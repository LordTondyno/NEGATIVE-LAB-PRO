# Negativ na pozitiv

Webová aplikace pro převod naskenovaných nebo nafocených negativů na pozitivy. Běží celá v prohlížeči, nic se nenahrává na server.

## Co umí
- Otevřít JPG, PNG a TIFF (přetažením nebo tlačítkem)
- Barevné i černobílé negativy
- Film base automaticky nebo pipetou (zobraz negativ a klikni na okraj filmu)
- Roztažení černého a bílého bodu po kanálech, expozice, gamma, kontrast, teplota, tint, sytost
- Export plného rozlišení do PNG

## Spuštění lokálně
Otevři `index.html` v prohlížeči (nebo `python -m http.server`).

## Nasazení na GitHub Pages
1. Vytvoř nový repozitář na GitHubu (např. `negativ-na-pozitiv`).
2. V repozitáři: `git init && git add . && git commit -m "První verze" && git branch -M main`
3. `git remote add origin https://github.com/TVOJE_JMENO/negativ-na-pozitiv.git && git push -u origin main`
4. Na GitHubu: Settings, Pages, Source: **GitHub Actions**.
5. Po pushi se aplikace nasadí na `https://TVOJE_JMENO.github.io/negativ-na-pozitiv/`.

## Další kroky
- RAW (LibRaw přes WebAssembly), 16bitový export
- Filmové profily a roll analysis (společná analýza celé role)
- WebGL pro plynulejší náhled na velkých souborech
