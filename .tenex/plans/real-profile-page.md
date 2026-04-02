# Real Nostr Profile Page Implementation

## Context

Currently, `src/MockProfilePage.tsx` (515 lines) provides a template layout for profile pages but uses hardcoded mock data. The application needs a real, Nostr-backed profile page that:

- Fetches NIP-01 kind 0 metadata (name, about, picture, banner, website, nip05) from relays
- Displays all markets authored by the user (kind 30000 with `#c: ['cascade']` tag)
- Displays all positions held by the user (kind 30078 via `positionService.fetchPositions`)
- Detects the logged-in user's own profile and shows edit controls
- Gracefully handles missing or incomplete data

**Related files:**
- `src/MockProfilePage.tsx`: Current template to replace
- `src/services/nostrService.ts`: Existing service layer; needs kind 0 fetching function
- `src/services/positionService.ts`: Already provides `fetchPositions(ndk, pubkey)`
- `src/App.tsx` (line ~775): Router configuration; route param will change from `:handle` to `:pubkey`
- `src/components/NavHeader.tsx`: Avatar/pubkey abbreviation pattern reference
- `src/components/UserAvatar.tsx`: Reusable avatar component (used for profile picture)
- `src/context/NostrContext.tsx`: Provides `useNostr()` hook with `ndkInstance` and `fetchEvents()`
- `src/stores/profileStore.ts`: `HumanProfile` type for localStorage-backed user profile data

The implementation follows a three-layer architecture: service layer (pure, testable Nostr fetching) → React component (layout, state management, tabs) → router (URL handling).

---

## Approach

### Strategy

Replace `MockProfilePage.tsx` with a new `ProfilePage.tsx` component that:

1. **Accepts flexible pubkey input**: Route param `:pubkey` accepts both npub and hex formats; normalize to hex internally using nip19 decoder
2. **Fetches real data in parallel**: Kind 0 metadata, kind 30000 markets, kind 30078 positions — all fetched concurrently via NDK
3. **Renders with graceful fallbacks**: If kind 0 metadata is not found, display "Unknown" name and pubkey abbreviation instead of error
4. **Structures tabs**: Two tabs — "Markets" and "Positions" — with dedicated list components
5. **Detects own profile**: Compare fetched pubkey against logged-in user's pubkey; show "Edit Profile" button only on own profile
6. **Provides simple edit modal**: Form with name and bio fields; stores updates to `profileStore` and publishes kind 0 event

### Why This Approach

- **Parallel fetching**: Reduces perceived latency; all three data sources (kind 0, kind 30000, kind 30078) are independent queries
- **Service layer separation**: `fetchKind0Metadata` is testable offline and decoupled from React; matches existing `positionService` pattern
- **Graceful degradation**: Missing kind 0 does not break the page; unknown profiles are still displayable
- **Three-component architecture**: ProfilePage (orchestration) → MarketListItem/PositionListItem (rendering) → EditProfileModal (user edit flow); keeps components focused
- **Pubkey normalization at entry**: Single normalization point in component avoids repeated conversions; stores normalized hex internally

### Considered Alternatives

| Alternative | Why Rejected |
|-------------|-------------|
| Fetch kind 0, kind 30000, kind 30078 sequentially | Slower perceived load time; data sources are independent so parallelization is safe |
| Error modal if kind 0 not found | Cascades can have users without profiles (anonymous early adopters); graceful fallback improves UX |
| Dedicated MarketCard component | Would duplicate MarketListItem; markets in profile context need different fields (created date) than market list elsewhere; inline rendering is simpler |
| Filter positions by status (open/resolved) | All positions tell the user's complete story; resolved positions show history; no filtering needed |
| Implement follower counts now | Requires kind 3 (contacts) queries on all users who follow; high relay load; defer to post-MVP; stub at 0 with label "Coming soon" |
| Two-way sync between profileStore and kind 0 | profileStore is for app-wide user settings; kind 0 is Nostr-canonical profile; write only to kind 0; read from both for fallback if kind 0 fetch fails |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Pubkey normalization** | Accept both npub (NIP-19) and hex; normalize to hex internally; store as hex | NIP-19 npub is user-friendly; hex is canonical; single normalization point in component |
| **Kind 0 fallback** | Show "Unknown" name, pubkey abbreviation (first 4 chars + "…") if kind 0 fetch fails or returns empty | Gracefully displays anonymous users; does not block profile view |
| **Markets rendering** | Inline list in "Markets" tab; no dedicated MarketCard component needed | Profile context differs from global market list; MarketListItem shows created date + author; avoids component duplication |
| **Position filtering** | Show all positions (both open and resolved) | Resolved positions show user's trading history; no filtering improves transparency |
| **Follower counts** | Stub at 0 with label "Coming soon" | Requires expensive kind 3 queries; defer to post-MVP; no blocking impact on feature launch |
| **Loading UX** | Show spinner during initial fetch; preserve last render on refetch; empty state messages for no markets / no positions | Reduces perceived latency; empty states communicate data absence clearly |
| **Own profile detection** | Compare normalized pubkey from route param against logged-in user's pubkey from `useNostr().pubkey` | Determines whether to show "Edit Profile" button; no separate auth logic needed |
| **Edit modal storage** | Write name and bio to profileStore immediately; publish kind 0 event asynchronously; if publish fails, updates still persist locally | Users see changes immediately; kind 0 syncs eventually; app remains responsive |

---

## File Changes

### `src/services/nostrService.ts`

**Action**: Modify

**What**: Add `fetchKind0Metadata` function (32 lines). This function fetches NIP-01 kind 0 (metadata) events for a given pubkey.

```typescript
/**
 * Fetch kind 0 (metadata) event for a given pubkey.
 * Returns the metadata object or null if not found.
 */
export async function fetchKind0Metadata(
  ndk: NDKInstance,
  pubkey: string
): Promise<{ name: string; about: string; picture: string; banner: string; website: string; nip05: string } | null> {
  try {
    const event = await ndk.fetchEvent({
      kinds: [0],
      authors: [pubkey],
    });

    if (!event) {
      return null;
    }

    // Parse kind 0 content as JSON
    try {
      const metadata = JSON.parse(event.content);
      return {
        name: metadata.name || "",
        about: metadata.about || "",
        picture: metadata.picture || "",
        banner: metadata.banner || "",
        website: metadata.website || "",
        nip05: metadata.nip05 || "",
      };
    } catch {
      // Malformed JSON in kind 0 — return null
      return null;
    }
  } catch (error) {
    console.error(`Error fetching kind 0 for ${pubkey}:`, error);
    return null;
  }
}
```

**Why**: Separates Nostr kind 0 fetching into a reusable, testable service function. Matches existing `positionService` pattern. Decouples data fetching from React component logic.

---

### `src/ProfilePage.tsx`

**Action**: Create

**What**: New file, ~480 lines. Complete implementation:

```typescript
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { bech32 } from "@noble/hashes/bech32";
import { useNostr } from "../context/NostrContext";
import { fetchKind0Metadata } from "../services/nostrService";
import { positionService } from "../services/positionService";
import { saveHumanProfile, loadHumanProfile } from "../stores/profileStore";
import UserAvatar from "../components/UserAvatar";
import EditProfileModal from "./EditProfileModal";

interface ProfileData {
  pubkey: string;
  name: string;
  about: string;
  picture: string;
  banner: string;
  website: string;
  nip05: string;
}

interface Market {
  id: string;
  title: string;
  description: string;
  createdAt: number;
}

interface Position {
  id: string;
  marketTitle: string;
  side: "yes" | "no";
  amount: number;
  createdAt: number;
  resolved: boolean;
}

const ProfilePage: React.FC = () => {
  const { pubkey: routePubkey } = useParams<{ pubkey: string }>();
  const { pubkey: loggedInPubkey, ndkInstance } = useNostr();

  const [normalizedPubkey, setNormalizedPubkey] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"markets" | "positions">("markets");

  // Normalize pubkey: accept both npub and hex
  useEffect(() => {
    if (!routePubkey) {
      setNormalizedPubkey(null);
      return;
    }

    let hex = routePubkey;
    if (routePubkey.startsWith("npub1")) {
      try {
        const decoded = bech32.decode(routePubkey);
        hex = decoded.slice(0, 32).toString("hex");
      } catch {
        console.error("Invalid npub format");
        setNormalizedPubkey(null);
        return;
      }
    }
    setNormalizedPubkey(hex);
  }, [routePubkey]);

  // Fetch kind 0 metadata
  useEffect(() => {
    if (!normalizedPubkey || !ndkInstance) return;

    setLoadingProfile(true);
    fetchKind0Metadata(ndkInstance, normalizedPubkey).then((metadata) => {
      if (metadata) {
        setProfile({
          pubkey: normalizedPubkey,
          name: metadata.name || "Unknown",
          about: metadata.about || "",
          picture: metadata.picture || "",
          banner: metadata.banner || "",
          website: metadata.website || "",
          nip05: metadata.nip05 || "",
        });
      } else {
        // Graceful fallback: show minimal profile with pubkey
        setProfile({
          pubkey: normalizedPubkey,
          name: "Unknown",
          about: "",
          picture: "",
          banner: "",
          website: "",
          nip05: "",
        });
      }
      setLoadingProfile(false);
    });
  }, [normalizedPubkey, ndkInstance]);

  // Fetch kind 30000 markets (authored by this user)
  useEffect(() => {
    if (!normalizedPubkey || !ndkInstance) return;

    setLoadingMarkets(true);
    ndkInstance
      .fetchEvents({
        kinds: [30000],
        authors: [normalizedPubkey],
      })
      .then((events) => {
        const marketList = events.map((event) => {
          const content = JSON.parse(event.content || "{}");
          return {
            id: `${normalizedPubkey}:${event.dTag}`,
            title: content.title || "Untitled Market",
            description: content.description || "",
            createdAt: event.created_at || Date.now() / 1000,
          };
        });
        setMarkets(marketList.sort((a, b) => b.createdAt - a.createdAt));
        setLoadingMarkets(false);
      })
      .catch((error) => {
        console.error("Error fetching markets:", error);
        setMarkets([]);
        setLoadingMarkets(false);
      });
  }, [normalizedPubkey, ndkInstance]);

  // Fetch kind 30078 positions
  useEffect(() => {
    if (!normalizedPubkey || !ndkInstance) return;

    setLoadingPositions(true);
    positionService
      .fetchPositions(ndkInstance, normalizedPubkey)
      .then((fetchedPositions) => {
        const positionList = fetchedPositions.map((pos) => ({
          id: pos.id,
          marketTitle: pos.marketTitle || "Unknown Market",
          side: pos.side,
          amount: pos.amount,
          createdAt: pos.createdAt,
          resolved: pos.status === "resolved",
        }));
        setPositions(positionList.sort((a, b) => b.createdAt - a.createdAt));
        setLoadingPositions(false);
      })
      .catch((error) => {
        console.error("Error fetching positions:", error);
        setPositions([]);
        setLoadingPositions(false);
      });
  }, [normalizedPubkey, ndkInstance]);

  if (!normalizedPubkey) {
    return <div className="p-6 text-center text-neutral-400">Invalid pubkey</div>;
  }

  const isOwnProfile = loggedInPubkey === normalizedPubkey;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Banner */}
      {profile?.banner && (
        <div className="h-48 bg-neutral-800 overflow-hidden">
          <img src={profile.banner} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Profile Header */}
      <div className="px-6 py-8 border-b border-neutral-800">
        <div className="flex gap-6">
          <UserAvatar pubkey={normalizedPubkey} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold">{profile?.name || "Unknown"}</h1>
              {isOwnProfile && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-sm font-medium px-3 py-1 border border-neutral-600 rounded-sm hover:border-white transition"
                >
                  Edit Profile
                </button>
              )}
            </div>
            {profile?.about && <p className="text-neutral-400 mt-2">{profile.about}</p>}
            {profile?.website && (
              <a href={profile.website} className="text-emerald-400 hover:underline mt-2 block text-sm">
                {profile.website}
              </a>
            )}
            {profile?.nip05 && <p className="text-neutral-500 text-sm mt-1">{profile.nip05}</p>}
            <p className="text-neutral-500 text-sm mt-3">
              {normalizedPubkey.slice(0, 4)}…{normalizedPubkey.slice(-4)}
            </p>
          </div>
        </div>
      </div>

      {/* Credibility Strip */}
      <div className="grid gap-4 border-b border-neutral-800 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Markets</p>
          <p className="text-lg font-semibold text-white mt-1">{markets.length}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Positions</p>
          <p className="text-lg font-semibold text-white mt-1">{positions.length}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Followers</p>
          <p className="text-neutral-500 text-sm mt-1">Coming soon</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Following</p>
          <p className="text-neutral-500 text-sm mt-1">Coming soon</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-800 px-6">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("markets")}
            className={`py-4 px-1 text-sm font-medium transition ${
              activeTab === "markets"
                ? "border-b-2 border-white text-white -mb-px"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Markets
          </button>
          <button
            onClick={() => setActiveTab("positions")}
            className={`py-4 px-1 text-sm font-medium transition ${
              activeTab === "positions"
                ? "border-b-2 border-white text-white -mb-px"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Positions
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-8">
        {activeTab === "markets" && (
          <div>
            {loadingMarkets ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border border-neutral-600 border-t-white" />
              </div>
            ) : markets.length === 0 ? (
              <p className="text-center text-neutral-400 py-12">No markets created yet</p>
            ) : (
              <div className="space-y-4">
                {markets.map((market) => (
                  <MarketListItem key={market.id} market={market} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "positions" && (
          <div>
            {loadingPositions ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border border-neutral-600 border-t-white" />
              </div>
            ) : positions.length === 0 ? (
              <p className="text-center text-neutral-400 py-12">No positions held yet</p>
            ) : (
              <div className="space-y-4">
                {positions.map((position) => (
                  <PositionListItem key={position.id} position={position} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && isOwnProfile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSave={(name, bio) => {
            // Save to profileStore
            saveHumanProfile({ name, about: bio });
            // Publish kind 0 event (async, no await)
            if (ndkInstance && loggedInPubkey) {
              ndkInstance.publish({
                kind: 0,
                content: JSON.stringify({
                  name,
                  about: bio,
                  picture: profile?.picture || "",
                  banner: profile?.banner || "",
                  website: profile?.website || "",
                  nip05: profile?.nip05 || "",
                }),
              });
            }
            setShowEditModal(false);
            // Optionally refetch to show updated data
            if (normalizedPubkey && ndkInstance) {
              fetchKind0Metadata(ndkInstance, normalizedPubkey).then((metadata) => {
                if (metadata) {
                  setProfile((prev) => (prev ? { ...prev, ...metadata } : null));
                }
              });
            }
          }}
        />
      )}
    </div>
  );
};

// Market List Item Component
interface MarketListItemProps {
  market: Market;
}

const MarketListItem: React.FC<MarketListItemProps> = ({ market }) => {
  const createdDate = new Date(market.createdAt * 1000).toLocaleDateString();
  return (
    <div className="border-b border-neutral-800 pb-4 last:border-0">
      <h3 className="font-semibold text-white">{market.title}</h3>
      {market.description && <p className="text-neutral-400 text-sm mt-1">{market.description}</p>}
      <p className="text-neutral-500 text-xs mt-2">Created {createdDate}</p>
    </div>
  );
};

// Position List Item Component
interface PositionListItemProps {
  position: Position;
}

const PositionListItem: React.FC<PositionListItemProps> = ({ position }) => {
  const createdDate = new Date(position.createdAt * 1000).toLocaleDateString();
  const sideColor = position.side === "yes" ? "text-emerald-400" : "text-rose-400";
  const statusBadge = position.resolved ? (
    <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 ml-2">Resolved</span>
  ) : (
    <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-500 ml-2">Open</span>
  );

  return (
    <div className="border-b border-neutral-800 pb-4 last:border-0">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-neutral-300">{position.marketTitle}</p>
          <p className={`font-semibold mt-1 ${sideColor}`}>{position.side.toUpperCase()} — {position.amount}</p>
        </div>
        {statusBadge}
      </div>
      <p className="text-neutral-500 text-xs mt-2">Created {createdDate}</p>
    </div>
  );
};

export default ProfilePage;
```

**Why**: Implements the complete profile page with:
- Pubkey normalization from both npub and hex formats
- Parallel data fetching (kind 0, markets, positions)
- Graceful fallbacks for missing metadata
- Profile header with banner, avatar, bio, website, nip05
- Credibility strip with market/position counts, placeholder for followers/following
- Two tabs with list components and loading/empty states
- Own profile detection and "Edit Profile" button
- Integration with EditProfileModal for local + Nostr updates

---

### `src/EditProfileModal.tsx`

**Action**: Create

**What**: New file, ~120 lines. Modal component for editing profile name and bio.

```typescript
import React, { useState } from "react";

interface EditProfileModalProps {
  profile: { name: string; about: string } | null;
  onClose: () => void;
  onSave: (name: string, bio: string) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ profile, onClose, onSave }) => {
  const [name, setName] = useState(profile?.name || "");
  const [bio, setBio] = useState(profile?.about || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      onSave(name, bio);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-sm p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-white mb-4">Edit Profile</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-sm px-3 py-2 text-white focus:outline-none focus:border-white transition"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-sm px-3 py-2 text-white focus:outline-none focus:border-white transition resize-none"
              placeholder="Tell us about yourself"
            />
            <p className="text-neutral-500 text-xs mt-1">{bio.length} / 500</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 border border-neutral-600 rounded-sm text-neutral-300 hover:text-white transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 bg-white text-neutral-950 rounded-sm font-medium hover:bg-neutral-200 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
```

**Why**: Provides simple name/bio editing with local persistence to profileStore and async kind 0 publishing. Users see changes immediately; Nostr sync happens in background.

---

### `src/App.tsx`

**Action**: Modify

**What**: Update router configuration (line ~775).

Replace:
```typescript
<Route path="/u/:handle" element={<MockProfilePage />} />
```

With:
```typescript
import ProfilePage from "./pages/ProfilePage";

// ... later in routes array:
<Route path="/u/:pubkey" element={<ProfilePage />} />
```

**Why**: 
- Changes route param from `:handle` to `:pubkey` to accept both npub and hex public keys
- Imports new ProfilePage component
- Removes MockProfilePage import (can be deleted)

---

## Execution Order

### Phase 1: Service Layer (Foundation)
1. **Add `fetchKind0Metadata` to `src/services/nostrService.ts`** (32 lines)
   - Fetches kind 0 metadata for a pubkey
   - Returns typed metadata object or null
   - Includes error handling and JSON parse fallback
   - Verify: Import function, test with a known pubkey via NDK, confirm return type matches interface

### Phase 2: React Components
2. **Create `src/EditProfileModal.tsx`** (120 lines)
   - Modal form for name/bio editing
   - Local state for form fields
   - Calls `onSave` callback with updated values
   - Verify: Modal renders, fields update on input, buttons are enabled/disabled correctly

3. **Create `src/ProfilePage.tsx`** (480 lines)
   - Main component with pubkey normalization
   - Parallel data fetching hooks (kind 0, markets, positions)
   - Profile header, credibility strip, tab navigation
   - MarketListItem and PositionListItem subcomponents
   - EditProfileModal integration
   - Verify: Pubkey normalization works (test npub and hex), kind 0/markets/positions load in parallel, tabs switch content, edit modal opens/closes, own profile detection works

### Phase 3: Router Integration
4. **Update `src/App.tsx` route** (line ~775)
   - Change route param from `:handle` to `:pubkey`
   - Import ProfilePage, remove MockProfilePage
   - Verify: Router resolves `/u/<npub>` and `/u/<hex>` to ProfilePage, MockProfilePage no longer used

### Phase 4: Verification & Testing
5. **Manual integration testing** (7 scenarios + 40+ item checklist, see Verification section)

---

## Verification

### Automated Checks

1. **TypeScript type safety**
   ```bash
   npm run type-check
   # Verify: No errors in src/ProfilePage.tsx, src/EditProfileModal.tsx, src/services/nostrService.ts
   ```

2. **Build verification**
   ```bash
   npm run build
   # Verify: Build succeeds, no import/export errors
   ```

3. **Linting**
   ```bash
   npm run lint -- src/ProfilePage.tsx src/EditProfileModal.tsx src/services/nostrService.ts
   # Verify: No warnings about unused imports, style violations, or accessibility issues
   ```

### Integration Test Scenarios

Each scenario includes expected behavior verification steps:

1. **Public profile (non-owned)**
   - Navigate to `/u/<hex-pubkey>` of a different user
   - Verify: Profile header displays (name, about, picture, banner if available), credibility strip shows market/position counts, "Edit Profile" button NOT shown, tabs switch content

2. **npub pubkey resolution**
   - Navigate to `/u/<npub>` (bech32-encoded pubkey)
   - Verify: Page loads same content as `/u/<hex>` for same user, normalization happens transparently

3. **Invalid/missing pubkey**
   - Navigate to `/u/invalidtext`
   - Verify: Error message shown, page does not crash

4. **Own profile (authenticated user)**
   - Log in as user
   - Navigate to `/u/<own-pubkey>`
   - Verify: "Edit Profile" button shown, button click opens EditProfileModal

5. **Edit profile**
   - Open EditProfileModal on own profile
   - Change name and bio
   - Click "Save"
   - Verify: Modal closes, profile header updates immediately, kind 0 event publishes to relays (check in relay logs)

6. **Empty profile (no kind 0)**
   - Fetch profile for pubkey with no kind 0 metadata
   - Verify: Name displays as "Unknown", pubkey abbreviation shown, no error, page renders normally

7. **Markets and positions loading**
   - Navigate to profile with >0 markets and >0 positions
   - Verify: Both load in parallel (watch network tab), credibility strip shows correct counts, lists render without duplicates

### Manual Testing Checklist

**Profile Header:**
- [ ] Banner image displays if present
- [ ] Avatar renders with correct color based on pubkey
- [ ] Name displays or shows "Unknown" if not found
- [ ] Bio renders with word wrapping
- [ ] Website is clickable link with emerald color
- [ ] NIP-05 verification identifier shown if present
- [ ] Pubkey abbreviation (first 4 + last 4) displayed

**Credibility Strip:**
- [ ] Markets count displays
- [ ] Positions count displays
- [ ] Followers shows "Coming soon"
- [ ] Following shows "Coming soon"
- [ ] Grid layout responsive (stacks on mobile, 2 cols on tablet, 4 cols on desktop)

**Tabs:**
- [ ] "Markets" tab active by default
- [ ] "Positions" tab can be clicked
- [ ] Active tab has underline, white text
- [ ] Inactive tab has neutral-500 text, hover effect
- [ ] Tab content switches when clicked

**Markets Tab:**
- [ ] Loading spinner shown while fetching
- [ ] Empty state message if no markets
- [ ] Market list renders without duplicates
- [ ] Each market shows title, description, created date
- [ ] Markets sorted by date (newest first)

**Positions Tab:**
- [ ] Loading spinner shown while fetching
- [ ] Empty state message if no positions
- [ ] Position list renders without duplicates
- [ ] Each position shows market title, side (YES/NO), amount, status, created date
- [ ] YES positions colored emerald
- [ ] NO positions colored rose
- [ ] Resolved positions show "Resolved" badge
- [ ] Open positions show "Open" badge in emerald
- [ ] Positions sorted by date (newest first)

**Edit Profile (Own Profile Only):**
- [ ] "Edit Profile" button shows only on own profile
- [ ] Button click opens modal
- [ ] Modal has name and bio fields pre-filled with current values
- [ ] Name field has 50 char limit (shows count)
- [ ] Bio field has 500 char limit (shows count)
- [ ] Cancel button closes modal without changes
- [ ] Save button disables while saving
- [ ] Save publishes kind 0 event with updated name and bio
- [ ] Profile header updates immediately after save
- [ ] Local profileStore updated with new name/bio

**Pubkey Normalization:**
- [ ] `/u/<hex>` resolves correctly
- [ ] `/u/<npub>` resolves to same profile as hex equivalent
- [ ] Invalid npub format shows error
- [ ] Pubkey stored internally as hex (verified in code, no conversion overhead)

**Loading States:**
- [ ] Spinner shows during kind 0 fetch
- [ ] Spinner shows during markets fetch
- [ ] Spinner shows during positions fetch
- [ ] Last render preserved during refetch (no blank flash)
- [ ] Spinners disappear when data loads

**Network Error Handling:**
- [ ] If kind 0 fetch fails, profile still shows with "Unknown" name
- [ ] If markets fetch fails, "No markets" message shown (no error modal)
- [ ] If positions fetch fails, "No positions" message shown (no error modal)
- [ ] Page remains responsive; no unhandled promise rejections in console

**Backward Compatibility:**
- [ ] Existing discussion links with hex pubkeys still work (no breaking change)
- [ ] Comment/reply references to hex pubkeys unchanged
- [ ] MockProfilePage no longer exists (removed from imports, not available at old route if any)

**Style & Spacing:**
- [ ] Background is neutral-950 (pure dark)
- [ ] Text is white/neutral-300/neutral-400/neutral-500 as specified
- [ ] Emerald accent for YES positions and website links
- [ ] Rose accent for NO positions
- [ ] Underline tabs only (no background fills, no pills)
- [ ] No rounded corners except avatar (rounded-sm for inputs/buttons if needed)
- [ ] Padding/margins follow consistent `gap-` and `px-`/`py-` scale
- [ ] Mobile responsive: credibility strip stacks, avatar and name stack on very small screens

**Browser & Device Testing:**
- [ ] Desktop (Chrome, Firefox, Safari)
- [ ] Mobile (iOS Safari, Chrome mobile)
- [ ] Tablet (iPad, Android)
- [ ] Network latency simulation (slow 3G) — spinners visible, not blank
- [ ] No console errors or warnings

### Edge Cases to Test

1. **Very long name/bio** — Verify text wrapping and truncation if applicable
2. **Missing picture URL** — Verify avatar still renders with color
3. **Malformed JSON in kind 0** — Verify fallback to "Unknown" name
4. **User with 100+ positions** — Verify list renders efficiently, no performance issues
5. **User with 0 markets and 0 positions** — Verify empty state messages display
6. **Relay timeout on kind 0 fetch** — Verify fallback and user-friendly error handling
7. **Edit name/bio then page reload** — Verify localStorage persisted, kind 0 synced
8. **Navigate between different users quickly** — Verify no state cross-contamination, correct user data loads

---

## Scope & Limitations

### In Scope

- Fetch and display NIP-01 kind 0 metadata (name, about, picture, banner, website, nip05)
- Display all markets authored by user (kind 30000, filtered by author pubkey)
- Display all positions held by user (kind 30078 via positionService)
- Pubkey normalization (accept npub and hex formats)
- Own profile detection and edit controls (name/bio)
- Publish kind 0 updates to relays after edit
- Graceful fallback for missing kind 0 metadata
- Loading spinners, empty states, error handling
- Responsive design (mobile, tablet, desktop)
- Style compliance with neutral-950, emerald/rose accents, underline tabs

### Out of Scope (Deferred)

- Follower/following counts (requires kind 3 queries on all followers; high relay load; post-MVP)
- Social graph visualization or follow buttons
- User blocking or muting
- Profile cover image upload
- Profile picture upload or change via UI (kind 0 editing restricted to text fields only)
- Market detail pages (profile shows title/description only, linking to market detail deferred)
- Position detail pages (profile shows summary only, linking to position detail deferred)
- Notification when profile is viewed by others
- Profile search or discovery
- Verification badges (beyond NIP-05)

### Acceptable Trade-offs

- Follower counts stub at 0 with "Coming soon" — avoids expensive kind 3 queries, acceptable UX
- Edit modal saves locally first, publishes kind 0 asynchronously — users see instant feedback, eventual consistency with relays
- No real-time sync of kind 0 changes from other clients — profile refreshes on page reload or manual refetch (user refreshes page or navigates away and back)

---

## Success Criteria

### Functional Requirements

1. **Pubkey normalization**: Accepts both npub (NIP-19 bech32) and hex pubkey formats; normalizes to hex internally; single normalization point in component
2. **Kind 0 metadata fetch**: Fetches NIP-01 kind 0 from NDK relays; returns typed metadata object (name, about, picture, banner, website, nip05)
3. **Kind 0 fallback**: If kind 0 not found or malformed JSON, displays "Unknown" name and pubkey abbreviation; does not error
4. **Markets display**: Fetches kind 30000 events (markets) authored by user; displays title, description, created date; sorted by date (newest first)
5. **Positions display**: Fetches kind 30078 events (positions) for user via positionService; displays market title, side (YES/NO), amount, status, created date; sorted by date
6. **Own profile detection**: Compares normalized pubkey against logged-in user pubkey from useNostr(); shows "Edit Profile" button only on own profile
7. **Edit profile modal**: Modal form with name and bio fields; saves to profileStore locally; publishes kind 0 event with updated metadata; modal closes after save
8. **Profile header layout**: Banner image (if available), avatar, name, bio, website (clickable), nip05, pubkey abbreviation
9. **Credibility strip**: Four statistics grid (markets, positions, followers, following); "Coming soon" for followers/following; responsive layout (stacks on mobile)
10. **Tabs**: "Markets" and "Positions" tabs with underline style only; active tab white text with bottom border, inactive tab neutral-500 with hover effect
11. **Loading states**: Spinner shown during fetches; preserved last render on refetch; no blank screens
12. **Empty states**: "No markets created yet" and "No positions held yet" messages when lists are empty
13. **Error handling**: Network failures do not crash page; graceful degradation with empty states or "Unknown" fallbacks

### Type Safety

1. **TypeScript strict mode**: All files compile without errors in strict mode (`npm run type-check`)
2. **Explicit types**: ProfileData, Market, Position, EditProfileModalProps all fully typed
3. **No `any` types**: All parameters and return values have explicit types
4. **Function signatures**: fetchKind0Metadata fully typed (params, return, error handling)
5. **React props**: All component props interfaces defined; no implicit `any`

### Style Compliance

1. **Background**: All backgrounds are neutral-950 (pure dark); no other dark shades
2. **Text colors**: White (primary), neutral-300 (secondary), neutral-400 (tertiary), neutral-500 (metadata)
3. **Accents**: Emerald for YES positions and website links; Rose for NO positions; no other accent colors
4. **Borders**: Used sparingly; divide-y for lists; border-neutral-800 or lighter for structure
5. **Tabs**: Underline style only; no background fills, no pill shapes, no rounded corners on tab container
6. **Avatar**: Rounded-sm only; no large rounded corners, no pills
7. **Inputs/buttons**: rounded-sm, no gradients, no emojis in UI chrome
8. **Typography**: Text labels text-sm font-medium, metadata text-xs, headings appropriate weight (h1 text-3xl font-semibold)
9. **Responsive**: Mobile-first; predictable breakpoints (sm, md, lg, xl); no arbitrary breakpoints

### Backward Compatibility

1. **Existing discussion links**: Hex pubkey links still resolve correctly; no breaking change to `/u/` route
2. **Comment references**: No changes to how comments or replies reference users; pubkey format unchanged
3. **localStorage**: profileStore API unchanged; old profiles migrate gracefully or ignored
4. **Router API**: No changes to other routes; `/u/:pubkey` is addition/replacement only

### Testing

1. **Integration scenarios**: All 7 scenarios pass (public profile, npub resolution, invalid pubkey, own profile, edit profile, empty profile, markets+positions loading)
2. **Manual checklist**: All 40+ items verified
3. **Edge cases**: All 8 edge cases tested
4. **No regressions**: Other pages (discussion list, market list, home) still work; no broken links or imports

### Regressions

1. **MockProfilePage removal**: No other component imports MockProfilePage; App.tsx route updated; no broken references
2. **Build verification**: `npm run build` succeeds; no import/export errors
3. **Lint**: `npm run lint` passes; no style or accessibility warnings
4. **Type check**: `npm run type-check` passes; no type errors

### Data Integrity

1. **No data loss**: Edit profile updates profileStore and publishes kind 0; no data removed or overwritten incorrectly
2. **Concurrency**: If user edits profile while offline, changes persist locally; no conflicts on reconnect
3. **Consistency**: Profile header updates immediately after edit; kind 0 eventually published to relays; fallback to localStorage if relay fails

### Performance

1. **Parallel fetching**: Kind 0, markets, positions fetched concurrently (not sequentially)
2. **No unnecessary re-fetches**: Data fetched once per pubkey; route changes trigger appropriate refetches
3. **Render performance**: Lists render 50+ items without noticeable lag; no unnecessary re-renders of subcomponents

### User Experience

1. **No blank screens**: Loading spinners visible during fetches; last render preserved on refetch
2. **Responsive feedback**: Edit button click opens modal immediately; save button disabled during publish
3. **Clear messaging**: Empty states and "Unknown" profiles communicated clearly; no cryptic errors
4. **Intuitive navigation**: Tabs clearly marked; pubkey display includes abbreviation for recognition

---

## Implementation Notes

### Data Fetching Pattern

- **Kind 0 metadata**: `fetchKind0Metadata(ndk, pubkey)` in service layer; returns typed metadata object or null
- **Markets**: NDK `fetchEvents({ kinds: [30000], authors: [pubkey] })`; parse content as JSON; filter by d-tag if needed (initially no filtering)
- **Positions**: `positionService.fetchPositions(ndk, pubkey)` (existing); returns position array with status

### Pubkey Normalization

- Accept route param `:pubkey` as both npub and hex
- In effect, use `bech32.decode(pubkey)` if starts with `npub1`; otherwise assume hex
- Store normalized hex internally; use hex for all Nostr queries
- Display hex abbreviation (first 4 + last 4 chars)

### Profile Storage

- `profileStore.loadHumanProfile()` — Load locally stored profile (fallback if kind 0 not found)
- `profileStore.saveHumanProfile({ name, about })` — Save to localStorage immediately on edit
- Kind 0 publish happens asynchronously; eventual consistency with relays

### Edit Modal Behavior

- Opens only if `isOwnProfile === true`
- Pre-fills with current profile data
- Save: calls `onSave(name, bio)` callback, which handles:
  - Store to profileStore immediately
  - Publish kind 0 event asynchronously
  - Refetch kind 0 to show updated data in header
- Cancel: closes modal without changes

### Error Handling

- Kind 0 fetch fails → show "Unknown" name, continue rendering page
- Markets fetch fails → show empty state, log error
- Positions fetch fails → show empty state, log error
- Invalid pubkey in route → show error message, stop rendering
- Relay timeout → graceful fallback, no error modal (background failure OK)

### Component Hierarchy

```
ProfilePage
  ├─ UserAvatar (external, reusable)
  ├─ MarketListItem (local subcomponent)
  ├─ PositionListItem (local subcomponent)
  └─ EditProfileModal (separate file)
```

---

## Post-MVP Enhancements

- Implement follower/following counts (requires kind 3 fetching)
- Link markets and positions to detail pages
- Add profile picture upload/change
- Real-time profile sync (if relay sends new kind 0)
- User blocking/muting
- Follow button for other users' profiles
- Profile search
- Verification badges (NIP-05 name colorization)
