# Rich User Profiles Status

> The `rich-user-profiles` branch is explicitly parked pending a deliberate identity-model pass; resume criteria and rationale are documented.

**Tags:** #cascade #profiles #identity #discussion

---

# Rich User Profiles Status

## Decision

`rich-user-profiles` is **parked** as of 2026-03-29.

This branch should not be treated as near-shippable follow-up work. It introduced the surface area of pubkey-based identity and profile aggregation, but the review showed the runtime model is still actor-centric in the places that matter. Shipping from this branch now would produce fake or misleading identity behavior.

## Why It Is Parked

The branch fails at the architectural seams, not at polish:

1. Trading state is still effectively keyed around legacy actors, so real pubkeys do not own balances and positions end-to-end.
2. Market creation and participant indexing still write placeholder identities such as `you` / `system` instead of the actual user pubkey.
3. The dedicated discussion route still uses the legacy `author` model, so discussion/community activity is not consistently identity-aware.
4. Identity and profile metadata are split across ad hoc storage boundaries instead of one clear runtime source of truth.
5. Required `creatorPubkey` / `createdAt` fields lack runtime migration for existing persisted data.
6. Discussion activity is not written into the participant index, so the profile view would present incomplete activity even if shipped.

## Product Rationale

Cascade's discussion/community surface matters, but a fake identity layer is worse than no identity layer. The branch currently risks shipping profile pages and cross-market aggregation that look correct while being fundamentally wrong underneath.

That is not a cleanup pass. It is a deliberate identity-model pass.

## Resume Criteria

Resume this work only when the following can be done as one coherent slice:

1. Establish a single runtime identity boundary for the current user.
2. Convert participant ownership and trading flows to pubkey-based keys end-to-end.
3. Ensure market creation, trading activity, and discussion activity all write real pubkeys into shared indexing.
4. Migrate the dedicated discussion route off legacy author strings.
5. Add runtime normalization/migration for persisted markets missing `creatorPubkey` or `createdAt`.
6. Verify profile aggregation against real data, not placeholders or mock identities.

## Recommended Future Shape

When resumed, treat this as an identity-foundation project first and a profile-UI project second.

A good sequence is:

1. Canonical identity source
2. Runtime/storage migration
3. Market/trade/discussion activity indexing
4. Profile and avatar surfaces on top

## Current Work-Session Outcome

The branch is no longer ambiguously stalled. It is explicitly parked until the above criteria are chosen as a deliberate priority.