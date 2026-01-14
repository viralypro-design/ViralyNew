-- ============================================================================
-- עדכון Metadata למשתמש אדמין
-- ============================================================================
-- מטרה: עדכון ה-role של משתמש ל-'admin' ב-raw_user_meta_data
-- ============================================================================

-- שלב 1: בדיקה שהמשתמש קיים
SELECT 
  id,
  email,
  raw_user_meta_data,
  created_at
FROM auth.users
WHERE email = 'viralypro@gmail.com';

-- שלב 2: עדכון ה-metadata ל-role: 'admin'
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'viralypro@gmail.com';

-- שלב 3: בדיקה שהעדכון בוצע בהצלחה
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data,
  created_at
FROM auth.users
WHERE email = 'viralypro@gmail.com';

-- ============================================================================
-- אם אתה רוצה לעדכן משתמש אחר (לא viralypro@gmail.com):
-- ============================================================================
-- החלף את 'viralypro@gmail.com' באימייל של המשתמש שאתה רוצה לעדכן

-- ============================================================================
-- אם אתה רוצה לעדכן לפי UID (מזהה המשתמש):
-- ============================================================================
-- UPDATE auth.users 
-- SET raw_user_meta_data = jsonb_set(
--   COALESCE(raw_user_meta_data, '{}'::jsonb),
--   '{role}',
--   '"admin"'
-- )
-- WHERE id = 'd84e0ee9-5144-4204-9212-d53da608b84f';  -- החלף ב-UID שלך

