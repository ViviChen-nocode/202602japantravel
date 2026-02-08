const flights = [
  {
    id: "NH854-2026-02-08",
    carrier: "NH",
    flightNo: "854",
    airline: "ANA",
    date: "2026-02-08",
    route: "台北松山 TSA → 東京羽田 HND",
    note: "去程",
  },
  {
    id: "NH853-2026-02-16",
    carrier: "NH",
    flightNo: "853",
    airline: "ANA",
    date: "2026-02-16",
    route: "東京羽田 HND → 台北松山 TSA",
    note: "回程",
  },
];

const dom = {
  cards: document.querySelector("#cards"),
  cardTemplate: document.querySelector("#flightCardTemplate"),
  updatedAt: document.querySelector("#updatedAt"),
  refreshBtn: document.querySelector("#refreshBtn"),
};

const monthMap = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function nowLabel() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${h}:${min}`;
}

function formatDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayTag(dateStr) {
  const todayStr = toDateString(new Date());
  if (dateStr === todayStr) return "今天";
  if (dateStr > todayStr) return "未來";
  return "已過去";
}

function dateParts(dateStr) {
  const [year, month, day] = dateStr.split("-");
  return { year, month, day };
}

function buildFlightStatsUrl(flight) {
  const { year, month, day } = dateParts(flight.date);
  return `https://www.flightstats.com/v2/flight-tracker/${flight.carrier}/${flight.flightNo}?year=${year}&month=${month}&date=${day}`;
}

function buildBaseFlightStatsUrl(flight) {
  return `https://www.flightstats.com/v2/flight-tracker/${flight.carrier}/${flight.flightNo}`;
}

function buildProxyUrl(url) {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

function extractNextData(html) {
  const startMarker = "__NEXT_DATA__ = ";
  const endMarker = ";__NEXT_LOADED_PAGES__";
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start < 0 || end < 0) {
    throw new Error("無法解析航班資料（頁面格式變更）");
  }
  const raw = html.slice(start + startMarker.length, end);
  return JSON.parse(raw);
}

function isFlightObjectUsable(flight) {
  return !!flight && typeof flight === "object" && Object.keys(flight).length > 0;
}

function getScheduledDate(flight) {
  return flight?.schedule?.scheduledDeparture?.slice(0, 10) || "";
}

function toDateFromOtherDay(day) {
  const [mon, dd] = String(day?.date2 || "").split("-");
  const month = monthMap[mon];
  if (!day?.year || !month || !dd) return "";
  return `${day.year}-${month}-${dd}`;
}

function pickDetailUrlFromOtherDays(trackerState, targetDate) {
  const days = trackerState?.otherDays || [];
  const matched = days.find((day) => toDateFromOtherDay(day) === targetDate);
  const relativeUrl = matched?.flights?.[0]?.url;
  return relativeUrl ? `https://www.flightstats.com/v2${relativeUrl}` : "";
}

async function fetchTextWithTimeout(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`來源回應錯誤：${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function translateTimeTitle(title) {
  if (!title) return "";
  if (/estimated/i.test(title)) return "預估";
  if (/actual/i.test(title)) return "實際";
  return title;
}

function formatClock(timeObj) {
  if (!timeObj) {
    return { text: "-", isEstimated: false };
  }

  const timeText = timeObj.time24 || [timeObj.time, timeObj.ampm].filter(Boolean).join(" ");
  const zone = timeObj.timezone ? ` ${timeObj.timezone}` : "";
  const rawTitle = timeObj.title || "";
  const title = translateTimeTitle(rawTitle);
  const prefix = title ? `${title} ` : "";

  return {
    text: `${prefix}${timeText || "-"}${zone}`,
    isEstimated: /estimated/i.test(rawTitle),
  };
}

function translateStatusShort(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s.includes("scheduled")) return "表定";
  if (s.includes("active")) return "飛行中";
  if (s.includes("arrived") || s.includes("landed")) return "已抵達";
  if (s.includes("cancel")) return "已取消";
  if (s.includes("delay")) return "延誤";
  if (s.includes("divert")) return "轉降";
  return status;
}

function translateStatusDescription(text) {
  if (!text) return "狀態未提供";

  const delayedHM = text.match(/Delayed by\s+(\d+)h\s*(\d+)m/i);
  if (delayedHM) {
    return `延誤 ${delayedHM[1]} 小時 ${delayedHM[2]} 分`;
  }

  const delayedH = text.match(/Delayed by\s+(\d+)h/i);
  if (delayedH) {
    return `延誤 ${delayedH[1]} 小時`;
  }

  const delayedM = text.match(/Delayed by\s+(\d+)m/i);
  if (delayedM) {
    return `延誤 ${delayedM[1]} 分`;
  }

  if (/^Scheduled$/i.test(text)) return "表定";
  if (/on\s*time/i.test(text)) return "準時";
  if (/arrived|landed/i.test(text)) return "已抵達";
  if (/departed|in\s*air|active/i.test(text)) return "已起飛";
  if (/cancelled|canceled/i.test(text)) return "已取消";
  if (/tracking will begin after departure/i.test(text)) return "起飛後開始追蹤";

  return text;
}

function translateLastUpdated(text) {
  if (!text) return "更新時間未提供";

  const match = text.match(/Status Last Updated\s+(\d+)\s+(Second|Seconds|Minute|Minutes|Hour|Hours)\s+Ago/i);
  if (match) {
    const value = match[1];
    const unit = match[2].toLowerCase();
    if (unit.startsWith("second")) return `狀態更新於 ${value} 秒前`;
    if (unit.startsWith("minute")) return `狀態更新於 ${value} 分鐘前`;
    if (unit.startsWith("hour")) return `狀態更新於 ${value} 小時前`;
  }

  return text.replace(/^Status Last Updated\s*/i, "狀態更新於 ").replace(/\s+Ago$/i, "前");
}

function normalizeFlightData(flight) {
  const status = flight?.status || {};
  const departure = flight?.departureAirport || {};
  const arrival = flight?.arrivalAirport || {};

  const depScheduled = formatClock(departure?.times?.scheduled);
  const depEstimated = formatClock(departure?.times?.estimatedActual);
  const arrScheduled = formatClock(arrival?.times?.scheduled);
  const arrEstimated = formatClock(arrival?.times?.estimatedActual);

  return {
    statusRaw: `${status.statusDescription || ""} ${status.status || ""}`.trim(),
    statusText: translateStatusDescription(status.statusDescription || status.status || ""),
    statusShort: translateStatusShort(status.status || ""),
    lastUpdatedText: translateLastUpdated(status.lastUpdatedText || ""),
    scheduledDate: getScheduledDate(flight),
    departure: {
      airport: `${departure.city || ""} ${departure.fs || ""}`.trim() || "-",
      scheduled: depScheduled.text,
      estimated: depEstimated.text,
      estimatedHighlighted: depEstimated.isEstimated,
      terminalGate: `${departure.terminal || "-"} / ${departure.gate || "-"}`,
    },
    arrival: {
      airport: `${arrival.city || ""} ${arrival.fs || ""}`.trim() || "-",
      scheduled: arrScheduled.text,
      estimated: arrEstimated.text,
      estimatedHighlighted: arrEstimated.isEstimated,
      terminalGate: `${arrival.terminal || "-"} / ${arrival.gate || "-"}`,
    },
  };
}

async function resolveFlightStatus(flight) {
  const strictUrl = buildFlightStatsUrl(flight);
  const strictHtml = await fetchTextWithTimeout(buildProxyUrl(strictUrl));
  const strictData = extractNextData(strictHtml);
  const strictTracker = strictData?.props?.initialState?.flightTracker || {};
  let selected = strictTracker.flight;
  let note = "";

  if (!isFlightObjectUsable(selected)) {
    const baseUrl = buildBaseFlightStatsUrl(flight);
    const baseHtml = await fetchTextWithTimeout(buildProxyUrl(baseUrl));
    const baseData = extractNextData(baseHtml);
    const baseTracker = baseData?.props?.initialState?.flightTracker || {};
    const detailUrl = pickDetailUrlFromOtherDays(baseTracker, flight.date);

    if (detailUrl) {
      const detailHtml = await fetchTextWithTimeout(buildProxyUrl(detailUrl));
      const detailData = extractNextData(detailHtml);
      selected = detailData?.props?.initialState?.flightTracker?.flight;
    } else {
      selected = baseTracker.flight;
      note = "此日期目前可能尚未開放追蹤明細";
    }
  }

  if (!isFlightObjectUsable(selected)) {
    throw new Error("目前查無可解析的航班狀態");
  }

  const normalized = normalizeFlightData(selected);
  if (normalized.scheduledDate && normalized.scheduledDate !== flight.date) {
    note = `目前來源回傳的是 ${normalized.scheduledDate} 的班次`;
  }

  return {
    normalized,
    note,
  };
}

function getStatusClass(sourceText) {
  const source = (sourceText || "").toLowerCase();
  if (source.includes("delay") || source.includes("延誤")) return "is-delayed";
  if (source.includes("cancel") || source.includes("取消")) return "is-cancelled";
  if (source.includes("arriv") || source.includes("landed") || source.includes("抵達")) return "is-arrived";
  if (source.includes("on time") || source.includes("active") || source.includes("準時")) return "is-ontime";
  return "";
}

function createCard(flight) {
  const templateRoot = dom.cardTemplate?.content?.firstElementChild;
  if (!templateRoot) return null;

  const root = templateRoot.cloneNode(true);
  root.dataset.flightId = flight.id;
  root.querySelector(".flight-no").textContent = `${flight.airline} ${flight.carrier}${flight.flightNo}`;
  root.querySelector(".route").textContent = flight.route;
  root.querySelector(".day-tag").textContent = getDayTag(flight.date);
  root.querySelector(".flight-date").textContent = `日期：${formatDate(flight.date)}`;
  root.querySelector(".flight-note").textContent = `段落：${flight.note}`;

  root.querySelector(".flightstats-link").href = buildFlightStatsUrl(flight);
  root.querySelector(".flightradar-link").href = `https://www.flightradar24.com/data/flights/${flight.carrier.toLowerCase()}${flight.flightNo}`;
  root.querySelector(".flightaware-link").href = `https://www.flightaware.com/live/flight/${flight.carrier === "NH" ? "ANA" : flight.carrier}${flight.flightNo}`;

  return root;
}

function setEstimatedHighlight(el, isHighlighted) {
  if (!el) return;
  el.classList.toggle("time-estimated", !!isHighlighted);
}

function setLoadingState(card) {
  card.querySelector(".status-main").textContent = "狀態：讀取中...";
  card.querySelector(".status-main").className = "status-main";
  card.querySelector(".update-time").textContent = "";
  card.querySelector(".status-note").textContent = "";

  card.querySelector(".dep-airport").textContent = "-";
  card.querySelector(".dep-scheduled").textContent = "-";
  card.querySelector(".dep-estimated").textContent = "-";
  setEstimatedHighlight(card.querySelector(".dep-estimated"), false);
  card.querySelector(".dep-terminal-gate").textContent = "-";

  card.querySelector(".arr-airport").textContent = "-";
  card.querySelector(".arr-scheduled").textContent = "-";
  card.querySelector(".arr-estimated").textContent = "-";
  setEstimatedHighlight(card.querySelector(".arr-estimated"), false);
  card.querySelector(".arr-terminal-gate").textContent = "-";
}

function setResolvedState(card, result) {
  const { normalized, note } = result;

  const statusMain = card.querySelector(".status-main");
  statusMain.textContent = `狀態：${normalized.statusText}`;
  statusMain.className = `status-main ${getStatusClass(normalized.statusRaw || normalized.statusText)}`.trim();

  card.querySelector(".update-time").textContent = normalized.lastUpdatedText || "更新時間未提供";
  card.querySelector(".status-note").textContent = note || "";

  card.querySelector(".dep-airport").textContent = normalized.departure.airport;
  card.querySelector(".dep-scheduled").textContent = normalized.departure.scheduled;
  card.querySelector(".dep-estimated").textContent = normalized.departure.estimated;
  setEstimatedHighlight(card.querySelector(".dep-estimated"), normalized.departure.estimatedHighlighted);
  card.querySelector(".dep-terminal-gate").textContent = normalized.departure.terminalGate;

  card.querySelector(".arr-airport").textContent = normalized.arrival.airport;
  card.querySelector(".arr-scheduled").textContent = normalized.arrival.scheduled;
  card.querySelector(".arr-estimated").textContent = normalized.arrival.estimated;
  setEstimatedHighlight(card.querySelector(".arr-estimated"), normalized.arrival.estimatedHighlighted);
  card.querySelector(".arr-terminal-gate").textContent = normalized.arrival.terminalGate;
}

function setErrorState(card, error) {
  const statusMain = card.querySelector(".status-main");
  statusMain.textContent = "狀態：暫時無法取得";
  statusMain.className = "status-main is-cancelled";
  card.querySelector(".update-time").textContent = "";
  card.querySelector(".status-note").textContent = `錯誤：${error.message || "未知錯誤"}`;
}

function renderCards() {
  if (!dom.cards || !dom.cardTemplate) return [];
  dom.cards.innerHTML = "";
  const cardEntries = [];

  flights.forEach((flight) => {
    const card = createCard(flight);
    if (!card) return;
    setLoadingState(card);
    dom.cards.appendChild(card);
    cardEntries.push({ flight, card });
  });

  return cardEntries;
}

async function refreshStatuses() {
  const cardEntries = renderCards();
  if (!cardEntries.length) {
    if (dom.cards) {
      dom.cards.innerHTML = '<p class="load-msg">無法建立航班卡片，請重新整理。</p>';
    }
    return;
  }

  if (dom.updatedAt) {
    dom.updatedAt.textContent = `最後更新：${nowLabel()}（抓取中）`;
  }

  if (dom.refreshBtn) {
    dom.refreshBtn.disabled = true;
    dom.refreshBtn.textContent = "抓取中...";
  }

  await Promise.all(
    cardEntries.map(async ({ flight, card }) => {
      try {
        const result = await resolveFlightStatus(flight);
        setResolvedState(card, result);
      } catch (error) {
        setErrorState(card, error);
      }
    })
  );

  if (dom.updatedAt) {
    dom.updatedAt.textContent = `最後更新：${nowLabel()}`;
  }

  if (dom.refreshBtn) {
    dom.refreshBtn.disabled = false;
    dom.refreshBtn.textContent = "重新抓取狀態";
  }
}

function init() {
  dom.refreshBtn?.addEventListener("click", () => {
    refreshStatuses();
  });

  refreshStatuses();
}

init();
