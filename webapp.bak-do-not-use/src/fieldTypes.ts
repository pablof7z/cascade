export type FieldAttention = 'steady' | 'review' | 'needs-input'

export type FieldDisagreement = 'contained' | 'rising' | 'high'

export type FieldTopicStatus = 'active' | 'watching' | 'needs-judgment'

export type FieldSourceKind =
  | 'article'
  | 'book'
  | 'briefing'
  | 'dataset'
  | 'memo'
  | 'note'
  | 'transcript'
  | 'video'

export type AgentProvisioning = 'hosted' | 'connected'

export type FieldAgentStatus = 'active' | 'challenging' | 'monitoring'

export type WalletStatus = 'funded' | 'watch' | 'top-up'

export type MeetingStatus = 'live' | 'watching' | 'awaiting-human'

export type MeetingEntryKind = 'argument' | 'counterargument' | 'evidence' | 'decision'

export type MeetingActionStatus = 'needs-human' | 'queued' | 'approved'

export type FieldOwner = {
  id: string
  name: string
  role: string
}

export type FieldTopic = {
  id: string
  kind: 'thesis' | 'question'
  title: string
  summary: string
  status: FieldTopicStatus
}

export type FieldSource = {
  id: string
  kind: FieldSourceKind
  title: string
  author: string
  addedAt: string
  note: string
  relevance: string
}

export type AgentWallet = {
  id: string
  balanceUsd: number
  allocatedUsd: number
  monthlySpendUsd: number
  status: WalletStatus
}

export type FieldAgent = {
  id: string
  name: string
  role: string
  provisioning: AgentProvisioning
  status: FieldAgentStatus
  focus: string
  recentContribution: string
  wallet: AgentWallet
}

export type MeetingCitation = {
  sourceId: string
  note: string
}

export type MeetingEntry = {
  id: string
  authorId: string
  at: string
  kind: MeetingEntryKind
  headline: string
  body: string
  topicId?: string
  citations?: MeetingCitation[]
}

export type MeetingAction = {
  id: string
  title: string
  ownerId: string
  status: MeetingActionStatus
  rationale: string
}

export type FieldMeeting = {
  id: string
  title: string
  status: MeetingStatus
  summary: string
  updatedAt: string
  participantIds: string[]
  entries: MeetingEntry[]
  actions: MeetingAction[]
  tensions: string[]
}

export type FieldPosition = {
  id: string
  label: string
  thesis: string
  exposureUsd: number
  status: 'monitoring' | 'active' | 'hedged'
}

export type CandidateMarket = {
  id: string
  label: string
  framing: string
  status: 'draft' | 'under-review' | 'ready'
}

export type FieldCapital = {
  fieldWalletUsd: number
  deployedUsd: number
  availableUsd: number
  monthlyBudgetUsd: number
  note: string
}

export type Field = {
  id: string
  name: string
  summary: string
  conviction: string
  attention: FieldAttention
  disagreement: FieldDisagreement
  recentUpdate: string
  owner: FieldOwner
  topics: FieldTopic[]
  sourceLibrary: FieldSource[]
  council: FieldAgent[]
  meeting: FieldMeeting
  capital: FieldCapital
  positions: FieldPosition[]
  candidateMarkets: CandidateMarket[]
}

export type FieldWorkspace = {
  fields: Field[]
}
