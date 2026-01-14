# מדריך בדיקה ותיקון - מערכת Subscriptions

## 📋 סטטוס נוכחי

### ✅ מה שכבר עובד:
1. **טבלת user_subscriptions** - קיימת ומוגדרת
2. **RLS Policies** - מוגדרות נכון
3. **עמודת default_track** - קיימת
4. **RPC function update_user_default_track** - קיימת ועובדת
5. **SubscriptionProvider** - מתוקן לטעון default_track נכון

### ⚠️ מה שצריך תיקון:
1. **משתמש maorcomp@gmail.com** - קיים אבל אין לו subscription
   - **פתרון**: להריץ את `fix_user_subscription_maorcomp.sql` ב-Supabase SQL Editor

## 🔧 שלבי תיקון

### שלב 1: תיקון subscription למשתמש קיים

1. פתח את Supabase Dashboard
2. לך ל-SQL Editor
3. הריץ את הקובץ: `fix_user_subscription_maorcomp.sql`
4. ודא שהפלט מציג subscription נוצר/מעודכן

### שלב 2: בדיקת זרימת כניסה

לאחר תיקון ה-subscription, בדוק:

1. **התחברות עם maorcomp@gmail.com**
   - פתח את האפליקציה
   - לחץ על "התחברות"
   - הכנס: maorcomp@gmail.com + סיסמה
   - ודא שהכניסה מצליחה

2. **טעינת subscription**
   - ודא שה-subscription נטען נכון
   - בדוק ב-console שאין שגיאות
   - ודא ש-default_track נטען (אם קיים)

3. **עדכון default_track**
   - אם צריך, עדכן את default_track דרך ה-RPC
   - ודא שהעדכון עובד

### שלב 3: בדיקת זרימת רישום חדש

1. **רישום משתמש חדש**
   - התנתק מהמשתמש הנוכחי
   - לחץ על "הרשמה"
   - מלא פרטים + בחר חבילה
   - ודא שה-subscription נוצר אוטומטית

2. **בדיקת trigger**
   - אם ה-subscription לא נוצר, בדוק:
     - האם הטריגר מותקן? (הרץ `verify_and_fix_trigger.sql`)
     - האם יש plan_type ב-metadata?

## 🧪 הרצת בדיקות

### בדיקת סטטוס מערכת:
```bash
npx tsx check_system_status.ts
```

### בדיקת זרימת רישום:
```bash
npx tsx tests/test-signup-flow.ts
```

## 📝 הערות חשובות

1. **טריגר לא רץ על משתמשים קיימים**
   - הטריגר רץ רק על INSERT חדש
   - משתמשים שנוצרו לפני התקנת הטריגר צריכים subscription ידני

2. **Service Role Key**
   - נדרש ליצירת subscriptions ידנית
   - הוסף ל-`.env.local`: `SUPABASE_SERVICE_ROLE_KEY=your_key`

3. **default_track**
   - נדרש רק לחבילות trial ו-creators
   - חבילות אחרות לא דורשות בחירת תחום

## 🐛 פתרון בעיות

### בעיה: Subscription לא נטען אחרי התחברות
**פתרון:**
1. בדוק ב-console אם יש שגיאות
2. ודא שה-RLS policies מוגדרות נכון
3. בדוק שה-subscription קיים ב-DB

### בעיה: default_track לא נשמר
**פתרון:**
1. ודא שהעמודה קיימת (הרץ `supabase_fix_default_track_column.sql`)
2. ודא שה-RPC function קיימת
3. בדוק שה-RLS מאפשרת עדכון דרך RPC

### בעיה: טריגר לא יוצר subscription
**פתרון:**
1. הרץ `verify_and_fix_trigger.sql` לבדיקה
2. אם הטריגר חסר, הרץ `supabase_migration_subscription_system.sql`
3. ודא שיש plan_type ב-metadata של המשתמש

