import { StrategyCategory } from './types';

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
  sections: [], // Fetched from API - get_functions_and_actionable_goals
}));

export const FUNCTION_CODES: Record<string, string> = Object.fromEntries(
  FUNCTION_META.map((m) => [m.id, m.fnCode])
);

