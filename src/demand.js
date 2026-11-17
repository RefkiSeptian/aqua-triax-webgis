/** Project scenario demand, not a population census or real Katongan consumption. */
const LEVELS = Object.freeze({EMERGENCY_MIN:15, DOMESTIC_MID:50, DOMESTIC_HIGH:100});
function householdDemand(persons, litersPerPersonPerDay) {
 if (!Number.isInteger(persons) || persons < 1 || persons > 30 ||
     !Number.isFinite(litersPerPersonPerDay) || litersPerPersonPerDay <= 0 || litersPerPersonPerDay > 1000) {
   throw new RangeError('Invalid persons or litersPerPersonPerDay');
 }
 return {persons,liters_per_person_per_day:litersPerPersonPerDay, household_liters_per_day:persons*litersPerPersonPerDay, status:'SCENARIO_NOT_OBSERVED'};
}
module.exports={LEVELS,householdDemand};
