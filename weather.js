// Static hosting version of the experimental viewing index in forecast.py.
// It fetches Open-Meteo directly from the visitor's browser.
(function (scope) {
  'use strict';

  const CACHE_MS = 5 * 60 * 1000;
  const cache = new Map();
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

  async function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`数据服务返回 ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function citiesDirect(q) {
    if (q.length < 2 || q.length > 60) throw new Error('请输入 2 至 60 个字搜索城市。');
    const local = popular.filter(city => city.name.includes(q));
    if (local.length) return { cities: local.slice(0, 8) };
    try {
      const query = new URLSearchParams({ name: q, count: 8, language: 'zh', format: 'json' });
      const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${query}`, 8000);
      return { cities: (data.results || []).filter(row => ['CN', 'HK', 'MO', 'TW'].includes(row.country_code))
        .map(row => ({ name: row.name, admin1: row.admin1 || '', latitude: row.latitude, longitude: row.longitude })) };
    } catch (_) { throw new Error('城市查询暂时不可用，请稍后重试。'); }
  }

  async function forecastDirect(city, force = false) {
    const latitude = Number(city.latitude);
    const longitude = Number(city.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 3 || latitude > 54 || longitude < 73 || longitude > 135)
      throw new Error('请选取中国地区的城市。');
    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const saved = cache.get(key);
    const location = { name: city.name, latitude, longitude };
    if (!force && saved && saved.expires > Date.now()) return { ...saved.data, location, cached: true, stale: false };
    const query = new URLSearchParams({
      latitude: latitude.toFixed(2), longitude: longitude.toFixed(2),
      hourly: 'cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation_probability,visibility',
      daily: 'sunrise,sunset', timezone: 'Asia/Shanghai', forecast_days: 3
    });
    try {
      const weather = await fetchJson(`https://api.open-meteo.com/v1/forecast?${query}`, 12000);
      const data = { location, days: buildDays(weather), source: 'Open-Meteo',
        method: '实验性云量规则 v1', updated_at: new Date().toISOString(), cached: false, stale: false };
      cache.set(key, { expires: Date.now() + CACHE_MS, data });
      return data;
    } catch (_) {
      if (saved) return { ...saved.data, location, cached: true, stale: true };
      throw new Error('预测数据暂时不可用，请稍后重试。');
    }
  }

  scope.citiesDirect = citiesDirect;
  scope.forecastDirect = forecastDirect;
  if (typeof module !== 'undefined') module.exports = { eventIndex, buildDays, citiesDirect, forecastDirect };
})(typeof window === 'undefined' ? globalThis : window);
