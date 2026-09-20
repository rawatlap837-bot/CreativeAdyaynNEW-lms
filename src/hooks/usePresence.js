import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// One channel per tab. Writers and observers share a topic and subscription.
let channel = null;
let closing = Promise.resolve();
let disposeTimer;
let userId = null;
let refs = 0;
const observers = new Set();
const writers = new Map();
let currentIds = new Set();
function publish() {
  currentIds = new Set(Object.values(channel?.presenceState() || {}).flat().map((entry) => entry.user_id).filter(Boolean));
  for (const callback of observers) callback(new Set(currentIds));
}
function track() {
  if (!channel) return;
  if (userId) channel.track({ user_id: userId, online_at: new Date().toISOString() });
  else channel.untrack();
}
function acquire() {
  refs++;
  clearTimeout(disposeTimer);
  closing.then(() => {
    if (!refs || channel) return;
    channel = supabase.channel("lms:online-users", { config: { presence: { key: crypto.randomUUID() } } });
    channel.on("presence", { event: "sync" }, publish).subscribe((status) => {
      if (status === "SUBSCRIBED") track();
    });
  });
  return () => {
    refs--;
    disposeTimer = setTimeout(() => {
      if (refs || !channel) return;
      const old = channel; channel = null; currentIds = new Set();
      closing = supabase.removeChannel(old);
    }, 0);
  };
}
export default function usePresence(id) {
  useEffect(() => {
    if (!id) return;
    const key = Symbol(); writers.set(key, id); userId = id;
    const release = acquire(); track();
    return () => {
      writers.delete(key); userId = [...writers.values()].at(-1) || null;
      track(); release();
    };
  }, [id]);
}
export function useOnlinePresence() {
  const [onlineIds, setOnlineIds] = useState(() => new Set(currentIds));
  useEffect(() => {
    observers.add(setOnlineIds); const release = acquire();
    return () => { observers.delete(setOnlineIds); release(); };
  }, []);
  return onlineIds;
}
