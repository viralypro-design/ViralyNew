-- ============================================================================
-- Fix Subscription for maorcomp@gmail.com
-- ============================================================================
-- Purpose: ליצור subscription עבור המשתמש maorcomp@gmail.com
-- ============================================================================

BEGIN;

-- מציאת ה-user_id של המשתמש
DO $$
DECLARE
  v_user_id uuid;
  v_plan_type text;
  v_subscription_exists boolean;
BEGIN
  -- מציאת המשתמש
  SELECT id, raw_user_meta_data->>'plan_type' INTO v_user_id, v_plan_type
  FROM auth.users
  WHERE email = 'maorcomp@gmail.com'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User maorcomp@gmail.com not found!';
  END IF;
  
  RAISE NOTICE 'Found user: %', v_user_id;
  RAISE NOTICE 'Plan type from metadata: %', v_plan_type;
  
  -- בדיקה אם כבר יש subscription
  SELECT EXISTS(SELECT 1 FROM public.user_subscriptions WHERE user_id = v_user_id)
  INTO v_subscription_exists;
  
  IF v_subscription_exists THEN
    RAISE NOTICE 'User already has a subscription. Updating if needed...';
    
    -- עדכון אם צריך
    UPDATE public.user_subscriptions
    SET 
      plan_type = COALESCE(v_plan_type::plan_type, plan_type),
      status = 'active',
      updated_at = now()
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Subscription updated';
  ELSE
    -- יצירת subscription חדש
    IF v_plan_type IS NULL THEN
      RAISE WARNING 'No plan_type in metadata, using trial as default';
      v_plan_type := 'trial';
    END IF;
    
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_type,
      status,
      minutes_used_monthly,
      analyses_used_monthly
    ) VALUES (
      v_user_id,
      v_plan_type::plan_type,
      'active',
      0,
      0
    );
    
    RAISE NOTICE 'Subscription created successfully';
  END IF;
  
  -- הצגת התוצאה
  RAISE NOTICE 'Final subscription:';
  PERFORM * FROM public.user_subscriptions WHERE user_id = v_user_id;
END $$;

-- הצגת התוצאה הסופית
SELECT 
  u.email,
  us.plan_type,
  us.status,
  us.default_track,
  us.minutes_used_monthly,
  us.analyses_used_monthly,
  us.created_at,
  us.updated_at
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
WHERE u.email = 'maorcomp@gmail.com';

COMMIT;

