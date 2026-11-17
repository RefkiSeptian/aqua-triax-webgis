const assert=require('assert');
const fs=require('fs');
const {assessWaterQuality}=require('../src/quality_rules');
const raw=fs.readFileSync('data/kesling/treatment_technology_matrix.csv','utf8').trim().split(/\r?\n/);
const ids=new Set(raw.slice(1).map(r=>r.split(',')[0]));
const input={intended_use:'DRINKING',has_lab_report:false,lab_complete:false,
 sanitary_flags:{animal_droppings:true,uncovered_tank:true,unknown_roof_material:true,chemical_suspected:true,turbid:true}};
const ans=assessWaterQuality(input);
assert(ans.candidate_controls.every(k=>ids.has(k)), 'Unregistered treatment code');
assert(!ans.safe_to_drink_claim);
console.log('PASS quality candidate codes:',ans.candidate_controls.join(', '));
