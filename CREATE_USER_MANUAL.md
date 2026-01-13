# הוראות ליצירת משתמש ידנית ב-Supabase

## דרך 1: יצירת משתמש דרך Supabase Dashboard (הכי פשוט)

### שלב 1: היכנס ל-Supabase Dashboard
1. לך ל-https://supabase.com/dashboard
2. בחר את הפרויקט שלך

### שלב 2: עבור ל-Authentication → Users
1. בתפריט השמאלי, לחץ על **Authentication**
2. לחץ על **Users** (תחת MANAGE)

### שלב 3: צור משתמש חדש
1. לחץ על הכפתור **"Add user"** או **"Invite user"** (בפינה הימנית העליונה)
2. מלא את הפרטים:
   - **Email**: `viralytest@test.com`
   - **Password**: `Test123456!@#`
   - **Auto Confirm User**: ✅ סמן את זה (כך המשתמש יהיה מאומת מיד)
   - **User Metadata** (אופציונלי): 
     ```json
     {
       "plan_type": "creators"
     }
     ```
3. לחץ על **"Create user"** או **"Send invitation"**

### שלב 4: וודא שהמשתמש נוצר
1. המשתמש אמור להופיע ברשימת המשתמשים
2. ודא שהסטטוס הוא **"Confirmed"** (לא "Unconfirmed")
3. אם הוא לא מאומת, לחץ עליו ולחץ על **"Confirm user"**

---

## דרך 2: יצירת משתמש דרך SQL Editor

### שלב 1: פתח את SQL Editor
1. ב-Supabase Dashboard, לחץ על **SQL Editor** בתפריט השמאלי
2. לחץ על **"New query"**

### שלב 2: הרץ את השאילתה הבאה:

```sql
-- יצירת משתמש חדש עם metadata
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'viralytest@test.com',
  crypt('Test123456!@#', gen_salt('bf')),
  now(),
  '{"plan_type": "creators"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (email) DO NOTHING;
```

### שלב 3: בדוק שהמשתמש נוצר
1. לך ל-Authentication → Users
2. המשתמש אמור להופיע ברשימה

---

## דרך 3: יצירת משתמש דרך Supabase CLI (אם מותקן)

```bash
# התחבר ל-Supabase
supabase login

# בחר את הפרויקט
supabase link --project-ref YOUR_PROJECT_REF

# צור משתמש
supabase db execute "
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'viralytest@test.com',
    crypt('Test123456!@#', gen_salt('bf')),
    now(),
    '{\"plan_type\": \"creators\"}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (email) DO NOTHING;
"
```

---

## פתרון בעיית "Email invalid"

אם אתה מקבל שגיאה שהאימייל לא תקין, זה יכול להיות בגלל:

### 1. בדוק את Email Validation Rules
1. לך ל-Authentication → Settings
2. בדוק את **"Email validation"** - ודא שאין כללים שחוסמים את האימייל

### 2. בדוק את Domain Block List
1. לך ל-Authentication → Settings
2. בדוק את **"Blocked email domains"** - ודא ש-`test.com` לא חסום

### 3. נסה אימייל אחר
אם `test.com` חסום, נסה:
- `viralytest@gmail.com`
- `viralytest@example.com`
- או כל דומיין אחר

### 4. השבית Email Validation זמנית
1. לך ל-Authentication → Settings
2. מצא את **"Email validation"**
3. השבית זמנית לבדיקות

---

## לאחר יצירת המשתמש

1. **ודא שהמשתמש מאומת**: Status צריך להיות "Confirmed"
2. **ודא שיש subscription**: לך ל-Table Editor → `user_subscriptions` ובדוק שיש רשומה למשתמש
3. **נסה להתחבר**: חזור לאפליקציה ונסה להתחבר עם:
   - Email: `viralytest@test.com`
   - Password: `Test123456!@#`

---

## הערות חשובות

- אם יצרת משתמש דרך SQL, ייתכן שצריך ליצור גם את ה-subscription ידנית
- ודא שה-trigger `on_auth_user_created_subscription` קיים ופועל
- אם ה-metadata לא נשמר, ה-subscription לא ייווצר אוטומטית

