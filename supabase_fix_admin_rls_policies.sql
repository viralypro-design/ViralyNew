-- ============================================================================
-- Fix: תיקון RLS Policies לפאנל ניהול
-- ============================================================================
-- Purpose: תיקון ה-RLS Policies כך שיעבדו נכון עם אדמין
-- Problem: ה-Policies מנסות לגשת ישירות ל-auth.users מה-public schema
-- Solution: שימוש בפונקציה is_admin() עם SECURITY DEFINER
-- ============================================================================

BEGIN;

-- ============================================================================
-- שלב 1: תיקון הפונקציה is_admin() - הוספת auth schema ל-search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = COALESCE(p_user_id, auth.uid())
    AND (raw_user_meta_data->>'role')::text = 'admin'
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin IS 'בודק אם משתמש הוא אדמין - תוקן עם auth schema';

-- ============================================================================
-- שלב 2: מחיקת ה-Policies הישנות
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all analyses" ON public.analyses;
DROP POLICY IF EXISTS "Admins can view all videos" ON public.videos;
DROP POLICY IF EXISTS "Admins can manage benefits" ON public.benefits;
DROP POLICY IF EXISTS "Admins can view all user benefits" ON public.user_benefits;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;

-- ============================================================================
-- שלב 3: יצירת Policies חדשות שמשתמשות בפונקציה is_admin()
-- ============================================================================

-- Policy ל-analyses - אדמין יכול לראות הכל
CREATE POLICY "Admins can view all analyses"
  ON public.analyses
  FOR SELECT
  USING (public.is_admin());

COMMENT ON POLICY "Admins can view all analyses" ON public.analyses IS 
  'אדמין יכול לראות את כל הניתוחים';

-- Policy ל-videos - אדמין יכול לראות הכל
CREATE POLICY "Admins can view all videos"
  ON public.videos
  FOR SELECT
  USING (public.is_admin());

COMMENT ON POLICY "Admins can view all videos" ON public.videos IS 
  'אדמין יכול לראות את כל קבצי הוידאו';

-- Policy ל-benefits - אדמין יכול לנהל הכל
CREATE POLICY "Admins can manage benefits"
  ON public.benefits
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON POLICY "Admins can manage benefits" ON public.benefits IS 
  'אדמין יכול לנהל את כל ההטבות';

-- Policy ל-user_benefits - אדמין יכול לראות הכל
CREATE POLICY "Admins can view all user benefits"
  ON public.user_benefits
  FOR SELECT
  USING (public.is_admin());

COMMENT ON POLICY "Admins can view all user benefits" ON public.user_benefits IS 
  'אדמין יכול לראות את כל ההטבות של המשתמשים';

-- Policy ל-user_subscriptions - אדמין יכול לראות הכל
CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  USING (public.is_admin());

COMMENT ON POLICY "Admins can view all subscriptions" ON public.user_subscriptions IS 
  'אדמין יכול לראות את כל המנויים';

-- ============================================================================
-- שלב 4: תיקון הפונקציה get_admin_users() - הוספת auth schema
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  role text,
  plan_type plan_type
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- בדיקה אם המשתמש הוא אדמין
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    u.created_at,
    COALESCE((u.raw_user_meta_data->>'role')::text, 'user') as role,
    s.plan_type
  FROM auth.users u
  LEFT JOIN public.user_subscriptions s ON s.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_admin_users IS 'מחזיר רשימת כל המשתמשים (לאדמין בלבד) - תוקן עם auth schema';

-- ============================================================================
-- שלב 5: תיקון הפונקציה get_admin_stats() - הוספת auth schema
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  -- בדיקה אם המשתמש הוא אדמין
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'users_last_30_days', (
      SELECT COUNT(*) FROM auth.users 
      WHERE created_at > now() - interval '30 days'
    ),
    'total_analyses', (SELECT COUNT(*) FROM public.analyses),
    'total_videos', (SELECT COUNT(*) FROM public.videos),
    'total_admins', (
      SELECT COUNT(*) FROM auth.users 
      WHERE (raw_user_meta_data->>'role')::text = 'admin'
    ),
    'plan_distribution', (
      SELECT jsonb_object_agg(plan_type::text, count)
      FROM (
        SELECT plan_type, COUNT(*) as count
        FROM public.user_subscriptions
        GROUP BY plan_type
      ) sub
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

COMMENT ON FUNCTION public.get_admin_stats IS 'מחזיר סטטיסטיקות כללית לפאנל ניהול - תוקן עם auth schema';

-- ============================================================================
-- שלב 6: תיקון הפונקציה delete_admin_user() - הוספת auth schema
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
  -- הערה: מחיקת המשתמש עצמו מ-auth.users צריכה להיעשות דרך Supabase Dashboard או Admin API
  DELETE FROM public.user_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.analyses WHERE user_id = p_user_id;
  DELETE FROM public.videos WHERE user_id = p_user_id;
  DELETE FROM public.user_updates WHERE user_id = p_user_id;
  DELETE FROM public.user_benefits WHERE user_id = p_user_id;
  
  -- החזרת true כדי לציין שהפעולה בוצעה
  -- המשתמש עצמו צריך להימחק ידנית דרך Dashboard
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.delete_admin_user IS 'מוחק נתונים קשורים למשתמש (לאדמין בלבד) - תוקן עם auth schema';

COMMIT;

-- ============================================================================
-- בדיקה שהתיקון עבד
-- ============================================================================

-- בדיקה שהפונקציה is_admin() עובדת
SELECT 
  email,
  public.is_admin(id) as is_admin,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'viralypro@gmail.com';

-- בדיקה שה-Policies נוצרו
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('analyses', 'videos', 'benefits', 'user_benefits')
AND policyname LIKE '%Admin%'
ORDER BY tablename, policyname;

