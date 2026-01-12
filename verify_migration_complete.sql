-- ============================================================================
-- בדיקות מלאות לוידוא שהמיגרציה הופעלה בהצלחה
-- ============================================================================
-- הרץ את כל השאילתות האלה ב-SQL Editor של Supabase Dashboard
-- ============================================================================

-- ============================================================================
-- בדיקה 1: האם הטבלה user_subscriptions קיימת
-- ============================================================================
SELECT 
  table_name,
  table_schema,
  '✅ טבלה קיימת' as status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'user_subscriptions';

-- ============================================================================
-- בדיקה 2: האם ה-ENUMs קיימים
-- ============================================================================
SELECT 
  typname as enum_name,
  array_agg(enumlabel ORDER BY enumsortorder) as enum_values,
  '✅ ENUM קיים' as status
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('plan_type', 'subscription_status')
GROUP BY typname;

-- ============================================================================
-- בדיקה 3: מבנה הטבלה - כל העמודות
-- ============================================================================
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default,
  CASE 
    WHEN column_name = 'user_id' AND is_nullable = 'NO' THEN '✅ Primary Key'
    WHEN column_name = 'plan_type' AND is_nullable = 'NO' THEN '✅ חובה, אין default'
    WHEN column_name = 'status' AND column_default IS NOT NULL THEN '✅ עם default'
    ELSE '✅ תקין'
  END as validation
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_subscriptions'
ORDER BY ordinal_position;

-- ============================================================================
-- בדיקה 4: RLS מופעל
-- ============================================================================
SELECT 
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity = true THEN '✅ RLS מופעל'
    ELSE '❌ RLS לא מופעל'
  END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'user_subscriptions';

-- ============================================================================
-- בדיקה 5: Policies - צריך להיות 3 policies
-- ============================================================================
SELECT 
  policyname,
  cmd as command,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ משתמש יכול לקרוא רק את עצמו'
    WHEN cmd = 'INSERT' THEN '✅ רק service_role יכול ליצור'
    WHEN cmd = 'UPDATE' THEN '✅ רק service_role יכול לעדכן'
    ELSE '✅ תקין'
  END as description
FROM pg_policies
WHERE tablename = 'user_subscriptions'
ORDER BY cmd, policyname;

-- בדיקה: וידוא שאין policy ל-DELETE
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ DELETE חסום (אין policy)'
    ELSE '❌ יש policy ל-DELETE - צריך למחוק!'
  END as delete_policy_status
FROM pg_policies
WHERE tablename = 'user_subscriptions'
  AND cmd = 'DELETE';

-- ============================================================================
-- בדיקה 6: Trigger על auth.users
-- ============================================================================
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  CASE 
    WHEN trigger_name = 'on_auth_user_created_subscription' THEN '✅ Trigger קיים'
    ELSE '❌ Trigger לא קיים'
  END as status
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth'
  AND trigger_name = 'on_auth_user_created_subscription';

-- ============================================================================
-- בדיקה 7: Functions - צריך להיות 3 functions
-- ============================================================================
SELECT 
  routine_name,
  routine_type,
  CASE 
    WHEN routine_name = 'handle_new_user_subscription' THEN '✅ Function ליצירת subscription בהרשמה'
    WHEN routine_name = 'update_user_subscriptions_updated_at' THEN '✅ Function לעדכון updated_at'
    WHEN routine_name = 'can_user_run_analysis' THEN '✅ Function לבדיקת הרשאות'
    ELSE '✅ Function קיים'
  END as description
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_user_subscription', 'update_user_subscriptions_updated_at', 'can_user_run_analysis')
ORDER BY routine_name;

-- ============================================================================
-- בדיקה 8: Indexes - צריך להיות 2 indexes
-- ============================================================================
SELECT 
  indexname,
  tablename,
  CASE 
    WHEN indexname LIKE '%status%' THEN '✅ Index על status'
    WHEN indexname LIKE '%plan_type%' THEN '✅ Index על plan_type'
    ELSE '✅ Index קיים'
  END as description
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_subscriptions'
ORDER BY indexname;

-- ============================================================================
-- בדיקה 9: Foreign Key ל-auth.users
-- ============================================================================
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  '✅ Foreign Key תקין' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'user_subscriptions'
  AND ccu.table_name = 'users';

-- ============================================================================
-- סיכום - ספירת כל הרכיבים
-- ============================================================================
SELECT 
  'סיכום' as category,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_subscriptions') as tables,
  (SELECT COUNT(*) FROM pg_type WHERE typname IN ('plan_type', 'subscription_status')) as enums,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_subscriptions') as policies,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created_subscription') as triggers,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN ('handle_new_user_subscription', 'update_user_subscriptions_updated_at', 'can_user_run_analysis')) as functions,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'user_subscriptions') as indexes;

-- ============================================================================
-- בדיקה סופית: האם הכל תקין?
-- ============================================================================
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_subscriptions') = 1
     AND (SELECT COUNT(*) FROM pg_type WHERE typname IN ('plan_type', 'subscription_status')) = 2
     AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_subscriptions') = 3
     AND (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created_subscription') = 1
     AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN ('handle_new_user_subscription', 'update_user_subscriptions_updated_at', 'can_user_run_analysis')) = 3
    THEN '✅✅✅ כל הבדיקות עברו בהצלחה! המיגרציה הופעלה נכון.'
    ELSE '❌ יש בעיות - בדוק את התוצאות למעלה'
  END as final_status;

