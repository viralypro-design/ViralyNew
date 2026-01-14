-- ============================================================================
-- בדיקת סטטוס הטריגר - למה הוא לא רץ?
-- ============================================================================

-- בדיקה 1: האם הטריגר קיים?
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created_subscription';

-- בדיקה 2: האם הפונקציה קיימת?
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'handle_new_user_subscription'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- בדיקה 3: בדיקת משתמש ספציפי - מה יש ב-metadata?
SELECT 
  id,
  email,
  raw_user_meta_data,
  raw_user_meta_data->>'plan_type' as plan_type_from_metadata,
  created_at
FROM auth.users
WHERE id = '08608158-5604-4415-b045-655890779a3b'::uuid;

-- בדיקה 4: האם יש subscription?
SELECT 
  user_id,
  plan_type,
  status,
  default_track,
  created_at
FROM public.user_subscriptions
WHERE user_id = '08608158-5604-4415-b045-655890779a3b'::uuid;

-- בדיקה 5: בדיקת RLS policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_subscriptions'
  AND schemaname = 'public';

