/**
 * AGC 2027 — Water quality risk-control decision support, NON-CERTIFYING.
 * No drinking-water safety inference from imagery, hypothetical flags or treatment alone.
 * The rules return interventions TO CONSIDER and further testing, not a prescribed
 * operating procedure, treatment efficacy or a legal conformity certificate.
 */
const ALLOWED_USES=new Set(['DRINKING','COOKING','NONPOTABLE_DOMESTIC','OTHER']);
const FLAG_KEYS=['animal_droppings','uncovered_tank','unknown_roof_material','chemical_suspected','turbid'];
function assessWaterQuality(input) {
 if (!input || !ALLOWED_USES.has(input.intended_use)) throw new RangeError('Unknown intended_use');
 const flags=input.sanitary_flags||{};
 for (const k of FLAG_KEYS) if (typeof flags[k]!=='boolean') throw new RangeError('Missing/invalid sanitary flag: '+k);
 if (typeof input.has_lab_report!=='boolean' || typeof input.lab_complete!=='boolean') throw new RangeError('Missing laboratory status');
 if (input.lab_complete && !input.has_lab_report) throw new RangeError('lab_complete cannot be true without lab report');
 const risks=[], controls=new Set(['PRE_CLEAN','SCREEN','TANK_COVER']), tests=new Set(['SANITARY_INSPECTION']);
 if (flags.animal_droppings) {risks.push('MICROBIAL_SOURCE_POSSIBLE'); controls.add('FIRST_FLUSH');tests.add('MICROBIAL_TESTING');}
 if (flags.uncovered_tank) {risks.push('VECTOR_AND_RECONTAMINATION_POSSIBLE');controls.add('TANK_COVER');tests.add('VECTOR_INSPECTION');}
 if (flags.unknown_roof_material) {risks.push('MATERIAL_UNKNOWN');tests.add('ROOF_MATERIAL_REVIEW');tests.add('CHEMICAL_TESTING_IF_INDICATED');}
 if (flags.chemical_suspected) {risks.push('CHEMICAL_RISK_SUSPECTED');tests.add('TARGETED_CHEMICAL_TESTING');controls.add('SOURCE_AVOIDANCE');}
 if (flags.turbid) {risks.push('PARTICLES_TURBIDITY_POSSIBLE');controls.add('SEDIMENT');tests.add('TURBIDITY_MEASUREMENT');}
 const potable=['DRINKING','COOKING'].includes(input.intended_use);
 if (potable){tests.add('E_COLI_AND_RELEVANT_POTABLE_PANEL');tests.add('REGULATORY_REVIEW');controls.add('MICROBIAL_TREATMENT_DESIGN_REVIEW');}
 if (!input.has_lab_report || !input.lab_complete) tests.add('COMPLETE_RELEVANT_LABORATORY_TESTING');
 return {
   intended_use:input.intended_use,
   approval_status:input.has_lab_report&&input.lab_complete?'NEEDS_QUALIFIED_REVIEW':'NOT_VERIFIED',
   safe_to_drink_claim:false,
   risk_flags:risks,candidate_controls:[...controls].sort(),required_verification:[...tests].sort(),
   disclaimer:'Scenario-only controls. No compliance, potable, performance or treatment efficacy claim. Obtain appropriate laboratory testing and qualified review.'
 };
}
if (typeof module !== 'undefined') module.exports={assessWaterQuality};
