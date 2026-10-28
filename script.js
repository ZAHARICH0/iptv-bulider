(() => {
  "use strict";
  const SOURCE_ALL = "https://iptv-org.github.io/iptv/index.m3u";
  const COUNTRY_BASE = "https://iptv-org.github.io/iptv/countries/";
  const CATEGORY_BASE = "https://iptv-org.github.io/iptv/categories/";
  const LANGUAGE_BASE = "https://iptv-org.github.io/iptv/languages/";
  const STORAGE_KEY = "iptvBuilderHistoryV1";
  const $ = (id) => document.getElementById(id);

  const country = $("country"), category = $("category"), language = $("language");
  const prompt = $("prompt"), status = $("status"), generateBtn = $("generateBtn");
  const epgToggle = $("epgToggle"), archiveToggle = $("archiveToggle");
  const epgFields = $("epgFields"), archiveFields = $("archiveFields");

  const categoryCodes = {
    animation: ["animation", "cartoons", "cartoon", "анимац", "мульт"],
    kids: ["kids", "children", "детск", "для детей", "мульт"],
    news: ["news", "новост"],
    music: ["music", "музык"],
    sports: ["sports", "sport", "спортив"],
    movies: ["movies", "movie", "фильм", "кино"],
    entertainment: ["entertainment", "развлеч"],
    documentary: ["documentary", "документал"],
    general: ["general", "общие"]
  };
  const countryTerms = [
    [["росси", "russia", "russian"], "ru"],
    [["беларус", "белорус", "belarus"], "by"],
    [["казахстан", "kazakhstan", "казах"], "kz"],
    [["украин", "ukraine", "украина"], "ua"],
    [["германи", "germany", "немец"], "de"],
    [["сша", "united states", "america", "америк"], "us"],
    [["великобрит", "британ", "united kingdom", "britain", "англи"], "gb"],
    [["франци", "france", "француз"], "fr"],
    [["польш", "poland"], "pl"],
    [["армени", "armenia"], "am"],
    [["азербайдж", "azerbaijan"], "az"],
    [["узбекист", "uzbekistan"], "uz"],
    [["турци", "turkey", "турция"], "tr"],
    [["индия", "india"], "in"],
    [["япони", "japan"], "jp"]
  ];
  const languageTerms = [
    [["русск", "на русском", "russian"], "rus"],
    [["англий", "english", "на английском"], "eng"],
    [["казахск", "на казахском"], "kaz"],
    [["белорусск", "на белорусском"], "bel"],
    [["украинск", "на украинском"], "ukr"],
    [["немецк", "на немецком"], "deu"],
    [["французск", "на французском"], "fra"],
    [["испанск", "на испанском"], "spa"]
  ];

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = "status" + (type ? " " + type : "");
  }
  function detectFromPrompt() {
    const text = prompt.value.toLowerCase();
    if (!country.value) {
      for (const [terms, code] of countryTerms) {
        if (terms.some(t => text.includes(t))) { country.value = code; break; }
      }
    }
    if (!language.value) {
      for (const [terms, code] of languageTerms) {
        if (terms.some(t => text.includes(t))) { language.value = code; break; }
      }
    }
    if (!category.value) {
      for (const [code, terms] of Object.entries(categoryCodes)) {
        if (terms.some(t => text.includes(t))) { category.value = code; break; }
      }
    }
  }
  function selectedCategoryFromPrompt() {
    const text = prompt.value.toLowerCase();
    for (const [code, terms] of Object.entries(categoryCodes)) {
      if (terms.some(t => text.includes(t))) return code;
    }
    return "";
  }
  function getCategoryCode() {
    const text = prompt.value.toLowerCase();
    if (category.value === "kids" && (text.includes("мульт") || text.includes("cartoon"))) return "animation";
    return category.value;
  }
  function safeName(s) {
    return (s || "iptv-playlist").normalize("NFKD").replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 70) || "iptv-playlist";
  }
  function parseM3U(raw) {
    const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
    const channels = [];
    let pending = null;
    for (const lineRaw of lines) {
      const line = lineRaw.trim();
      if (!line) continue;
      if (line.startsWith("#EXTINF")) {
        const comma = line.indexOf(",");
        const attrsPart = comma >= 0 ? line.slice(0, comma) : line;
        const name = comma >= 0 ? line.slice(comma + 1).trim() : "Без названия";
        const attr = (key) => {
          const match = attrsPart.match(new RegExp("(?:^|\\s)" + key + '="([^"]*)"'));
          return match ? match[1] : "";
        };
        pending = {
          name: name || "Без названия",
          tvgId: attr("tvg-id"),
          logo: attr("tvg-logo"),
          group: attr("group-title"),
          extinf: line
        };
      } else if (!line.startsWith("#") && pending) {
        pending.url = line;
        channels.push(pending);
        pending = null;
      }
    }
    return channels;
  }
  function parseAttrs(line) {
    const attrs = {};
    const head = line.slice(0, line.indexOf(",") >= 0 ? line.indexOf(",") : line.length);
    for (const key of ["tvg-id", "tvg-logo", "group-title", "tvg-name", "tvg-country", "tvg-language"]) {
      const re = new RegExp("(?:^|\\s)" + key + '="([^"]*)"');
      const m = head.match(re);
      if (m) attrs[key] = m[1];
    }
    return attrs;
  }
  function countryUrl(code) { return COUNTRY_BASE + code + ".m3u"; }
  function categoryUrl(code) { return CATEGORY_BASE + code + ".m3u"; }
  function languageUrl(code) { return LANGUAGE_BASE + code + ".m3u"; }

  async function fetchText(url) {
    const response = await fetch(url, {cache: "no-store"});
    if (!response.ok) throw new Error("Источник ответил HTTP " + response.status);
    return await response.text();
  }
  function buildOutput(channels, opts) {
    const lines = [];
    const epgUrl = opts.epgUrl.trim();
    lines.push(epgUrl && opts.epg ? `#EXTM3U x-tvg-url="${epgUrl.replace(/"/g, "%22")}"` : "#EXTM3U");
    for (const ch of channels) {
      let attrs = "";
      if (ch.tvgId) attrs += ` tvg-id="${ch.tvgId}"`;
      if (ch.logo) attrs += ` tvg-logo="${ch.logo}"`;
      if (ch.group) attrs += ` group-title="${ch.group.replace(/"/g, "'")}"`;
      if (opts.archive) attrs += ` catchup="default" catchup-days="${opts.archiveDays}"`;
      lines.push(`#EXTINF:-1${attrs},${ch.name}`);
      lines.push(ch.url);
    }
    return lines.join("\r\n") + "\r\n";
  }
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  }
  function saveHistory(items) {
    try {
      // Keep up to 20 full playlists to avoid overflowing browser storage.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 20)));
      return true;
    } catch (err) {
      setStatus("Плейлист создан, но история не сохранилась: в браузере закончилось место. Скачай файл.", "error");
      return false;
    }
  }
  function downloadM3U(item) {
    const blob = new Blob([item.content], {type: "audio/x-mpegurl;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.filename.endsWith(".m3u") ? item.filename : item.filename + ".m3u";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  function renderHistory() {
    const items = loadHistory();
    const list = $("history");
    list.innerHTML = "";
    $("emptyHistory").classList.toggle("hidden", items.length > 0);
    for (const item of items) {
      const row = document.createElement("article");
      row.className = "history-item";
      const icon = document.createElement("div"); icon.className = "file-icon"; icon.textContent = "▤";
      const info = document.createElement("div"); info.className = "history-info";
      const title = document.createElement("b"); title.textContent = item.title;
      const meta = document.createElement("small");
      const date = new Date(item.createdAt);
      meta.textContent = `${item.count} канал(ов) · ${date.toLocaleString("ru-RU")} · ${item.filename}`;
      info.append(title, meta);
      const actions = document.createElement("div"); actions.className = "history-actions";
      const dl = document.createElement("button"); dl.className = "mini-btn download"; dl.textContent = "↓ Скачать";
      dl.addEventListener("click", () => downloadM3U(item));
      const view = document.createElement("button"); view.className = "mini-btn"; view.textContent = "Просмотр";
      view.addEventListener("click", () => {
        const blob = new Blob([item.content], {type: "text/plain;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      });
      const del = document.createElement("button"); del.className = "mini-btn"; del.textContent = "×";
      del.setAttribute("aria-label", "Удалить из истории");
      del.addEventListener("click", () => {
        saveHistory(loadHistory().filter(x => x.id !== item.id));
        renderHistory();
      });
      actions.append(dl, view, del);
      row.append(icon, info, actions);
      list.append(row);
    }
  }

  async function generate() {
    detectFromPrompt();
    const rawPrompt = prompt.value.trim();
    const countryCode = country.value;
    const categoryCode = getCategoryCode();
    const languageCode = language.value;
    const useEpg = epgToggle.checked;
    const useArchive = archiveToggle.checked;
    const epgUrl = $("epgUrl").value.trim();
    const archiveDays = $("archiveDays").value;

    if (useEpg && epgUrl) {
      try { new URL(epgUrl); } catch { setStatus("Проверь ссылку EPG: нужен полный адрес с https:// или http://.", "error"); return; }
    }
    if (!rawPrompt && !countryCode && !categoryCode && !languageCode) {
      setStatus("Напиши запрос или выбери хотя бы один фильтр.", "error"); return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = "<span>◌</span> Загружаю каналы…";
    setStatus("Подключаюсь к IPTV-org и собираю подходящие каналы…");
    try {
      // Use the most specific published playlist as a starting point.
      let urls = [];
      if (countryCode) urls.push(countryUrl(countryCode));
      if (categoryCode) urls.push(categoryUrl(categoryCode));
      if (languageCode) urls.push(languageUrl(languageCode));
      if (!urls.length) urls.push(SOURCE_ALL);

      const results = await Promise.all(urls.map(async url => {
        try { return {url, channels: parseM3U(await fetchText(url))}; }
        catch (err) { return {url, error: err}; }
      }));
      let channels;
      const good = results.filter(r => r.channels && r.channels.length);
      if (!good.length) {
        const failed = results.map(r => r.error?.message).filter(Boolean)[0] || "Не удалось получить список.";
        throw new Error(failed + ". Если открыт локальный HTML-файл, попробуй разместить сайт на хостинге с HTTPS (браузер может блокировать запросы).");
      }
      // Intersect multiple selected filters by URL, not channel title.
      channels = good[0].channels;
      for (const result of good.slice(1)) {
        const allowed = new Set(result.channels.map(c => c.url));
        channels = channels.filter(c => allowed.has(c.url));
      }

      // When using only the global list, apply best-effort text filters from prompt.
      if (urls[0] === SOURCE_ALL) {
        const text = rawPrompt.toLowerCase();
        const categoryTermsForPrompt = categoryCode ? (categoryCodes[categoryCode] || []) : [];
        if (categoryTermsForPrompt.length) {
          channels = channels.filter(c => categoryTermsForPrompt.some(term =>
            (c.group || "").toLowerCase().includes(term) || c.name.toLowerCase().includes(term)
          ));
        }
        const termMatch = countryTerms.find(([terms, code]) => code === countryCode);
        if (termMatch) channels = channels.filter(c => (c.extinf || "").toLowerCase().includes(countryCode) || (c.group || "").toLowerCase().includes(countryCode));
        if (text.includes("детск") || text.includes("мульт") || text.includes("cartoon")) {
          channels = channels.filter(c => /kid|child|cartoon|animation|дет|мульт/i.test((c.group || "") + " " + c.name));
        }
      }
      // Remove duplicate stream URLs.
      const seen = new Set();
      channels = channels.filter(c => c.url && !seen.has(c.url) && seen.add(c.url));
      if (!channels.length) throw new Error("По этим фильтрам каналы не найдены. Попробуй убрать один фильтр или выбрать другую категорию.");
      const title = rawPrompt || [
        country.options[country.selectedIndex]?.text || "Все каналы",
        category.options[category.selectedIndex]?.text || "",
        language.options[language.selectedIndex]?.text || ""
      ].filter(Boolean).join(" · ");
      const fileBase = safeName(title.toLowerCase().replace(/\s+/g, "-"));
      const item = {
        id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
        title, filename: fileBase + ".m3u", count: channels.length,
        createdAt: new Date().toISOString(),
        content: buildOutput(channels, {epg: useEpg, epgUrl, archive: useArchive, archiveDays})
      };
      const history = [item, ...loadHistory().filter(x => x.title !== item.title)].slice(0, 20);
      saveHistory(history);
      renderHistory();
      downloadM3U(item);
      setStatus(`Готово! Найдено каналов: ${channels.length}. Файл скачан и добавлен в историю.`, "success");
    } catch (error) {
      setStatus("Не получилось создать плейлист: " + error.message, "error");
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = "<span>✦</span> Создать M3U";
    }
  }

  document.querySelectorAll(".chip").forEach(button => button.addEventListener("click", () => {
    prompt.value = button.dataset.prompt || "";
    detectFromPrompt();
    prompt.focus();
  }));
  epgToggle.addEventListener("change", () => epgFields.classList.toggle("hidden", !epgToggle.checked));
  archiveToggle.addEventListener("change", () => archiveFields.classList.toggle("hidden", !archiveToggle.checked));
  generateBtn.addEventListener("click", generate);
  $("clearHistory").addEventListener("click", () => {
    if (loadHistory().length && confirm("Удалить всю историю созданных плейлистов?")) {
      localStorage.removeItem(STORAGE_KEY); renderHistory();
    }
  });
  renderHistory();
})();
