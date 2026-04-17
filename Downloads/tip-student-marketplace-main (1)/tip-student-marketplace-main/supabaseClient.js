import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
    'https://ooqiirkoimnqpnglblcc.supabase.co',
    'sb_publishable_d5AHzgtn31TVeKAnuNVNVg_Hjt9bA0K'  // paste your FULL publishable key here
)