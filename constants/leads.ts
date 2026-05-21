export const leadStatuses = ["New", "Contacted", "Interested", "Follow Up", "Converted", "Lost"] as const;
export const leadSources = ["WhatsApp", "Instagram", "Website", "Referral", "Walk-in", "Other"] as const;

export type LeadStatus = (typeof leadStatuses)[number];
export type LeadSource = (typeof leadSources)[number];