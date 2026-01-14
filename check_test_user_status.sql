-- ============================================================================
-- בדיקת סטטוס משתמש הבדיקות
-- ============================================================================
-- Email: viralytest@test.com
-- ============================================================================

-- בדיקה 1: מידע על המשתמש
SELECT 
  id,
  email,
  raw_user_meta_data,
  raw_user_meta_data->>'plan_type' as metadata_plan_type,
  created_at,
  updated_at
FROM auth.users
WHERE email = 'viralytest@test.com';

-- בדיקה 2: Subscription של המשתמש
SELECT 
  us.*,
  u.email
FROM public.user_subscriptions us
JOIN auth.users u ON us.user_id = u.id
WHERE u.email = 'viralytest@test.com';

-- בדיקה 3: אם אין subscription, ניצור אחד
DO $$
DECLARE
  v_user_id uuid;
  v_subscription_exists boolean;
BEGIN
  -- מציאת המשתמש
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'viralytest@test.com'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️  User viralytest@test.com not found!';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Found user: %', v_user_id;
  
  -- בדיקה אם יש subscription
  SELECT EXISTS(SELECT 1 FROM public.user_subscriptions WHERE user_id = v_user_id)
  INTO v_subscription_exists;
  
  IF NOT v_subscription_exists THEN
    RAISE NOTICE '⚠️  No subscription found. Creating one...';
    
    -- יצירת subscription עם חבילת trial
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_type,
      status,
      minutes_used_monthly,
      analyses_used_monthly,
      default_track
    ) VALUES (
      v_user_id,
      'trial'::plan_type,
      'active',
      0,
      0,
      'actors' -- ברירת מחדל
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE '✅ Subscription created';
  ELSE
    RAISE NOTICE '✅ Subscription already exists';
  END IF;
END $$;

-- הצגת התוצאה הסופית
SELECT 
  u.email,
  u.id as user_id,
  us.plan_type,
  us.status,
  us.default_track,
  us.minutes_used_monthly,
  us.analyses_used_monthly,
  us.created_at,
  us.updated_at
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
WHERE u.email = 'viralytest@test.com';

