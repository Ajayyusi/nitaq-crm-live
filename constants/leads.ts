export const leadStages = [
  "Lead",
  "Contacted",
  "Interested",
  "Not Connecting",
  "Not Answering",
  "Invalid Number",
  "Enrolled",
  "Paid",
  "Lost",
] as const;

export const leadSources = [
  "WhatsApp",
  "Instagram",
  "Google Maps",
  "Referral",
  "Walk-in",
  "Paid Ads",
  "Other",
] as const;

export const courseList = [
  "AI for Professionals",
  "CyberShield Program",
  "Digital Marketing Mastery",
  "Excel & Power BI",
  "Cybersecurity Essentials",
  "Sales & Negotiation",
  "Web Development",
  "Supportive Education - Maths",
  "Supportive Education - Science",
  "Supportive Education - English",
  "General Academic Support",
  "Language Training",
  "Other",
] as const;

export type LeadStage = (typeof leadStages)[number];
export type LeadSource = (typeof leadSources)[number];
export type CourseOption = (typeof courseList)[number];

// Legacy aliases kept so existing API files compile without changes
export const leadStatuses = leadStages;
export type LeadStatus = LeadStage;
