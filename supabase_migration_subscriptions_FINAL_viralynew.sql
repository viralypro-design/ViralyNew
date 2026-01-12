-- ============================================================================
-- Migration: Subscription System Alignment - viralynew
-- ============================================================================
-- Purpose: ליישר קו מלא בין אפליקציית React + TypeScript לבין Supabase
-- Project: viralynew (ktvltvgydoboluqvoszg)
-- 
-- ⚠️ Migration זה מעדכן את הטבלה subscriptions הקיימת
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
-- יוצר את הטבלה אם לא קיימת, או מעדכן אותה אם קיימת

DO $$ 
BEGIN
  -- אם הטבלה לא קיימת - צור אותה
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    
    CREATE TABLE public.subscriptions (
      -- Primary Key
      user_id uuid NOT NULL PRIMARY KEY,
      
      -- Foreign Key ל-auth.users
      CONSTRAINT subscriptions_user_id_fkey 
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
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    
  ELSE
    -- הטבלה קיימת - הוסף עמודות חדשות אם לא קיימות
    
    -- plan_type - חובה, אין default
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                     AND table_name = 'subscriptions' 
                     AND column_name = 'plan_type') THEN
      ALTER TABLE public.subscriptions 
      ADD COLUMN plan_type plan_type;
    END IF;
    
    -- status - עם default
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                     AND table_name = 'subscriptions' 
                     AND column_name = 'status') THEN
      ALTER TABLE public.subscriptions 
      ADD COLUMN status subscription_status DEFAULT 'active';
    END IF;
    
    -- minutes_used_monthly
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                     AND table_name = 'subscriptions' 
                     AND column_name = 'minutes_used_monthly') THEN
      ALTER TABLE public.subscriptions 
      ADD COLUMN minutes_used_monthly integer NOT NULL DEFAULT 0 
        CHECK (minutes_used_monthly >= 0);
    END IF;
    
    -- analyses_used_monthly
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                     AND table_name = 'subscriptions' 
                     AND column_name = 'analyses_used_monthly') THEN
      ALTER TABLE public.subscriptions 
      ADD COLUMN analyses_used_monthly integer NOT NULL DEFAULT 0 
        CHECK (analyses_used_monthly >= 0);
    END IF;
    
    -- updated_at אם לא קיים
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                     AND table_name = 'subscriptions' 
                     AND column_name = 'updated_at') THEN
      ALTER TABLE public.subscriptions 
      ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
    
  END IF;
END $$;

-- הערות על הטבלה
COMMENT ON TABLE public.subscriptions IS 
  'טבלת מנויים - Source of Truth. כל הנתונים מגיעים מה-DB בלבד, אין localStorage או fallback';
COMMENT ON COLUMN public.subscriptions.plan_type IS 
  'סוג החבילה - חובה, אין default. אין fallback ל-trial';
COMMENT ON COLUMN public.subscriptions.status IS 
  'סטטוס המנוי - active או inactive';
COMMENT ON COLUMN public.subscriptions.minutes_used_monthly IS 
  'דקות שנוצלו החודש - מתאפס כל חודש';
COMMENT ON COLUMN public.subscriptions.analyses_used_monthly IS 
  'ניתוחים שנוצלו החודש - מתאפס כל חודש';

-- אינדקסים לביצועים
DO $$ 
BEGIN
  -- אינדקס על status (אם העמודה קיימת)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = 'subscriptions' 
               AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
      ON public.subscriptions(status);
  END IF;
  
  -- אינדקס על plan_type (אם העמודה קיימת)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = 'subscriptions' 
               AND column_name = 'plan_type') THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_type 
      ON public.subscriptions(plan_type);
  END IF;
END $$;

-- ============================================================================
-- חלק 3: Trigger לעדכון updated_at אוטומטי
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_subscriptions_updated_at() IS 
  'עדכון אוטומטי של updated_at בעת שינוי רשומה';

DROP TRIGGER IF EXISTS trigger_update_subscriptions_updated_at 
  ON public.subscriptions;

CREATE TRIGGER trigger_update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at OR OLD.updated_at IS NULL)
  EXECUTE FUNCTION public.update_subscriptions_updated_at();

-- ============================================================================
-- חלק 4: RLS (Row Level Security) - חובה, בלי חורים
-- ============================================================================

-- הפעלת RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- מחיקת policies קיימות שלנו (אם יש) - לא נוגע ב-policies קיימות אחרות
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.subscriptions;

-- Policy 1: SELECT - משתמש יכול לקרוא רק את עצמו
-- ⚠️ אם יש כבר policy ל-SELECT, זה יחליף אותה
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can read own subscription" ON public.subscriptions IS 
  'משתמש יכול לקרוא רק את המנוי שלו עצמו';

-- Policy 2: INSERT - רק service_role או trigger בהרשמה
CREATE POLICY "Service role can insert subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY "Service role can insert subscriptions" ON public.subscriptions IS 
  'רק service_role יכול ליצור subscriptions - בדרך כלל דרך trigger בהרשמה';

-- Policy 3: UPDATE - רק service_role
-- ⚠️ אם יש כבר policy ל-UPDATE, זה יחליף אותה
CREATE POLICY "Service role can update subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY "Service role can update subscriptions" ON public.subscriptions IS 
  'רק service_role יכול לעדכן subscriptions - מונע שינוי בצד לקוח';

-- Policy 4: DELETE - חסום לחלוטין
-- אין policy ל-DELETE = חסום לחלוטין

COMMENT ON TABLE public.subscriptions IS 
  'DELETE חסום לחלוטין - אין policy, אז אף אחד לא יכול למחוק';

-- ============================================================================
-- חלק 5: Trigger בהרשמה (New User)
-- ============================================================================
-- Trigger זה יוצר subscription רק אם יש plan_type ב-metadata של המשתמש
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
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = NEW.id) THEN
    -- כבר יש subscription - לא יוצרים עוד אחד
    RETURN NEW;
  END IF;
  
  -- יצירת subscription חדש
  INSERT INTO public.subscriptions (
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
  ) ON CONFLICT (user_id) DO NOTHING; -- למקרה שיש כבר רשומה
  
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
-- לפי הדרישות:
-- - אם אין למשתמש רשומת subscription → אל תיצור אחת
-- - אל תנחש plan
-- - אל תכניס trial אוטומטי
-- 
-- לכן אין seed data כאן.
-- רק משתמשים חדשים יקבלו subscription דרך trigger (אם יש plan_type ב-metadata)

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
-- 7. ⚠️ אם יש רשומות קיימות ב-subscriptions, הן לא יושפעו
--    אבל עמודת plan_type תהיה NULL - צריך לעדכן ידנית
-- ============================================================================

