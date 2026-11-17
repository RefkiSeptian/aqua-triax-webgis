/**
 * AGC 2027 Katongan — Daily YAS water balance, pure JavaScript reference.
 * Rain: CHIRPS v3 daily aggregated over Katongan AOI, 1996-2025.
 * No first flush, water quality, actual roof validation or usage cost.
 * Per day order: inflow -> spillage -> fulfil demand -> store remainder.
 */
function simulateYAS(rainRows, scenario) {
  const {roof_m2, rc, demand_lpd, tank_l} = scenario;
  if (!(roof_m2 > 0 && rc > 0 && rc <= 1 && demand_lpd > 0 && tank_l >= 0)) {
    throw new RangeError('Parameters invalid (roof_m2>0, 0<rc<=1, demand_lpd>0, tank_l>=0).');
  }
  if (!rainRows || rainRows.length === 0) throw new Error('Rain data empty');
  let storage = 0, fullyMet = 0, fullyMetDry = 0, nDry = 0;
  let inflowSum = 0, spillSum = 0, yieldSum = 0, unmetSum = 0;
  const daily = [];
  for (const row of rainRows) {
    const rain = Number(row.rain_mm);
    const month = Number(row.month);
    if (!Number.isFinite(rain) || rain < 0 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new RangeError('Invalid rain or month');
    }
    const inflow = rain * roof_m2 * rc; // mm*m2 = L
    const before = storage + inflow;
    const overflow = Math.max(0, before - tank_l);
    const available = before - overflow;
    const yieldL = Math.min(demand_lpd, available);
    const unmet = demand_lpd - yieldL;
    storage = available - yieldL;
    const met = unmet <= 1e-7;
    if (met) fullyMet++;
    if (month >= 7 && month <= 9) {nDry++; if (met) fullyMetDry++;}
    inflowSum += inflow; spillSum += overflow; yieldSum += yieldL; unmetSum += unmet;
    daily.push({date:row.date, inflow_L:inflow, overflow_L:overflow, yield_L:yieldL,
       storage_L:storage, unmet_L:unmet, fully_met:met});
  }
  return {
    time_reliability_pct: 100*fullyMet/rainRows.length,
    volume_reliability_pct: 100*yieldSum/(demand_lpd*rainRows.length),
    dry_season_time_reliability_pct: 100*fullyMetDry/nDry,
    total_inflow_m3: inflowSum/1000,
    total_spillage_m3: spillSum/1000,
    total_delivered_m3: yieldSum/1000,
    total_unmet_m3: unmetSum/1000,
    scenario: {...scenario},
    method: 'YAS_AOI_DAILY_1996_2025',
    daily
  };
}
if (typeof module !== 'undefined') module.exports = {simulateYAS};
