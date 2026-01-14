-- ============================================================================
-- Script: Create Admin User
-- ============================================================================
-- Purpose: יצירת משתמש אדמין עם האימייל והסיסמה המבוקשים
-- Email: viralypro@gmail.com
-- Password: Viraly@123
-- 
-- הערה: סקריפט זה צריך לרוץ עם service_role key או דרך Supabase Dashboard
-- ============================================================================

-- דרך 1: יצירה דרך Supabase Dashboard (מומלץ)
-- 1. לך ל-Authentication > Users
-- 2. לחץ על "Add user" > "Create new user"
-- 3. הזן:
--    - Email: viralypro@gmail.com
--    - Password: Viraly@123
--    - Auto Confirm User: כן
-- 4. לאחר יצירת המשתמש, הרץ את השאילתה הבאה לעדכון ה-metadata:

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'viralypro@gmail.com';

-- בדיקה שהמשתמש נוצר בהצלחה
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
WHERE email = 'viralypro@gmail.com';

-- ============================================================================
-- דרך 2: יצירה ישירה דרך SQL (דורש service_role)
-- ============================================================================
-- הערה: זה דורש גישה ל-service_role key ויכול להיות מסובך יותר
-- עדיף להשתמש בדרך 1

-- INSERT INTO auth.users (
--   id,
--   instance_id,
--   email,
--   encrypted_password,
--   email_confirmed_at,
--   raw_user_meta_data,
--   created_at,
--   updated_at,
--   confirmation_token,
--   email_change,
--   email_change_token_new,
--   recovery_token
-- )
-- VALUES (
--   gen_random_uuid(),
--   '00000000-0000-0000-0000-000000000000',
--   'viralypro@gmail.com',
--   crypt('Viraly@123', gen_salt('bf')),
--   now(),
--   '{"role": "admin"}'::jsonb,
--   now(),
--   now(),
--   '',
--   '',
--   '',
--   ''
-- );

