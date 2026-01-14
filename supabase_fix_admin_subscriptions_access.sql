-- ============================================================================
-- Fix: תיקון גישת אדמין ל-user_subscriptions
-- ============================================================================
-- Purpose: וידוא שמשתמש אדמין יכול לגשת ל-user_subscriptions
-- Problem: 406 Not Acceptable - Policy לא מאפשרת גישה
-- ============================================================================

BEGIN;

-- ============================================================================
-- שלב 1: וידוא שהפונקציה is_admin() עובדת נכון
-- ============================================================================

-- אם הפונקציה לא קיימת, צור אותה
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
-- שלב 2: מחיקת Policy קיימת (אם יש) ויצירת חדשה
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;

-- Policy לאדמין - יכול לראות את כל ה-subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  USING (public.is_admin());

COMMENT ON POLICY "Admins can view all subscriptions" ON public.user_subscriptions IS 
  'אדמין יכול לראות את כל המנויים - כולל שלו עצמו';

-- ============================================================================
-- שלב 3: בדיקה שהכל עובד
-- ============================================================================

-- בדיקה שהפונקציה is_admin() עובדת
-- הרץ את זה ידנית עם המשתמש האדמין:
-- SELECT public.is_admin();

-- בדיקה שה-Policy נוצרה
-- SELECT 
--   tablename,
--   policyname,
--   cmd
-- FROM pg_policies
-- WHERE tablename = 'user_subscriptions'
-- AND policyname = 'Admins can view all subscriptions';

COMMIT;

-- ============================================================================
-- הערות:
-- ============================================================================
-- 1. Policy זו מאפשרת לאדמין לראות את כל ה-subscriptions
-- 2. Policy "Users can read own subscription" עדיין קיימת ומאפשרת למשתמשים רגילים לראות רק את שלהם
-- 3. אם יש שתי Policies, Supabase משתמש ב-OR - כלומר אם אחת מהן true, הגישה מותרת
-- 4. לכן אדמין יכול לראות את כל ה-subscriptions (כולל שלו עצמו)

