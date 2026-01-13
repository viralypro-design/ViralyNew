import React from 'react';
import { useSubscription } from '@/context/SubscriptionProvider';
import { usePlanAccess } from '@/hooks/usePlanAccess';

// דוגמה לשימוש נכון ב-usePlanAccess עם useSubscription
export function ExampleUsage() {
  const { subscription, loading } = useSubscription();

  // טעינה
  if (loading) {
    return <div>טוען...</div>; // או <Loader />
  }

  // אם אין subscription - המשתמש עדיין לא בחר חבילה
  if (!subscription) {
    return (
      <div>
        {/* או <ChoosePlanScreen /> */}
        <p>אנא בחר חבילה כדי להמשיך</p>
      </div>
    );
  }

  // קבלת access לפי subscription
  const access = usePlanAccess(subscription);

  // אם אין access (לא אמור לקרות אחרי בדיקת subscription, אבל זה בטיחות)
  if (!access) {
    return <div>שגיאה בטעינת הרשאות</div>;
  }

  // בדיקה אם ניתן להריץ ניתוח
  if (!access.canRunAnalysis()) {
    return (
      <div>
        {/* או <UpgradeModal /> */}
        <p>הגעת למכסת הניתוחים החודשית. שדרג את המנוי להמשך.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>תוכנית: {access.planLabel}</h2>
      
      {/* הצג תכונות לפי הרשאות */}
      {access.hasFeature('pdf_export') && (
        <button>ייצא ל-PDF</button>
      )}

      {access.hasFeature('compare_videos') && (
        <button>השווה סרטונים</button>
      )}

      {access.hasFeature('student_dashboard') && (
        <div>לוח בקרה לתלמידים</div>
      )}

      {/* בדיקות נוספות */}
      {access.hasMinutesLeft() ? (
        <p>נותרו דקות זמינות</p>
      ) : (
        <p>הגעת למכסת הדקות החודשית</p>
      )}
    </div>
  );
}

