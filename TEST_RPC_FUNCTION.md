# 🧪 מדריך לבדיקת RPC Function לעדכון חבילה

## שלב 1: הרצת הפונקציה ב-Supabase

### איפה להריץ:
1. לך ל-**Supabase Dashboard**: https://supabase.com/dashboard
2. בחר את הפרויקט שלך
3. לחץ על **SQL Editor** בתפריט השמאלי
4. העתק את התוכן מ-`supabase_rpc_update_plan.sql`
5. הדבק ב-SQL Editor והרץ (לחץ על "Run" או Ctrl+Enter)

---

## שלב 2: בדיקה שהפונקציה קיימת

### דרך 1: דרך SQL Editor
1. לך ל-**Supabase Dashboard → SQL Editor**
2. הרץ את השאילתה הבאה:

```sql
-- בדיקה שהפונקציה קיימת
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname = 'update_user_plan_type';
```

**תוצאה צפויה:**
- צריך להחזיר שורה אחת עם שם הפונקציה, הפרמטרים, וסוג ההחזרה

### דרך 2: דרך Database → Functions
1. לך ל-**Supabase Dashboard → Database**
2. לחץ על **Functions** בתפריט השמאלי
3. חפש את `update_user_plan_type`
4. אם היא קיימת - תראה אותה ברשימה

---

## שלב 3: בדיקה שהפונקציה עובדת

### בדיקה 1: בדיקה בסיסית (עם משתמש מחובר)
1. התחבר לאפליקציה עם משתמש שיש לו subscription
2. לך ל-**Supabase Dashboard → SQL Editor**
3. הרץ את השאילתה הבאה (החלף `'creators'` לחבילה שאתה רוצה לבדוק):

```sql
-- בדיקה שהפונקציה עובדת
-- החלף את 'creators' לחבילה שאתה רוצה לבדוק
SELECT public.update_user_plan_type('creators'::plan_type);
```

**תוצאה צפויה:**
- אם אתה מחובר כ-service_role או עם משתמש שיש לו subscription:
  - `{"success": true, "subscription": {...}}`
- אם אתה לא מחובר:
  - `{"success": false, "error": "לא מחובר. נא להתחבר תחילה."}`

### בדיקה 2: בדיקה דרך האפליקציה
1. התחבר לאפליקציה עם משתמש שיש לו subscription
2. לך ל-**"📦 ניהול חבילות"** בראש הדף
3. לחץ על **"🔄 שנה חבילה"** של חבילה אחרת
4. החבילה אמורה להתעדכן אוטומטית ללא צורך ברענון

---

## שלב 4: בדיקת הרשאות

### בדיקה שהפונקציה נגישה למשתמשים מחוברים:
```sql
-- בדיקה שהפונקציה נגישה
SELECT 
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'update_user_plan_type';
```

**תוצאה צפויה:**
- צריך לראות `authenticated` ו-`anon` עם `EXECUTE` privilege

---

## פתרון בעיות

### בעיה: הפונקציה לא קיימת
**פתרון:**
1. ודא שהרצת את `supabase_rpc_update_plan.sql` ב-SQL Editor
2. בדוק שאין שגיאות ב-SQL Editor
3. נסה להריץ שוב

### בעיה: הפונקציה קיימת אבל לא עובדת
**פתרון:**
1. בדוק שהמשתמש מחובר (יש לו session פעיל)
2. בדוק שיש subscription למשתמש
3. בדוק את ה-console ב-browser developer tools לשגיאות

### בעיה: "permission denied" או "policy violation"
**פתרון:**
1. הפונקציה משתמשת ב-`SECURITY DEFINER` - זה אמור לעבוד
2. אם עדיין לא עובד, בדוק את ה-RLS policies בטבלה `user_subscriptions`
3. ודא שהפונקציה מקבלת הרשאות נכון

---

## בדיקות נוספות

### בדיקה שהפונקציה מעדכנת נכון:
```sql
-- לפני השינוי - בדוק את החבילה הנוכחית
SELECT plan_type, updated_at 
FROM public.user_subscriptions 
WHERE user_id = auth.uid();

-- הרץ את הפונקציה
SELECT public.update_user_plan_type('creators_extreme'::plan_type);

-- אחרי השינוי - בדוק שהחבילה השתנתה
SELECT plan_type, updated_at 
FROM public.user_subscriptions 
WHERE user_id = auth.uid();
```

**תוצאה צפויה:**
- `plan_type` צריך להשתנות
- `updated_at` צריך להתעדכן

