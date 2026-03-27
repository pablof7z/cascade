import type { Market, ThesisDefinition } from './market'

export type MarketType = 'module' | 'thesis'

export type SampleMarketSpec = {
  title: string
  description: string
  category: string
  type: MarketType
  thesis?: ThesisDefinition
}

export const sampleModules: SampleMarketSpec[] = [
  {
    title: 'AGI achieved by 2030',
    description:
      'Will a system demonstrating general-purpose reasoning across arbitrary domains be publicly recognized by major AI labs before 2030?',
    category: 'AI & Compute',
    type: 'module',
  },
  {
    title: 'First Mars landing with crew by 2035',
    description:
      'Will humans set foot on Mars before January 1, 2035? Requires successful landing and survival for at least 24 hours.',
    category: 'Space & Frontier',
    type: 'module',
  },
  {
    title: 'Lab-grown meat exceeds 10% market share by 2028',
    description:
      'Will cultivated meat products capture over 10% of global meat sales by volume before 2028?',
    category: 'Biotech & Health',
    type: 'module',
  },
  {
    title: 'US implements UBI pilot program',
    description:
      'Will the US federal government launch a universal basic income pilot of 10,000+ participants before 2030?',
    category: 'Governance & Society',
    type: 'module',
  },
  {
    title: 'Fusion power plant goes online',
    description:
      'Will a fusion reactor deliver net-positive energy to a commercial grid before 2035?',
    category: 'Energy & Climate',
    type: 'module',
  },
  {
    title: 'Brain-computer interface reaches 1M users',
    description:
      'Will any single BCI product (invasive or non-invasive) have 1 million active users before 2032?',
    category: 'Biotech & Health',
    type: 'module',
  },
]

export const sampleTheses: SampleMarketSpec[] = [
  {
    title: "The Great Decoupling - AI productivity gains don't translate to wage growth",
    description:
      'Despite AI driving significant productivity increases, median real wages in developed economies remain flat or decline through 2035.',
    category: 'AI & Compute',
    type: 'thesis',
    thesis: {
      statement: "The Great Decoupling - AI productivity gains don't translate to wage growth",
      argument:
        'The core claim is that AI compounds output far faster than labor can defend its share of that output. Software captures more of the marginal work, firms keep more of the operating leverage, and institutions react after the fact. If that dynamic is right, the economy can look more productive on paper while households still feel squeezed.',
      signals: [
        {
          moduleTitle: 'AGI achieved by 2030',
          expectedOutcome: 'YES',
          note:
            'A credible AGI-level capability shock would accelerate the productivity wave this thesis depends on.',
        },
        {
          moduleTitle: 'US implements UBI pilot program',
          expectedOutcome: 'YES',
          note:
            'Serious UBI experimentation would suggest institutions are trying to patch labor displacement rather than celebrating wage-led gains.',
        },
      ],
    },
  },
  {
    title: 'Space economy exceeds $1T by 2040',
    description:
      'The total value of space-related economic activity - including launch services, satellites, manufacturing, tourism, and resource extraction - surpasses $1 trillion annually.',
    category: 'Space & Frontier',
    type: 'thesis',
    thesis: {
      statement: 'Space economy exceeds $1T by 2040',
      argument:
        'This thesis says launch, manufacturing, and infrastructure are all learning curves on top of each other. Once access to orbit gets cheap and predictable enough, new business models stack quickly: data, communications, defense, industrial production, and eventually extraction. The market goes nonlinear after the platform layer becomes reliable.',
      signals: [
        {
          moduleTitle: 'First Mars landing with crew by 2035',
          expectedOutcome: 'YES',
          note:
            'A crewed Mars mission would be a hard proof that launch cadence, cost, and industrial coordination are compounding fast enough.',
        },
      ],
    },
  },
  {
    title: 'Biological longevity escape velocity achieved',
    description:
      'Life expectancy gains exceed one year per year for some demographic by 2045, driven by rejuvenation therapies rather than disease prevention alone.',
    category: 'Biotech & Health',
    type: 'thesis',
    thesis: {
      statement: 'Biological longevity escape velocity achieved',
      argument:
        'The bet is that longevity will arrive as a systems problem, not a miracle drug. Better measurement, better delivery, and better iteration loops make rejuvenation cumulative. Once therapies start stacking instead of competing, the gains can compound faster than conventional medicine assumes.',
      signals: [
        {
          moduleTitle: 'Brain-computer interface reaches 1M users',
          expectedOutcome: 'YES',
          note:
            'Mass adoption of BCI would show regulators and consumers are increasingly comfortable with ambitious human-upgrade biotech.',
        },
        {
          moduleTitle: 'Lab-grown meat exceeds 10% market share by 2028',
          expectedOutcome: 'YES',
          note:
            'Scaled cultivated biology would suggest biotech manufacturing, regulation, and public acceptance are all moving in the right direction.',
        },
      ],
    },
  },
  {
    title: 'Climate migration reshapes global politics',
    description:
      'By 2040, climate-driven migration creates at least one new nation-state or triggers the collapse of an existing government.',
    category: 'Energy & Climate',
    type: 'thesis',
    thesis: {
      statement: 'Climate migration reshapes global politics',
      argument:
        'The thesis is that migration becomes the political transmission layer for climate risk. Even if the physical damage is uneven, population movement turns climate stress into border stress, housing stress, and legitimacy stress. Once the pressure is political, second-order effects dominate the headline weather events.',
      signals: [
        {
          moduleTitle: 'Fusion power plant goes online',
          expectedOutcome: 'NO',
          note:
            'If clean energy abundance arrives later than hoped, adaptation pressure stays high and migration remains a primary release valve.',
        },
      ],
    },
  },
]

export const sampleMarketBank = [...sampleModules, ...sampleTheses]

export const categories = [
  'All',
  'AI & Compute',
  'Space & Frontier',
  'Biotech & Health',
  'Energy & Climate',
  'Governance & Society',
]

export function getSampleSpec(title: string): SampleMarketSpec | undefined {
  return sampleMarketBank.find((spec) => spec.title === title)
}

export function inferMarketType(market: Pick<Market, 'title' | 'kind'>): MarketType {
  return market.kind ?? getSampleSpec(market.title)?.type ?? 'module'
}

export function getThesisDefinition(
  market: Pick<Market, 'title' | 'kind' | 'description' | 'thesis'>,
): ThesisDefinition | undefined {
  if (market.thesis) {
    return market.thesis
  }

  const spec = getSampleSpec(market.title)
  if (spec?.type === 'thesis' && spec.thesis) {
    return spec.thesis
  }

  if (market.kind === 'thesis') {
    return {
      statement: market.title,
      argument: market.description,
      signals: [],
    }
  }

  return undefined
}
