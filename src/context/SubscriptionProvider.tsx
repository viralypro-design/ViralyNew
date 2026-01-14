import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import { SubscriptionRow } from '@/types/subscription';

type SubscriptionContextType = {
  subscription: SubscriptionRow | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSubscription(retryCount = 0) {
    setLoading(true);
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError(sessionError.message);
      setLoading(false);
      return;
    }

    if (!session?.user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Try to get subscription - if admin, might not have one, that's OK
    // נסה לקרוא את כל העמודות כולל default_track (אם קיים)
    let { data, error } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_type, status, minutes_used_monthly, analyses_used_monthly, created_at, updated_at, default_track')
      .eq('user_id', session.user.id)
      .maybeSingle(); // Use maybeSingle instead of single to avoid error if no row

    // אם יש שגיאה בגלל עמודה שלא קיימת (default_track), נסה בלי זה
    if (error && (error.code === 'PGRST204' || error.message?.includes('406') || error.message?.includes('column') || error.message?.includes('does not exist'))) {
      console.warn('[SubscriptionProvider] Error with default_track column, trying without it:', error.message);
      const { data: dataWithoutTrack, error: errorWithoutTrack } = await supabase
        .from('user_subscriptions')
        .select('user_id, plan_type, status, minutes_used_monthly, analyses_used_monthly, created_at, updated_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (errorWithoutTrack) {
        error = errorWithoutTrack;
      } else {
        data = dataWithoutTrack;
        error = null;
      }
    }

    if (error) {
      if (error.code === 'PGRST116') {
        // אין subscription – המשתמש עדיין לא בחר חבילה
        // אם זה אחרי התחברות חדשה, נסה שוב (יכול להיות שהטריגר עדיין לא רץ)
        if (retryCount < 3) {
          console.log(`[SubscriptionProvider] No subscription found, retrying... (${retryCount + 1}/3)`);
          setTimeout(() => {
            loadSubscription(retryCount + 1);
          }, 1000 * (retryCount + 1)); // 1s, 2s, 3s
          return;
        }
        setSubscription(null);
      } else {
        setError(error.message);
        console.error('[SubscriptionProvider] Error loading subscription:', error);
      }
    } else {
      if (data) {
        console.log('[SubscriptionProvider] Subscription loaded:', {
          plan_type: data.plan_type,
          default_track: (data as any)?.default_track,
          status: data.status,
          user_id: data.user_id
        });
        setSubscription(data);
      } else {
        console.warn('[SubscriptionProvider] No subscription found for user:', session.user.id);
        
        // נסה ליצור subscription אוטומטית אם יש plan_type ב-metadata
        const planType = session.user.user_metadata?.plan_type;
        if (planType && ['trial', 'creators', 'creators_extreme', 'coach', 'coach_pro'].includes(planType)) {
          console.log('[SubscriptionProvider] Found plan_type in metadata, attempting to create subscription...', {
            user_id: session.user.id,
            plan_type: planType,
            default_track: session.user.user_metadata?.default_track
          });
          
          try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('create_user_subscription', {
              p_user_id: session.user.id,
              p_plan_type: planType,
              p_default_track: session.user.user_metadata?.default_track || null
            });
            
            if (rpcError) {
              console.error('[SubscriptionProvider] Failed to create subscription via RPC:', rpcError);
              console.warn('[SubscriptionProvider] User needs subscription. Please create it manually or contact support.');
            } else if (rpcData?.success) {
              console.log('[SubscriptionProvider] Subscription created successfully via RPC:', rpcData);
              // המתן קצת ואז טען שוב
              await new Promise(resolve => setTimeout(resolve, 500));
              // טען את ה-subscription שוב
              loadSubscription(0);
              return; // יצא מהפונקציה, loadSubscription יטען את הנתונים
            } else {
              console.error('[SubscriptionProvider] RPC returned error:', rpcData);
            }
          } catch (err: any) {
            console.error('[SubscriptionProvider] Error creating subscription:', err);
          }
        } else {
          console.warn('[SubscriptionProvider] No plan_type in metadata. User needs to choose a plan.');
        }
        
        setSubscription(null);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSubscription();

    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[SubscriptionProvider] Auth state changed:', event, session?.user?.id);
      // אחרי התחברות או אימות, נסה לטעון את ה-subscription עם retry
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // המתן שהטריגר/עדכונים יושלמו - זמן ארוך יותר ל-SIGNED_IN
        const delay = event === 'SIGNED_IN' ? 1500 : 500;
        console.log(`[SubscriptionProvider] Waiting ${delay}ms for trigger/updates to complete...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        loadSubscription(0);
      } else if (event === 'SIGNED_OUT') {
        // אחרי התנתקות, נקה את ה-subscription מיד
        setSubscription(null);
        setLoading(false);
        setError(null);
      } else {
        loadSubscription(0);
      }
    });

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        error,
        refresh: loadSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error(
      'useSubscription must be used inside SubscriptionProvider'
    );
  }
  return context;
}

