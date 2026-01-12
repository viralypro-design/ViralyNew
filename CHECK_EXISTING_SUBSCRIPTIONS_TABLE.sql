-- ============================================================================
-- בדיקה: מה יש בטבלה subscriptions הקיימת
-- ============================================================================
-- הרץ את זה כדי לראות מה המבנה הקיים
-- ============================================================================

-- בדיקה 1: מבנה הטבלה subscriptions הקיימת
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'subscriptions'
ORDER BY ordinal_position;

-- בדיקה 2: כמה רשומות יש
SELECT COUNT(*) as existing_rows FROM public.subscriptions;

-- בדיקה 3: Foreign keys
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'subscriptions';

-- בדיקה 4: האם יש טבלאות אחרות שמשתמשות ב-subscriptions
SELECT
  tc.table_name as referencing_table,
  kcu.column_name as referencing_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.table_name = 'subscriptions';

