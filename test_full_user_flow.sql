-- ============================================================================
-- בדיקה מלאה: FLOW רישום משתמש חדש, כניסה ובדיקת חבילות
-- ============================================================================
-- מייל לבדיקה: maorcomp@gmail.com
-- ============================================================================

-- שלב 1: בדיקה אם המשתמש כבר קיים
-- ============================================================================
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data->>'plan_type' as plan_type_from_metadata,
  raw_user_meta_data->>'role' as role_from_metadata
FROM auth.users
WHERE email = 'maorcomp@gmail.com';

-- שלב 2: בדיקה אם יש subscription למשתמש
-- ============================================================================
SELECT 
  us.user_id,
  us.plan_type,
  us.status,
  us.default_track,
  us.minutes_used_monthly,
  us.analyses_used_monthly,
  us.created_at,
  us.updated_at,
  u.email
FROM public.user_subscriptions us
LEFT JOIN auth.users u ON u.id = us.user_id
WHERE u.email = 'maorcomp@gmail.com';

-- שלב 3: בדיקה אם הטור default_track קיים
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_subscriptions'
  AND column_name = 'default_track';

-- שלב 4: בדיקה אם ה-RPC function קיים
-- ============================================================================
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'update_user_default_track';

-- שלב 5: בדיקת RLS policies על user_subscriptions
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_subscriptions'
ORDER BY policyname;

-- שלב 6: בדיקת trigger ליצירת subscription
-- ============================================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth' 
  AND event_object_table = 'users'
  AND trigger_name LIKE '%subscription%';

-- ============================================================================
-- הוראות לבדיקה ידנית:
-- ============================================================================
-- 1. פתח את האפליקציה בדפדפן
-- 2. לחץ על "הרשמה"
-- 3. הזן את המייל: maorcomp@gmail.com
-- 4. בחר חבילה (trial או creators)
-- 5. בחר תחום (אם נדרש)
-- 6. השלם את הרישום
-- 7. התחבר עם המשתמש שנוצר
-- 8. בדוק שהחבילה נטענת נכון
-- 9. בדוק שהתחום נטען נכון
-- 10. בדוק שהדקות נכונות
-- ============================================================================

