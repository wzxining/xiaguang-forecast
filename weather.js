// Static hosting version of the experimental viewing index in forecast.py.
// It fetches Open-Meteo directly from the visitor's browser.
(function (scope) {
  'use strict';

  const CACHE_MS = 5 * 60 * 1000;
  const cache = new Map();
  const STORE_KEY = 'xiaguang:weather:v2';
  const MAX_STALE_MS = 6 * 60 * 60 * 1000;
  const controllers = new Map();
  let rateLimitUntil = 0;
  const coordinateKey = point => `${Number(point.latitude).toFixed(6)},${Number(point.longitude).toFixed(6)}`;
  const todayInChina = () => new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  function usableSaved(saved) {
    const data = saved?.data;
    const age = Date.now()-Date.parse(data?.updated_at);
    // Yesterday's three-day table must never be labelled as today's table.
    return age >= 0 && age < MAX_STALE_MS && Array.isArray(data?.days) && data.days[0]?.date === todayInChina() &&
      data.days.every(day => ['sunrise','sunset'].every(k =>
        Number.isFinite(day[k]?.score) && day[k].score >= 0 && day[k].score <= 100 &&
        Number.isFinite(Date.parse(day[k].time))));
  }
  try {
    const stored = JSON.parse(scope.localStorage?.getItem(STORE_KEY) || '{}');
    Object.entries(stored).slice(-150).forEach(([key,saved]) => { if(usableSaved(saved)) cache.set(key,saved); });
  } catch (_) { /* Blocked browser storage must not stop live forecasts. */ }
  function persistCache() {
    try {
      const entries = [...cache.entries()].filter(([,saved]) => usableSaved(saved)).slice(-100);
      scope.localStorage?.setItem(STORE_KEY,JSON.stringify(Object.fromEntries(entries)));
    } catch (_) { /* A full or disabled browser store is optional. */ }
  }
  function setForecastScope(points) {
    const keep = new Set(points.map(coordinateKey));
    controllers.forEach((controller,key) => { if(!keep.has(key)) controller.abort(); });
  }
  function cancelled() { const error = new Error('已切换地点。'); error.code='cancelled'; return error; }
  function errorMessage(error) {
    if(error.code==='timeout') return '气象查询超时，请稍后点击“更新预报”。';
    if(error.status===429) return '气象服务暂时限流，请稍后再更新预报。';
    if(error.status>=500) return '气象服务暂时繁忙，请稍后更新预报。';
    if(error.code==='network') return '暂时连接不上气象数据服务，请稍后更新预报或更换网络。';
    if(error.code==='cancelled') return error.message;
    if(error.status) return '气象服务未能完成查询（'+error.status+'），请稍后重试。';
    return '该景点的气象数据不完整，暂不能计算预报。请稍后更新。';
  }
  const pending = new Map();
  const queue = [];
  let active = 0;
  // Bound traffic when a city has many mapped locations.
  function limited(task) {
    return new Promise((resolve, reject) => {
      queue.push({task, resolve, reject});
      drain();
    });
  }
  function drain() {
    while (active < 3 && queue.length) {
      const {task, resolve, reject} = queue.shift(); active++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; drain(); });
    }
  }
  const popular = [
    ['北京', 39.90, 116.41], ['上海', 31.23, 121.47],
    ['广州', 23.13, 113.26], ['深圳', 22.54, 114.06],
    ['成都', 30.66, 104.07], ['重庆', 29.56, 106.55],
    ['杭州', 30.27, 120.15], ['南京', 32.06, 118.80],
    ['武汉', 30.59, 114.31], ['西安', 34.34, 108.94],
    ['昆明', 25.04, 102.71], ['厦门', 24.48, 118.09],
    ['拉萨', 29.65, 91.14], ['乌鲁木齐', 43.83, 87.62],
    ['哈尔滨', 45.80, 126.53], ['三亚', 18.25, 109.51],
    ['香港', 22.32, 114.17], ['澳门', 22.20, 113.54],
    ['台北', 25.03, 121.57]
  ].map(([name, latitude, longitude]) => ({ name, latitude, longitude }));

  const clamp = value => Math.max(0, Math.min(100, value));
  const mean = values => {
    const numbers = values.filter(value => value !== null && value !== undefined).map(Number);
    return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
  };
  const chinaTime = value => Date.parse(`${value}+08:00`);

  function eventIndex(hourly, eventTime) {
    const times = hourly.time || [];
    if (!times.length) throw new Error('气象接口缺少逐小时数据');
    const target = chinaTime(eventTime);
    let chosen = times.map((hour, index) => ({ index, gap: Math.abs(chinaTime(hour) - target) }))
      .filter(item => item.gap <= 90 * 60 * 1000);
    if (!chosen.length) {
      chosen = [{ index: times.reduce((best, hour, index) =>
        Math.abs(chinaTime(hour) - target) < Math.abs(chinaTime(times[best]) - target) ? index : best, 0) }];
    }
    const field = name => mean(chosen.map(({ index }) => (hourly[name] || [])[index]));
    const rawLow = field('cloud_cover_low');
    const rawMid = field('cloud_cover_mid');
    const rawHigh = field('cloud_cover_high');
    if ([rawLow, rawMid, rawHigh].some(value => value === null)) throw new Error('气象接口缺少分层云量数据');
    const low = clamp(rawLow);
    const mid = clamp(rawMid);
    const high = clamp(rawHigh);
    const rain = clamp(field('precipitation_probability') || 0);
    const visibility = field('visibility');
    const canvasCover = (mid + high) / 2;
    const canvas = clamp(100 - Math.abs(canvasCover - 45) * 1.45);
    const horizon = 100 - low;
    let score = 0.40 * canvas + 0.45 * horizon + 0.15 * Math.min(canvas, horizon);
    score -= rain * 0.32;
    if (visibility !== null && visibility < 5000) score -= 15 * (1 - Math.max(0, visibility) / 5000);
    score = Math.round(clamp(score));

    let reason;
    if (rain >= 55) reason = '时段附近有较高降水可能，观赏条件受影响。';
    else if (low >= 70) reason = '低云较多，可能遮挡日出日落方向。';
    else if (visibility !== null && visibility < 5000) reason = '能见度偏低，远处霞光可能不清晰。';
    else if (canvasCover < 18) reason = '中高云较少，可被照亮的云层有限。';
    else if (canvasCover > 82) reason = '中高云较密，霞光效果存在不确定性。';
    else reason = '有一定中高云，且低云遮挡相对较少。';

    return {
      score, grade: score >= 70 ? '较佳' : score >= 40 ? '一般' : '偏低', reason,
      cloud_low: Math.round(low), cloud_mid: Math.round(mid), cloud_high: Math.round(high),
      rain_probability: Math.round(rain), visibility_m: visibility === null ? null : Math.round(visibility)
    };
  }

  function buildDays(weather) {
    const daily = weather.daily || {};
    const dates = daily.time || [];
    const sunrises = daily.sunrise || [];
    const sunsets = daily.sunset || [];
    if (!dates.length || dates.length !== sunrises.length || dates.length !== sunsets.length)
      throw new Error('气象接口缺少日出日落数据');
    const days = [];
    dates.forEach((date, index) => {
      const sunrise = sunrises[index];
      const sunset = sunsets[index];
      if (!sunrise || !sunset) return;
      days.push({
        date,
        sunrise: { time: `${sunrise}+08:00`, ...eventIndex(weather.hourly || {}, sunrise) },
        sunset: { time: `${sunset}+08:00`, ...eventIndex(weather.hourly || {}, sunset) }
      });
    });
    if (!days.length) throw new Error('气象接口没有可用的日出日落时段');
    return days;
  }

  async function fetchJson(url, timeoutMs, outerSignal) {
    if(outerSignal?.aborted) throw cancelled();
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    outerSignal?.addEventListener('abort',abort,{once:true});
    const timer = setTimeout(() => { timedOut=true; controller.abort(); }, timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const error = new Error(`数据服务返回 ${response.status}`);error.status=response.status;
        if(response.status===429){
          const seconds=Number(response.headers?.get('Retry-After'));
          rateLimitUntil=Date.now()+Math.max(60000,Number.isFinite(seconds)?seconds*1000:60000);
        }
        throw error;
      }
      return await response.json();
    } catch(error) {
      if(outerSignal?.aborted) throw cancelled();
      if(timedOut) error.code='timeout';
      else if(!error.status && error instanceof TypeError) error.code='network';
      throw error;
    } finally { clearTimeout(timer);outerSignal?.removeEventListener('abort',abort); }
  }
  async function fetchForecast(query, signal, saved) {
    let lastError;
    for(let attempt=0;attempt<2;attempt++){
      if(signal.aborted) throw cancelled();
      if(rateLimitUntil>Date.now()){const error=new Error('rate limit');error.status=429;throw error;}
      try{return await fetchJson(`https://api.open-meteo.com/v1/forecast?${query}`,attempt===0?18000:22000,signal);}
      catch(error){
        lastError=error;
        const retryable=['timeout','network'].includes(error.code)||error.status>=500;
        if(!retryable||usableSaved(saved)||attempt===1)throw error;
        await new Promise(resolve=>setTimeout(resolve,800));
      }
    }
    throw lastError;
  }

  async function citiesDirect(q) {
    if (q.length < 2 || q.length > 60) throw new Error('请输入 2 至 60 个字搜索城市。');
    const term=q.replace(/市$/, '');
    const all=[...popular,...(scope.CITY_INDEX || [])];
    const seen=new Set();
    const local=all.filter(city=> { const key=city.name.replace(/市$/, ''); if(seen.has(key)) return false; seen.add(key); return key.includes(term); }).sort((a,b)=>Number(b.name===term)-Number(a.name===term));
    if (local.length) return { cities: local.slice(0, 8) };
    try {
      const query = new URLSearchParams({ name: q, count: 8, language: 'zh', format: 'json' });
      const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${query}`, 8000);
      return { cities: (data.results || []).filter(row => ['CN', 'HK', 'MO', 'TW'].includes(row.country_code))
        .map(row => ({ name: row.name, admin1: row.admin1 || '', latitude: row.latitude, longitude: row.longitude })) };
    } catch (_) { throw new Error('城市查询暂时不可用，请稍后重试。'); }
  }

  async function forecastDirect(point, force = false) {
    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 3 || latitude > 54 || longitude < 73 || longitude > 135)
      throw new Error('这个地点尚无可用坐标，暂不能查询景点预报。');
    // Keep the actual POI, rather than rounding every point to a city-sized cell.
    const key = coordinateKey({latitude,longitude});
    const saved = cache.get(key);
    const location = { name: point.name, latitude, longitude };
    if (!force && usableSaved(saved) && saved.expires > Date.now()) return { ...saved.data, location, cached: true, stale: false };
    if (pending.has(key) && controllers.get(key)?.signal.aborted) pending.delete(key);
    if (!pending.has(key)) {
      const controller = new AbortController(); controllers.set(key,controller);
      const job = limited(async () => {
        const query = new URLSearchParams({
          latitude: latitude.toFixed(6), longitude: longitude.toFixed(6),
          hourly: 'cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation_probability,visibility',
          daily: 'sunrise,sunset', timezone: 'Asia/Shanghai', forecast_days: 3
        });
        try {
          const weather = await fetchForecast(query,controller.signal,saved);
          const data = { days: buildDays(weather), source: 'Open-Meteo',
            grid: { latitude: weather.latitude, longitude: weather.longitude, elevation: weather.elevation },
            method: '实验性云量规则 v1', updated_at: new Date().toISOString(), cached: false, stale: false };
          cache.set(key, { expires: Date.now() + CACHE_MS, data });
          persistCache();
          return data;
        } catch (error) {
          if(error.code==='cancelled') throw error;
          if (usableSaved(saved)) return { ...saved.data, cached: true, stale: true, warning: errorMessage(error) };
          throw Object.assign(new Error(errorMessage(error)),{code:error.code,status:error.status});
        }
      }).finally(() => {
        if(pending.get(key)===job) pending.delete(key);
        if(controllers.get(key)===controller) controllers.delete(key);
      });
      pending.set(key, job);
    }
    return { ...await pending.get(key), location };
  }

  scope.setForecastScope = setForecastScope;
  scope.citiesDirect = citiesDirect;
  scope.forecastDirect = forecastDirect;
  if (typeof module !== 'undefined') module.exports = { eventIndex, buildDays, citiesDirect, forecastDirect, setForecastScope };
})(typeof window === 'undefined' ? globalThis : window);
