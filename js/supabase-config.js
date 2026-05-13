/**
 * supabase-config.js
 * Supabase client initialization.
 * Replaces firebase-config.js — import { supabase } from "./supabase-config.js"
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL     = "https://glaolagiflbsoccrnstz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsYW9sYWdpZmxic29jY3Juc3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzU0MDksImV4cCI6MjA5NDI1MTQwOX0.GnjJrF-gsdL5uYNygvOuvZm8LQ2-7uBj_XOAQHXvhBA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
