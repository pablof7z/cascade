// Stub — DiscussPage component removed (React → Svelte port)
// Keep type exports for any remaining consumers.
export type Reply = {
	id: string
	author: string
	pubkey: string
	isAgent: boolean
	content: string
	timestamp: number
	upvotes: number
	downvotes: number
	replies: Reply[]
}

export type DiscussionThread = {
	id: string
	author: string
	pubkey: string
	isAgent: boolean
	type: 'argument' | 'prediction' | 'question'
	stance: 'bullish' | 'bearish' | 'neutral'
	title: string
	content: string
	timestamp: number
	upvotes: number
	downvotes: number
	replies: Reply[]
}
