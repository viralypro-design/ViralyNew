-- ============================================================================
-- בדיקת סטטוס אדמין של משתמש
-- ============================================================================
-- מטרה: לבדוק אם משתמש הוא אדמין
-- ============================================================================

-- בדיקה 1: בדיקת role של משתמש ספציפי
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  CASE 
    WHEN raw_user_meta_data->>'role' = 'admin' THEN '✅ אדמין'
    ELSE '❌ לא אדמין'
  END as status,
  raw_user_meta_data,
  created_at
FROM auth.users
WHERE email = 'viralypro@gmail.com';

-- בדיקה 2: רשימת כל האדמינים במערכת
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'admin'
ORDER BY created_at DESC;

-- בדיקה 3: בדיקה דרך הפונקציה is_admin (אם המיגרציה רצה)
-- הערה: זה יעבוד רק אם המיגרציה supabase_migration_admin_panel.sql רצה
SELECT 
  email,
  public.is_admin(id) as is_admin,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'viralypro@gmail.com';

-- בדיקה 4: בדיקה כללית - כמה אדמינים יש במערכת
SELECT 
  COUNT(*) as total_admins
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'admin';

