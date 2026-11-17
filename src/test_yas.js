// node src/test_yas.js <path to daily CSV> <path to YAS matrix CSV>
const fs = require('fs');
const {simulateYAS} = require('./yas');
function csv(content) {
  const rows=content.trim().split(/\r?\n/); const keys=rows.shift().split(',');
  return rows.map(r => Object.fromEntries(r.split(',').map((v,i)=>[keys[i],v])));
}
const daily=csv(fs.readFileSync(process.argv[2]||'data/katongan_daily_rain_1996_2025.csv','utf8'));
const matrix=csv(fs.readFileSync(process.argv[3]||'data/katongan_yas_scenario_matrix.csv','utf8'));
function close(a,b,atol=1e-6) {return Math.abs(a-b)<=atol;}
for (let i=0;i<matrix.length;i++) {
 const s=matrix[i];
 const got=simulateYAS(daily, {roof_m2:+s.roof_m2,rc:+s.runoff,demand_lpd:+s.demand_lpd,tank_l:+s.tank_l});
 for (const k of ['time_reliability_pct','volume_reliability_pct','dry_season_time_reliability_pct',
  'total_inflow_m3','total_spillage_m3','total_delivered_m3','total_unmet_m3']) {
  if (!close(got[k],+s[k],1e-6)) throw new Error(`Scenario ${i}, ${k}: ${got[k]} vs ${s[k]}`);
 }
}
console.log('PASS',matrix.length,'YAS scenarios; daily rain length',daily.length);
