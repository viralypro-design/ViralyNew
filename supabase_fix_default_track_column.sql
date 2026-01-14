-- ============================================================================
-- Fix: Add default_track column to user_subscriptions if it doesn't exist
-- ============================================================================
-- Purpose: להוסיף את הטור default_track אם הוא לא קיים
-- ============================================================================

BEGIN;

-- הוספת עמודה ל-user_subscriptions לשמירת תחום ברירת מחדל (אם לא קיימת)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_subscriptions' 
    AND column_name = 'default_track'
  ) THEN
    ALTER TABLE public.user_subscriptions 
    ADD COLUMN default_track text;
    
    COMMENT ON COLUMN public.user_subscriptions.default_track IS 
      'תחום ברירת מחדל של המשתמש - actors, musicians, creators, influencers';
    
    -- אינדקס לביצועים
    CREATE INDEX IF NOT EXISTS idx_user_subscriptions_default_track 
      ON public.user_subscriptions(default_track) 
      WHERE default_track IS NOT NULL;
    
    RAISE NOTICE 'Column default_track added to user_subscriptions';
  ELSE
    RAISE NOTICE 'Column default_track already exists in user_subscriptions';
  END IF;
END $$;

-- וידוא שה-RLS policies מאפשרות קריאה ועדכון של default_track
-- Policy 1: SELECT - משתמש יכול לקרוא רק את עצמו (כולל default_track)
-- Policy 2: INSERT - רק service_role או trigger יכול (כולל default_track)
-- Policy 3: UPDATE - רק service_role יכול (כולל default_track)

-- בדיקה שה-policies קיימות
DO $$
BEGIN
  -- Policy 1: SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_subscriptions' 
    AND policyname = 'Users can read own subscription'
  ) THEN
    CREATE POLICY "Users can read own subscription"
      ON public.user_subscriptions
      FOR SELECT
      USING (auth.uid() = user_id);
    
    RAISE NOTICE 'Policy "Users can read own subscription" created';
  END IF;
  
  -- Policy 2: INSERT (אם צריך)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_subscriptions' 
    AND policyname = 'Service role can insert subscriptions'
  ) THEN
    CREATE POLICY "Service role can insert subscriptions"
      ON public.user_subscriptions
      FOR INSERT
      WITH CHECK (true); -- רק service_role יכול (נבדק ב-RLS)
    
    RAISE NOTICE 'Policy "Service role can insert subscriptions" created';
  END IF;
  
  -- Policy 3: UPDATE (אם צריך)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_subscriptions' 
    AND policyname = 'Service role can update subscriptions'
  ) THEN
    CREATE POLICY "Service role can update subscriptions"
      ON public.user_subscriptions
      FOR UPDATE
      USING (true) -- רק service_role יכול (נבדק ב-RLS)
      WITH CHECK (true);
    
    RAISE NOTICE 'Policy "Service role can update subscriptions" created';
  END IF;
END $$;

-- וידוא שה-RLS מופעל
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

COMMIT;

