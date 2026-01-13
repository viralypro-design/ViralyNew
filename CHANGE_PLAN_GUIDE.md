# 🧪 מדריך לבדיקת חבילות ושינוי חבילה

## איך לבדוק את החבילות

### 1. דרך האפליקציה (PlanTester)
לאחר התחברות, תראה קומפוננטה "🧪 בדיקת חבילות - Plan Tester" בראש הדף.

הקומפוננטה מציגה:
- ✅ **חבילה נוכחית** - שם, סטטוס, שימוש, הרשאות
- 📦 **כל החבילות הזמינות** - לחץ על חבילה כדי לנסות לשנות
- 🎯 **תכונות זמינות** - רשימת כל התכונות והאם הן פעילות

### 2. בדיקת הרשאות
הקומפוננטה בודקת:
- ✅ האם ניתן להריץ ניתוח (`canRunAnalysis()`)
- ✅ האם יש דקות זמינות (`hasMinutesLeft()`)
- ✅ אילו תכונות זמינות (`hasFeature()`)

---

## איך לשנות חבילה

### דרך 1: דרך Supabase Dashboard (הכי פשוט)

#### שלב 1: היכנס ל-Supabase Dashboard
1. לך ל-https://supabase.com/dashboard
2. בחר את הפרויקט שלך

#### שלב 2: עבור ל-Table Editor
1. לחץ על **Table Editor** בתפריט השמאלי
2. בחר את הטבלה **`user_subscriptions`**

#### שלב 3: מצא את המשתמש
1. חפש את המשתמש שלך לפי `user_id` (המזהה של המשתמש מ-`auth.users`)
2. או חפש לפי אימייל דרך `auth.users` ואז העתק את ה-`id`

#### שלב 4: עדכן את החבילה
1. לחץ על השורה של המשתמש
2. שנה את `plan_type` לאחת מהאפשרויות הזמינות:
   - `trial` - ניסיון
   - `creators` - יוצרים
   - `creators_extreme` - יוצרים באקסטרים
   
   **הערה:** חבילות `coach` ו-`coach_pro` מושבתות כרגע ולא זמינות בממשק
3. לחץ על **Save**

#### שלב 5: רענן את האפליקציה
1. חזור לאפליקציה
2. לחץ על כפתור **🔄 רענן נתונים** ב-PlanTester
3. החבילה אמורה להתעדכן

---

### דרך 2: דרך SQL Editor (למשתמשים מתקדמים)

#### שלב 1: פתח את SQL Editor
1. ב-Supabase Dashboard, לחץ על **SQL Editor**
2. לחץ על **"New query"**

#### שלב 2: הרץ את השאילתה הבאה:

```sql
-- שינוי חבילה למשתמש ספציפי
UPDATE public.user_subscriptions 
SET plan_type = 'creators_extreme'  -- שנה לחבילה הרצויה
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'viralytest@test.com'  -- שנה לאימייל שלך
);
```

#### אפשרויות ל-plan_type (זמינות כרגע):
- `'trial'` - ניסיון
- `'creators'` - יוצרים
- `'creators_extreme'` - יוצרים באקסטרים

#### חבילות מושבתות (לא זמינות כרגע):
- `'coach'` - מאמנים וסוכנויות (מושבת)
- `'coach_pro'` - מאמנים וסוכנויות PRO (מושבת)

#### שלב 3: בדוק שהשינוי בוצע
```sql
-- בדיקה שהחבילה שונתה
SELECT 
  u.email,
  us.plan_type,
  us.status,
  us.analyses_used_monthly,
  us.minutes_used_monthly
FROM public.user_subscriptions us
JOIN auth.users u ON u.id = us.user_id
WHERE u.email = 'viralytest@test.com';
```

---

## בדיקת Flow מלא

### 1. בדוק חבילת Trial
```sql
UPDATE public.user_subscriptions 
SET plan_type = 'trial' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'viralytest@test.com');
```
**צפוי:**
- ✅ 1 ניתוח לחודש
- ✅ 1 דקה לחודש
- ✅ אין תכונות פרימיום

### 2. בדוק חבילת Creators
```sql
UPDATE public.user_subscriptions 
SET plan_type = 'creators' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'viralytest@test.com');
```
**צפוי:**
- ✅ 10 ניתוחים לחודש
- ✅ 30 דקות לחודש
- ✅ PDF export
- ✅ Progress tracking
- ✅ Analysis history

### 3. בדוק חבילת Creators Extreme
```sql
UPDATE public.user_subscriptions 
SET plan_type = 'creators_extreme' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'viralytest@test.com');
```
**צפוי:**
- ✅ 30 ניתוחים לחודש
- ✅ 100 דקות לחודש
- ✅ כל התכונות של Creators
- ✅ Advanced analysis
- ✅ Compare videos

### 4. בדוק חבילת Coach (מושבת כרגע)
```sql
-- הערה: חבילה זו מושבתת כרגע ולא זמינה בממשק
UPDATE public.user_subscriptions 
SET plan_type = 'coach' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'viralytest@test.com');
```
**צפוי:**
- ✅ ניתוחים ללא הגבלה (-1)
- ✅ 200 דקות לחודש
- ✅ כל התכונות
- ✅ Student dashboard
- ✅ Students management
- ✅ עד 10 תלמידים

### 5. בדוק חבילת Coach Pro (מושבת כרגע)
```sql
-- הערה: חבילה זו מושבתת כרגע ולא זמינה בממשק
UPDATE public.user_subscriptions 
SET plan_type = 'coach_pro' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'viralytest@test.com');
```
**צפוי:**
- ✅ ניתוחים ללא הגבלה (-1)
- ✅ 300 דקות לחודש
- ✅ כל התכונות
- ✅ עד 30 תלמידים

---

## בדיקת הגבלות

### בדיקת מכסת ניתוחים
1. שנה את `analyses_used_monthly` ל-10 (לחבילת creators)
2. נסה להריץ ניתוח
3. **צפוי:** `canRunAnalysis()` יחזיר `false`

### בדיקת מכסת דקות
1. שנה את `minutes_used_monthly` ל-30 (לחבילת creators)
2. נסה להריץ ניתוח
3. **צפוי:** `hasMinutesLeft()` יחזיר `false`

### בדיקת תכונות
1. שנה ל-`trial`
2. **צפוי:** כל התכונות `false`
3. שנה ל-`creators_extreme`
4. **צפוי:** כל התכונות `true` (חוץ מ-student features)

---

## טיפים לבדיקה

1. **רענן תמיד אחרי שינוי** - לחץ על "🔄 רענן נתונים" ב-PlanTester
2. **בדוק את ה-console** - יש לוגים שמראים את הבדיקות
3. **בדוק את ה-DB** - ודא שהשינויים נשמרו ב-`user_subscriptions`
4. **בדוק RLS** - ודא שהמשתמש יכול לקרוא רק את המנוי שלו

---

## פתרון בעיות

### החבילה לא משתנה
- ✅ ודא שאתה משתמש ב-service_role key (אם דרך API)
- ✅ או עדכן דרך Dashboard/SQL Editor
- ✅ ודא שה-RLS policies מאפשרות קריאה

### לא רואה את החבילה
- ✅ רענן את הדף
- ✅ לחץ על "🔄 רענן נתונים"
- ✅ בדוק ב-console אם יש שגיאות

### שגיאת "Invalid plan_type"
- ✅ ודא שה-plan_type תואם ל-enum ב-DB
- ✅ בדוק ב-`planConfig.ts` שהחבילה קיימת

