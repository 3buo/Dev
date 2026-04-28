// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Reemplaza estas dos variables con los datos de tu Dashboard de Supabase
const supabaseUrl = 'https://snruccregkwcsnptojvw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNucnVjY3JlZ2t3Y3NucHRvanZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjE5MDUsImV4cCI6MjA5Mjg5NzkwNX0.1Tl9DKHx8LMrHisaNvktl9fW3P0KRJnlVdQH3pdEMYo';

export const supabase = createClient(supabaseUrl, supabaseKey);
