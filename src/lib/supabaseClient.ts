import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client Configuration
 * 
 * Environment Variables:
 * - VITE_SUPABASE_URL: Loaded from .env.local (automatically by Vite)
 * - VITE_SUPABASE_ANON_KEY: Loaded from .env.local (automatically by Vite)
 * 
 * Note: Vite automatically loads .env.local and exposes variables prefixed with VITE_
 * to client code via import.meta.env
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// יצירת Supabase client
let supabase;

// בדיקה אם המשתנים קיימים
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please check your .env.local file and ensure it contains:');
  console.error('  VITE_SUPABASE_URL=your_supabase_url');
  console.error('  VITE_SUPABASE_ANON_KEY=your_supabase_anon_key');
  
  // במקום לזרוק שגיאה, ניצור client עם ערכים placeholder
  // זה יאפשר לאפליקציה להיטען ולהציג הודעה למשתמש
  const errorMessage = 'Missing Supabase configuration. Please check .env.local file.';
  console.error(errorMessage);
  
  // יצירת client עם ערכים placeholder (לא יעבוד, אבל יאפשר לאפליקציה להיטען)
  supabase = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key'
  );
  
  // הוספת flag לזיהוי שהקונפיגורציה לא תקינה
  (supabase as any).__configError = errorMessage;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

