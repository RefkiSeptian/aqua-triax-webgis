/**
 * Daily AOI CHIRPS YAS with optional first-flush sensitivity (not event-scale hydrology).
 * Base scenario with depth_mm=0 preserves original benchmark exactly.
 * Daily event proxy: a rain day >= dry_day_threshold_mm after >= dry_gap_days
 * consecutive days with rain < threshold is a new event. An event may continue
 * through consecutive wet days. One diversion is applied at each event start.
 * WARNING: actual first-flush must be designed by sanitary/engineering specialists;
 * parameters are hypothetical and CHIRPS daily cannot resolve within-day storms.
 */
function simulateYASWithFirstFlush(rainRows, scenario, firstFlush={depth_mm:0,dry_gap_days:2,dry_day_threshold_mm:1}) {
 const depth=Number(firstFlush.depth_mm??0);
 const gap=Number(firstFlush.dry_gap_days??2);
 const threshold=Number(firstFlush.dry_day_threshold_mm??1);
 if (!Number.isFinite(depth)||depth<0||depth>20||!Number.isInteger(gap)||gap<1||gap>30||!(threshold>0&&threshold<=20)) throw new RangeError('Invalid first-flush proxy');
 if (!Array.isArray(rainRows)||!rainRows.length) throw new RangeError('Empty rainfall');
 if (depth===0) {
   const runYAS = typeof module === 'undefined' ? simulateYAS : require('./yas').simulateYAS;
   return {...runYAS(rainRows,scenario),first_flush_total_m3:0,first_flush_events:0,
      first_flush_method:'NONE',first_flush_status:'MODEL_NO_DIVERSION'};
 }
 const {roof_m2,rc,demand_lpd,tank_l}=scenario;
 if (!(roof_m2>0&&rc>0&&rc<=1&&demand_lpd>0&&tank_l>=0)) throw new RangeError('Invalid YAS parameters');
 let storage=0,fullyMet=0,fullyDry=0,dryDays=0;
 let sumIn=0,sumFF=0,sumOverflow=0,sumDelivered=0,sumUnmet=0,events=0;
 let consecutiveDryDays=gap,wasWet=false;
 const daily=[];
 for (const row of rainRows){
   const mm=Number(row.rain_mm),mo=Number(row.month);
   if (!Number.isFinite(mm)||mm<0||!Number.isInteger(mo)||mo<1||mo>12) throw new RangeError('Invalid rainfall');
   const isWet=mm>=threshold;
   let startEvent=false;
   if (isWet){startEvent=!wasWet && consecutiveDryDays>=gap;consecutiveDryDays=0;wasWet=true;}
   else {consecutiveDryDays++;wasWet=false;}
   const gross=mm*roof_m2*rc; // liters
   const ff=startEvent?Math.min(gross,depth*roof_m2):0; // liters; not applied twice through RC
   if (startEvent)events++;
   const inflow=gross-ff;
   const pre=storage+inflow;
   const overflow=Math.max(0,pre-tank_l);
   const available=pre-overflow;
   const yieldL=Math.min(demand_lpd,available), unmet=demand_lpd-yieldL;
   storage=available-yieldL;
   if (unmet<=1e-7)fullyMet++;
   if (mo>=7&&mo<=9){dryDays++;if(unmet<=1e-7)fullyDry++;}
   sumIn+=inflow;sumFF+=ff;sumOverflow+=overflow;sumDelivered+=yieldL;sumUnmet+=unmet;
   daily.push({date:row.date,rain_mm:mm,new_event_proxy:startEvent,first_flush_L:ff,inflow_L:inflow,overflow_L:overflow,yield_L:yieldL,storage_L:storage,unmet_L:unmet});
 }
 return {time_reliability_pct:100*fullyMet/rainRows.length, volume_reliability_pct:100*sumDelivered/(rainRows.length*demand_lpd),
 dry_season_time_reliability_pct:100*fullyDry/dryDays,total_inflow_m3:sumIn/1000,total_spillage_m3:sumOverflow/1000,
 total_delivered_m3:sumDelivered/1000,total_unmet_m3:sumUnmet/1000,first_flush_total_m3:sumFF/1000,first_flush_events:events,
 scenario:{...scenario,first_flush:firstFlush},method:'YAS_AOI_DAILY_1996_2025',first_flush_method:'DAILY_EVENT_PROXY',
 first_flush_status:'HYPOTHETICAL_UNVALIDATED',daily};
}
if (typeof module !== 'undefined') module.exports={simulateYASWithFirstFlush};
