import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { nip19 } from "nostr-tools";
import { NDKEvent, NDKKind } from "@nostr-dev-kit/ndk";
import { useNostr } from "./context";
import { fetchKind0Metadata } from "./services/nostrService";
import { fetchPositions } from "./services/positionService";
import UserAvatar from "./components/UserAvatar";
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
  eventId: string;
  slug: string;
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
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
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
        const decoded = nip19.decode(routePubkey);
        if (decoded.type === "npub") {
          hex = decoded.data;
        } else {
          console.error("Invalid npub type");
          setNormalizedPubkey(null);
          return;
        }
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

  // Fetch kind 982 markets (authored by this user)
  useEffect(() => {
    if (!normalizedPubkey || !ndkInstance) return;

    setLoadingMarkets(true);
    ndkInstance
      .fetchEvents({
        kinds: [982 as NDKKind],
        authors: [normalizedPubkey],
      })
      .then((events) => {
        const marketList = Array.from(events)
          .filter((event: NDKEvent) => event.id != null)
          .map((event: NDKEvent) => {
            const slug = event.getMatchingTags("d")[0]?.[1] ?? "";
            const title = event.getMatchingTags("title")[0]?.[1] ?? "Untitled Market";
            const description = event.getMatchingTags("description")[0]?.[1] ?? "";
            return {
              eventId: event.id as string,
              slug,
              title,
              description,
              createdAt: event.created_at ?? Date.now() / 1000,
            };
          });
        setMarkets(marketList.sort((a: Market, b: Market) => b.createdAt - a.createdAt));
        setLoadingMarkets(false);
      })
      .catch((error: unknown) => {
        console.error("Error fetching markets:", error);
        setMarkets([]);
        setLoadingMarkets(false);
      });
  }, [normalizedPubkey, ndkInstance]);

  // Fetch kind 30078 positions
  useEffect(() => {
    if (!normalizedPubkey || !ndkInstance) return;

    setLoadingPositions(true);
    fetchPositions(ndkInstance, normalizedPubkey)
      .then((fetchedPositions) => {
        const positionList = fetchedPositions.map((pos) => ({
          id: pos.id,
          marketTitle: pos.marketTitle || "Unknown Market",
          side: pos.direction,
          amount: pos.quantity,
          createdAt: pos.timestamp,
          resolved: false,
        }));
        setPositions(positionList.sort((a: Position, b: Position) => b.createdAt - a.createdAt));
        setLoadingPositions(false);
      })
      .catch((error: unknown) => {
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
          {loadingProfile ? (
            <div className="w-24 h-24 bg-neutral-800 rounded-sm animate-pulse" />
          ) : (
            <UserAvatar pubkey={normalizedPubkey} size="lg" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold">
                {loadingProfile ? "Loading..." : (profile?.name || "Unknown")}
              </h1>
              {isOwnProfile && !loadingProfile && (
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
                  <MarketListItem key={market.eventId} market={market} />
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
            // Publish kind 0 event (async, no await)
            if (ndkInstance && loggedInPubkey) {
              const event = new NDKEvent(ndkInstance);
              event.kind = 0;
              event.content = JSON.stringify({
                name,
                about: bio,
                picture: profile?.picture || "",
                banner: profile?.banner || "",
                website: profile?.website || "",
                nip05: profile?.nip05 || "",
              });
              event.publish().catch((err: unknown) => {
                console.error("Failed to publish profile update:", err);
              });
            }
            setShowEditModal(false);
            // Refetch to show updated data
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
