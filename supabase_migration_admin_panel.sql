-- ============================================================================
-- Migration: Admin Panel System
-- ============================================================================
-- Purpose: יצירת מערכת פאנל ניהול מתקדם עם כל הטבלאות והפונקציות הנדרשות
-- Project: viralynew
-- ============================================================================

BEGIN;

-- ============================================================================
-- חלק 1: ENUMs
-- ============================================================================

-- ENUM לתפקידי משתמשים
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
    COMMENT ON TYPE user_role IS 'תפקידי משתמשים במערכת';
  END IF;
END $$;

-- ENUM לסוגי הטבות
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'benefit_type') THEN
    CREATE TYPE benefit_type AS ENUM (
      'free_week',
      'free_month',
      'discount_percentage',
      'free_analyses',
      'registration_coupon'
    );
    COMMENT ON TYPE benefit_type IS 'סוגי הטבות זמינות במערכת';
  END IF;
END $$;

-- ============================================================================
-- חלק 2: טבלת analyses (ניתוחים)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analyses (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  CONSTRAINT analyses_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE,
  
  -- פרטי הניתוח
  track text NOT NULL, -- 'actors', 'singers', 'content_creators', 'influencers'
  average_score numeric(5,2),
  
  -- מטא-דאטה
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.analyses IS 'טבלת ניתוחים שבוצעו במערכת';
COMMENT ON COLUMN public.analyses.track IS 'תחום הניתוח';
COMMENT ON COLUMN public.analyses.average_score IS 'ציון ממוצע של הניתוח';

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON public.analyses(created_at DESC);

-- ============================================================================
-- חלק 3: טבלת videos (וידאו)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.videos (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  CONSTRAINT videos_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE,
  
  -- פרטי הוידאו
  file_name text NOT NULL,
  file_size_mb numeric(10,2) NOT NULL,
  duration_seconds integer NOT NULL,
  
  -- מטא-דאטה
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.videos IS 'טבלת קבצי וידאו שהועלו למערכת';
COMMENT ON COLUMN public.videos.file_size_mb IS 'גודל הקובץ במגה-בייט';
COMMENT ON COLUMN public.videos.duration_seconds IS 'משך הוידאו בשניות';

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);

-- ============================================================================
-- חלק 4: טבלת benefits (הטבות וקופונים)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.benefits (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- סוג ההטבה
  benefit_type benefit_type NOT NULL,
  
  -- פרטי ההטבה
  title text NOT NULL,
  description text,
  
  -- פרמטרים ספציפיים לפי סוג
  plan_type plan_type, -- לאיזה חבילה ההטבה (NULL = כל החבילות)
  discount_percentage integer CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  free_analyses_count integer CHECK (free_analyses_count >= 0),
  free_days integer CHECK (free_days >= 0),
  
  -- קופון (אם רלוונטי)
  coupon_code text UNIQUE,
  coupon_valid_until timestamptz,
  
  -- סטטוס
  is_active boolean NOT NULL DEFAULT true,
  
  -- מטא-דאטה
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.benefits IS 'טבלת הטבות וקופונים במערכת';
COMMENT ON COLUMN public.benefits.benefit_type IS 'סוג ההטבה';
COMMENT ON COLUMN public.benefits.plan_type IS 'חבילה ספציפית (NULL = כל החבילות)';
COMMENT ON COLUMN public.benefits.coupon_code IS 'קוד קופון ייחודי';

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_benefits_is_active ON public.benefits(is_active);
CREATE INDEX IF NOT EXISTS idx_benefits_coupon_code ON public.benefits(coupon_code) WHERE coupon_code IS NOT NULL;

-- ============================================================================
-- חלק 5: טבלת user_benefits (הטבות שניתנו למשתמשים)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_benefits (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  benefit_id uuid NOT NULL,
  
  CONSTRAINT user_benefits_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE,
  CONSTRAINT user_benefits_benefit_id_fkey 
    FOREIGN KEY (benefit_id) 
    REFERENCES public.benefits(id) 
    ON DELETE CASCADE,
  
  -- סטטוס שימוש
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  
  -- מטא-דאטה
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_benefits IS 'טבלת הטבות שניתנו למשתמשים ספציפיים';

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_user_benefits_user_id ON public.user_benefits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_benefits_benefit_id ON public.user_benefits(benefit_id);

-- ============================================================================
-- חלק 6: RLS Policies
-- ============================================================================

-- הפעלת RLS על כל הטבלאות
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_benefits ENABLE ROW LEVEL SECURITY;

-- Policies ל-analyses
CREATE POLICY "Users can view own analyses"
  ON public.analyses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all analyses"
  ON public.analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- Policies ל-videos
CREATE POLICY "Users can view own videos"
  ON public.videos
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all videos"
  ON public.videos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- Policies ל-benefits
CREATE POLICY "Everyone can view active benefits"
  ON public.benefits
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage benefits"
  ON public.benefits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- Policies ל-user_benefits
CREATE POLICY "Users can view own benefits"
  ON public.user_benefits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user benefits"
  ON public.user_benefits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- ============================================================================
-- חלק 7: Functions לעזרה
-- ============================================================================

-- פונקציה לבדיקה אם משתמש הוא אדמין
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND (raw_user_meta_data->>'role')::text = 'admin'
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin IS 'בודק אם משתמש הוא אדמין';

-- פונקציה לקבלת סטטיסטיקות כללית
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.get_admin_stats IS 'מחזיר סטטיסטיקות כללית לפאנל ניהול';

-- פונקציה לקבלת רשימת משתמשים (לאדמין בלבד)
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
SET search_path = public
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

COMMENT ON FUNCTION public.get_admin_users IS 'מחזיר רשימת כל המשתמשים (לאדמין בלבד)';

-- פונקציה למחיקת משתמש (לאדמין בלבד)
-- הערה: מחיקת משתמש מ-auth.users דורשת הרשאות מיוחדות
-- עדיף להשתמש ב-Supabase Admin API או Dashboard
CREATE OR REPLACE FUNCTION public.delete_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.delete_admin_user IS 'מוחק נתונים קשורים למשתמש (לאדמין בלבד). מחיקת המשתמש עצמו צריכה להיעשות דרך Dashboard';

-- ============================================================================
-- חלק 8: יצירת משתמש אדמין
-- ============================================================================

-- הערה: יצירת משתמש אדמין צריכה להיעשות ידנית דרך Supabase Auth
-- או דרך SQL עם service_role key
-- כאן נוסיף רק הערה כיצד לעשות זאת:

-- דרך 1: דרך Supabase Dashboard
-- 1. לך ל-Authentication > Users
-- 2. לחץ על "Add user"
-- 3. הזן: email: viralypro@gmail.com, password: Viraly@123
-- 4. לאחר יצירת המשתמש, עדכן את ה-metadata:
--    UPDATE auth.users 
--    SET raw_user_meta_data = jsonb_set(
--      COALESCE(raw_user_meta_data, '{}'::jsonb),
--      '{role}',
--      '"admin"'
--    )
--    WHERE email = 'viralypro@gmail.com';

-- דרך 2: דרך SQL (דורש service_role)
-- INSERT INTO auth.users (
--   id,
--   instance_id,
--   email,
--   encrypted_password,
--   email_confirmed_at,
--   raw_user_meta_data,
--   created_at,
--   updated_at
-- ) VALUES (
--   gen_random_uuid(),
--   '00000000-0000-0000-0000-000000000000',
--   'viralypro@gmail.com',
--   crypt('Viraly@123', gen_salt('bf')),
--   now(),
--   '{"role": "admin"}'::jsonb,
--   now(),
--   now()
-- );

COMMIT;

