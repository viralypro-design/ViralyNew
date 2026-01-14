-- ============================================================================
-- RPC Function: Create User Subscription
-- ============================================================================
-- Purpose: ליצור subscription חדש למשתמש (כשהטריגר לא רץ)
-- Usage: SELECT * FROM create_user_subscription(user_id, plan_type, default_track);
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_user_subscription(
  p_user_id uuid,
  p_plan_type plan_type,
  p_default_track text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id uuid;
  v_result jsonb;
BEGIN
  -- בדיקה אם המשתמש קיים
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- בדיקה אם כבר יש subscription למשתמש הזה
  IF EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Subscription already exists for this user'
    );
  END IF;
  
  -- בדיקה אם plan_type תקין
  BEGIN
    -- נסה להמיר את plan_type ל-enum (validation)
    PERFORM p_plan_type::plan_type;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid plan_type: ' || p_plan_type::text
    );
  END;
  
  -- בדיקה אם default_track תקין (אם ניתן)
  IF p_default_track IS NOT NULL THEN
    IF p_default_track NOT IN ('actors', 'musicians', 'creators', 'influencers') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid default_track: ' || p_default_track
      );
    END IF;
  END IF;
  
  -- יצירת subscription חדש
  INSERT INTO public.user_subscriptions (
    user_id,
    plan_type,
    status,
    minutes_used_monthly,
    analyses_used_monthly,
    default_track
  ) VALUES (
    p_user_id,
    p_plan_type,
    'active',
    0,
    0,
    p_default_track
  )
  RETURNING user_id INTO v_subscription_id;
  
  -- החזרת תוצאה
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_subscription_id,
    'plan_type', p_plan_type::text,
    'default_track', p_default_track
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION public.create_user_subscription IS 
  'יוצר subscription חדש למשתמש. משמש כגיבוי כשהטריגר לא רץ.';

-- הרשאות: רק משתמש מחובר יכול ליצור subscription לעצמו
-- (אבל בפועל, זה SECURITY DEFINER אז זה רץ עם הרשאות service_role)

