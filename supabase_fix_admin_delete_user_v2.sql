-- ============================================================================
-- Fix: Admin Panel - Delete User V2 (Enhanced)
-- ============================================================================
-- Purpose: תיקון משופר של פונקציית מחיקת משתמש עם בדיקות נוספות
-- ============================================================================

BEGIN;

-- ============================================================================
-- שלב 1: מחיקת הפונקציה הישנה ויצירת חדשה משופרת
-- ============================================================================

DROP FUNCTION IF EXISTS public.delete_admin_user(uuid);

CREATE OR REPLACE FUNCTION public.delete_admin_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_result jsonb;
  v_user_exists boolean;
  v_deleted_count integer := 0;
BEGIN
  -- בדיקה אם המשתמש הוא אדמין
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- בדיקה שהמשתמש קיים
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found',
      'deleted', false
    );
  END IF;

  -- מחיקת הנתונים הקשורים למשתמש (לפני מחיקת המשתמש עצמו)
  -- סדר המחיקה חשוב בגלל foreign keys
  
  -- 1. מחיקת user_benefits
  DELETE FROM public.user_benefits WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- 2. מחיקת user_updates
  DELETE FROM public.user_updates WHERE user_id = p_user_id;
  
  -- 3. מחיקת analyses
  DELETE FROM public.analyses WHERE user_id = p_user_id;
  
  -- 4. מחיקת videos
  DELETE FROM public.videos WHERE user_id = p_user_id;
  
  -- 5. מחיקת user_subscriptions
  DELETE FROM public.user_subscriptions WHERE user_id = p_user_id;
  
  -- 6. מחיקת המשתמש עצמו מ-auth.users
  -- הערה: בגלל RLS, צריך להשתמש ב-SECURITY DEFINER עם search_path נכון
  DELETE FROM auth.users WHERE id = p_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- בדיקה שהמשתמש נמחק
  SELECT NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF v_user_exists THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'User deleted successfully',
      'deleted', true
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User deletion failed - user still exists',
      'deleted', false
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM,
      'deleted', false,
      'error_code', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION public.delete_admin_user IS 'מוחק משתמש וכל הנתונים הקשורים (לאדמין בלבד) - גרסה משופרת עם בדיקות';

-- ============================================================================
-- שלב 2: וידוא שהפונקציות האחרות עובדות ישירות מול Supabase
-- ============================================================================

-- וידוא שהפונקציה update_user_plan_admin עובדת
CREATE OR REPLACE FUNCTION public.update_user_plan_admin(
  p_user_id uuid,
  p_plan_type plan_type
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- בדיקה אם המשתמש הוא אדמין
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- עדכון החבילה ב-user_subscriptions
  UPDATE public.user_subscriptions
  SET plan_type = p_plan_type,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- אם אין subscription, צור אחד חדש
  IF NOT FOUND THEN
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_type,
      status,
      minutes_used_monthly,
      analyses_used_monthly
    ) VALUES (
      p_user_id,
      p_plan_type,
      'active',
      0,
      0
    );
  END IF;

  -- עדכון ה-metadata של המשתמש
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{plan_type}',
    to_jsonb(p_plan_type::text)
  ),
  updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Plan updated successfully'
  );
END;
$$;

-- וידוא שהפונקציה update_user_role עובדת
CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- בדיקה אם המשתמש הוא אדמין
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- בדיקה שהתפקיד תקין
  IF p_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid role. Must be "user" or "admin"';
  END IF;

  -- עדכון ה-metadata של המשתמש
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(p_role)
  ),
  updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role updated successfully'
  );
END;
$$;

COMMIT;

