export type ID = string;

export type AgentStatus = "active" | "paused";

export interface Agent {
  id: ID;
  name: string;
  email: string;
  phone: string;
  area: string;
  code: string; // referral code a merchant enters at signup
  status: AgentStatus;
  joinedAt: number;
}

// The merchant's journey, in order. Repeat/retained are derived from payments.
export const STAGES = [
  "conversation",
  "interested",
  "signed_up",
  "bank_added",
  "verified",
  "link_created",
  "transacting",
] as const;
export type Stage = (typeof STAGES)[number] | "lost";

export const STAGE_LABEL: Record<Stage, string> = {
  conversation: "Conversation",
  interested: "Interested",
  signed_up: "Signed up",
  bank_added: "Bank added",
  verified: "Verified",
  link_created: "Payment link",
  transacting: "Transacting",
  lost: "Lost",
};

export type KybStatus = "none" | "verified" | "review" | "failed" | "queued";

export interface Kyb {
  tier: 0 | 1 | 2;
  status: KybStatus; // status of the latest check
  ninLast4?: string;
  bankName?: string;
  accountLast4?: string;
  resolvedName?: string;
  nameMatch?: boolean;
  cac?: string;
  cacType?: "bn" | "co" | "it";
  legalName?: string;
  note?: string;
  updatedAt?: number;
}

export interface Payment {
  id: ID;
  at: number;
  amountNgn: number;
  token: "USDC" | "USDT";
  chain: string;
}

export interface Merchant {
  id: ID;
  businessName: string;
  ownerName: string;
  phone: string;
  category: string;
  area: string;
  agentId: ID;
  stage: Stage;
  createdAt: number;
  history: { stage: Stage; at: number }[];
  kyb: Kyb;
  payments: Payment[];
}

export type Channel = "visit" | "call" | "whatsapp";
export type Outcome = "interested" | "not_interested" | "signed_up" | "call_back" | "helped_setup";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  interested: "Interested",
  not_interested: "Not interested",
  signed_up: "Signed up on the spot",
  call_back: "Asked to call back",
  helped_setup: "Helped with setup",
};

export interface Interaction {
  id: ID;
  merchantId: ID;
  agentId: ID;
  at: number;
  channel: Channel;
  outcome: Outcome;
  objection?: string;
  competitor?: string;
  quote?: string;
  note?: string;
}

export type NoteCategory =
  | "why_not"
  | "why_yes"
  | "objection"
  | "competitor"
  | "onboarding"
  | "request";

export const NOTE_LABEL: Record<NoteCategory, string> = {
  why_not: "Why they didn't activate",
  why_yes: "Why they activated",
  objection: "Objection",
  competitor: "Competitor",
  onboarding: "Onboarding",
  request: "Feature request",
};

export interface FieldNote {
  id: ID;
  agentId: ID;
  at: number;
  category: NoteCategory;
  area: string;
  observation: string;
  quote?: string;
  hypothesis?: string;
  merchantId?: ID;
}

export type Priority = "high" | "medium" | "low";

export type Trigger =
  | "no_bank"
  | "not_verified"
  | "kyb_review"
  | "no_link"
  | "no_payment"
  | "dormant"
  | "call_back";

export const TRIGGER_LABEL: Record<Trigger, string> = {
  no_bank: "Signed up, no bank account",
  not_verified: "Bank added, not verified",
  kyb_review: "Verification needs a fix",
  no_link: "Verified, no payment link",
  no_payment: "Payment link, no payment yet",
  dormant: "No payment in 14 days",
  call_back: "Asked to call back",
};

export interface FollowUp {
  id: ID;
  merchantId: ID;
  agentId: ID;
  trigger: Trigger;
  priority: Priority;
  due: number;
  status: "open" | "done";
  outcome?: string;
  closedAt?: number;
}

export interface Data {
  version: number;
  agents: Agent[];
  merchants: Merchant[];
  interactions: Interaction[];
  notes: FieldNote[];
  followUps: FollowUp[];
}

export const AREAS = [
  "Computer Village, Ikeja",
  "Balogun Market",
  "Alaba International",
  "Trade Fair Complex",
  "Yaba Tech Hub",
  "Lekki Phase 1",
  "Oshodi",
  "Surulere",
];

export const CATEGORIES = [
  "Phones & accessories",
  "Electronics",
  "Fashion",
  "Provisions",
  "Restaurant",
  "Pharmacy",
  "Cosmetics",
  "Freelancer / agency",
  "Logistics",
];

export const OBJECTIONS = [
  "Customers don't pay in crypto",
  "Doesn't trust crypto",
  "Worried about the rate",
  "Already uses P2P",
  "Wants to think about it",
  "Needs it explained to partner",
  "Phone / data issue",
];

export const COMPETITORS = [
  "Binance P2P",
  "Bybit P2P",
  "Busha",
  "Yellow Card",
  "Quidax",
  "Roqqu",
  "Bank transfer only",
  "None",
];

export const BANKS = [
  "Access Bank",
  "GTBank",
  "First Bank",
  "Zenith Bank",
  "UBA",
  "Kuda",
  "Moniepoint",
  "OPay",
  "PalmPay",
];
