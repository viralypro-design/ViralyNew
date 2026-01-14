-- ============================================================================
-- תיקון מיידי: בדיקת טריגר + יצירת subscription למשתמש שנרשם
-- ============================================================================
-- User ID: 08608158-5604-4415-b045-655890779a3b
-- Email: maorcomp@gmail.com
-- ============================================================================

BEGIN;

-- ============================================================================
-- שלב 1: בדיקה שהטריגר קיים ו-תיקון אם צריך
-- ============================================================================

-- בדיקה אם הפונקציה קיימת
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user_subscription'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE WARNING 'Function does not exist! Creating it...';
    
    -- יצירת הפונקציה
    CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    DECLARE
      selected_plan_type plan_type;
    BEGIN
      -- בדיקה אם יש plan_type ב-raw_user_meta_data
      IF NEW.raw_user_meta_data IS NULL OR 
         NEW.raw_user_meta_data->>'plan_type' IS NULL THEN
        RETURN NEW;
      END IF;
      
      -- ניסיון להמיר את plan_type ל-enum
      BEGIN
        selected_plan_type := (NEW.raw_user_meta_data->>'plan_type')::plan_type;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Invalid plan_type in user metadata: %', NEW.raw_user_meta_data->>'plan_type';
        RETURN NEW;
      END;
      
      -- בדיקה אם כבר יש subscription
      IF EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.id) THEN
        RETURN NEW;
      END IF;
      
      -- יצירת subscription חדש
      INSERT INTO public.user_subscriptions (
        user_id,
        plan_type,
        status,
        minutes_used_monthly,
        analyses_used_monthly
      ) VALUES (
        NEW.id,
        selected_plan_type,
        'active',
        0,
        0
      );
      
      RETURN NEW;
    END;
    $func$;
    
    RAISE NOTICE '✅ Function created';
  ELSE
    RAISE NOTICE '✅ Function exists';
  END IF;
END $$;

-- בדיקה אם הטריגר קיים
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created_subscription'
    AND tgrelid = (SELECT oid FROM pg_class WHERE relname = 'users' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth'))
  ) THEN
    RAISE WARNING 'Trigger does not exist! Creating it...';
    
    CREATE TRIGGER on_auth_user_created_subscription
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user_subscription();
    
    RAISE NOTICE '✅ Trigger created';
  ELSE
    RAISE NOTICE '✅ Trigger exists';
  END IF;
END $$;

-- ============================================================================
-- שלב 2: יצירת subscription למשתמש שנרשם (אם אין)
-- ============================================================================

DO $$
DECLARE
  v_user_id uuid := '08608158-5604-4415-b045-655890779a3b'::uuid;
  v_plan_type text;
  v_has_subscription boolean;
BEGIN
  -- בדיקה אם יש subscription
  SELECT EXISTS(SELECT 1 FROM public.user_subscriptions WHERE user_id = v_user_id)
  INTO v_has_subscription;
  
  IF v_has_subscription THEN
    RAISE NOTICE 'Subscription already exists for this user';
  ELSE
    -- קבלת plan_type מה-metadata
    SELECT raw_user_meta_data->>'plan_type' INTO v_plan_type
    FROM auth.users
    WHERE id = v_user_id;
    
    -- אם אין plan_type ב-metadata, השתמש ב-trial
    IF v_plan_type IS NULL THEN
      v_plan_type := 'trial';
      RAISE NOTICE 'No plan_type in metadata, using trial';
    END IF;
    
    -- יצירת subscription
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_type,
      status,
      minutes_used_monthly,
      analyses_used_monthly,
      default_track
    ) VALUES (
      v_user_id,
      v_plan_type::plan_type,
      'active',
      0,
      0,
      'musicians' -- התחום שנבחר ברישום
    );
    
    RAISE NOTICE '✅ Subscription created successfully';
  END IF;
END $$;

-- ============================================================================
-- שלב 3: הצגת התוצאה
-- ============================================================================

SELECT 
  'User Info' as info_type,
  u.email,
  u.id::text as user_id,
  u.raw_user_meta_data->>'plan_type' as metadata_plan_type,
  u.created_at as user_created_at
FROM auth.users u
WHERE u.id = '08608158-5604-4415-b045-655890779a3b'::uuid

UNION ALL

SELECT 
  'Subscription Info' as info_type,
  u.email,
  us.user_id::text,
  us.plan_type::text,
  us.created_at
FROM auth.users u
JOIN public.user_subscriptions us ON u.id = us.user_id
WHERE u.id = '08608158-5604-4415-b045-655890779a3b'::uuid;

-- הצגת פרטי subscription מלאים
SELECT 
  us.*,
  u.email
FROM public.user_subscriptions us
JOIN auth.users u ON us.user_id = u.id
WHERE us.user_id = '08608158-5604-4415-b045-655890779a3b'::uuid;

COMMIT;

