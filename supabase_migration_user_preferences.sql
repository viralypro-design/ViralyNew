-- ============================================================================
-- Migration: User Preferences - Default Track
-- ============================================================================
-- Purpose: הוספת עמודה ל-user_subscriptions לשמירת תחום ברירת מחדל
-- ============================================================================

BEGIN;

-- הוספת עמודה ל-user_subscriptions לשמירת תחום ברירת מחדל
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS default_track text;

COMMENT ON COLUMN public.user_subscriptions.default_track IS 
  'תחום ברירת מחדל של המשתמש - actors, musicians, creators, influencers';

-- אינדקס לביצועים
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_default_track 
  ON public.user_subscriptions(default_track) 
  WHERE default_track IS NOT NULL;

COMMIT;

