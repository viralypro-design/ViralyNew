# 🚨 הוראות דחופות לתיקון הבעיה

## הבעיה:
המשתמש `maorcomp@gmail.com` (user_id: `08608158-5604-4415-b045-655890779a3b`) מתחבר אבל אין לו subscription.

## פתרון מיידי:

### שלב 1: הרץ את ה-SQL ב-Supabase
1. פתח Supabase Dashboard
2. לך ל-SQL Editor
3. העתק והדבק את הקוד הבא:

```sql
-- תיקון מיידי למשתמש maorcomp@gmail.com
BEGIN;

DO $$
DECLARE
  v_user_id uuid := '08608158-5604-4415-b045-655890779a3b'::uuid;
  v_plan_type text := 'trial';
  v_default_track text := 'musicians';
BEGIN
  -- בדיקה אם כבר יש subscription
  IF EXISTS(SELECT 1 FROM public.user_subscriptions WHERE user_id = v_user_id) THEN
    RAISE NOTICE 'Subscription already exists, updating...';
    
    UPDATE public.user_subscriptions
    SET 
      plan_type = 'trial'::plan_type,
      status = 'active',
      default_track = v_default_track,
      updated_at = now()
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Subscription updated successfully';
  ELSE
    -- יצירת subscription חדש
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_type,
      status,
      minutes_used_monthly,
      analyses_used_monthly,
      default_track
    ) VALUES (
      v_user_id,
      'trial'::plan_type,
      'active',
      0,
      0,
      v_default_track
    );
    
    RAISE NOTICE 'Subscription created successfully';
  END IF;
END $$;

-- הצגת התוצאה
SELECT 
  u.email,
  us.plan_type,
  us.status,
  us.default_track,
  us.minutes_used_monthly,
  us.analyses_used_monthly
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
WHERE u.id = '08608158-5604-4415-b045-655890779a3b'::uuid;

COMMIT;
```

4. לחץ על "Run" או F5
5. ודא שהפלט מציג subscription נוצר/מעודכן

### שלב 2: רענון בדפדפן
1. רענן את הדף (F5)
2. התנתק והתחבר שוב
3. בדוק שה-subscription נטען

## אם זה לא עובד:

### בדיקה 1: וודא שהטבלה קיימת
```sql
SELECT * FROM public.user_subscriptions LIMIT 1;
```

### בדיקה 2: וודא שה-RLS מאפשר קריאה
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_subscriptions';
-- צריך להחזיר: rowsecurity = true
```

### בדיקה 3: בדוק את ה-policies
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'user_subscriptions';
-- צריך להחזיר לפחות policy אחת ל-SELECT
```

## הערות:
- הטריגר רץ רק על משתמשים חדשים (INSERT)
- משתמשים קיימים צריכים subscription ידני
- אחרי יצירת ה-subscription, המשתמש צריך להתנתק ולהתחבר שוב

