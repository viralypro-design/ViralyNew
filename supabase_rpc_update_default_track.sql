-- ============================================================================
-- RPC Function: Update User Default Track
-- ============================================================================
-- Purpose: עדכון תחום ברירת מחדל של משתמש
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_default_track(
  p_user_id uuid,
  p_default_track text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- בדיקה שהמשתמש קיים
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- בדיקה שהתחום תקין
  IF p_default_track NOT IN ('actors', 'musicians', 'creators', 'influencers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid track');
  END IF;
  
  -- עדכון default_track ב-user_subscriptions
  UPDATE public.user_subscriptions
  SET default_track = p_default_track
  WHERE user_id = p_user_id;
  
  -- אם אין subscription, לא עושים כלום (זה בסדר)
  
  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.update_user_default_track IS 'מעדכן תחום ברירת מחדל של משתמש';

