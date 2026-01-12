# ✅ רשימת בדיקות אבטחה למערכת Subscriptions

## 📋 דרישות לבדיקה:

### ✅ 1. משתמש מחובר לא יכול לראות subscription של אחר
**איך לבדוק:**
```sql
-- עם anon key של משתמש A
SELECT * FROM public.user_subscriptions;
-- אמור להחזיר רק את המנוי של משתמש A
```

**Policy נדרש:**
- `"Users can read own subscription"` עם `USING (auth.uid() = user_id)`

**סטטוס:** ✅ מוגדר ב-migration

---

### ✅ 2. Refresh לא משנה plan
**איך לבדוק:**
```sql
-- עם anon key (לא service_role)
UPDATE public.user_subscriptions 
SET plan_type = 'creators_extreme' 
WHERE user_id = auth.uid();
-- אמור להיכשל עם שגיאה: "new row violates row-level security policy"
```

**Policy נדרש:**
- `"Service role can update subscriptions"` - רק `service_role` יכול לעדכן

**סטטוס:** ✅ מוגדר ב-migration - משתמש רגיל לא יכול לעדכן

---

### ✅ 3. Logout / Login שומר חבילה
**איך לבדוק:**
1. התחבר עם משתמש שיש לו subscription
2. בדוק את `plan_type`
3. התנתק והתחבר שוב
4. בדוק שוב את `plan_type` - צריך להיות זהה

**Policy נדרש:**
- אין policy שמאפשרת למשתמש לעדכן - רק `service_role`

**סטטוס:** ✅ מוגדר ב-migration - logout/login לא משנה כי אין אפשרות לעדכן

---

### ✅ 4. אין subscription בלי בחירה
**איך לבדוק:**
```sql
-- יצירת משתמש חדש בלי plan_type ב-metadata
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  gen_random_uuid(),
  'test@example.com',
  '{}'::jsonb  -- אין plan_type
);
-- לא אמור ליצור subscription ב-user_subscriptions
```

**Trigger נדרש:**
- `handle_new_user_subscription()` - בודק אם יש `plan_type` ב-metadata
- אם אין - לא יוצר subscription

**סטטוס:** ✅ מוגדר ב-migration - trigger בודק אם יש plan_type

---

### ✅ 5. שינוי plan אפשרי רק דרך admin / service
**איך לבדוק:**
```sql
-- עם service_role key - אמור לעבוד
UPDATE public.user_subscriptions 
SET plan_type = 'coach' 
WHERE user_id = 'some-user-id';

-- עם anon key - אמור להיכשל
UPDATE public.user_subscriptions 
SET plan_type = 'coach' 
WHERE user_id = auth.uid();
-- אמור להיכשל
```

**Policy נדרש:**
- `"Service role can update subscriptions"` - רק `service_role`

**סטטוס:** ✅ מוגדר ב-migration - רק service_role יכול לעדכן

---

## 🔧 הפעלת Migration

לפני הבדיקות, יש להריץ את ה-migration:
```sql
-- להריץ את הקובץ: supabase_migration_subscription_system.sql
```

---

## 📊 בדיקות אוטומטיות

לאחר הפעלת ה-migration, להריץ:
```sql
-- בדיקה 1: RLS מופעל
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_subscriptions';
-- אמור להחזיר: rowsecurity = true

-- בדיקה 2: Policies קיימות
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'user_subscriptions';
-- אמור להחזיר 3 policies: SELECT, INSERT, UPDATE

-- בדיקה 3: אין policy ל-DELETE
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'user_subscriptions' AND cmd = 'DELETE';
-- אמור להחזיר 0 שורות

-- בדיקה 4: Trigger קיים
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
  AND trigger_schema = 'auth'
  AND trigger_name = 'on_auth_user_created_subscription';
-- אמור להחזיר את ה-trigger

-- בדיקה 5: ENUMs קיימים
SELECT typname, array_agg(enumlabel) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('plan_type', 'subscription_status')
GROUP BY typname;
-- אמור להחזיר: plan_type ו-subscription_status
```

---

## ⚠️ הערות חשובות

1. **אין fallback ל-trial** - אם אין subscription, אין גישה
2. **אין localStorage** - כל הנתונים מה-DB בלבד
3. **DELETE חסום** - אין policy ל-DELETE, אז אף אחד לא יכול למחוק
4. **רק service_role יכול לעדכן** - מונע שינוי בצד לקוח
5. **Trigger יוצר subscription רק עם plan_type** - אין default

---

## 🚀 שלבים לביצוע

1. ✅ הריץ את `supabase_migration_subscription_system.sql`
2. ✅ בדוק את ה-policies עם הבדיקות האוטומטיות
3. ✅ בדוק ידנית כל דרישה עם anon key ו-service_role key
4. ✅ ודא שאין subscription בלי plan_type
5. ✅ ודא שמשתמש לא יכול לעדכן את המנוי שלו

