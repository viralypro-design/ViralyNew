-- ============================================================================
-- יצירת Subscription למשתמש קיים - תיקון מיידי
-- ============================================================================
-- Purpose: ליצור subscription למשתמש שנרשם אבל הטריגר לא יצר subscription
-- User ID: 08608158-5604-4415-b045-655890779a3b
-- Email: maorcomp@gmail.com
-- ============================================================================

BEGIN;

-- יצירת subscription ישירות
INSERT INTO public.user_subscriptions (
  user_id,
  plan_type,
  status,
  minutes_used_monthly,
  analyses_used_monthly,
  default_track
) 
SELECT 
  '08608158-5604-4415-b045-655890779a3b'::uuid,
  COALESCE(
    (raw_user_meta_data->>'plan_type')::plan_type,
    'trial'::plan_type
  ),
  'active',
  0,
  0,
  'musicians' -- התחום שנבחר ברישום
FROM auth.users
WHERE id = '08608158-5604-4415-b045-655890779a3b'::uuid
ON CONFLICT (user_id) 
DO UPDATE SET
  plan_type = COALESCE(
    EXCLUDED.plan_type,
    (SELECT (raw_user_meta_data->>'plan_type')::plan_type FROM auth.users WHERE id = '08608158-5604-4415-b045-655890779a3b'::uuid),
    user_subscriptions.plan_type
  ),
  status = 'active',
  default_track = COALESCE(EXCLUDED.default_track, user_subscriptions.default_track, 'musicians'),
  updated_at = now();

-- הצגת התוצאה
SELECT 
  u.email,
  u.id as user_id,
  u.raw_user_meta_data->>'plan_type' as metadata_plan_type,
  us.plan_type,
  us.status,
  us.default_track,
  us.minutes_used_monthly,
  us.analyses_used_monthly,
  us.created_at,
  us.updated_at
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
WHERE u.id = '08608158-5604-4415-b045-655890779a3b'::uuid;

COMMIT;

