import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { buildMarketEventTags } from '$lib/cascade/marketEventTags';
import { getCascadeEventKinds } from '$lib/ndk/cascade';
import { getServerNdkClient } from '$lib/server/nostr';
import { waitForAnyRelayConnected } from '$lib/ndk/client';
import { DEFAULT_RELAYS } from '$lib/ndk/config';
import { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	createMarket: async ({ request, locals }) => {
		const formData = await request.formData();

		const claim = formData.get('claim')?.toString().trim() || '';
		const category = formData.get('category')?.toString().trim() || '';
		const caseText = formData.get('caseText')?.toString().trim() || '';
		const imageUrl = formData.get('imageUrl')?.toString().trim() || '';
		const summaryText = formData.get('summaryText')?.toString().trim() || '';
		const tagsRaw = formData.get('tags')?.toString() || '[]';
		const seedSide = formData.get('seedSide')?.toString() || 'yes';
		const seedAmountRaw = formData.get('seedAmount')?.toString() || '100';

		// Validate required fields
		if (!claim) {
			return fail(400, { success: false, error: 'A claim is required.' });
		}

		if (!category) {
			return fail(400, { success: false, error: 'Please select a category.' });
		}

		const tags = JSON.parse(tagsRaw) as string[];
		const seedAmount = Number.parseInt(seedAmountRaw, 10) || 100;

		const slug = slugify(claim);
		if (!slug) {
			return fail(400, { success: false, error: 'Could not generate a valid slug from the claim.' });
		}

		try {
			const ndk = await getServerNdkClient();
			const edition = locals.cascadeEdition || 'mainnet';
			const eventKinds = getCascadeEventKinds(edition);

			// Build market event tags
			const marketTags = buildMarketEventTags({
				title: claim,
				slug,
				description: summaryText || caseText.slice(0, 280),
				category,
				topics: tags.join(','),
				linkedMarkets: [] // TODO: support linked markets in form
			});

			// Add image URL tag if provided
			if (imageUrl) {
				marketTags.push(['image', imageUrl]);
			}

			// Create and publish market event
			const marketEvent = new NDKEvent(ndk);
			marketEvent.kind = eventKinds.market as number;
			marketEvent.content = caseText;
			marketEvent.tags = marketTags;

			// Wait for relays
			const publishRelayUrls = DEFAULT_RELAYS.filter((r) => !r.includes('purplepag.es'));
			const targetUrls = publishRelayUrls.length ? publishRelayUrls : DEFAULT_RELAYS;
			await waitForAnyRelayConnected(targetUrls, 15_000);

			const publishRelays = NDKRelaySet.fromRelayUrls(targetUrls, ndk);

			// Sign and publish
			await marketEvent.sign();
			await marketEvent.publish(publishRelays, 10_000);

			const rawEvent = marketEvent.rawEvent();
			const eventId = rawEvent.id || marketEvent.id;

			if (!eventId) {
				return fail(500, { success: false, error: "Couldn't get market event ID after publishing." });
			}

			return {
				success: true,
				market: {
					slug,
					eventId,
					claim,
					category,
					seedSide,
					seedAmount
				}
			};
		} catch (error) {
			console.error('Market creation failed:', error);
			const message = error instanceof Error ? error.message : 'Unknown error';
			return fail(500, { success: false, error: `Failed to create market: ${message}` });
		}
	}
};