import {
  AREAS,
  BANKS,
  CATEGORIES,
  COMPETITORS,
  OBJECTIONS,
  STAGES,
  type Agent,
  type Data,
  type FieldNote,
  type Interaction,
  type Merchant,
  type Outcome,
  type Payment,
  type Stage,
} from "./types";
import { followUpsFor } from "./derive";

export const DATA_VERSION = 1;
export const DAY = 86_400_000;

// Deterministic so every reset produces the same demo.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

let counter = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}`;

const AGENTS: Omit<Agent, "id" | "joinedAt">[] = [
  { name: "Tolu Adebayo", email: "tolu.adebayo@example.com", phone: "0803 412 7781", area: AREAS[0], code: "LQ-TOLU", status: "active" },
  { name: "Chinedu Okafor", email: "chinedu.okafor@example.com", phone: "0812 554 0912", area: AREAS[2], code: "LQ-CHIN", status: "active" },
  { name: "Aisha Bello", email: "aisha.bello@example.com", phone: "0706 221 4410", area: AREAS[4], code: "LQ-AISH", status: "active" },
  { name: "Femi Lawal", email: "femi.lawal@example.com", phone: "0905 118 3362", area: AREAS[1], code: "LQ-FEMI", status: "active" },
  { name: "Grace Eze", email: "grace.eze@example.com", phone: "0810 773 9025", area: AREAS[5], code: "LQ-GRAC", status: "paused" },
];

const BUSINESSES = [
  "Mama Put Kitchen", "Gadget Hub NG", "Ola Phones", "Iya Basira Provisions", "Kemi's Closet", "Prime Pharmacy",
  "Tech Republic", "Bukka 360", "Glow by Ada", "Swift Dispatch", "Chuks Electronics", "Lagos Thrift Store",
  "Pixel Studio", "Mr Biggs Suya Spot", "Fola Fabrics", "Zee Accessories", "Naija Gadgets", "Eko Wears",
  "Hassan Phone Repairs", "Blessed Provisions", "Laptop Clinic", "Amaka Hair & Beauty", "Royal Shawarma",
  "Pinnacle Logistics", "Codebase Agency", "Iyabo Foodstuff", "Shoe Palace", "Divine Pharmacy", "Mega Chargers",
  "Uche Solar & Inverter", "Bola Bags", "Smart Buy Electronics", "The Wig Bar", "Bite Me Grills", "Tunde Prints",
  "Halal Meats Oshodi", "Jumoke Jewels", "Kola Gadgets", "Market Square Fresh", "Mide Media", "Precious Perfumes",
  "Ade Auto Parts", "Ruth's Kitchen", "Gbenga Phones", "Lekki Nails",
];

const OWNERS = [
  "Bisi Ogunleye", "Emeka Nwosu", "Olamide Ajayi", "Basirat Yusuf", "Kemi Alade", "Ifeanyi Obi", "Seyi Coker",
  "Musa Ibrahim", "Adaeze Eze", "Dayo Fashola", "Chukwuma Obi", "Ngozi Uche", "Tobi Aina", "Yakubu Sani",
  "Folake Bakare", "Zainab Musa", "Kunle Adeyemi", "Ebere Okeke", "Hassan Bello", "Blessing Nnaji",
];

const QUOTES = [
  "If my customers start paying like this, I'm in.",
  "Abeg, how much una dey collect?",
  "I use Binance P2P already, it's just stressful.",
  "Show me someone in this market using it first.",
  "My oga has to see it before we start.",
  "Foreign customers ask me for USDT all the time.",
  "The rate must be good o.",
  "Can it go straight to my Moniepoint?",
];

export function seed(now = Date.now()): Data {
  const r = rng(42);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));

  const agents: Agent[] = AGENTS.map((a, i) => ({ ...a, id: `ag_${i + 1}`, joinedAt: now - (60 - i * 8) * DAY }));
  const working = agents.filter((a) => a.status === "active");

  // How far each merchant got. Weighted so the funnel narrows realistically.
  const reach: Stage[] = [
    "conversation", "conversation", "conversation", "interested", "interested", "interested", "lost", "lost",
    "signed_up", "signed_up", "bank_added", "bank_added", "verified", "link_created", "link_created",
    "transacting", "transacting", "transacting", "transacting",
  ];

  const merchants: Merchant[] = [];
  const interactions: Interaction[] = [];

  BUSINESSES.forEach((businessName, i) => {
    const agent = i < 4 ? agents[4] : pick(working);
    const stage = pick(reach);
    const start = now - (stage === "transacting" ? between(30, 75) : between(2, 20)) * DAY - between(0, 10) * 3_600_000;
    const history: Merchant["history"] = [];
    let t = start;
    const path = stage === "lost" ? (["conversation", "lost"] as Stage[]) : STAGES.slice(0, STAGES.indexOf(stage as never) + 1);
    for (const s of path) {
      history.push({ stage: s, at: t });
      t = Math.min(now - DAY / 2, t + between(1, 4) * DAY);
    }

    const reached = (s: Stage) => path.includes(s);
    const owner = pick(OWNERS);
    const bank = pick(BANKS);
    const m: Merchant = {
      id: `mc_${i + 1}`,
      businessName,
      ownerName: owner,
      phone: `080${between(1, 9)} ${between(100, 999)} ${between(1000, 9999)}`,
      category: pick(CATEGORIES),
      area: r() < 0.7 ? agent.area : pick(AREAS),
      agentId: agent.id,
      stage,
      createdAt: start,
      history,
      kyb: { tier: 0, status: "none" },
      payments: [],
    };

    if (reached("bank_added")) {
      m.kyb = { tier: 0, status: "none", bankName: bank, accountLast4: String(between(1000, 9999)), resolvedName: owner.toUpperCase() };
    }
    if (reached("verified")) {
      const cac = r() < 0.3;
      m.kyb = {
        ...m.kyb,
        tier: cac ? 2 : 1,
        status: "verified",
        ninLast4: String(between(1000, 9999)),
        nameMatch: true,
        ...(cac ? { cac: `BN${between(1000000, 3999999)}`, cacType: "bn" as const, legalName: businessName.toUpperCase() } : {}),
        updatedAt: history.find((h) => h.stage === "verified")!.at,
      };
    } else if (stage === "bank_added" && r() < 0.5) {
      // A couple of merchants stuck in review, so the queue isn't empty.
      m.kyb = { ...m.kyb, status: "review", ninLast4: String(between(1000, 9999)), nameMatch: false, resolvedName: pick(OWNERS).toUpperCase(), note: "Bank account name doesn't match owner's NIN", updatedAt: t };
    }
    if (stage === "transacting") {
      const first = history[history.length - 1].at;
      const n = between(1, 9);
      const dormant = r() < 0.12;
      const payments: Payment[] = [];
      for (let k = 0; k < n; k++) {
        const end = dormant ? Math.min(first + 10 * DAY, now - 16 * DAY) : now;
        const at = k === 0 ? first : first + Math.floor(r() * Math.max(DAY, end - first));
        payments.push({ id: `pay_${i}_${k}`, at, amountNgn: between(8, 450) * 1000, token: r() < 0.7 ? "USDC" : "USDT", chain: pick(["Sui", "Solana", "Base", "BSC", "Stellar"]) });
      }
      m.payments = payments.sort((a, b) => a.at - b.at);
    }
    merchants.push(m);

    // Interactions that tell the story of how they got here.
    const touches = Math.min(history.length, between(1, 3));
    for (let k = 0; k < touches; k++) {
      const at = history[Math.min(k, history.length - 1)].at + between(0, 5) * 3_600_000;
      let outcome: Outcome = "interested";
      if (stage === "lost") outcome = "not_interested";
      else if (stage === "conversation") outcome = r() < 0.5 ? "call_back" : "interested";
      else if (k === 0) outcome = reached("signed_up") && r() < 0.4 ? "signed_up" : "interested";
      else outcome = reached("bank_added") ? "helped_setup" : "call_back";
      const hesitant = outcome === "not_interested" || outcome === "call_back" || r() < 0.3;
      interactions.push({
        id: `ix_${i}_${k}`,
        merchantId: m.id,
        agentId: agent.id,
        at,
        channel: k === 0 ? "visit" : pick(["visit", "call", "whatsapp"] as const),
        outcome,
        objection: hesitant ? pick(OBJECTIONS) : undefined,
        competitor: r() < 0.6 ? pick(COMPETITORS) : undefined,
        quote: r() < 0.5 ? pick(QUOTES) : undefined,
      });
    }
  });

  // Today's activity, so the field workspace isn't empty on first open.
  working.flatMap((a) => merchants.filter((m) => m.agentId === a.id).slice(0, 3)).forEach((m, k) => {
    interactions.push({ id: `ix_today_${k}`, merchantId: m.id, agentId: m.agentId, at: now - between(1, 6) * 3_600_000, channel: "visit", outcome: k % 3 === 0 ? "helped_setup" : "interested", quote: k === 1 ? QUOTES[5] : undefined });
  });

  const notes: FieldNote[] = [
    { category: "why_not", observation: "Most traders in the plaza have never been paid in crypto by a customer. They don't see the need yet.", quote: "Who go pay me for USDT for this market?", hypothesis: "Target sellers with foreign or online customers first, not walk-in retail." },
    { category: "competitor", observation: "Several phone dealers already sell USDT on Binance P2P. They complain about frozen accounts and scam buyers.", quote: "P2P don hold my money for 3 days before.", hypothesis: "Lead with 'no P2P counterparty, straight to your bank'." },
    { category: "why_yes", observation: "Laptop dealer activated after a Ghanaian customer paid in USDC on the spot during the demo.", quote: "Ehen! E don land for my account already?", hypothesis: "A live first payment during the visit converts best." },
    { category: "onboarding", observation: "Two merchants got stuck at bank account because their account is in their wife's name.", hypothesis: "Need a clear rule on third-party payout accounts." },
    { category: "request", observation: "Restaurant owners asked for a printed QR sticker they can paste on the counter.", quote: "Make I just paste am for wall." },
    { category: "objection", observation: "Rate is the first question every time. They compare with what their P2P vendor offered this morning.", hypothesis: "Show today's rate on the agent's phone before the pitch." },
    { category: "why_not", observation: "Signed up but never created a payment link — didn't understand what a 'link' is.", quote: "Na which link? I no get website.", hypothesis: "Call it 'payment QR' in Yoruba/Pidgin explanations." },
    { category: "competitor", observation: "Freelancers use Busha and Yellow Card. They like that Linq goes directly to a business account.", hypothesis: "Agencies and freelancers are a warm segment." },
    { category: "onboarding", observation: "NIN check passed in seconds for 5 of 6 merchants today. One forgot their NIN and had to dial *346#.", hypothesis: "Tell merchants to have NIN ready before the visit." },
    { category: "request", observation: "Merchants want the naira to land in Moniepoint/OPay, not only commercial banks." },
    { category: "why_yes", observation: "Pharmacy activated because a supplier in the UK wanted to pay them in USDT.", quote: "My supplier dey always ask for crypto address." },
    { category: "objection", observation: "Older traders want their children or a partner to see it first. A second visit with the decision-maker works.", hypothesis: "Book follow-ups for evenings when family members are around." },
  ].map((n, k) => {
    const agent = working[k % working.length];
    return { ...n, id: `nt_${k}`, agentId: agent.id, area: agent.area, at: now - (k * 2 + 1) * DAY + between(0, 8) * 3_600_000 } as FieldNote;
  });

  const data: Data = { version: DATA_VERSION, agents, merchants, interactions, notes, followUps: [] };
  // Follow-ups are generated from where each merchant is stuck.
  data.followUps = merchants.flatMap((m) => followUpsFor(m, now)).map((f, k) => {
    // Close a few so "Done" has history.
    if (k % 5 === 0) return { ...f, status: "done" as const, outcome: "Reached — will finish setup this week", closedAt: now - DAY };
    return f;
  });
  for (const m of merchants.filter((m) => m.stage === "conversation").slice(0, 4)) {
    data.followUps.push({ id: uid("fu"), merchantId: m.id, agentId: m.agentId, trigger: "call_back", priority: "medium", due: now + between(0, 3) * DAY, status: "open" });
  }
  return data;
}
