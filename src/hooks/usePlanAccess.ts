import { PLAN_CONFIG } from '@/config/planConfig';
import { FeatureKey, SubscriptionRow } from '@/types/subscription';

/**
 * ממשק גישה לחבילה
 * כל הפונקציות הן pure functions - ללא side effects
 * מונע race conditions על ידי חישוב סינכרוני וטהור
 */
export interface PlanAccess {
  readonly planLabel: string;
  readonly maxExperts: number; // מספר מקסימלי של מומחים שניתן לבחור
  readonly maxDomains: number; // מספר מקסימלי של תחומים (tracks) זמינים
  readonly maxVideoMinutes: number; // אורך מקסימלי של סרטון בדקות
  readonly maxVideoMB: number; // גודל מקסימלי של סרטון ב-MB
  hasFeature(feature: FeatureKey): boolean;
  canUploadVideo(videoMinutes: number, videoMB: number): boolean;
  canRunAnalysis(): boolean;
  hasMinutesLeft(): boolean;
  canAddStudent(currentCount: number): boolean;
  canSelectExpert(currentCount: number): boolean; // האם ניתן לבחור עוד מומחה
  canSelectTrack(): boolean; // האם ניתן לבחור תחום נוסף
}

/**
 * Hook לבדיקת הרשאות לפי מנוי
 * 
 * @param subscription - מנוי מה-DB בלבד (אין localStorage או fallback)
 * @returns PlanAccess | null - null אם אין מנוי פעיל (אין fallback לחבילת ניסיון)
 * 
 * התנהגות:
 * - מחזיר null אם אין subscription או שהוא לא active
 * - מחזיר null אם plan_type לא קיים ב-PLAN_CONFIG
 * - כל הפונקציות הן pure - ללא side effects
 * - ללא race conditions - כל החישובים סינכרוניים וטהורים
 */
export function usePlanAccess(subscription?: SubscriptionRow): PlanAccess | null {
  // אין fallback - אם אין subscription, מחזיר null
  if (!subscription || subscription.status !== 'active') {
    return null;
  }

  // Validation - וידוא שה-plan_type קיים בקונפיג
  const plan = PLAN_CONFIG[subscription.plan_type];
  if (!plan) {
    // Production safety - אם plan_type לא תקין, מחזיר null
    console.error(`Invalid plan_type: ${subscription.plan_type}`);
    return null;
  }

  // יצירת אובייקט עם פונקציות pure - ללא side effects
  // כל הפונקציות משתמשות בערכים מה-subscription שהועברו
  // אין גישה ל-state חיצוני או localStorage
  return {
    planLabel: plan.label,
    maxExperts: plan.allowedDomains, // allowedDomains = מספר מומחים מקסימלי
    maxDomains: plan.allowedDomains, // allowedDomains = מספר תחומים מקסימלי
    maxVideoMinutes: plan.maxVideoMinutes,
    maxVideoMB: plan.maxVideoMB,

    hasFeature(feature: FeatureKey): boolean {
      return Boolean(plan.features[feature]);
    },

    canUploadVideo(videoMinutes: number, videoMB: number): boolean {
      // Validation - וידוא שהערכים תקינים
      if (videoMinutes < 0 || videoMB < 0) {
        return false;
      }
      return (
        videoMinutes <= plan.maxVideoMinutes &&
        videoMB <= plan.maxVideoMB
      );
    },

    canRunAnalysis(): boolean {
      // -1 = ללא הגבלה
      if (plan.maxAnalysesPerMonth === -1) {
        return true;
      }
      // Validation - וידוא שהערך תקין
      if (subscription.analyses_used_monthly < 0) {
        return false;
      }
      return (
        subscription.analyses_used_monthly < plan.maxAnalysesPerMonth
      );
    },

    hasMinutesLeft(): boolean {
      // Validation - וידוא שהערך תקין
      if (subscription.minutes_used_monthly < 0) {
        return false;
      }
      return (
        subscription.minutes_used_monthly < plan.maxMinutesPerMonth
      );
    },

    canAddStudent(currentCount: number): boolean {
      // רק למסלול premium יש maxStudents
      if (!plan.maxStudents) {
        return false;
      }
      // Validation - וידוא שהערך תקין
      if (currentCount < 0) {
        return false;
      }
      return currentCount < plan.maxStudents;
    },

    canSelectExpert(currentCount: number): boolean {
      // Validation - וידוא שהערך תקין
      if (currentCount < 0) {
        return false;
      }
      return currentCount < plan.allowedDomains;
    },

    canSelectTrack(): boolean {
      // כל החבילות מאפשרות לפחות תחום אחד
      return plan.allowedDomains > 0;
    },
  };
}

