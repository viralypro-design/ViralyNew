-- ============================================================================
-- בדיקה מלאה: תהליך רישום משתמש, בחירת חבילה ותחום, ובדיקת עדכון
-- ============================================================================
-- מייל: maorcomp@gmail.com
-- חבילה: trial
-- תחום: musicians (זמרים ומוזיקאים)
-- ============================================================================

-- שלב 1: בדיקה אם המשתמש קיים
-- ============================================================================
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data->>'plan_type' as plan_type_from_metadata
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

-- שלב 4: בדיקה אם ה-RPC function קיים ופועל
-- ============================================================================
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'update_user_default_track';

-- שלב 5: בדיקת RLS policies
-- ============================================================================
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_subscriptions'
ORDER BY policyname;

-- ============================================================================
-- הערות:
-- ============================================================================
-- 1. אם המשתמש כבר קיים - צריך למחוק אותו או לעדכן את ה-subscription שלו
-- 2. אם אין subscription - צריך ליצור אותו ידנית (רק service_role יכול)
-- 3. אם יש subscription - צריך לעדכן את ה-default_track ל-musicians
-- 4. אחרי הרישום - צריך לבדוק שהחבילה והתחום מעודכנים נכון
-- ============================================================================

-- ============================================================================
-- הוראות לבדיקה ידנית בדפדפן:
-- ============================================================================
-- 1. פתח את האפליקציה: http://localhost:3000
-- 2. לחץ על "התחבר / הרשם"
-- 3. בחר טאב "הרשמה"
-- 4. הזן:
--    - אימייל: maorcomp@gmail.com
--    - סיסמה: Test123456
--    - אימות סיסמה: Test123456
-- 5. ודא שהחבילה היא "ניסיון" (trial)
-- 6. בחר תחום: "זמרים ומוזיקאים" (musicians) מה-dropdown
-- 7. לחץ על "הרשמה"
-- 8. המתן שהרישום יושלם
-- 9. אחרי הכניסה - בדוק שהחבילה והתחום נטענו נכון
-- ============================================================================

