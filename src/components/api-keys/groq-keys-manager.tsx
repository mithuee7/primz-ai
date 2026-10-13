"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check } from "lucide-react";

interface GroqKey {
  id: string;
  key_name: string;
  is_active: boolean;
  last_error: string | null;
  reset_at: string | null;
  created_at: string;
}

export function GroqKeysManager() {
  const [keys, setKeys] = useState<GroqKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timers, setTimers] = useState<Record<string, number>>({});

  // Fetch keys on mount
  useEffect(() => {
    fetchKeys();
  }, []);

  // Update countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        Object.keys(updated).forEach((keyId) => {
          const val = updated[keyId];
          if (val !== undefined) {
            updated[keyId] = Math.max(0, val - 1);
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/groq-keys");
      const data = await response.json();

      setKeys(data);

      // Initialize timers for rate limited keys
      const newTimers: Record<string, number> = {};
      data.forEach((key: GroqKey) => {
        if (key.reset_at) {
          const resetTime = new Date(key.reset_at).getTime();
          const now = new Date().getTime();
          const seconds = Math.ceil((resetTime - now) / 1000);
          newTimers[key.id] = Math.max(0, seconds);
        }
      });
      setTimers(newTimers);
    } catch (err) {
      setError("Failed to fetch API keys");
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
      const response = await fetch("/api/groq-keys", {
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
      setError("Failed to add API key");
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const response = await fetch(`/api/groq-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete key");

      await fetchKeys();
    } catch (err) {
      setError("Failed to delete API key");
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return "Ready";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Groq API Keys</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
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
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name (optional)</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Main, Backup, Test"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
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
        <div className="text-center py-4 text-gray-500">
          No API keys added yet. Add one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="p-3 border rounded bg-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium">{key.key_name}</div>
                  <div className="text-xs text-gray-500">
                    Added {formatDate(key.created_at)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {key.is_active ? (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                      Rate Limited
                    </span>
                  )}
                </div>
              </div>

              {!key.is_active && key.reset_at && (
                <div className="text-sm text-orange-600 mb-2">
                  Retry in: {formatTime(timers[key.id] || 0)}
                </div>
              )}

              {key.last_error && (
                <div className="text-xs text-red-600 mb-2">
                  Error: {key.last_error}
                </div>
              )}

              <button
                onClick={() => handleDeleteKey(key.id)}
                className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {keys.length > 0 && (
        <div className="p-3 bg-blue-50 rounded text-sm text-blue-700">
          💡 You have {keys.filter((k) => k.is_active).length} active key(s). When one
          hits the rate limit, the app will automatically switch to another.
        </div>
      )}
    </div>
  );
}
