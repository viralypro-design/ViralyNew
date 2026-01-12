import React from 'react';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { SubscriptionRow } from '@/types/subscription';

// דוגמה לשימוש ב-hook ב-UI
interface ExampleUsageProps {
  subscription?: SubscriptionRow;
}

export function ExampleUsage({ subscription }: ExampleUsageProps) {
  const access = usePlanAccess(subscription);

  // אם אין מנוי פעיל - הצג טעינה או הודעת שגיאה
  if (!access) {
    return <div>טוען...</div>; // או <Loader />
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

