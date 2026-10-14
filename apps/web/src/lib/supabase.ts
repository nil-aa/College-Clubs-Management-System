import { createClient } from '@supabase/supabase-js';
import type { Database } from '@club-management/shared';

const url = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'local-development-anon-key';

export const supabase = createClient<Database>(url, anonKey);
