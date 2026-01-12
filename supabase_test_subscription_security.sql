-- ============================================================================
-- בדיקות אבטחה למערכת Subscriptions
-- ============================================================================
-- מטרה: לוודא שכל הדרישות מתקיימות
-- ============================================================================

-- ============================================================================
-- בדיקה 1: משתמש מחובר לא יכול לראות subscription של אחר
-- ============================================================================

-- בדיקה: משתמש A לא יכול לראות subscription של משתמש B
-- זה אמור לעבוד אוטומטית דרך RLS policy "Users can read own subscription"

-- בדיקה ידנית (יש להריץ עם anon key של משתמש מסוים):
-- SELECT * FROM public.user_subscriptions WHERE user_id != auth.uid();
-- זה אמור להחזיר 0 שורות

-- ============================================================================
-- בדיקה 2: refresh לא משנה plan
-- ============================================================================

-- בדיקה: משתמש לא יכול לעדכן את plan_type שלו
-- זה אמור להיכשל עם anon key:
-- UPDATE public.user_subscriptions 
-- SET plan_type = 'creators_extreme' 
-- WHERE user_id = auth.uid();
-- זה אמור להיכשל - רק service_role יכול

-- ============================================================================
-- בדיקה 3: logout/login שומר חבילה
-- ============================================================================

-- זה תלוי ב-policy של UPDATE - אם רק service_role יכול לעדכן,
-- אז logout/login לא ישנה את החבילה (כי זה לא מעדכן את הטבלה)

-- בדיקה: לאחר logout/login, החבילה נשארת זהה
-- זה אמור לעבוד אוטומטית כי אין policy שמאפשרת למשתמש לעדכן

-- ============================================================================
-- בדיקה 4: אין subscription בלי בחירה
-- ============================================================================

-- בדיקה: יצירת משתמש חדש בלי plan_type ב-metadata לא יוצר subscription
-- זה אמור לעבוד דרך trigger handle_new_user_subscription

-- דוגמה:
-- INSERT INTO auth.users (id, email, raw_user_meta_data)
-- VALUES (
--   gen_random_uuid(),
--   'test@example.com',
--   '{}'::jsonb  -- אין plan_type
-- );
-- זה לא אמור ליצור subscription

-- ============================================================================
-- בדיקה 5: שינוי plan אפשרי רק דרך admin/service
-- ============================================================================

-- בדיקה: רק service_role יכול לעדכן plan_type
-- זה אמור לעבוד דרך RLS policy "Service role can update subscriptions"

-- דוגמה (עם service_role key):
-- UPDATE public.user_subscriptions 
-- SET plan_type = 'coach' 
-- WHERE user_id = 'some-user-id';
-- זה אמור לעבוד רק עם service_role key

-- ============================================================================
-- בדיקות אוטומטיות (יש להריץ עם service_role)
-- ============================================================================

-- בדיקה 1: וידוא ש-RLS מופעל
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'user_subscriptions';

-- בדיקה 2: רשימת כל ה-policies
SELECT 
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'user_subscriptions'
ORDER BY cmd, policyname;

-- בדיקה 3: וידוא שאין policy ל-DELETE
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'user_subscriptions'
  AND cmd = 'DELETE';
-- זה אמור להחזיר 0 שורות

-- בדיקה 4: וידוא ש-trigger קיים
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth'
  AND trigger_name = 'on_auth_user_created_subscription';

-- בדיקה 5: וידוא שה-ENUMs קיימים
SELECT 
  typname as enum_name,
  array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('plan_type', 'subscription_status')
GROUP BY typname;

-- ============================================================================
-- בדיקות נוספות
-- ============================================================================

-- בדיקה: וידוא שאין default ל-plan_type
SELECT 
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_subscriptions'
  AND column_name = 'plan_type';
-- column_default צריך להיות NULL

-- בדיקה: וידוא שיש foreign key ל-auth.users
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
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
-- סיכום
-- ============================================================================
-- כל הבדיקות האלה אמורות לעבור אם ה-migration הופעל נכון
-- ============================================================================

