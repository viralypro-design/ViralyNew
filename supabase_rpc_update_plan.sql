-- ============================================================================
-- RPC Function: עדכון plan_type ישירות מהאפליקציה
-- ============================================================================
-- מטרה: לאפשר למשתמש לעדכן את החבילה שלו ישירות מהאפליקציה
-- בטיחות: רק המשתמש עצמו יכול לעדכן את החבילה שלו
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_plan_type(new_plan_type plan_type)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  updated_subscription jsonb;
BEGIN
  -- קבלת user_id של המשתמש המחובר
  current_user_id := auth.uid();
  
  -- בדיקה שהמשתמש מחובר
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'לא מחובר. נא להתחבר תחילה.'
    );
  END IF;
  
  -- בדיקה שהחבילה החדשה תקינה
  IF new_plan_type NOT IN ('trial', 'creators', 'creators_extreme', 'coach', 'coach_pro') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'סוג חבילה לא תקין'
    );
  END IF;
  
  -- בדיקה שיש subscription למשתמש
  IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = current_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'אין subscription פעיל. נא ליצור subscription תחילה.'
    );
  END IF;
  
  -- עדכון החבילה
  UPDATE public.user_subscriptions
  SET plan_type = new_plan_type,
      updated_at = now()
  WHERE user_id = current_user_id;
  
  -- החזרת הנתונים המעודכנים
  SELECT row_to_json(us.*)::jsonb
  INTO updated_subscription
  FROM public.user_subscriptions us
  WHERE us.user_id = current_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription', updated_subscription
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION public.update_user_plan_type(plan_type) IS 
  'RPC function לעדכון plan_type ישירות מהאפליקציה - רק המשתמש עצמו יכול לעדכן את החבילה שלו';

-- מתן הרשאות
GRANT EXECUTE ON FUNCTION public.update_user_plan_type(plan_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_plan_type(plan_type) TO anon;

