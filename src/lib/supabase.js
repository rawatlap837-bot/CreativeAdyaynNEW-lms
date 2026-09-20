import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env.local, then restart Vite.");
}

if (!/^https?:\/\//.test(supabaseUrl)) throw new Error("VITE_SUPABASE_URL must be an HTTP or HTTPS project URL.");
if (supabaseAnonKey.startsWith("sb_secret_")) throw new Error("Use a Supabase publishable key in the frontend, never a secret key.");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});

export default supabase;
