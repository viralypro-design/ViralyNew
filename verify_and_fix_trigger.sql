-- ============================================================================
-- Verify and Fix Trigger for User Subscriptions
-- ============================================================================
-- Purpose: לבדוק ולתקן את הטריגר ליצירת subscription בעת הרשמה
-- ============================================================================

BEGIN;

-- ============================================================================
-- חלק 1: בדיקה שהפונקציה קיימת
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user_subscription'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE EXCEPTION 'Function handle_new_user_subscription does not exist!';
  ELSE
    RAISE NOTICE '✅ Function handle_new_user_subscription exists';
  END IF;
END $$;

-- ============================================================================
-- חלק 2: בדיקה שהטריגר קיים
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created_subscription'
    AND tgrelid = (SELECT oid FROM pg_class WHERE relname = 'users' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth'))
  ) THEN
    RAISE WARNING 'Trigger on_auth_user_created_subscription does not exist! Creating it...';
    
    -- יצירת הטריגר
    CREATE TRIGGER on_auth_user_created_subscription
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user_subscription();
    
    RAISE NOTICE '✅ Trigger created successfully';
  ELSE
    RAISE NOTICE '✅ Trigger on_auth_user_created_subscription exists';
  END IF;
END $$;

-- ============================================================================
-- חלק 3: וידוא שהפונקציה מוגדרת כ-SECURITY DEFINER
-- ============================================================================
DO $$
DECLARE
  v_prosecdef boolean;
BEGIN
  SELECT prosecdef INTO v_prosecdef
  FROM pg_proc
  WHERE proname = 'handle_new_user_subscription'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  IF v_prosecdef IS NULL THEN
    RAISE EXCEPTION 'Function handle_new_user_subscription not found';
  ELSIF NOT v_prosecdef THEN
    RAISE WARNING 'Function is not SECURITY DEFINER! Recreating...';
    
    -- יצירת הפונקציה מחדש עם SECURITY DEFINER
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
    
    RAISE NOTICE '✅ Function recreated with SECURITY DEFINER';
  ELSE
    RAISE NOTICE '✅ Function is SECURITY DEFINER';
  END IF;
END $$;

-- ============================================================================
-- חלק 4: בדיקה שהטבלה user_subscriptions קיימת
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_subscriptions'
  ) THEN
    RAISE EXCEPTION 'Table user_subscriptions does not exist!';
  ELSE
    RAISE NOTICE '✅ Table user_subscriptions exists';
  END IF;
END $$;

-- ============================================================================
-- חלק 5: בדיקה שהעמודה default_track קיימת (אם צריך)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_subscriptions' 
    AND column_name = 'default_track'
  ) THEN
    RAISE NOTICE '⚠️  Column default_track does not exist - this is OK if not needed yet';
  ELSE
    RAISE NOTICE '✅ Column default_track exists';
  END IF;
END $$;

-- ============================================================================
-- חלק 6: בדיקת משתמש קיים - האם יש לו subscription?
-- ============================================================================
-- בדיקה למשתמש maorcomp@gmail.com
DO $$
DECLARE
  v_user_id uuid;
  v_subscription_count integer;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'maorcomp@gmail.com'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'ℹ️  User maorcomp@gmail.com not found (this is OK if not created yet)';
  ELSE
    RAISE NOTICE '✅ User maorcomp@gmail.com found: %', v_user_id;
    
    SELECT COUNT(*) INTO v_subscription_count
    FROM public.user_subscriptions
    WHERE user_id = v_user_id;
    
    IF v_subscription_count = 0 THEN
      RAISE WARNING '⚠️  User has no subscription! Checking metadata...';
      
      -- בדיקת metadata
      DECLARE
        v_metadata jsonb;
      BEGIN
        SELECT raw_user_meta_data INTO v_metadata
        FROM auth.users
        WHERE id = v_user_id;
        
        IF v_metadata IS NULL OR v_metadata->>'plan_type' IS NULL THEN
          RAISE WARNING '⚠️  User metadata has no plan_type - trigger will not create subscription';
        ELSE
          RAISE WARNING '⚠️  User has plan_type in metadata but no subscription! This suggests trigger did not run.';
          RAISE WARNING '   Metadata plan_type: %', v_metadata->>'plan_type';
        END IF;
      END;
    ELSE
      RAISE NOTICE '✅ User has subscription';
    END IF;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- סיכום
-- ============================================================================
SELECT 
  'Trigger Status' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created_subscription'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT 
  'Function Status',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'handle_new_user_subscription'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END
UNION ALL
SELECT 
  'Table Status',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_subscriptions'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END;

