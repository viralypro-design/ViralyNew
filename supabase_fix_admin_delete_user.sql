-- ============================================================================
-- Fix: Admin Panel - Delete User and Update Functions
-- ============================================================================
-- Purpose: תיקון פונקציות פאנל אדמין למחיקת משתמשים ועדכון ישיר מול Supabase
-- ============================================================================

BEGIN;

-- ============================================================================
-- שלב 1: תיקון הפונקציה delete_admin_user() - מחיקת משתמש מ-auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- בדיקה אם המשתמש הוא אדמין
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- מחיקת הנתונים הקשורים למשתמש
  DELETE FROM public.user_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.analyses WHERE user_id = p_user_id;
  DELETE FROM public.videos WHERE user_id = p_user_id;
  DELETE FROM public.user_updates WHERE user_id = p_user_id;
  DELETE FROM public.user_benefits WHERE user_id = p_user_id;
  
  -- מחיקת המשתמש עצמו מ-auth.users
  DELETE FROM auth.users WHERE id = p_user_id;
  
  -- החזרת true כדי לציין שהפעולה בוצעה
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.delete_admin_user IS 'מוחק משתמש וכל הנתונים הקשורים (לאדמין בלבד) - כולל מחיקה מ-auth.users';

-- ============================================================================
-- שלב 2: יצירת פונקציה לעדכון חבילת משתמש (לאדמין בלבד)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_plan_admin(
  p_user_id uuid,
  p_plan_type plan_type
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.update_user_plan_admin IS 'מעדכן חבילת משתמש (לאדמין בלבד) - כולל עדכון ב-user_subscriptions ו-metadata';

-- ============================================================================
-- שלב 3: יצירת פונקציה לעדכון תפקיד משתמש (לאדמין בלבד)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id uuid,
  p_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.update_user_role IS 'מעדכן תפקיד משתמש (לאדמין בלבד) - כולל עדכון metadata';

-- ============================================================================
-- שלב 4: יצירת פונקציה לעדכון הטבה (לאדמין בלבד)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_benefit(
  p_benefit_id uuid,
  p_benefit_data jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- בדיקה אם המשתמש הוא אדמין
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- עדכון ההטבה
  UPDATE public.benefits
  SET 
    benefit_type = COALESCE((p_benefit_data->>'benefit_type')::benefit_type, benefit_type),
    title = COALESCE(p_benefit_data->>'title', title),
    description = COALESCE(p_benefit_data->>'description', description),
    plan_type = COALESCE((p_benefit_data->>'plan_type')::plan_type, plan_type),
    discount_percentage = COALESCE((p_benefit_data->>'discount_percentage')::integer, discount_percentage),
    free_analyses_count = COALESCE((p_benefit_data->>'free_analyses_count')::integer, free_analyses_count),
    free_days = COALESCE((p_benefit_data->>'free_days')::integer, free_days),
    coupon_code = COALESCE(p_benefit_data->>'coupon_code', coupon_code),
    coupon_valid_until = COALESCE((p_benefit_data->>'coupon_valid_until')::timestamptz, coupon_valid_until),
    is_active = COALESCE((p_benefit_data->>'is_active')::boolean, is_active),
    updated_at = now()
  WHERE id = p_benefit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Benefit not found';
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.update_benefit IS 'מעדכן הטבה (לאדמין בלבד)';

-- ============================================================================
-- שלב 5: יצירת פונקציה למחיקת הטבה (לאדמין בלבד)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_benefit(p_benefit_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- בדיקה אם המשתמש הוא אדמין
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- מחיקת ההטבה
  DELETE FROM public.benefits WHERE id = p_benefit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Benefit not found';
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.delete_benefit IS 'מוחק הטבה (לאדמין בלבד)';

-- ============================================================================
-- שלב 6: יצירת פונקציה להקצאת הטבה למשתמש (לאדמין בלבד)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_benefit_to_user(
  p_user_id uuid,
  p_benefit_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- בדיקה אם המשתמש הוא אדמין
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- בדיקה שההטבה קיימת ופעילה
  IF NOT EXISTS (
    SELECT 1 FROM public.benefits 
    WHERE id = p_benefit_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Benefit not found or not active';
  END IF;

  -- בדיקה שהמשתמש קיים
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- הקצאת ההטבה למשתמש (אם עדיין לא קיימת)
  INSERT INTO public.user_benefits (user_id, benefit_id, is_used)
  VALUES (p_user_id, p_benefit_id, false)
  ON CONFLICT (user_id, benefit_id) DO NOTHING;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.assign_benefit_to_user IS 'מקצה הטבה למשתמש (לאדמין בלבד)';

COMMIT;

