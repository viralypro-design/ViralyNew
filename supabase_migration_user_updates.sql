-- ============================================================================
-- Migration: User Updates Table
-- ============================================================================
-- Purpose: יצירת טבלת עדכונים והודעות למשתמשים
-- Project: viralynew (ktvltvgydoboluqvoszg)
-- 
-- ⚠️ טבלה זו מאפשרת לאדמין לשלוח עדכונים והודעות למשתמשים
-- ============================================================================

BEGIN;

-- ============================================================================
-- חלק 1: טבלת user_updates
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_updates'
  ) THEN
    CREATE TABLE public.user_updates (
      -- Primary Key
      id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Foreign Key למשתמש
      user_id uuid NOT NULL,
      CONSTRAINT user_updates_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE,
      
      -- תוכן העדכון
      title text NOT NULL,
      content text NOT NULL,
      
      -- סטטוס קריאה
      is_read boolean NOT NULL DEFAULT false,
      
      -- מטא-דאטה
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      
      -- סוג העדכון (אופציונלי)
      update_type text DEFAULT 'info', -- 'info', 'warning', 'success', 'error'
      
      -- קישור (אופציונלי)
      link_url text,
      link_text text
    );
  END IF;
END $$;

-- יצירת אינדקסים
CREATE INDEX IF NOT EXISTS idx_user_updates_user_id ON public.user_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_updates_created_at ON public.user_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_updates_is_read ON public.user_updates(is_read);
CREATE INDEX IF NOT EXISTS idx_user_updates_user_unread ON public.user_updates(user_id, is_read) WHERE is_read = false;

-- הערות
COMMENT ON TABLE public.user_updates IS 'טבלת עדכונים והודעות למשתמשים - מאפשרת לאדמין לשלוח הודעות';
COMMENT ON COLUMN public.user_updates.user_id IS 'מזהה המשתמש';
COMMENT ON COLUMN public.user_updates.title IS 'כותרת העדכון';
COMMENT ON COLUMN public.user_updates.content IS 'תוכן העדכון';
COMMENT ON COLUMN public.user_updates.is_read IS 'האם העדכון נקרא';
COMMENT ON COLUMN public.user_updates.update_type IS 'סוג העדכון: info, warning, success, error';
COMMENT ON COLUMN public.user_updates.link_url IS 'קישור אופציונלי';
COMMENT ON COLUMN public.user_updates.link_text IS 'טקסט הקישור';

-- ============================================================================
-- חלק 2: Trigger לעדכון updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_updates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_updates_updated_at ON public.user_updates;
CREATE TRIGGER trigger_update_user_updates_updated_at
  BEFORE UPDATE ON public.user_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_updates_updated_at();

-- ============================================================================
-- חלק 3: RLS Policies (Row Level Security)
-- ============================================================================

-- הפעלת RLS
ALTER TABLE public.user_updates ENABLE ROW LEVEL SECURITY;

-- Policy: משתמשים יכולים לראות רק את העדכונים שלהם
DROP POLICY IF EXISTS "Users can view own updates" ON public.user_updates;
CREATE POLICY "Users can view own updates"
  ON public.user_updates
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: משתמשים יכולים לעדכן רק את העדכונים שלהם (לסמן כנקרא)
DROP POLICY IF EXISTS "Users can update own updates" ON public.user_updates;
CREATE POLICY "Users can update own updates"
  ON public.user_updates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: רק service_role יכול ליצור עדכונים (אדמין)
-- זה ייעשה דרך service_role key, לא דרך RLS

-- ============================================================================
-- חלק 4: RPC Functions
-- ============================================================================

-- Function לסמן עדכון כנקרא
CREATE OR REPLACE FUNCTION public.mark_update_as_read(update_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'לא מחובר. נא להתחבר תחילה.');
  END IF;
  
  -- עדכן את העדכון כנקרא רק אם הוא שייך למשתמש הנוכחי
  UPDATE public.user_updates
  SET is_read = true, updated_at = now()
  WHERE id = update_id AND user_id = current_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'עדכון לא נמצא או אין הרשאה');
  END IF;
  
  RETURN jsonb_build_object('success', true);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.mark_update_as_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_update_as_read(uuid) TO anon;

-- Function לסמן כל העדכונים כנקראים
CREATE OR REPLACE FUNCTION public.mark_all_updates_as_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  updated_count integer;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'לא מחובר. נא להתחבר תחילה.');
  END IF;
  
  -- עדכן את כל העדכונים של המשתמש כנקראים
  UPDATE public.user_updates
  SET is_read = true, updated_at = now()
  WHERE user_id = current_user_id AND is_read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object('success', true, 'updated_count', updated_count);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.mark_all_updates_as_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_updates_as_read() TO anon;

-- ============================================================================
-- חלק 5: Function ליצירת עדכון (לשימוש אדמין דרך service_role)
-- ============================================================================

-- Function ליצירת עדכון למשתמש ספציפי
-- ⚠️ יש להשתמש ב-service_role key כדי לקרוא לפונקציה זו
CREATE OR REPLACE FUNCTION public.create_user_update(
  p_user_id uuid,
  p_title text,
  p_content text,
  p_update_type text DEFAULT 'info',
  p_link_url text DEFAULT NULL,
  p_link_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_update_id uuid;
  created_update jsonb;
BEGIN
  -- בדוק שהמשתמש קיים
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'משתמש לא נמצא');
  END IF;
  
  -- צור את העדכון
  INSERT INTO public.user_updates (
    user_id,
    title,
    content,
    update_type,
    link_url,
    link_text,
    is_read
  )
  VALUES (
    p_user_id,
    p_title,
    p_content,
    p_update_type,
    p_link_url,
    p_link_text,
    false
  )
  RETURNING id INTO new_update_id;
  
  -- החזר את העדכון שנוצר
  SELECT row_to_json(u.*)::jsonb INTO created_update
  FROM public.user_updates u
  WHERE u.id = new_update_id;
  
  RETURN jsonb_build_object('success', true, 'update', created_update);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions (רק service_role יוכל להשתמש)
-- GRANT EXECUTE ON FUNCTION public.create_user_update TO service_role;

-- Function ליצירת עדכון לכל המשתמשים
CREATE OR REPLACE FUNCTION public.create_broadcast_update(
  p_title text,
  p_content text,
  p_update_type text DEFAULT 'info',
  p_link_url text DEFAULT NULL,
  p_link_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_count integer;
BEGIN
  -- צור עדכון לכל המשתמשים הפעילים
  INSERT INTO public.user_updates (
    user_id,
    title,
    content,
    update_type,
    link_url,
    link_text,
    is_read
  )
  SELECT 
    u.id,
    p_title,
    p_content,
    p_update_type,
    p_link_url,
    p_link_text,
    false
  FROM auth.users u
  WHERE u.email_confirmed_at IS NOT NULL;
  
  GET DIAGNOSTICS created_count = ROW_COUNT;
  
  RETURN jsonb_build_object('success', true, 'created_count', created_count);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions (רק service_role יוכל להשתמש)
-- GRANT EXECUTE ON FUNCTION public.create_broadcast_update TO service_role;

COMMIT;

-- ============================================================================
-- סיכום
-- ============================================================================
-- ✅ טבלת user_updates נוצרה
-- ✅ Triggers נוצרו (עדכון updated_at)
-- ✅ RLS Policies הוגדרו (משתמשים רואים רק את העדכונים שלהם)
-- ✅ RPC Functions נוצרו:
--    - mark_update_as_read - לסמן עדכון כנקרא
--    - mark_all_updates_as_read - לסמן כל העדכונים כנקראים
--    - create_user_update - ליצור עדכון למשתמש ספציפי (אדמין)
--    - create_broadcast_update - ליצור עדכון לכל המשתמשים (אדמין)
-- ============================================================================
-- 
-- שימוש:
-- 1. משתמשים יכולים לראות את העדכונים שלהם דרך SettingsModal
-- 2. אדמין יכול ליצור עדכונים דרך service_role key:
--    SELECT public.create_user_update(
--      'user_id_here'::uuid,
--      'כותרת',
--      'תוכן',
--      'info'
--    );
-- 3. אדמין יכול לשלוח עדכון לכל המשתמשים:
--    SELECT public.create_broadcast_update(
--      'כותרת',
--      'תוכן',
--      'info'
--    );
-- ============================================================================

