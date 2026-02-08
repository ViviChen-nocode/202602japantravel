const itinerary = [
  { date: "2026-02-08", label: "2/8 台北 + 東京羽田", places: ["taipei", "haneda"] },
  { date: "2026-02-09", label: "2/9 東京羽田 + 富士河口湖", places: ["haneda", "kawaguchiko"] },
  { date: "2026-02-10", label: "2/10 富士河口湖", places: ["kawaguchiko"] },
  { date: "2026-02-11", label: "2/11 富士河口湖 + 東京上野", places: ["kawaguchiko", "ueno"] },
  { date: "2026-02-12", label: "2/12 東京上野 + 斑尾東急 + 斑尾高原", places: ["ueno", "madarao_tokyu", "madarao_kogen"] },
  { date: "2026-02-13", label: "2/13 斑尾東急 + 斑尾高原", places: ["madarao_tokyu", "madarao_kogen"] },
  { date: "2026-02-14", label: "2/14 斑尾東急 + 斑尾高原", places: ["madarao_tokyu", "madarao_kogen"] },
  { date: "2026-02-15", label: "2/15 斑尾高原 + 東京品川", places: ["madarao_kogen", "shinagawa"] },
  { date: "2026-02-16", label: "2/16 東京品川 + 羽田 + 台北", places: ["shinagawa", "haneda", "taipei"] },
];

const locationMap = {
  taipei: { name: "台北", region: "Taiwan", lat: 25.033, lon: 121.5654, isSki: false },
  haneda: { name: "東京羽田", region: "Japan", lat: 35.5494, lon: 139.7798, isSki: false },
  kawaguchiko: { name: "富士河口湖", region: "Japan", lat: 35.4874, lon: 138.7544, isSki: false },
  ueno: { name: "東京上野", region: "Japan", lat: 35.7138, lon: 139.7773, isSki: false },
  madarao_tokyu: { name: "斑尾東急雪場", region: "Japan", lat: 36.8596, lon: 138.2876, isSki: true },
  madarao_kogen: { name: "斑尾高原雪場", region: "Japan", lat: 36.8524, lon: 138.2926, isSki: true },
  shinagawa: { name: "東京品川", region: "Japan", lat: 35.6285, lon: 139.7387, isSki: false },
};

const locationPriority = { madarao_tokyu: 0, madarao_kogen: 1 };
const locationOrder = Array.from(new Set(itinerary.flatMap((item) => item.places)));
const locationOrderMap = new Map(locationOrder.map((id, idx) => [id, idx]));

const weatherCodeMap = {
  0: "晴朗",
  1: "大致晴",
  2: "局部多雲",
  3: "陰",
  45: "霧",
  48: "霧凇",
  51: "毛毛雨",
  53: "小雨",
  55: "中雨",
  56: "凍毛雨",
  57: "凍雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "凍雨",
  67: "強凍雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "冰粒",
  80: "陣雨",
  81: "強陣雨",
  82: "暴雨",
  85: "陣雪",
  86: "強陣雪",
  95: "雷雨",
  96: "雷雨夾冰雹",
  99: "強雷雨夾冰雹",
};

const state = {
  viewDate: toDateString(new Date()),
  selectedLocationIds: new Set(),
};

const dom = {
  refreshBtn: document.querySelector("#refreshBtn"),
  todayModeBtn: document.querySelector("#todayModeBtn"),
  tomorrowModeBtn: document.querySelector("#tomorrowModeBtn"),
  dayButtons: document.querySelectorAll(".day-btn"),
  customDateSelect: document.querySelector("#customDateSelect"),
  resetLocationsBtn: document.querySelector("#resetLocationsBtn"),
  locationFilters: document.querySelector("#locationFilters"),
  planHint: document.querySelector("#planHint"),
  statusText: document.querySelector("#statusText"),
  dailySectionHint: document.querySelector("#dailySectionHint"),
  hourlyTitle: document.querySelector("#hourlyTitle"),
  hourlyHint: document.querySelector("#hourlyHint"),
  cardsGrid: document.querySelector("#cardsGrid"),
  hourlyGrid: document.querySelector("#hourlyGrid"),
  weatherCardTemplate: document.querySelector("#weatherCardTemplate"),
  hourlyCardTemplate: document.querySelector("#hourlyCardTemplate"),
};

function getWeatherLabel(code) {
  return weatherCodeMap[code] || `代碼 ${code}`;
}

function getWeatherSymbol(code) {
  if (code >= 71 && code <= 77) {
    return "❄️";
  }
  if (code === 85 || code === 86) {
    return "❄️";
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return "☔";
  }
  if (code >= 95) {
    return "⛈️";
  }
  if (code === 0 || code === 1) {
    return "☀️";
  }
  if (code === 2 || code === 3) {
    return "☁️";
  }
  if (code === 45 || code === 48) {
    return "🌫️";
  }
  return "☁️";
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMonthDay(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getRelativeDateString(offset) {
  return toDateString(addDays(new Date(), offset));
}

function getPreviousDateString(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return toDateString(date);
}

function getViewMode(dateStr) {
  const today = getRelativeDateString(0);
  const tomorrow = getRelativeDateString(1);
  if (dateStr === today) {
    return "today";
  }
  if (dateStr === tomorrow) {
    return "tomorrow";
  }
  return "custom";
}

function renderDateSelectOptions() {
  dom.customDateSelect.innerHTML = `
    <option value="">依今天/明天與快速鍵</option>
    ${itinerary
      .map((item) => `<option value="${item.date}">${item.label}</option>`)
      .join("")}
  `;
}

function getSortedLocationIds(ids) {
  return Array.from(new Set(ids)).sort((a, b) => {
    const aPriority = locationPriority[a] ?? 99;
    const bPriority = locationPriority[b] ?? 99;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    const aOrder = locationOrderMap.get(a) ?? 999;
    const bOrder = locationOrderMap.get(b) ?? 999;
    return aOrder - bOrder;
  });
}

function pickItineraryByDate(dateStr) {
  const dates = itinerary.map((item) => item.date).sort();
  const exact = itinerary.find((item) => item.date === dateStr);
  if (exact) {
    return { plan: exact, requestedDate: dateStr, resolvedDate: dateStr, note: "" };
  }

  if (dateStr < dates[0]) {
    const plan = itinerary.find((item) => item.date === dates[0]);
    return {
      plan,
      requestedDate: dateStr,
      resolvedDate: plan.date,
      note: `${dateStr} 不在行程內，地點改用 ${plan.date} 行程`,
    };
  }

  const futureDate = dates.find((value) => value > dateStr);
  if (futureDate) {
    const plan = itinerary.find((item) => item.date === futureDate);
    return {
      plan,
      requestedDate: dateStr,
      resolvedDate: plan.date,
      note: `${dateStr} 不在行程內，地點改用 ${plan.date} 行程`,
    };
  }

  const lastDate = dates[dates.length - 1];
  const plan = itinerary.find((item) => item.date === lastDate);
  return {
    plan,
    requestedDate: dateStr,
    resolvedDate: plan.date,
    note: `${dateStr} 不在行程內，地點改用 ${plan.date} 行程`,
  };
}

function getCurrentSelectionContext() {
  return pickItineraryByDate(state.viewDate);
}

function resetSelectedLocationsToPlan() {
  const selected = getCurrentSelectionContext();
  state.selectedLocationIds = new Set(selected.plan.places);
  renderLocationFilters();
}

function renderLocationFilters() {
  const sortedIds = getSortedLocationIds(locationOrder);
  dom.locationFilters.innerHTML = sortedIds
    .map((id) => {
      const location = locationMap[id];
      const checked = state.selectedLocationIds.has(id) ? "checked" : "";
      return `
        <label class="location-pill ${checked ? "is-selected" : ""}">
          <input type="checkbox" value="${id}" ${checked} />
          <span>${location.name}${location.isSki ? " · 雪場" : ""}</span>
        </label>
      `;
    })
    .join("");

  dom.locationFilters.querySelectorAll("input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const id = event.target.value;
      if (event.target.checked) {
        state.selectedLocationIds.add(id);
      } else {
        state.selectedLocationIds.delete(id);
      }
      renderLocationFilters();
      renderDashboard();
    });
  });
}

function buildForecastUrl(location) {
  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.searchParams.set("latitude", String(location.lat));
  endpoint.searchParams.set("longitude", String(location.lon));
  endpoint.searchParams.set("timezone", "auto");
  endpoint.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "weather_code",
      "wind_speed_10m",
      "precipitation",
    ].join(",")
  );
  endpoint.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "apparent_temperature",
      "weather_code",
      "precipitation_probability",
      "precipitation",
      "snowfall",
      "snow_depth",
      "wind_speed_10m",
    ].join(",")
  );
  endpoint.searchParams.set(
    "daily",
    ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "snowfall_sum"].join(",")
  );
  endpoint.searchParams.set("past_days", "1");
  endpoint.searchParams.set("forecast_days", "16");
  return endpoint.toString();
}

async function fetchForecast(location) {
  const response = await fetch(buildForecastUrl(location));
  if (!response.ok) {
    throw new Error(`無法取得 ${location.name} 資料 (${response.status})`);
  }
  return response.json();
}

function getDailySnapshot(data, dateStr) {
  let index = data.daily.time.findIndex((value) => value === dateStr);
  if (index < 0) {
    index = 0;
  }
  return {
    sourceDate: data.daily.time[index],
    weatherCode: data.daily.weather_code[index],
    maxTemp: data.daily.temperature_2m_max[index],
    minTemp: data.daily.temperature_2m_min[index],
    rainSum: data.daily.precipitation_sum[index],
    snowSum: data.daily.snowfall_sum[index] || 0,
  };
}

function getCurrentHourData(data) {
  const currentTime = data.current.time;
  const hourlyIndex = data.hourly.time.findIndex((value) => value === currentTime);
  if (hourlyIndex < 0) {
    return { snowfall: 0, snowDepth: 0 };
  }
  return {
    snowfall: data.hourly.snowfall?.[hourlyIndex] ?? 0,
    snowDepth: data.hourly.snow_depth?.[hourlyIndex] ?? 0,
  };
}

function getTrendNoteByPreviousPlan(daily, previousPlanBaseline) {
  if (!previousPlanBaseline) {
    return "與前一日行程相比：無可用資料";
  }
  const dailyAvg = (daily.maxTemp + daily.minTemp) / 2;
  const delta = dailyAvg - previousPlanBaseline.avgTemp;
  if (Math.abs(delta) < 0.5) {
    return `與前一日行程相比：溫度差不多（基準 ${previousPlanBaseline.count} 地點）`;
  }
  if (delta > 0) {
    return `與前一日行程相比：較暖約 ${Math.abs(delta).toFixed(1)}°C`;
  }
  return `與前一日行程相比：較冷約 ${Math.abs(delta).toFixed(1)}°C`;
}

function buildPreviousPlanBaseline(resultById, previousPlanLocationIds, previousDate) {
  const temps = previousPlanLocationIds
    .map((id) => resultById.get(id))
    .filter((result) => result && !result.error && result.data)
    .map((result) => getDailySnapshot(result.data, previousDate))
    .map((daily) => (daily.maxTemp + daily.minTemp) / 2);

  if (!temps.length) {
    return null;
  }

  const avgTemp = temps.reduce((acc, temp) => acc + temp, 0) / temps.length;
  return { avgTemp, count: temps.length };
}

function getHourlyIndexes(data, targetDate) {
  const currentLocalDate = data.current.time.slice(0, 10);
  const currentLocalHour = Number(data.current.time.slice(11, 13));
  const isToday = targetDate === currentLocalDate;
  const startHour = isToday ? Math.max(currentLocalHour, 5) : 5;
  return data.hourly.time
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time.startsWith(`${targetDate}T`))
    .filter(({ time }) => Number(time.slice(11, 13)) >= startHour)
    .map(({ index }) => index);
}

function formatHourLabel(timeString) {
  return timeString.slice(11, 16);
}

function renderErrorCard(container, location, error, className = "weather-card") {
  const failure = document.createElement("article");
  failure.className = `${className} error`;
  failure.innerHTML = `
    <header class="card-header">
      <h2>${location.name}</h2>
      <span>${location.region}</span>
    </header>
    <p>讀取失敗：${error.message}</p>
  `;
  container.appendChild(failure);
}

function renderDailyCard(location, data, targetDate, previousPlanBaseline, fallbackFromId = null) {
  const cardFragment = dom.weatherCardTemplate.content.cloneNode(true);
  const root = cardFragment.querySelector(".weather-card");
  const fallbackLocation = fallbackFromId ? locationMap[fallbackFromId] : null;
  const daily = getDailySnapshot(data, targetDate);
  const currentSnow = getCurrentHourData(data);
  const trendNote = getTrendNoteByPreviousPlan(daily, previousPlanBaseline);
  const dailySymbol = getWeatherSymbol(daily.weatherCode);
  const currentSymbol = getWeatherSymbol(data.current.weather_code);

  root.querySelector(".location-name").textContent = location.name;
  root.querySelector(".location-meta").textContent = `${location.region}${location.isSki ? " · 雪場" : ""}${
    fallbackLocation ? ` · 估算來源 ${fallbackLocation.name}` : ""
  }`;
  root.querySelector(".overview-weather").textContent = `${daily.sourceDate}｜${dailySymbol} ${getWeatherLabel(
    daily.weatherCode
  )}`;
  root.querySelector(".overview-temp").textContent = `${Math.round(daily.minTemp)}°C ~ ${Math.round(daily.maxTemp)}°C`;
  root.querySelector(".overview-rain").textContent = `整日降雨 ${daily.rainSum} mm`;
  root.querySelector(".overview-snow").textContent = `整日降雪 ${daily.snowSum.toFixed(1)} cm`;
  root.querySelector(".trend-note").textContent = trendNote;
  root.querySelector(".main-temp").textContent = `${Math.round(data.current.temperature_2m)}°C`;
  root.querySelector(".main-desc").textContent = `${currentSymbol} ${getWeatherLabel(
    data.current.weather_code
  )}（體感 ${Math.round(data.current.apparent_temperature)}°C）`;
  root.querySelector(".wind-line").textContent = `風速 ${data.current.wind_speed_10m} km/h`;
  root.querySelector(".precip-line").textContent = `降水 ${data.current.precipitation ?? 0} mm`;
  root.querySelector(".snow-line").textContent = location.isSki
    ? `雪況 1h雪 ${currentSnow.snowfall.toFixed(1)} cm / 雪深 ${currentSnow.snowDepth.toFixed(1)} cm`
    : "雪況 不適用";

  return cardFragment;
}

function renderHourlyCard(location, data, targetDate, fallbackFromId = null) {
  const cardFragment = dom.hourlyCardTemplate.content.cloneNode(true);
  const root = cardFragment.querySelector(".hourly-card");
  const fallbackLocation = fallbackFromId ? locationMap[fallbackFromId] : null;
  const hourChips = root.querySelector(".hour-chips");
  const indexes = getHourlyIndexes(data, targetDate);
  const currentLocalDate = data.current.time.slice(0, 10);
  const currentLocalHour = data.current.time.slice(11, 13);
  const shouldHighlightCurrentHour = targetDate === currentLocalDate;

  root.querySelector(".location-name").textContent = location.name;
  root.querySelector(".location-meta").textContent = `${location.region}${location.isSki ? " · 雪場" : ""}${
    fallbackLocation ? ` · 估算來源 ${fallbackLocation.name}` : ""
  }`;

  if (!indexes.length) {
    hourChips.innerHTML = `<p class="hour-empty">該時段無可用小時資料</p>`;
    return cardFragment;
  }

  hourChips.innerHTML = indexes
    .map((idx) => {
      const time = data.hourly.time[idx];
      const temp = Math.round(data.hourly.temperature_2m[idx]);
      const weatherCode = data.hourly.weather_code[idx];
      const symbol = getWeatherSymbol(weatherCode);
      const weather = getWeatherLabel(weatherCode);
      const rainPercent = data.hourly.precipitation_probability[idx] ?? 0;
      const snowAmount = data.hourly.snowfall[idx] || 0;
      const hourKey = time.slice(11, 13);
      const isCurrentHour = shouldHighlightCurrentHour && hourKey === currentLocalHour;
      return `
        <div class="hour-chip ${isCurrentHour ? "is-current-hour" : ""}">
          <p class="hour-time">${formatHourLabel(time)}</p>
          <p class="hour-temp">${temp}°C</p>
          <p class="hour-weather">${symbol} ${weather}</p>
          <p class="hour-meta">☔ ${rainPercent}% / ❄️ ${snowAmount.toFixed(1)}cm</p>
        </div>
      `;
    })
    .join("");

  return cardFragment;
}

async function fetchLocationResults(locationIds) {
  const tasks = locationIds.map(async (id) => {
    const location = locationMap[id];
    if (!location) {
      return null;
    }
    try {
      const data = await fetchForecast(location);
      return { id, location, data, error: null, fallbackFromId: null };
    } catch (error) {
      return { id, location, data: null, error, fallbackFromId: null };
    }
  });

  const rawResults = await Promise.all(tasks);
  const resultById = new Map(rawResults.filter(Boolean).map((result) => [result.id, result]));

  const tangramResult = resultById.get("madarao_tokyu");
  if (tangramResult?.error) {
    let kogenResult = resultById.get("madarao_kogen");
    if (!kogenResult) {
      const kogenLocation = locationMap.madarao_kogen;
      try {
        const kogenData = await fetchForecast(kogenLocation);
        kogenResult = { id: "madarao_kogen", location: kogenLocation, data: kogenData, error: null, fallbackFromId: null };
      } catch (kogenError) {
        kogenResult = { id: "madarao_kogen", location: kogenLocation, data: null, error: kogenError, fallbackFromId: null };
      }
      resultById.set("madarao_kogen", kogenResult);
    }

    if (kogenResult && !kogenResult.error && kogenResult.data) {
      resultById.set("madarao_tokyu", {
        id: "madarao_tokyu",
        location: tangramResult.location,
        data: kogenResult.data,
        error: null,
        fallbackFromId: "madarao_kogen",
      });
    }
  }

  return locationIds.map((id) => resultById.get(id)).filter(Boolean);
}

function updateDateControls(resolvedDate) {
  const viewMode = getViewMode(state.viewDate);
  const todayDate = getRelativeDateString(0);
  const tomorrowDate = getRelativeDateString(1);

  dom.todayModeBtn.textContent = `今天 ${formatMonthDay(todayDate)}`;
  dom.tomorrowModeBtn.textContent = `明天 ${formatMonthDay(tomorrowDate)}`;
  dom.todayModeBtn.classList.toggle("active", viewMode === "today");
  dom.tomorrowModeBtn.classList.toggle("active", viewMode === "tomorrow");

  dom.dayButtons.forEach((button) => {
    const offset = Number(button.dataset.offset);
    const date = getRelativeDateString(offset);
    button.textContent = formatMonthDay(date);
    button.title = date;
    button.classList.toggle("active", state.viewDate === date);
  });

  const matched = itinerary.some((item) => item.date === resolvedDate) ? resolvedDate : "";
  dom.customDateSelect.value = matched;
}

function setViewDate(dateStr) {
  state.viewDate = dateStr;
  resetSelectedLocationsToPlan();
  renderDashboard();
}

function renderNoLocationSelected() {
  dom.cardsGrid.innerHTML = `<article class="weather-card"><p>請至少勾選 1 個地點。</p></article>`;
  dom.hourlyGrid.innerHTML = `<article class="hourly-card"><p>請至少勾選 1 個地點。</p></article>`;
}

async function renderDashboard() {
  const selected = getCurrentSelectionContext();
  const targetDate = selected.requestedDate;
  const previousDate = getPreviousDateString(targetDate);
  const previousPlan = itinerary.find((item) => item.date === previousDate) || null;

  const locationIds = getSortedLocationIds([...state.selectedLocationIds]);
  const previousPlanLocationIds = previousPlan ? getSortedLocationIds(previousPlan.places) : [];
  const combinedFetchIds = getSortedLocationIds([...locationIds, ...previousPlanLocationIds]);
  const isTodayView = targetDate === getRelativeDateString(0);
  const viewMode = getViewMode(state.viewDate);
  const currentHour = new Date().getHours();
  const todayStartText = `${String(Math.max(currentHour, 5)).padStart(2, "0")}:00`;
  const hourlyRangeText = isTodayView ? `今天 ${todayStartText} → 今晚 24:00` : `${targetDate} 05:00 → 23:00`;

  dom.planHint.textContent = `天氣日期：${targetDate}｜地點來源：${selected.plan.label}${selected.note ? `｜${selected.note}` : ""}`;
  dom.dailySectionHint.textContent = `重點日期：${targetDate}｜地點數 ${locationIds.length}${
    previousPlan ? `｜前一日基準 ${previousPlan.date}` : "｜前一日基準 無"
  }`;
  dom.hourlyTitle.textContent =
    viewMode === "today" ? "每小時天氣（今天）" : viewMode === "tomorrow" ? "每小時天氣（明天）" : `每小時天氣（${targetDate}）`;
  dom.hourlyHint.textContent = `時段：${hourlyRangeText}`;
  updateDateControls(selected.resolvedDate);

  dom.statusText.textContent = `更新中：${targetDate}（地點來源 ${selected.plan.date}）`;
  dom.cardsGrid.innerHTML = "";
  dom.hourlyGrid.innerHTML = "";

  if (!locationIds.length) {
    renderNoLocationSelected();
    dom.statusText.textContent = "未勾選地點";
    return;
  }

  const results = await fetchLocationResults(combinedFetchIds);
  const resultById = new Map(results.map((result) => [result.id, result]));
  const previousPlanBaseline = buildPreviousPlanBaseline(resultById, previousPlanLocationIds, previousDate);

  locationIds.forEach((id) => {
    const result = resultById.get(id);
    if (!result) {
      return;
    }
    if (result.error) {
      renderErrorCard(dom.cardsGrid, result.location, result.error, "weather-card");
      renderErrorCard(dom.hourlyGrid, result.location, result.error, "hourly-card");
      return;
    }
    dom.cardsGrid.appendChild(
      renderDailyCard(result.location, result.data, targetDate, previousPlanBaseline, result.fallbackFromId)
    );
    dom.hourlyGrid.appendChild(renderHourlyCard(result.location, result.data, targetDate, result.fallbackFromId));
  });

  dom.statusText.textContent = `已更新：${targetDate}（地點來源 ${selected.plan.date}，${new Date().toLocaleString()}）`;
}

function initializeControls() {
  renderDateSelectOptions();
  dom.refreshBtn.addEventListener("click", renderDashboard);
  dom.todayModeBtn.addEventListener("click", () => setViewDate(getRelativeDateString(0)));
  dom.tomorrowModeBtn.addEventListener("click", () => setViewDate(getRelativeDateString(1)));
  dom.dayButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const offset = Number(button.dataset.offset);
      setViewDate(getRelativeDateString(offset));
    });
  });
  dom.customDateSelect.addEventListener("change", (event) => {
    if (!event.target.value) {
      return;
    }
    setViewDate(event.target.value);
  });
  dom.resetLocationsBtn.addEventListener("click", () => {
    resetSelectedLocationsToPlan();
    renderDashboard();
  });

  // Keep relative date labels in sync when day changes while page stays open.
  setInterval(() => {
    const selected = getCurrentSelectionContext();
    updateDateControls(selected.resolvedDate);
  }, 60000);
}

initializeControls();
resetSelectedLocationsToPlan();
renderDashboard();
