-- ============================================================================
-- Migration: Users Management Table
-- ============================================================================
-- Purpose: יצירת טבלת ניהול משתמשים נוספת (מעבר ל-auth.users)
-- Project: viralynew (ktvltvgydoboluqvoszg)
-- 
-- ⚠️ טבלה זו משלימה את auth.users עם מידע נוסף
-- ============================================================================

BEGIN;

-- ============================================================================
-- חלק 1: טבלת user_profiles (ניהול משתמשים)
-- ============================================================================

-- יצירת טבלת user_profiles לניהול משתמשים
-- טבלה זו משלימה את auth.users עם מידע נוסף
-- שונה מ-users ל-user_profiles כדי להימנע מהתנגשויות
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    CREATE TABLE public.user_profiles (
      -- Primary Key - קשור ל-auth.users
      id uuid NOT NULL PRIMARY KEY,
      
      -- Foreign Key ל-auth.users
      CONSTRAINT user_profiles_id_fkey 
        FOREIGN KEY (id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE,
  
      -- מידע נוסף על המשתמש
      full_name text,
      phone text,
      company text,
      
      -- העדפות משתמש
      preferred_language text DEFAULT 'he',
      timezone text DEFAULT 'Asia/Jerusalem',
      
      -- מטא-דאטה
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      last_login timestamptz,
      
      -- סטטוס
      is_active boolean NOT NULL DEFAULT true,
      is_verified boolean NOT NULL DEFAULT false
    );
  END IF;
END $$;

-- יצירת אינדקסים
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON public.user_profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON public.user_profiles(is_active);

-- הערות
COMMENT ON TABLE public.user_profiles IS 'טבלת ניהול משתמשים - משלימה את auth.users עם מידע נוסף';
COMMENT ON COLUMN public.user_profiles.id IS 'מזהה משתמש - קשור ל-auth.users(id)';
COMMENT ON COLUMN public.user_profiles.full_name IS 'שם מלא של המשתמש';
COMMENT ON COLUMN public.user_profiles.phone IS 'מספר טלפון';
COMMENT ON COLUMN public.user_profiles.company IS 'חברה/ארגון';
COMMENT ON COLUMN public.user_profiles.preferred_language IS 'שפה מועדפת';
COMMENT ON COLUMN public.user_profiles.timezone IS 'אזור זמן';
COMMENT ON COLUMN public.user_profiles.last_login IS 'תאריך התחברות אחרונה';
COMMENT ON COLUMN public.user_profiles.is_active IS 'האם המשתמש פעיל';
COMMENT ON COLUMN public.user_profiles.is_verified IS 'האם המשתמש אומת';

-- ============================================================================
-- חלק 2: Trigger לעדכון updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trigger_update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_profiles_updated_at();

-- ============================================================================
-- חלק 3: Trigger ליצירת רשומה ב-users כאשר נוצר משתמש חדש ב-auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, is_active, is_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    true,
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_handle_new_user ON auth.users;
CREATE TRIGGER trigger_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- חלק 4: Trigger לעדכון last_login כאשר משתמש מתחבר
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  -- עדכן את last_login בטבלת user_profiles
  UPDATE public.user_profiles
  SET last_login = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- הערה: Trigger זה יעבוד רק אם יש מנגנון שמעדכן את auth.users בעת התחברות
-- ניתן להוסיף דרך RPC function או דרך client-side code

-- ============================================================================
-- חלק 5: RLS Policies (Row Level Security)
-- ============================================================================

-- הפעלת RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: משתמשים יכולים לראות רק את הפרופיל שלהם
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: משתמשים יכולים לעדכן רק את הפרופיל שלהם
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: משתמשים יכולים ליצור רק את הפרופיל שלהם
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- חלק 6: RPC Functions לניהול משתמשים
-- ============================================================================

-- Function לעדכון פרופיל משתמש
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_preferred_language text DEFAULT NULL,
  p_timezone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  updated_user jsonb;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'לא מחובר. נא להתחבר תחילה.');
  END IF;
  
  -- עדכן את הפרופיל
  UPDATE public.user_profiles
  SET 
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    company = COALESCE(p_company, company),
    preferred_language = COALESCE(p_preferred_language, preferred_language),
    timezone = COALESCE(p_timezone, timezone),
    updated_at = now()
  WHERE id = current_user_id;
  
  -- החזר את הפרופיל המעודכן
  SELECT row_to_json(u.*)::jsonb INTO updated_user
  FROM public.user_profiles u
  WHERE u.id = current_user_id;
  
  RETURN jsonb_build_object('success', true, 'user', updated_user);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile TO anon;

-- Function לקבלת פרופיל משתמש
CREATE OR REPLACE FUNCTION public.get_user_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_profile jsonb;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'לא מחובר. נא להתחבר תחילה.');
  END IF;
  
  -- החזר את הפרופיל
  SELECT row_to_json(u.*)::jsonb INTO user_profile
  FROM public.user_profiles u
  WHERE u.id = current_user_id;
  
  IF user_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'פרופיל לא נמצא');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'user', user_profile);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile TO anon;

-- ============================================================================
-- חלק 7: יצירת רשומות קיימות (אם יש משתמשים קיימים)
-- ============================================================================

-- יצירת רשומות ב-user_profiles עבור משתמשים קיימים ב-auth.users
INSERT INTO public.user_profiles (id, full_name, is_active, is_verified)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email) as full_name,
  true as is_active,
  (u.email_confirmed_at IS NOT NULL) as is_verified
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles WHERE id = u.id
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- סיכום
-- ============================================================================
-- ✅ טבלת user_profiles נוצרה (שונה מ-users כדי להימנע מהתנגשויות)
-- ✅ Triggers נוצרו (עדכון updated_at, יצירת רשומה חדשה)
-- ✅ RLS Policies הוגדרו
-- ✅ RPC Functions נוצרו (update_user_profile, get_user_profile)
-- ✅ רשומות קיימות נוצרו עבור משתמשים קיימים
-- ============================================================================

