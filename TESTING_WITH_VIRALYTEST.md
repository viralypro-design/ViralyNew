# 🧪 מדריך בדיקה עם משתמש viralytest@test.com

## 📋 הכנה לבדיקה

### שלב 1: וודא שיש subscription למשתמש
הרץ את `check_test_user_status.sql` ב-Supabase SQL Editor:
- בודק אם המשתמש קיים
- בודק אם יש subscription
- יוצר subscription אם חסר

### שלב 2: התחברות
1. פתח את האפליקציה
2. התחבר עם:
   - **Email**: `viralytest@test.com`
   - **Password**: `Test123456!@#`
3. בדוק ב-console שהכניסה הצליחה

## 🔍 מה לבדוק

### 1. טעינת Subscription
- [ ] ה-subscription נטען נכון
- [ ] אין שגיאות ב-console
- [ ] ה-plan_type נכון
- [ ] ה-default_track נטען (אם קיים)

### 2. מעבר בין חבילות
יש 2 דרכים:

#### דרך 1: SimplePlanManager
- [ ] פתח את SimplePlanManager (אם יש כפתור/טאב)
- [ ] לחץ על "🔄 שנה חבילה" של חבילה אחרת
- [ ] בדוק אם זה עובד או מציג שגיאה
- [ ] אם יש שגיאה, העתק את ה-SQL שהוצע

#### דרך 2: PlanTester
- [ ] פתח את PlanTester (אם יש כפתור/טאב)
- [ ] לחץ על חבילה אחרת
- [ ] בדוק אם זה עובד או מציג שגיאה

#### דרך 3: עדכון ידני ב-SQL
אם המעבר לא עובד דרך האפליקציה (בגלל RLS), עדכן ידנית:

```sql
-- עדכון חבילה למשתמש viralytest@test.com
UPDATE public.user_subscriptions 
SET plan_type = 'creators_extreme'  -- שנה לחבילה הרצויה
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'viralytest@test.com'
);
```

לאחר העדכון:
- [ ] לחץ על "🔄 רענן נתונים" ב-PlanTester/SimplePlanManager
- [ ] בדוק שהחבילה התעדכנה

### 3. בדיקת הרשאות
לאחר שינוי חבילה, בדוק:
- [ ] `canRunAnalysis()` - האם ניתן להריץ ניתוח?
- [ ] `hasMinutesLeft()` - האם יש דקות זמינות?
- [ ] `canUploadVideo()` - האם ניתן להעלות סרטון?
- [ ] התכונות (features) נכונות לפי החבילה

### 4. בדיקת default_track
אם החבילה היא `trial` או `creators`:
- [ ] בדוק שה-default_track נטען נכון
- [ ] נסה לשנות תחום
- [ ] בדוק שהשינוי נשמר

## 🐛 רישום תקלות

### אם יש שגיאה ב-console, רשם:
1. **הודעת השגיאה המלאה**
2. **מתי זה קרה** (בכניסה? בשינוי חבילה? בטעינת subscription?)
3. **מה עשית לפני השגיאה**
4. **הקוד הרלוונטי** (אם יש)

### דוגמאות לשגיאות נפוצות:
- `Subscription loaded: {plan_type: undefined, ...}` - subscription לא נטען
- `No subscription or planAccess yet` - אין subscription
- `RPC failed` - RPC function לא עובד
- `policy` או `permission` - בעיית RLS

## 📝 קבצים רלוונטיים

- `check_test_user_status.sql` - בדיקה ויצירת subscription
- `src/components/SimplePlanManager.tsx` - ממשק מעבר בין חבילות
- `src/components/PlanTester.tsx` - ממשק בדיקת חבילות
- `src/context/SubscriptionProvider.tsx` - טעינת subscription
- `src/hooks/usePlanAccess.ts` - בדיקת הרשאות

## ✅ רשימת בדיקה מהירה

```
□ משתמש viralytest@test.com קיים
□ יש subscription למשתמש
□ התחברות מצליחה
□ Subscription נטען נכון
□ מעבר בין חבילות עובד (או מציג הוראות SQL)
□ הרשאות נכונות לפי החבילה
□ default_track נטען (אם רלוונטי)
□ אין שגיאות ב-console
```

