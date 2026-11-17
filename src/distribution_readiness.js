/** Existing GOVERNMENT water-aid distribution only; never maps RWH tank water. */
function validateDistributionReadiness({sites=[],demandNodes=[],roadCosts=[]}) {
 const requiredSite=['site_id','lon','lat','verification_status'];
 const requiredNode=['node_id','lon','lat','demand_liters_per_day','verification_status'];
 const missing=[];
 if (!sites.length) missing.push('VERIFIED_WATER_AID_SITES');
 if (!demandNodes.length) missing.push('VERIFIED_DEMAND_NODES');
 if (!roadCosts.length) missing.push('ROAD_NETWORK_COST_MATRIX');
 if (sites.length && sites.some(s=>requiredSite.some(k=>s[k]===undefined||s[k]==='')||s.verification_status!=='VERIFIED')) missing.push('SITE_VERIFICATION');
 if (demandNodes.length && demandNodes.some(d=>requiredNode.some(k=>d[k]===undefined||d[k]==='')||d.verification_status!=='VERIFIED')) missing.push('DEMAND_VERIFICATION');
 if (roadCosts.length && roadCosts.some(c=>c.route_validation_status!=='VERIFIED')) missing.push('NETWORK_COST_VERIFICATION');
 return {ready:missing.length===0,status:missing.length?'NOT_READY':'READY_FOR_NETWORK_ANALYSIS',missing_inputs:missing,
   scope:'EXISTING_EMERGENCY_WATER_AID_NOT_RWH',note:'Do not fabricate distribution sites or imply routing is operational before validated inputs.'};
}
module.exports={validateDistributionReadiness};
