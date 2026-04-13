export type FieldAttention = 'steady' | 'review' | 'needs-input';
export type AgentProvisioning = 'hosted' | 'connected';
export type FieldAgentStatus = 'active' | 'challenging' | 'monitoring';
export type MeetingStatus = 'live' | 'watching' | 'awaiting-human';
export type MeetingEntryKind = 'argument' | 'counterargument' | 'evidence' | 'decision';
export type MeetingActionStatus = 'needs-human' | 'queued' | 'approved';
export type FieldSourceKind =
  | 'article'
  | 'book'
  | 'briefing'
  | 'dataset'
  | 'memo'
  | 'note'
  | 'transcript'
  | 'video';

export type FieldOwner = {
  id: string;
  name: string;
  role: string;
};

export type FieldSource = {
  id: string;
  kind: FieldSourceKind;
  title: string;
  author: string;
  addedAt: string;
  note: string;
  relevance: string;
};

export type AgentWallet = {
  id: string;
  balanceUsd: number;
  allocatedUsd: number;
  monthlySpendUsd: number;
  status: 'funded' | 'watch' | 'funding';
};

export type FieldAgent = {
  id: string;
  name: string;
  role: string;
  provisioning: AgentProvisioning;
  status: FieldAgentStatus;
  focus: string;
  recentContribution: string;
  wallet: AgentWallet;
};

export type MeetingCitation = {
  sourceId: string;
  note: string;
};

export type MeetingEntry = {
  id: string;
  authorId: string;
  at: string;
  kind: MeetingEntryKind;
  headline: string;
  body: string;
  citations?: MeetingCitation[];
};

export type MeetingAction = {
  id: string;
  title: string;
  ownerId: string;
  status: MeetingActionStatus;
  rationale: string;
};

export type FieldMeeting = {
  id: string;
  title: string;
  status: MeetingStatus;
  summary: string;
  updatedAt: string;
  participantIds: string[];
  entries: MeetingEntry[];
  actions: MeetingAction[];
  tensions: string[];
};

export type FieldPosition = {
  id: string;
  label: string;
  thesis: string;
  exposureUsd: number;
  status: 'monitoring' | 'active' | 'hedged';
};

export type CandidateMarket = {
  id: string;
  label: string;
  framing: string;
  status: 'draft' | 'under-review' | 'ready';
};

export type FieldCapital = {
  fieldWalletUsd: number;
  deployedUsd: number;
  availableUsd: number;
  monthlyBudgetUsd: number;
  note: string;
};

export type Field = {
  id: string;
  name: string;
  summary: string;
  conviction: string;
  attention: FieldAttention;
  recentUpdate: string;
  owner: FieldOwner;
  sourceLibrary: FieldSource[];
  council: FieldAgent[];
  meeting: FieldMeeting;
  capital: FieldCapital;
  positions: FieldPosition[];
  candidateMarkets: CandidateMarket[];
};

export type FieldWorkspace = {
  fields: Field[];
};

const seedWorkspace: FieldWorkspace = {
  fields: [
    {
      id: 'ai-application-layer',
      name: 'AI application layer',
      summary:
        'A field for the conviction that agent-native products absorb more of the application layer once approvals, source material, and operating context are brought into the product.',
      conviction:
        'The edge here is not generic AI enthusiasm. It is a judgment about where agent workflows become trusted first, and where incumbents keep distribution despite weaker product shape.',
      attention: 'needs-input',
      recentUpdate:
        'The council agrees support and research workflows are the strongest wedge, but there is still disagreement on how quickly incumbents can copy the experience.',
      owner: {
        id: 'human',
        name: 'You',
        role: 'Field owner'
      },
      sourceLibrary: [
        {
          id: 'ai-source-1',
          kind: 'note',
          title: 'Internal note: where humans still override copilots',
          author: 'You',
          addedAt: '12 min ago',
          note: 'Approval-heavy workflows still win when the model can explain its evidence trail in the room.',
          relevance: 'The clearest record of where your judgment diverges from generic AI optimism.'
        },
        {
          id: 'ai-source-2',
          kind: 'transcript',
          title: 'Support escalation transcript archive',
          author: 'Ops team',
          addedAt: '2 hours ago',
          note: 'Escalations cluster around policy edges rather than simple retrieval failures.',
          relevance: 'Helps the council identify where human review still matters.'
        },
        {
          id: 'ai-source-3',
          kind: 'briefing',
          title: 'Weekly enterprise buying memo',
          author: 'Market desk',
          addedAt: '3 days ago',
          note: 'Budget owners will fund pilots if review, logging, and sources stay visible.',
          relevance: 'Supports the view that workflow design matters more than generic capability marketing.'
        }
      ],
      council: [
        {
          id: 'ai-agent-1',
          name: 'Mara Synthesis',
          role: 'Source librarian',
          provisioning: 'hosted',
          status: 'active',
          focus: 'Turn source material into short operating briefs for the council.',
          recentContribution: 'Mapped three repeated approval patterns from the support archive into reusable briefs.',
          wallet: {
            id: 'wallet-ai-1',
            balanceUsd: 2400,
            allocatedUsd: 650,
            monthlySpendUsd: 180,
            status: 'funded'
          }
        },
        {
          id: 'ai-agent-2',
          name: 'Rowan Skeptic',
          role: 'Counterargument lead',
          provisioning: 'hosted',
          status: 'challenging',
          focus: 'Pressure-test the thesis that product quality beats incumbent distribution in the near term.',
          recentContribution: 'Forced the field to narrow the likely wedge to internal support and research.',
          wallet: {
            id: 'wallet-ai-2',
            balanceUsd: 1900,
            allocatedUsd: 540,
            monthlySpendUsd: 150,
            status: 'funded'
          }
        },
        {
          id: 'ai-agent-3',
          name: 'Vale Operator',
          role: 'Workflow mapper',
          provisioning: 'connected',
          status: 'monitoring',
          focus: 'Track approval loops where humans still need visible control.',
          recentContribution: 'Tagged the workflows where escalation language changes before conversion does.',
          wallet: {
            id: 'wallet-ai-3',
            balanceUsd: 2600,
            allocatedUsd: 720,
            monthlySpendUsd: 95,
            status: 'watch'
          }
        }
      ],
      meeting: {
        id: 'meeting-ai-1',
        title: 'Weekly field meeting: app-layer wedge',
        status: 'awaiting-human',
        summary:
          'The council agrees the field is real, but the framing still needs your judgment before more capital moves.',
        updatedAt: '7 min ago',
        participantIds: ['human', 'ai-agent-1', 'ai-agent-2', 'ai-agent-3'],
        entries: [
          {
            id: 'ai-entry-1',
            authorId: 'human',
            at: '26 min ago',
            kind: 'argument',
            headline: 'The field should stay anchored in workflows I have actually seen break.',
            body:
              'I do not want a generic AI apps field. Keep the workspace around the places where I can inspect the source material and approve actions with context.'
          },
          {
            id: 'ai-entry-2',
            authorId: 'ai-agent-1',
            at: '18 min ago',
            kind: 'evidence',
            headline: 'Source material keeps pointing to approval-heavy internal workflows.',
            body:
              'Across the support archive, adoption improved when the operator could click through to the evidence behind a recommendation.',
            citations: [
              {
                sourceId: 'ai-source-1',
                note: 'Internal overrides cluster around policy edges, not routine retrieval.'
              },
              {
                sourceId: 'ai-source-2',
                note: 'Escalation transcripts show trust increasing when the source chain stays visible.'
              }
            ]
          },
          {
            id: 'ai-entry-3',
            authorId: 'ai-agent-2',
            at: '13 min ago',
            kind: 'counterargument',
            headline: 'Distribution may outrun workflow quality for another buying cycle.',
            body:
              'The council should not confuse a better product shape with a faster market outcome. Buyers can stay with incumbents longer than the field expects.'
          },
          {
            id: 'ai-entry-4',
            authorId: 'human',
            at: '7 min ago',
            kind: 'decision',
            headline: 'Hold capital until the framing is narrower.',
            body:
              'I want the candidate markets and staffing decisions scoped to the workflows where approval visibility is the actual moat.'
          }
        ],
        actions: [
          {
            id: 'ai-action-1',
            title: 'Approve one more hosted agent for distribution rebuttals',
            ownerId: 'human',
            status: 'needs-human',
            rationale:
              'The field needs another hosted voice focused on incumbent distribution channels before more capital moves.'
          },
          {
            id: 'ai-action-2',
            title: 'Narrow the candidate market to internal support and research workflows',
            ownerId: 'ai-agent-3',
            status: 'queued',
            rationale:
              'Tighter framing will make the candidate markets traceable to the source library instead of generic AI narratives.'
          }
        ],
        tensions: [
          'Internal workflows look strongest, but incumbents may keep distribution longer than the field wants to admit.',
          'The field needs a narrower framing before more wallet exposure is justified.'
        ]
      },
      capital: {
        fieldWalletUsd: 12500,
        deployedUsd: 4800,
        availableUsd: 7700,
        monthlyBudgetUsd: 1400,
        note: 'Most spend is reserved for source ingestion, rebuttal work, and one pending hosted hire.'
      },
      positions: [
        {
          id: 'ai-position-1',
          label: 'Internal AI support workflows reprice before 2027',
          thesis: 'Adoption moves faster where human approvals stay visible.',
          exposureUsd: 2400,
          status: 'active'
        },
        {
          id: 'ai-position-2',
          label: 'Generic agent app platforms stay distribution-constrained',
          thesis: 'Incumbent distribution remains the main short-term counterargument.',
          exposureUsd: 1600,
          status: 'hedged'
        }
      ],
      candidateMarkets: [
        {
          id: 'ai-market-1',
          label: 'Internal support copilots displace incumbent queues before 2027',
          framing: 'Tie the market to approval visibility and source traceability, not general AI excitement.',
          status: 'under-review'
        },
        {
          id: 'ai-market-2',
          label: 'Enterprise agent suites fail to escape incumbent procurement by 2027',
          framing: 'Use as an explicit counter-view if the field hires a third hosted skeptic.',
          status: 'draft'
        }
      ]
    },
    {
      id: 'europe-energy-spread',
      name: 'European industrial energy spread',
      summary:
        'A field for the conviction that industrial power pricing and grid bottlenecks in Europe remain structurally misread even when the headline crisis cools down.',
      conviction:
        'The edge comes from following how policy, grid constraints, and industrial demand interact over time, not from making a one-off macro call and forgetting it.',
      attention: 'review',
      recentUpdate:
        'The field is less urgent than last week, but the council still thinks the market underweights how slow grid relief reaches industrial buyers.',
      owner: {
        id: 'human',
        name: 'You',
        role: 'Field owner'
      },
      sourceLibrary: [
        {
          id: 'energy-source-1',
          kind: 'dataset',
          title: 'Industrial day-ahead pricing tracker',
          author: 'Grid notebook',
          addedAt: '33 min ago',
          note: 'Spreads narrowed in headlines but remain sticky in the regions you actually track.',
          relevance: 'Grounds the field in measured delivered pricing instead of press releases.'
        },
        {
          id: 'energy-source-2',
          kind: 'briefing',
          title: 'Grid operator outage summary',
          author: 'Transmission desk',
          addedAt: '5 hours ago',
          note: 'Maintenance delays keep the same capacity bottlenecks alive through the next quarter.',
          relevance: 'Supports the lag thesis and explains why relief is not linear.'
        },
        {
          id: 'energy-source-3',
          kind: 'transcript',
          title: 'Industrial earnings call excerpts',
          author: 'Research archive',
          addedAt: '1 day ago',
          note: 'Management teams still describe energy procurement as a planning constraint, not a solved issue.',
          relevance: 'Shows where operating reality diverges from macro optimism.'
        }
      ],
      council: [
        {
          id: 'energy-agent-1',
          name: 'Iris Grid',
          role: 'Infrastructure monitor',
          provisioning: 'hosted',
          status: 'active',
          focus: 'Track where announced relief is not yet delivered.',
          recentContribution: 'Reframed the bottleneck map around transmission delays instead of headline fuel prices.',
          wallet: {
            id: 'wallet-energy-1',
            balanceUsd: 2100,
            allocatedUsd: 580,
            monthlySpendUsd: 165,
            status: 'funded'
          }
        },
        {
          id: 'energy-agent-2',
          name: 'Leif Margin',
          role: 'Industrial demand analyst',
          provisioning: 'hosted',
          status: 'monitoring',
          focus: 'Track which subsectors still behave as if energy is scarce.',
          recentContribution: 'Flagged chemicals and data-center demand as the two places where the spread still matters most.',
          wallet: {
            id: 'wallet-energy-2',
            balanceUsd: 1750,
            allocatedUsd: 460,
            monthlySpendUsd: 140,
            status: 'funded'
          }
        },
        {
          id: 'energy-agent-3',
          name: 'Northline',
          role: 'Policy watcher',
          provisioning: 'connected',
          status: 'challenging',
          focus: 'Translate new relief language into concrete field assumptions and challenge false optimism.',
          recentContribution: 'Marked two policy announcements as narrative-only until operator data confirms delivery.',
          wallet: {
            id: 'wallet-energy-3',
            balanceUsd: 1500,
            allocatedUsd: 280,
            monthlySpendUsd: 70,
            status: 'watch'
          }
        }
      ],
      meeting: {
        id: 'meeting-energy-1',
        title: 'Relief narrative vs delivered power',
        status: 'live',
        summary:
          'The council is comparing upbeat policy language with operator data and industrial transcripts to decide whether the field should add to exposure or stay patient.',
        updatedAt: '22 min ago',
        participantIds: ['human', 'energy-agent-1', 'energy-agent-2', 'energy-agent-3'],
        entries: [
          {
            id: 'energy-entry-1',
            authorId: 'energy-agent-1',
            at: '41 min ago',
            kind: 'evidence',
            headline: 'Delivered relief still lags the narrative.',
            body:
              'The operator summary and the pricing tracker still point to the same regional bottlenecks. The market is talking as if relief is evenly distributed, but your field sources say otherwise.'
          },
          {
            id: 'energy-entry-2',
            authorId: 'energy-agent-3',
            at: '34 min ago',
            kind: 'counterargument',
            headline: 'Policy language can still compress spreads before delivery changes.',
            body:
              'Narrative relief can move pricing earlier than infrastructure does. We need a clear line between what you believe about reality and what the market may price in first.'
          },
          {
            id: 'energy-entry-3',
            authorId: 'human',
            at: '22 min ago',
            kind: 'decision',
            headline: 'Stay patient unless the library shows actual delivery.',
            body:
              'Treat press-release optimism as noise unless it shows up in operator data and industrial procurement language.'
          }
        ],
        actions: [
          {
            id: 'energy-action-1',
            title: 'Refresh the subsector map for chemicals and data centers',
            ownerId: 'energy-agent-2',
            status: 'queued',
            rationale:
              'These are the clearest places where delivered pricing still shapes planning behavior.'
          },
          {
            id: 'energy-action-2',
            title: 'Decide whether to increase field exposure after next operator update',
            ownerId: 'human',
            status: 'needs-human',
            rationale:
              'The next grid report is the cleanest gate for whether more field capital should move.'
          }
        ],
        tensions: [
          'Narrative relief may compress market pricing before real infrastructure catches up.',
          'The field still needs a cleaner subsector ranking before more wallet exposure is approved.'
        ]
      },
      capital: {
        fieldWalletUsd: 9800,
        deployedUsd: 3900,
        availableUsd: 5900,
        monthlyBudgetUsd: 1100,
        note: 'Capital stays patient here because the field only moves when delivery data catches up to the narrative.'
      },
      positions: [
        {
          id: 'energy-position-1',
          label: 'Industrial power spreads stay elevated into winter',
          thesis: 'Delivered infrastructure relief remains slower than market language implies.',
          exposureUsd: 2100,
          status: 'active'
        },
        {
          id: 'energy-position-2',
          label: 'Policy optimism compresses pricing too early',
          thesis: 'Use as a hedge against narrative-led repricing.',
          exposureUsd: 900,
          status: 'monitoring'
        }
      ],
      candidateMarkets: [
        {
          id: 'energy-market-1',
          label: 'EU industrial buyers still face crisis-like power spreads next quarter',
          framing: 'Anchor to delivered prices and procurement behavior, not headline relief language.',
          status: 'ready'
        },
        {
          id: 'energy-market-2',
          label: 'Transmission delays keep bottlenecks active into winter',
          framing: 'Use operator maintenance data as the primary evidence source.',
          status: 'under-review'
        }
      ]
    },
    {
      id: 'red-sea-shipping',
      name: 'Red Sea shipping repricing',
      summary:
        'A field for the conviction that maritime risk and insurance repricing leak into supply chains more slowly and more unevenly than the first headlines suggest.',
      conviction:
        'The edge comes from understanding how shipping, insurance, routing, and downstream inventory decisions fit together, not from reacting to each geopolitical headline in isolation.',
      attention: 'steady',
      recentUpdate:
        'The field remains coherent. The council thinks second-order inventory effects still matter more than the daily headline cycle.',
      owner: {
        id: 'human',
        name: 'You',
        role: 'Field owner'
      },
      sourceLibrary: [
        {
          id: 'shipping-source-1',
          kind: 'briefing',
          title: 'Weekly marine insurance note',
          author: 'Field library',
          addedAt: '1 hour ago',
          note: 'Premium changes are still being absorbed unevenly across routes and counterparties.',
          relevance: 'Explains why the field does not treat every shipping headline as a uniform repricing event.'
        },
        {
          id: 'shipping-source-2',
          kind: 'memo',
          title: 'Inventory desk memo',
          author: 'Ops notebook',
          addedAt: '7 hours ago',
          note: 'Downstream buyers are extending buffer inventory even when spot narratives calm down.',
          relevance: 'Ties route risk back to real operating behavior.'
        },
        {
          id: 'shipping-source-3',
          kind: 'dataset',
          title: 'Container routing tracker',
          author: 'Logistics feed',
          addedAt: '2 days ago',
          note: 'Reroutes remain elevated and timing risk is still concentrated in the same corridors.',
          relevance: 'Provides the base layer for the fields second-order view.'
        }
      ],
      council: [
        {
          id: 'shipping-agent-1',
          name: 'Darya Routes',
          role: 'Logistics monitor',
          provisioning: 'hosted',
          status: 'active',
          focus: 'Track route changes, container timing, and corridor-specific delays.',
          recentContribution: 'Cleaned up the route tracker so the field can separate signal from headline churn.',
          wallet: {
            id: 'wallet-shipping-1',
            balanceUsd: 1600,
            allocatedUsd: 420,
            monthlySpendUsd: 130,
            status: 'funded'
          }
        },
        {
          id: 'shipping-agent-2',
          name: 'Sabin Chain',
          role: 'Second-order analyst',
          provisioning: 'hosted',
          status: 'monitoring',
          focus: 'Map how reroutes and insurance feed into inventory and margin pressure downstream.',
          recentContribution: 'Flagged which downstream buyers are buffering inventory instead of trusting calmer headlines.',
          wallet: {
            id: 'wallet-shipping-2',
            balanceUsd: 1450,
            allocatedUsd: 380,
            monthlySpendUsd: 120,
            status: 'funded'
          }
        }
      ],
      meeting: {
        id: 'meeting-shipping-1',
        title: 'Inventory knock-on effects',
        status: 'watching',
        summary:
          'The council thinks the field remains on track. The meeting is focused on delayed pass-through into inventory behavior rather than the daily geopolitical cycle.',
        updatedAt: '1 hour ago',
        participantIds: ['human', 'shipping-agent-1', 'shipping-agent-2'],
        entries: [
          {
            id: 'shipping-entry-1',
            authorId: 'shipping-agent-1',
            at: '2 hours ago',
            kind: 'evidence',
            headline: 'Route normalization is still overstated.',
            body:
              'The routing tracker shows the same corridors carrying elevated timing risk even when the daily narrative calms down.'
          },
          {
            id: 'shipping-entry-2',
            authorId: 'shipping-agent-2',
            at: '1 hour ago',
            kind: 'argument',
            headline: 'The tradeable edge is in second-order inventory decisions.',
            body:
              'Downstream buyers are still paying to hold buffer inventory. That behavior matters more than whether the headline cycle looks calmer this week.'
          }
        ],
        actions: [
          {
            id: 'shipping-action-1',
            title: 'Keep exposure flat and refresh the route model next week',
            ownerId: 'shipping-agent-1',
            status: 'approved',
            rationale:
              'The field remains coherent, but no new action is better than forcing movement without a new signal.'
          }
        ],
        tensions: [
          'The field may look calm at the headline level while still transmitting delayed costs into downstream inventory.'
        ]
      },
      capital: {
        fieldWalletUsd: 7300,
        deployedUsd: 2600,
        availableUsd: 4700,
        monthlyBudgetUsd: 800,
        note: 'This field stays lean because the council mostly monitors delayed pass-through instead of staffing constant debate.'
      },
      positions: [
        {
          id: 'shipping-position-1',
          label: 'Inventory-sensitive sectors keep paying for routing risk',
          thesis: 'Second-order inventory behavior stays sticky even when headlines cool off.',
          exposureUsd: 1350,
          status: 'active'
        }
      ],
      candidateMarkets: [
        {
          id: 'shipping-market-1',
          label: 'Red Sea reroutes keep downstream inventory buffers elevated next quarter',
          framing: 'Frame around observed inventory behavior rather than daily conflict headlines.',
          status: 'under-review'
        }
      ]
    }
  ]
};

export function loadDashboardWorkspace(): FieldWorkspace {
  return JSON.parse(JSON.stringify(seedWorkspace)) as FieldWorkspace;
}

export function loadDashboardField(fieldId: string): Field | undefined {
  return loadDashboardWorkspace().fields.find((field) => field.id === fieldId);
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}
