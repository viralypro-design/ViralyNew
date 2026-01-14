# סדר הרצת המיגרציות - הוראות

## ⚠️ חשוב: הסדר הוא קריטי!

### שלב 1: הרצת מיגרציות בסיסיות (אם עדיין לא רצו)
אם עדיין לא הרצת את המיגרציות הבסיסיות, הרץ אותן בסדר הזה:

1. **`supabase_migration_subscriptions_FINAL_viralynew.sql`** (או `supabase_migration_subscription_system.sql`)
   - יוצר את טבלת `user_subscriptions`
   - יוצר את ה-ENUMs `plan_type` ו-`subscription_status`
   - יוצר את ה-RLS Policies
   - יוצר את ה-trigger ליצירת subscription בהרשמה

2. **`supabase_migration_user_updates.sql`**
   - יוצר את טבלת `user_updates` (עדכונים והודעות למשתמשים)
   - יוצר את ה-RLS Policies

### שלב 2: הרצת מיגרציית פאנל הניהול (חדש!)
3. **`supabase_migration_admin_panel.sql`** ⭐ **זה מה שצריך להריץ עכשיו**
   - יוצר את טבלאות: `analyses`, `videos`, `benefits`, `user_benefits`
   - יוצר את ה-ENUMs: `user_role`, `benefit_type`
   - יוצר את ה-RLS Policies
   - יוצר את הפונקציות: `is_admin()`, `get_admin_stats()`, `get_admin_users()`, `delete_admin_user()`

### שלב 3: יצירת משתמש אדמין (אחרי המיגרציות!)
4. **יצירת משתמש אדמין** - רק אחרי שהמיגרציות רצו בהצלחה!

---

## 📋 הוראות מפורטות:

### שלב 1: הרצת המיגרציה

1. לך ל-Supabase Dashboard
2. בחר את הפרויקט שלך
3. לך ל-SQL Editor
4. העתק והדבק את התוכן מ-`supabase_migration_admin_panel.sql`
5. לחץ על "Run" או "Execute"

### שלב 2: בדיקה שהמיגרציה רצה בהצלחה

הרץ את השאילתה הבאה כדי לבדוק:

```sql
-- בדיקה שהטבלאות נוצרו
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('analyses', 'videos', 'benefits', 'user_benefits')
ORDER BY table_name;

-- בדיקה שה-ENUMs נוצרו
SELECT typname 
FROM pg_type 
WHERE typname IN ('user_role', 'benefit_type');

-- בדיקה שהפונקציות נוצרו
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_admin', 'get_admin_stats', 'get_admin_users', 'delete_admin_user')
ORDER BY routine_name;
```

### שלב 3: יצירת משתמש אדמין

**דרך 1: דרך Supabase Dashboard (מומלץ)**

1. לך ל-Authentication > Users
2. לחץ על "Add user" > "Create new user"
3. הזן:
   - **Email**: `viralypro@gmail.com`
   - **Password**: `Viraly@123`
   - סמן ✅ "Auto Confirm User"
4. לחץ "Create user"

5. לאחר יצירת המשתמש, הרץ את השאילתה הבאה:

```sql
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'viralypro@gmail.com';
```

6. בדוק שהמשתמש נוצר עם התפקיד הנכון:

```sql
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
WHERE email = 'viralypro@gmail.com';
```

**תוצאה צפויה:**
```
role: "admin"
```

---

## ✅ סיכום הסדר:

1. ✅ **קודם** - הרץ את `supabase_migration_admin_panel.sql`
2. ✅ **אחר כך** - צור את משתמש האדמין דרך Dashboard
3. ✅ **בסוף** - עדכן את ה-metadata של המשתמש ל-`role: 'admin'`

---

## 🚨 אם משהו לא עובד:

אם המיגרציה נכשלת, בדוק:
- האם הטבלאות כבר קיימות? (אם כן, המיגרציה תדלג על יצירתן)
- האם יש שגיאות ב-SQL? (בדוק את ה-Error Log)
- האם יש הרשאות נכונות? (צריך להיות בעל הרשאות admin ב-Supabase)

---

## 📝 הערות:

- המיגרציה משתמשת ב-`IF NOT EXISTS` - אז אפשר להריץ אותה כמה פעמים בלי בעיה
- אם טבלה כבר קיימת, המיגרציה תדלג על יצירתה
- המשתמש האדמין צריך להיות עם `role: 'admin'` ב-`raw_user_meta_data`

