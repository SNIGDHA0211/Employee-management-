import { StrategyCategory, StrategySection } from './types';

/** Static NMRHI functional goals data (used instead of API) */
export const NMRHI_STATIC_DATA: Record<string, { function: string; functional_goals: any[] }> = {
  NPD: {
    function: 'NPD',
    functional_goals: [
      { functional_id: 1, main_goal: 'Quality', actionable_goals: [
        { actionable_id: 1, purpose: "accurately solve customer's problem", grp_id: 'D1' },
        { actionable_id: 2, purpose: 'Better than others', grp_id: 'D2' },
        { actionable_id: 3, purpose: 'Longer self-life', grp_id: 'D3' },
      ]},
      { functional_id: 2, main_goal: 'Customer Friendly', actionable_goals: [
        { actionable_id: 5, purpose: 'Easy to use, convenient', grp_id: 'D1' },
        { actionable_id: 6, purpose: 'When and how', grp_id: 'D2' },
        { actionable_id: 7, purpose: 'When not to use / Minimal psi effect', grp_id: 'D3' },
      ]},
      { functional_id: 3, main_goal: 'Attractive', actionable_goals: [
        { actionable_id: 9, purpose: 'Appearance, and texture, Packing', grp_id: 'D1' },
        { actionable_id: 10, purpose: 'homogeneity, color scheme, design', grp_id: 'D2' },
        { actionable_id: 11, purpose: 'attractive, aesthetics, user feeling', grp_id: 'D3' },
      ]},
      { functional_id: 4, main_goal: 'Economical', actionable_goals: [
        { actionable_id: 17, purpose: 'Presenting a comparable product', grp_id: 'D1' },
        { actionable_id: 18, purpose: 'Comparing price, usage', grp_id: 'D2' },
        { actionable_id: 19, purpose: 'Show economical by other comparison', grp_id: 'D3' },
      ]},
      { functional_id: 5, main_goal: 'Official', actionable_goals: [
        { actionable_id: 14, purpose: 'MSDS, TDS, COA, MOA', grp_id: 'D1' },
        { actionable_id: 13, purpose: 'Certificate, Registration', grp_id: 'D2' },
        { actionable_id: 15, purpose: 'Patent, copyright, trademark, IP', grp_id: 'D3' },
      ]},
    ],
  },
  MMR: {
    function: 'MMR',
    functional_goals: [
      { functional_id: 7, main_goal: 'Increasing customer base', actionable_goals: [
        { actionable_id: 26, purpose: 'Expanding geographical area', grp_id: 'D1' },
        { actionable_id: 27, purpose: 'Reaching the untapped customer', grp_id: 'D2' },
        { actionable_id: 28, purpose: 'Schemes and Plans', grp_id: 'D3' },
      ]},
      { functional_id: 8, main_goal: 'Creating a strong desire to use the product', actionable_goals: [
        { actionable_id: 31, purpose: 'Identifying pain points / Matching product to customer lifestyle / Adv frequency / Adv channel', grp_id: 'D1' },
        { actionable_id: 32, purpose: 'finding out how the product delivers / Adv frequency / Adv channel', grp_id: 'D2' },
        { actionable_id: 33, purpose: 'Substantial and effective advertising / Adv frequency / Adv channel ', grp_id: 'D3' },
      ]},
      { functional_id: 9, main_goal: 'Creating a reason to buy', actionable_goals: [
        { actionable_id: 36, purpose: 'A list of why to buy the product', grp_id: 'D1' },
        { actionable_id: 37, purpose: 'Take your own list', grp_id: 'D2' },
        { actionable_id: 38, purpose: 'Even if you take others, take your own list', grp_id: 'D3' },
      ]},
      { functional_id: 10, main_goal: 'Connecting with Govt, Semi-Govt consistently', actionable_goals: [
        { actionable_id: 39, purpose: 'Listing Dept, Official with approach plan', grp_id: 'D1' },
        { actionable_id: 40, purpose: 'State, Country, International Connect', grp_id: 'D2' },
        { actionable_id: 41, purpose: 'Becoming part of the govt schemes', grp_id: 'D3' },
      ]},
      { functional_id: 6, main_goal: 'Reaching maximum customers', actionable_goals: [
        { actionable_id: 20, purpose: 'cells point / Direct visit / Advertising / group meeting', grp_id: 'D1' },
        { actionable_id: 21, purpose: 'Internet and communication / Direct visit / Advertising / group meeting.', grp_id: 'D2' },
        { actionable_id: 22, purpose: 'exhibition / Direct visit / Advertising  / group meeting', grp_id: 'D3' },
      ]},
    ],
  },
  RG: {
    function: 'RG',
    functional_goals: [
      { functional_id: 11, main_goal: 'Maximise sales', actionable_goals: [
        { actionable_id: 43, purpose: 'connecting with objects to make habit', grp_id: 'D2' },
        { actionable_id: 42, purpose: 'Embedding evidences / To experience what is expected from the buyer.', grp_id: 'D1' },
        { actionable_id: 44, purpose: "expected Main and other user experience via multimedia. ", grp_id: 'D3' },
      ]},
      { functional_id: 12, main_goal: 'Collecting revenue in the shortest time possible', actionable_goals: [
        { actionable_id: 46, purpose: 'Lateral credit', grp_id: 'D1' },
        { actionable_id: 47, purpose: 'collect 100% of revenue', grp_id: 'D2' },
        { actionable_id: 48, purpose: 'Consistantly follow through different', grp_id: 'D3' },
      ]},
      { functional_id: 13, main_goal: 'Production Availability', actionable_goals: [
        { actionable_id: 51, purpose: 'Availability at position amount and location', grp_id: 'D2' },
        { actionable_id: 50, purpose: 'Can be purchased in two steps / Non-stop straight line transport.', grp_id: 'D1' },
        { actionable_id: 52, purpose: 'opportunity to buy at  position amount and location ', grp_id: 'D3' },
      ]},
      { functional_id: 14, main_goal: 'Increasing the number of product purchases per customer', actionable_goals: [
        { actionable_id: 54, purpose: 'Purchasing power parity / Offering attractive Discounts.', grp_id: 'D1' },
        { actionable_id: 55, purpose: 'Which one to use with original product? / Can find what is needed?', grp_id: 'D2' },
        { actionable_id: 57, purpose: 'Allied products to the customer in the sales process / Packaging creation according to purchasing power.', grp_id: 'D3' },
      ]},
      { functional_id: 15, main_goal: 'Increasing eligible manpower per product', actionable_goals: [
        { actionable_id: 60, purpose: 'Recruting eligible manpower', grp_id: 'D1' },
        { actionable_id: 61, purpose: 'training them to update', grp_id: 'D2' },
        { actionable_id: 62, purpose: 'maximize profit and turnover per human resource', grp_id: 'D3' },
      ]},
    ],
  },
  HC: {
    function: 'HC',
    functional_goals: [
      { functional_id: 16, main_goal: 'Make a Habit of using the product daily', actionable_goals: [
        { actionable_id: 63, purpose: 'Reasons why the product should be used daily / advertisement.', grp_id: 'D1' },
        { actionable_id: 64, purpose: 'Causes of product habituation / advertisement', grp_id: 'D2' },
        { actionable_id: 65, purpose: 'Production time and its relationship with time / advertisement', grp_id: 'D3' },
      ]},
      { functional_id: 17, main_goal: 'Increasing the number of satisfied customers', actionable_goals: [
        { actionable_id: 67, purpose: 'Drawing up customer specific satisfaction points / Fulfilment', grp_id: 'D1' },
        { actionable_id: 68, purpose: 'Satisfaction point % extraction / Achieving satisfaction point', grp_id: 'D2' },
        { actionable_id: 71, purpose: 'Why those who are satisfied / Why those who are not satisfied?', grp_id: 'D3' },
      ]},
      { functional_id: 19, main_goal: 'Hooking Customers', actionable_goals: [
        { actionable_id: 78, purpose: 'Trigger / Investment', grp_id: 'D1' },
        { actionable_id: 79, purpose: 'Action / Investment', grp_id: 'D2' },
        { actionable_id: 80, purpose: 'Reward / Investment', grp_id: 'D3' },
      ]},
      { functional_id: 20, main_goal: 'Becoming right option', actionable_goals: [
        { actionable_id: 82, purpose: 'replacing existing solutions', grp_id: 'D1' },
        { actionable_id: 83, purpose: 'monopolize completely or partially', grp_id: 'D2' },
        { actionable_id: 84, purpose: 'think 10x ', grp_id: 'D3' },
      ]},
      { functional_id: 18, main_goal: 'Increases Productivity', actionable_goals: [
        { actionable_id: 73, purpose: 'Same quality / usage retain productivity', grp_id: 'D1' },
        { actionable_id: 74, purpose: 'Maximum Resources', grp_id: 'D2' },
        { actionable_id: 76, purpose: 'Automation', grp_id: 'D3' },
      ]},
    ],
  },
  IP: {
    function: 'IP',
    functional_goals: [
      { functional_id: 21, main_goal: 'Reducing Production Costs', actionable_goals: [
        { actionable_id: 85, purpose: 'Making raw material cheaper / Procuring the product from another. ', grp_id: 'D1' },
        { actionable_id: 86, purpose: 'Completing the process quickly / Controlling all centers of value creation', grp_id: 'D2' },
        { actionable_id: 87, purpose: "Process/ingredient quality doesn't have to be pushed", grp_id: 'D3' },
      ]},
      { functional_id: 22, main_goal: 'Increasing the quality', actionable_goals: [
        { actionable_id: 89, purpose: 'Dose reduction', grp_id: 'D1' },
        { actionable_id: 90, purpose: 'Increasing activity spectrum and  effectiveness over a longer period of time', grp_id: 'D2' },
        { actionable_id: 92, purpose: 'Maintaining effectiveness in different situations', grp_id: 'D3' },
      ]},
      { functional_id: 24, main_goal: 'Finding a new product opportunity', actionable_goals: [
        { actionable_id: 98, purpose: 'Identifying needs through regular contact / Find out where quality fails short.', grp_id: 'D1' },
        { actionable_id: 100, purpose: "next generation of product  / if product class is not present how the need be fulfil l.", grp_id: 'D3' },
        { actionable_id: 99, purpose: 'New product iterations, four directions of study', grp_id: 'D2' },
      ]},
      { functional_id: 25, main_goal: 'Competitiveness', actionable_goals: [
        { actionable_id: 103, purpose: 'competition monitoring', grp_id: 'D1' },
        { actionable_id: 104, purpose: 'Trend tracking', grp_id: 'D2' },
        { actionable_id: 105, purpose: 'Edge creation', grp_id: 'D3' },
      ]},
      { functional_id: 23, main_goal: 'Making the product more customer-oriented', actionable_goals: [
        { actionable_id: 93, purpose: 'Finding flaws in a product through the eyes of the customer.', grp_id: 'D1' },
        { actionable_id: 94, purpose: 'Product never feels customer-oriented / Finding out which feature / part of the product is underutilized.', grp_id: 'D2' },
        { actionable_id: 95, purpose: 'Which quality makes the product long-term in the market / Making the quality stronger.', grp_id: 'D3' },
      ]},
    ],
  },
};

/** Convert static/API data format to StrategySection[] */
export function staticDataToSections(data: { functional_goals?: any[] } | null): StrategySection[] {
  const goals = data?.functional_goals ?? [];
  if (!Array.isArray(goals) || goals.length === 0) return [];
  return goals.map((g: any) => {
    const title = g.main_goal ?? g.Main_goal ?? g.mainGoal ?? 'Untitled';
    const ag = g.actionable_goals ?? g.Actionable_goals ?? g.actionableGoals ?? [];
    const points = (Array.isArray(ag) ? ag : [])
      .filter((a: any) => (a.purpose ?? a.Purpose ?? ''))
      .map((a: any) => ({
        id: Number(a.actionable_id ?? a.id ?? a.Id ?? 0),
        purpose: String(a.purpose ?? a.Purpose ?? ''),
        grp_id: (a.grp_id ?? a.grpId ?? 'D1') as 'D1' | 'D2' | 'D3',
      }));
    return { title, points };
  });
}

/** NMRHI category IDs mapped to function codes from employees API */
export const NMRHI_CATEGORY_IDS = ['nmrhi-npd', 'nmrhi-mmr', 'nmrhi-rg', 'nmrhi-hc', 'nmrhi-ip'] as const;
export const FUNCTION_CODE_TO_CATEGORY: Record<string, string> = {
  NPD: 'nmrhi-npd', MMR: 'nmrhi-mmr', RG: 'nmrhi-rg', HC: 'nmrhi-hc', IP: 'nmrhi-ip',
};

/**
 * Get allowed NMRHI category IDs from employee's department/function.
 * Employee API returns: department, function (e.g. "None", "NPD", "MMR", "NPD, MMR").
 * Returns only the category IDs that match - no default to all. If none match, returns [].
 */
export function getNMRHIAllowedCategories(employee: any): string[] {
  if (!employee) return [];
  const dept = String(employee.department || employee.Department || '').toUpperCase();
  const fn = String(employee.function || employee.Function || '').toUpperCase();
  const combined = `${dept} ${fn}`.replace(/[,|]/g, ' ');
  const allowed: string[] = [];
  if (/\bNPD\b/.test(combined)) allowed.push('nmrhi-npd');
  if (/\bMMR\b/.test(combined)) allowed.push('nmrhi-mmr');
  if (/\bRG\b/.test(combined)) allowed.push('nmrhi-rg');
  if (/\bHC\b/.test(combined)) allowed.push('nmrhi-hc');
  if (/\bIP\b/.test(combined)) allowed.push('nmrhi-ip');
  return allowed;
}

/** Display metadata only. Sections (functional_goals, actionable_goals) are fetched from API. */
const FUNCTION_META: Array<{ id: string; name: string; fullName: string; description: string; fnCode: string }> = [
  { id: 'nmrhi-npd', name: 'N', fullName: 'NPD - New Product Development', description: 'Strategic framework for developing new products, from ideation to market launch.', fnCode: 'NPD' },
  { id: 'nmrhi-mmr', name: 'M', fullName: 'MMR - Monthly Management Review', description: 'Comprehensive monthly review of management activities, performance metrics, and strategic alignment.', fnCode: 'MMR' },
  { id: 'nmrhi-rg', name: 'R', fullName: 'RG - Revenue Growth', description: 'Strategic initiatives for driving revenue growth through optimization and new opportunities.', fnCode: 'RG' },
  { id: 'nmrhi-hc', name: 'H', fullName: 'HC - Human Capital', description: 'Investment in people through training, development, and creating a positive organizational culture.', fnCode: 'HC' },
  { id: 'nmrhi-ip', name: 'I', fullName: 'IP - Innovation & Projects', description: 'Continuous pursuit of innovation and project execution to stay ahead of market trends and customer expectations.', fnCode: 'IP' },
];

export const STRATEGY_CATEGORIES: StrategyCategory[] = FUNCTION_META.map((m) => ({
  id: m.id,
  name: m.name,
  fullName: m.fullName,
  description: m.description,
  sections: staticDataToSections(NMRHI_STATIC_DATA[m.fnCode] ?? null),
}));

export const FUNCTION_CODES: Record<string, string> = Object.fromEntries(
  FUNCTION_META.map((m) => [m.id, m.fnCode])
);

/**
 * D1 = days 1-10, D2 = days 11-20, D3 = days 21 to last day of month.
 * D3 is flexible based on month (28/29/30/31 days).
 * Uses local timezone - consider server timezone if API validates by server date.
 */
export function getActiveGrpIdForDay(dayOfMonth: number): 'D1' | 'D2' | 'D3' {
  const d = Math.max(1, Math.min(31, Math.floor(Number(dayOfMonth)) || 1));
  if (d <= 10) return 'D1';
  if (d <= 20) return 'D2';
  return 'D3';
}

/** Get last day of month (1-31). month 1-12, year for leap Feb. */
export function getLastDayOfMonth(month: number, year?: number): number {
  const m = Math.max(1, Math.min(12, Math.floor(Number(month)) || 1));
  if (!year) year = new Date().getFullYear();
  return new Date(year, m, 0).getDate();
}

/** Get D3 label for a month, e.g. "Days 21-28" for Feb, "Days 21-31" for Jan. */
export function getD3LabelForMonth(month: number, year?: number): string {
  const last = getLastDayOfMonth(month, year);
  return `Days 21-${last}`;
}

