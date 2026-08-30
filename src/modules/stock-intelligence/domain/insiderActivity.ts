import type { InsiderActivityCategory, InsiderTransaction } from "./types";

export type InsiderActivityGroup = "investment" | "sale" | "compensation" | "administrative";

export type InsiderActivityMeta = {
  label: string;
  explanation: string;
  signalLabel: string;
  group: InsiderActivityGroup;
  tone: "positive" | "sale" | "compensation" | "neutral";
};

const CATEGORY_META: Record<InsiderActivityCategory, InsiderActivityMeta> = {
  personal_investment: {
    label: "Personal investment",
    explanation: "The insider purchased shares using personal or controlled capital, not company compensation.",
    signalLabel: "Bullish evidence",
    group: "investment",
    tone: "positive",
  },
  sale: {
    label: "Sale — reason not disclosed",
    explanation: "Shares were sold, but the filing does not disclose the insider's personal reason.",
    signalLabel: "Motive unknown",
    group: "sale",
    tone: "sale",
  },
  scheduled_sale: {
    label: "Scheduled sale",
    explanation: "The filing reports a Rule 10b5-1 trading plan. The insider's personal motive is still not disclosed.",
    signalLabel: "Planned activity",
    group: "sale",
    tone: "sale",
  },
  tax_sale: {
    label: "Shares sold for taxes",
    explanation: "The filing says shares were automatically sold to cover taxes related to equity compensation.",
    signalLabel: "Administrative",
    group: "sale",
    tone: "neutral",
  },
  award: {
    label: "Company stock award",
    explanation: "Shares or units were awarded as compensation. This was not a personal stock purchase.",
    signalLabel: "Compensation",
    group: "compensation",
    tone: "compensation",
  },
  option_exercise: {
    label: "Option exercised",
    explanation: "An employee option or similar right was converted into shares. This was not a market purchase.",
    signalLabel: "Compensation",
    group: "compensation",
    tone: "compensation",
  },
  tax_withholding: {
    label: "Shares withheld for taxes",
    explanation: "Shares were surrendered or withheld to cover taxes or an exercise price.",
    signalLabel: "Administrative",
    group: "administrative",
    tone: "neutral",
  },
  gift: {
    label: "Shares gifted",
    explanation: "Ownership was transferred as a gift, not sold as an investment decision.",
    signalLabel: "Ownership transfer",
    group: "administrative",
    tone: "neutral",
  },
  conversion: {
    label: "Shares converted",
    explanation: "One security or share class was converted into another. This usually does not change economic exposure.",
    signalLabel: "Administrative",
    group: "administrative",
    tone: "neutral",
  },
  issuer_disposition: {
    label: "Returned or sold to company",
    explanation: "Shares were transferred back to the issuer. The filing details provide the exact context.",
    signalLabel: "Administrative",
    group: "administrative",
    tone: "neutral",
  },
  other: {
    label: "Other ownership change",
    explanation: "The filing reports an ownership change that does not fit the common purchase, sale, award, or tax categories.",
    signalLabel: "Context only",
    group: "administrative",
    tone: "neutral",
  },
};

export const insiderActivityMeta = (category: InsiderActivityCategory) => CATEGORY_META[category];
export const isPersonalInvestment = (transaction: InsiderTransaction) => transaction.category === "personal_investment";
export const isSaleActivity = (transaction: InsiderTransaction) => CATEGORY_META[transaction.category].group === "sale";
export const isCompensationActivity = (transaction: InsiderTransaction) => CATEGORY_META[transaction.category].group === "compensation";
export const isAdministrativeActivity = (transaction: InsiderTransaction) => CATEGORY_META[transaction.category].group === "administrative";
