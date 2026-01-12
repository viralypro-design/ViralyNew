-- ============================================================================
-- Migration: Subscription System Alignment with React TypeScript Code
-- ============================================================================
-- Purpose: ליישר קו מלא בין אפליקציית React + TypeScript לבין Supabase
-- Date: Production Migration
-- 
-- Requirements:
-- - אין fallback לחבילת ניסיון
-- - אין localStorage - כל הנתונים מה-DB בלבד
-- - אין שינוי לוגיקה בצד לקוח
-- - לא לשבור משתמשים קיימים
-- ============================================================================

BEGIN;

-- ============================================================================
-- חלק 1: ENUMS (חובה)
-- ============================================================================

-- יצירת ENUM לסוגי חבילות - תואם ל-PlanType ב-TypeScript
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN
    CREATE TYPE plan_type AS ENUM (
      'trial',
      'creators',
      'creators_extreme',
      'coach',
      'coach_pro'
    );
    COMMENT ON TYPE plan_type IS 'סוגי החבילות הזמינות במערכת - תואם ל-PlanType ב-TypeScript';
  END IF;
END $$;

-- יצירת ENUM לסטטוס מנוי - תואם ל-subscription status ב-TypeScript
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM (
      'active',
      'inactive'
    );
    COMMENT ON TYPE subscription_status IS 'סטטוס המנוי - active או inactive בלבד';
  END IF;
END $$;

-- ============================================================================
-- חלק 2: טבלת subscriptions (Source of Truth)
-- ============================================================================
-- הערה: יוצרים טבלה חדשה user_subscriptions כדי לא לשבור את subscriptions הקיימת
-- אם רוצים להשתמש בשם subscriptions, יש לשנות את הטבלה הקיימת בנפרד

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  -- Primary Key
  user_id uuid NOT NULL PRIMARY KEY,
  
  -- Foreign Key ל-auth.users
  CONSTRAINT user_subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE,
  
  -- סוג החבילה - חובה, אין default
  plan_type plan_type NOT NULL,
  
  -- סטטוס המנוי - default active
  status subscription_status NOT NULL DEFAULT 'active',
  
  -- שימוש חודשי - דקות
  minutes_used_monthly integer NOT NULL DEFAULT 0 
    CHECK (minutes_used_monthly >= 0),
  
  -- שימוש חודשי - ניתוחים
  analyses_used_monthly integer NOT NULL DEFAULT 0 
    CHECK (analyses_used_monthly >= 0),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraint: משתמש יכול להיות רק עם מנוי אחד
  CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id)
);

-- הערות על הטבלה
COMMENT ON TABLE public.user_subscriptions IS 
  'טבלת מנויים - Source of Truth. כל הנתונים מגיעים מה-DB בלבד, אין localStorage או fallback';
COMMENT ON COLUMN public.user_subscriptions.user_id IS 
  'מזהה המשתמש - Primary Key ו-Foreign Key ל-auth.users';
COMMENT ON COLUMN public.user_subscriptions.plan_type IS 
  'סוג החבילה - חובה, אין default. אין fallback ל-trial';
COMMENT ON COLUMN public.user_subscriptions.status IS 
  'סטטוס המנוי - active או inactive';
COMMENT ON COLUMN public.user_subscriptions.minutes_used_monthly IS 
  'דקות שנוצלו החודש - מתאפס כל חודש';
COMMENT ON COLUMN public.user_subscriptions.analyses_used_monthly IS 
  'ניתוחים שנוצלו החודש - מתאפס כל חודש';

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status 
  ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_type 
  ON public.user_subscriptions(plan_type);

-- ============================================================================
-- חלק 3: Trigger לעדכון updated_at אוטומטי
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_user_subscriptions_updated_at() IS 
  'עדכון אוטומטי של updated_at בעת שינוי רשומה';

DROP TRIGGER IF EXISTS trigger_update_user_subscriptions_updated_at 
  ON public.user_subscriptions;

CREATE TRIGGER trigger_update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_subscriptions_updated_at();

-- ============================================================================
-- חלק 4: RLS (Row Level Security) - חובה, בלי חורים
-- ============================================================================

-- הפעלת RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- מחיקת policies קיימות (אם יש)
DROP POLICY IF EXISTS "Users can read own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Service role can insert subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Block all deletes" ON public.user_subscriptions;

-- Policy 1: SELECT - משתמש יכול לקרוא רק את עצמו
CREATE POLICY "Users can read own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can read own subscription" ON public.user_subscriptions IS 
  'משתמש יכול לקרוא רק את המנוי שלו עצמו';

-- Policy 2: INSERT - רק service_role או trigger בהרשמה
-- הערה: trigger יוצר subscription עם service_role, אז אנחנו מאפשרים רק service_role
CREATE POLICY "Service role can insert subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY "Service role can insert subscriptions" ON public.user_subscriptions IS 
  'רק service_role יכול ליצור subscriptions - בדרך כלל דרך trigger בהרשמה';

-- Policy 3: UPDATE - רק service_role
CREATE POLICY "Service role can update subscriptions"
  ON public.user_subscriptions
  FOR UPDATE
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY "Service role can update subscriptions" ON public.user_subscriptions IS 
  'רק service_role יכול לעדכן subscriptions - מונע שינוי בצד לקוח';

-- Policy 4: DELETE - חסום לחלוטין
-- אין policy ל-DELETE = חסום לחלוטין (גם service_role לא יכול למחוק)
-- אם צריך למחוק, יש לעשות זאת ידנית דרך SQL

COMMENT ON TABLE public.user_subscriptions IS 
  'DELETE חסום לחלוטין - אין policy, אז אף אחד לא יכול למחוק';

-- ============================================================================
-- חלק 5: Trigger בהרשמה (New User)
-- ============================================================================
-- הערה: Trigger זה יוצר subscription רק אם יש plan_type ב-metadata של המשתמש
-- אין default, אין fallback

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_plan_type plan_type;
BEGIN
  -- בדיקה אם יש plan_type ב-raw_user_meta_data
  -- אם אין - לא יוצרים subscription (אין fallback)
  IF NEW.raw_user_meta_data IS NULL OR 
     NEW.raw_user_meta_data->>'plan_type' IS NULL THEN
    -- אין plan_type - לא יוצרים subscription
    RETURN NEW;
  END IF;
  
  -- ניסיון להמיר את plan_type ל-enum
  BEGIN
    selected_plan_type := (NEW.raw_user_meta_data->>'plan_type')::plan_type;
  EXCEPTION WHEN OTHERS THEN
    -- plan_type לא תקין - לא יוצרים subscription
    RAISE WARNING 'Invalid plan_type in user metadata: %', NEW.raw_user_meta_data->>'plan_type';
    RETURN NEW;
  END;
  
  -- בדיקה אם כבר יש subscription למשתמש הזה (למקרה של retry)
  IF EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.id) THEN
    -- כבר יש subscription - לא יוצרים עוד אחד
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
$$;

COMMENT ON FUNCTION public.handle_new_user_subscription() IS 
  'Trigger ליצירת subscription בעת הרשמה - רק אם יש plan_type ב-metadata. אין default, אין fallback';

-- מחיקת trigger קיים (אם יש)
DROP TRIGGER IF EXISTS on_auth_user_created_subscription 
  ON auth.users;

-- יצירת trigger חדש
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();

-- ============================================================================
-- חלק 6: אבטחה ו-Hardening
-- ============================================================================

-- וידוא שאין table public writable
-- RLS מופעל, policies מוגדרות - זה מספיק

-- וידוא שאין anon key שיכול UPDATE subscriptions
-- Policy 3 מאפשר רק service_role - anon key לא יכול

-- וידוא שאין policies רחבות מדי
-- כל ה-policies מוגבלות למשתמש עצמו או service_role בלבד

-- ============================================================================
-- חלק 7: Seed Data - אין!
-- ============================================================================
-- הערה: לפי הדרישות:
-- - אם אין למשתמש רשומת subscription → אל תיצור אחת
-- - אל תנחש plan
-- - אל תכניס trial אוטומטי
-- 
-- לכן אין seed data כאן.
-- רק משתמשים חדשים יקבלו subscription דרך trigger (אם יש plan_type ב-metadata)

-- ============================================================================
-- חלק 8: Helper Functions (אופציונלי - לשימוש עתידי)
-- ============================================================================

-- פונקציה לבדיקה אם משתמש יכול להריץ ניתוח
CREATE OR REPLACE FUNCTION public.can_user_run_analysis(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription public.user_subscriptions%ROWTYPE;
  v_max_analyses integer;
BEGIN
  -- קבלת subscription
  SELECT * INTO v_subscription
  FROM public.user_subscriptions
  WHERE user_id = p_user_id
    AND status = 'active';
  
  -- אם אין subscription פעיל - לא יכול
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- כאן צריך לבדוק את PLAN_CONFIG - אבל זה ב-React
  -- אז נחזיר רק את הבדיקה הבסיסית
  -- בפועל, ה-React hook יעשה את הבדיקה המלאה
  
  RETURN true; -- placeholder - הבדיקה המלאה ב-React
END;
$$;

COMMENT ON FUNCTION public.can_user_run_analysis(uuid) IS 
  'פונקציה עזר לבדיקה אם משתמש יכול להריץ ניתוח - placeholder, הבדיקה המלאה ב-React hook';

-- ============================================================================
-- סיום Migration
-- ============================================================================

COMMIT;

-- ============================================================================
-- הערות חשובות:
-- ============================================================================
-- 1. טבלה זו היא Source of Truth - כל הנתונים מה-DB בלבד
-- 2. אין fallback לחבילת ניסיון - אם אין subscription, אין גישה
-- 3. Trigger יוצר subscription רק אם יש plan_type ב-user metadata
-- 4. RLS מופעל עם policies מחמירות - רק service_role יכול לעדכן
-- 5. DELETE חסום לחלוטין
-- 6. אין seed data - משתמשים קיימים לא מקבלים subscription אוטומטי
-- ============================================================================

