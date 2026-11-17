// Role families from job titles: simple keyword rules, all in this one file.
// Used by scripts/refresh.mjs (classifying every ATS role) and by the app (labels).
// Order matters: the first family whose rule matches wins (design before engineering, so a
// "Design Engineer" is design; data before engineering, so a "Data Engineer" is data).

/** @typedef {"design" | "engineering" | "product" | "data" | "other"} RoleFamily */

/** @type {[RoleFamily, RegExp, RegExp | null][]} [family, matches, but not] */
export const FAMILY_RULES = [
  [
    "design",
    /\b(designer|design engineer|design manager|head of design|design lead|ux|ui\/ux|product design)\b/i,
    // Same exclusions as the 15.11 design list: research, brand/visual/motion, students, physical design.
    /\b(research|researcher|brand|graphic|visual|motion|werkstudent|working student|intern|internship|praktik|instructional|hardware|mechanical|electrical|pcb|industrial designer|game|marketing designer|content designer|talent pool)\b/i,
  ],
  [
    "data",
    /\b(data scientist|data engineer|data analyst|analytics engineer|machine learning|ml engineer|mlops|ai research|research scientist|research engineer|applied scientist|data platform|product analyst)\b/i,
    /\b(werkstudent|working student|intern|internship|praktik)\b/i,
  ],
  [
    "product",
    /\b(product manager|product owner|head of ([a-z]+ )?product|vp,? product|director,? product|product lead|group product|product management|chief product)\b/i,
    /\b(marketing|werkstudent|working student|intern|internship|praktik)\b/i,
  ],
  [
    "engineering",
    /\b(engineer|engineering manager|head of engineering|developer|entwickler|software|frontend|front-end|backend|back-end|full[- ]?stack|devops|sre|site reliability|platform|infrastructure|mobile|ios|android|qa|test automation|architect|cto)\b/i,
    // Customer-facing "engineers" (pre-sales, support) and non-software engineering stay in Other.
    /\b(solutions? engineer|sales engineer|support engineer|customer engineer|field engineer|service engineer|technical account|electrical|mechanical|elektro|installateur|monteur|hvac|photovoltaik|werkstudent|working student|intern|internship|praktik|talent pool|agent architect)\b/i,
  ],
]

/** @param {string} title @returns {RoleFamily} */
export function familyOf(title) {
  for (const [family, yes, no] of FAMILY_RULES) {
    if (yes.test(title) && !(no && no.test(title))) return family
  }
  return "other"
}
