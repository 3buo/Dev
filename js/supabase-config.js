// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Reemplaza estas dos variables con los datos de tu Dashboard de Supabase
const supabaseUrl = 'https://snruccregkwcsnptojvw.supabase.co';
const supabaseKey = 'snruccregkwcsnptojvw';

export const supabase = createClient(supabaseUrl, supabaseKey);
