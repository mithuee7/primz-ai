"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";

interface ApifyKey {
  id: string;
  key_name: string;
  is_active: boolean;
  usage_count: number;
  monthly_limit: number;
}

export function ApifyKeysManager() {
  const [keys, setKeys] = useState<ApifyKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/apify-keys");
      const data = await response.json();
      setKeys(data);
    } catch (err) {
      setError("Failed to fetch Apify API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newKey.trim()) {
      setError("API key is required");
      return;
    }

    try {
      const response = await fetch("/api/apify-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: newKey,
          name: newKeyName || "Default",
        }),
      });

      if (!response.ok) throw new Error("Failed to add key");

      setNewKey("");
      setNewKeyName("");
      setShowForm(false);
      await fetchKeys();
    } catch (err) {
      setError("Failed to add Apify API key");
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Delete this Apify key? The usage count will reset.")) return;

    try {
      const response = await fetch(`/api/apify-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete key");

      await fetchKeys();
    } catch (err) {
      setError("Failed to delete API key");
    }
  };

  const getUsagePercentage = (key: ApifyKey) => {
    return (key.usage_count / key.monthly_limit) * 100;
  };

  const getRemainingCalls = (key: ApifyKey) => {
    return Math.max(0, key.monthly_limit - key.usage_count);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Apify API Keys</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          <Plus size={16} /> Add Key
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAddKey} className="p-4 bg-gray-50 rounded border space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Apify API Token</label>
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="apify_..."
              className="w-full px-3 py-2 border rounded"
            />
            <div className="text-xs text-gray-500 mt-1">
              Get free Apify credits at apify.com
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name (optional)</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Account 1, Account 2"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading keys...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-4 text-gray-500 space-y-2">
          <p>No Apify API keys added yet.</p>
          <p className="text-xs">
            Add keys to enable automatic lead type detection from Instagram bios and posts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => {
            const usage = getUsagePercentage(key);
            const remaining = getRemainingCalls(key);
            const isLowOnQuota = remaining < 3;

            return (
              <div key={key.id} className="p-3 border rounded bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{key.key_name}</div>
                    <div className="text-xs text-gray-500">
                      {key.usage_count} / {key.monthly_limit} calls used
                    </div>
                  </div>
                  {isLowOnQuota && (
                    <div className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                      <AlertCircle size={12} /> Low quota
                    </div>
                  )}
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      usage > 80
                        ? "bg-red-500"
                        : usage > 50
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(100, usage)}%` }}
                  ></div>
                </div>

                <button
                  onClick={() => handleDeleteKey(key.id)}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      {keys.length > 0 && (
        <div className="p-3 bg-indigo-50 rounded text-sm text-indigo-700">
          ℹ️ Free Apify accounts get ~10 calls/month. Add multiple accounts to increase
          your limit.
        </div>
      )}
    </div>
  );
}
