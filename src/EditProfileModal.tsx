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
