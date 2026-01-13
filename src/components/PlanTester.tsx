import React, { useState } from 'react';
import styled from 'styled-components';
import { useSubscription } from '@/context/SubscriptionProvider';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { PLAN_CONFIG, ACTIVE_PLANS } from '@/config/planConfig';
import { PlanType } from '@/types/subscription';
import { supabase } from '@/lib/supabaseClient';

const Container = styled.div`
  background: #0a0a0a;
  border: 1px solid #D4A043;
  border-radius: 12px;
  padding: 30px;
  margin: 20px auto;
  max-width: 900px;
  color: #e0e0e0;
`;

const Title = styled.h2`
  color: #D4A043;
  text-align: center;
  margin-bottom: 20px;
  font-size: 1.8rem;
`;

const CurrentPlan = styled.div`
  background: rgba(212, 160, 67, 0.1);
  border: 1px solid rgba(212, 160, 67, 0.3);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
  
  h3 {
    color: #D4A043;
    margin-bottom: 10px;
  }
  
  p {
    margin: 5px 0;
    color: #ccc;
  }
  
  strong {
    color: #D4A043;
  }
`;

const PlansGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
`;

const PlanCard = styled.div<{ $isActive: boolean }>`
  background: ${props => props.$isActive ? 'rgba(212, 160, 67, 0.15)' : '#0f0f0f'};
  border: 1px solid ${props => props.$isActive ? '#D4A043' : '#333'};
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: #D4A043;
    transform: translateY(-2px);
  }
  
  h4 {
    color: ${props => props.$isActive ? '#D4A043' : '#ccc'};
    margin-bottom: 10px;
  }
  
  .label {
    color: #888;
    font-size: 0.9rem;
  }
`;

const Button = styled.button`
  background: linear-gradient(135deg, #b8862e 0%, #e6be74 50%, #b8862e 100%);
  color: #000;
  border: none;
  border-radius: 50px;
  padding: 12px 25px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  margin: 5px;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(212, 160, 67, 0.5);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled.button`
  background: transparent;
  border: 1px solid #888;
  color: #ccc;
  border-radius: 50px;
  padding: 12px 25px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  margin: 5px;
  
  &:hover:not(:disabled) {
    border-color: #D4A043;
    color: #D4A043;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const FeaturesList = styled.div`
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  
  h4 {
    color: #D4A043;
    margin-bottom: 15px;
  }
  
  .feature {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #222;
    
    &:last-child {
      border-bottom: none;
    }
    
    .name {
      color: #ccc;
    }
    
    .value {
      color: ${props => props.color || '#D4A043'};
      font-weight: 600;
    }
  }
`;

const ErrorMsg = styled.div`
  color: #ff4d4d;
  background: rgba(255, 77, 77, 0.1);
  border: 1px solid #ff4d4d;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
`;

const SuccessMsg = styled.div`
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid #4ade80;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
`;

export function PlanTester() {
  const { subscription, loading, refresh } = useSubscription();
  const access = usePlanAccess(subscription);
  const [changingPlan, setChangingPlan] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePlan = async (newPlan: PlanType) => {
    if (!subscription) {
      setMessage({ type: 'error', text: 'אין subscription פעיל' });
      return;
    }

    setChangingPlan(true);
    setMessage(null);

    try {
      // שינוי plan דרך Supabase - צריך service_role key
      // אבל אנחנו משתמשים ב-anon key, אז ננסה דרך RPC או נצטרך לעשות זאת ידנית
      
      // הערה: לפי ה-policies, רק service_role יכול לעדכן
      // אז נציג הוראות למשתמש איך לעשות זאת ידנית
      
      setMessage({
        type: 'error',
        text: `לא ניתן לשנות חבילה דרך האפליקציה (רק service_role יכול). נא לעדכן ידנית ב-Supabase Dashboard או להריץ SQL:
        
UPDATE public.user_subscriptions 
SET plan_type = '${newPlan}' 
WHERE user_id = '${subscription.user_id}';`
      });
      
      // נסה בכל זאת (יתכשל אבל נראה את השגיאה)
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ plan_type: newPlan })
        .eq('user_id', subscription.user_id);

      if (error) {
        if (error.message.includes('policy') || error.message.includes('permission')) {
          setMessage({
            type: 'error',
            text: `לא ניתן לשנות חבילה דרך האפליקציה. נא לעדכן ידנית ב-Supabase Dashboard → Table Editor → user_subscriptions או להריץ SQL ב-SQL Editor.`
          });
        } else {
          setMessage({ type: 'error', text: `שגיאה: ${error.message}` });
        }
      } else {
        setMessage({ type: 'success', text: `החבילה שונתה ל-${PLAN_CONFIG[newPlan].label}!` });
        await refresh();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `שגיאה: ${err.message}` });
    } finally {
      setChangingPlan(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <Title>בודק חבילה...</Title>
      </Container>
    );
  }

  if (!subscription) {
    return (
      <Container>
        <Title>אין חבילה פעילה</Title>
        <p>אין subscription למשתמש זה. נא ליצור subscription ב-Supabase.</p>
      </Container>
    );
  }

  if (!access) {
    return (
      <Container>
        <Title>שגיאה בטעינת הרשאות</Title>
        <p>לא ניתן לטעון את הרשאות החבילה. ייתכן שה-plan_type לא תקין.</p>
      </Container>
    );
  }

  const planConfig = PLAN_CONFIG[subscription.plan_type];

  return (
    <Container>
      <Title>🧪 בדיקת חבילות - Plan Tester</Title>

      {message && (
        message.type === 'success' ? (
          <SuccessMsg>{message.text}</SuccessMsg>
        ) : (
          <ErrorMsg>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{message.text}</pre>
          </ErrorMsg>
        )
      )}

      <CurrentPlan>
        <h3>📦 חבילה נוכחית</h3>
        <p><strong>שם:</strong> {access.planLabel} ({subscription.plan_type})</p>
        <p><strong>סטטוס:</strong> {subscription.status}</p>
        <p><strong>ניתוחים שנוצלו:</strong> {subscription.analyses_used_monthly} / {planConfig.maxAnalysesPerMonth === -1 ? '∞' : planConfig.maxAnalysesPerMonth}</p>
        <p><strong>דקות שנוצלו:</strong> {subscription.minutes_used_monthly} / {planConfig.maxMinutesPerMonth}</p>
        <p><strong>ניתן להריץ ניתוח:</strong> {access.canRunAnalysis() ? '✅ כן' : '❌ לא'}</p>
        <p><strong>יש דקות זמינות:</strong> {access.hasMinutesLeft() ? '✅ כן' : '❌ לא'}</p>
      </CurrentPlan>

      <h3 style={{ color: '#D4A043', marginBottom: '15px' }}>שינוי חבילה:</h3>
      <PlansGrid>
        {ACTIVE_PLANS.map((planType) => {
          const isActive = subscription.plan_type === planType;
          const plan = PLAN_CONFIG[planType];
          return (
            <PlanCard
              key={planType}
              $isActive={isActive}
              onClick={() => !isActive && !changingPlan && handleChangePlan(planType)}
            >
              <h4>{plan.label}</h4>
              <div className="label">{planType}</div>
              {isActive && <div style={{ color: '#D4A043', marginTop: '10px' }}>✓ פעיל</div>}
            </PlanCard>
          );
        })}
      </PlansGrid>

      <FeaturesList>
        <h4>תכונות זמינות:</h4>
        {Object.entries(planConfig.features).map(([feature, enabled]) => (
          <div key={feature} className="feature">
            <span className="name">{feature}</span>
            <span className="value">{enabled ? '✅ כן' : '❌ לא'}</span>
          </div>
        ))}
      </FeaturesList>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <SecondaryButton onClick={refresh} disabled={changingPlan}>
          🔄 רענן נתונים
        </SecondaryButton>
      </div>
    </Container>
  );
}

