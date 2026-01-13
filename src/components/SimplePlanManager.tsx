import React, { useState } from 'react';
import styled from 'styled-components';
import { useSubscription } from '@/context/SubscriptionProvider';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { PLAN_CONFIG, ACTIVE_PLANS } from '@/config/planConfig';
import { PlanType } from '@/types/subscription';
import { supabase } from '@/lib/supabaseClient';

const Container = styled.div`
  background: linear-gradient(145deg, #0a0a0a, #111);
  border: 2px solid #D4A043;
  border-radius: 16px;
  padding: 30px;
  margin: 20px auto;
  max-width: 1000px;
  color: #e0e0e0;
  box-shadow: 0 0 30px rgba(212, 160, 67, 0.2);
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 30px;
  
  h2 {
    color: #D4A043;
    font-size: 2rem;
    margin-bottom: 10px;
  }
  
  p {
    color: #888;
    font-size: 0.95rem;
  }
`;

const CurrentPlanCard = styled.div`
  background: rgba(212, 160, 67, 0.15);
  border: 2px solid #D4A043;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
  text-align: center;
  
  .plan-name {
    color: #D4A043;
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 15px;
  }
  
  .plan-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin-top: 20px;
  }
  
  .detail-item {
    background: rgba(0, 0, 0, 0.3);
    padding: 12px;
    border-radius: 8px;
    
    .label {
      color: #888;
      font-size: 0.85rem;
      margin-bottom: 5px;
    }
    
    .value {
      color: #D4A043;
      font-size: 1.2rem;
      font-weight: 700;
    }
  }
`;

const PlansGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const PlanCard = styled.div<{ $isActive: boolean; $canSelect: boolean }>`
  background: ${props => props.$isActive ? 'rgba(212, 160, 67, 0.2)' : '#0f0f0f'};
  border: 2px solid ${props => props.$isActive ? '#D4A043' : '#333'};
  border-radius: 12px;
  padding: 20px;
  cursor: ${props => props.$canSelect ? 'pointer' : 'default'};
  transition: all 0.3s;
  position: relative;
  
  ${props => props.$canSelect && !props.$isActive && `
    &:hover {
      border-color: #D4A043;
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(212, 160, 67, 0.3);
    }
  `}
  
  ${props => props.$isActive && `
    &::before {
      content: '✓ פעיל';
      position: absolute;
      top: 10px;
      left: 10px;
      background: #D4A043;
      color: #000;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
    }
  `}
  
  h3 {
    color: ${props => props.$isActive ? '#D4A043' : '#ccc'};
    font-size: 1.3rem;
    margin-bottom: 10px;
    margin-top: ${props => props.$isActive ? '25px' : '0'};
  }
  
  .plan-type {
    color: #888;
    font-size: 0.85rem;
    margin-bottom: 15px;
  }
  
  .plan-features {
    color: #aaa;
    font-size: 0.9rem;
    line-height: 1.6;
    
    .feature {
      margin: 5px 0;
      
      &::before {
        content: '• ';
        color: #D4A043;
      }
    }
  }
  
  .change-button {
    margin-top: 15px;
    width: 100%;
    padding: 10px;
    background: ${props => props.$isActive ? 'transparent' : 'linear-gradient(135deg, #b8862e 0%, #e6be74 50%, #b8862e 100%)'};
    color: ${props => props.$isActive ? '#888' : '#000'};
    border: ${props => props.$isActive ? '1px solid #333' : 'none'};
    border-radius: 8px;
    font-weight: 700;
    cursor: ${props => props.$isActive ? 'default' : 'pointer'};
    transition: all 0.3s;
    
    ${props => !props.$isActive && `
      &:hover {
        transform: scale(1.05);
      }
    `}
  }
`;

const InstructionsBox = styled.div`
  background: rgba(212, 160, 67, 0.1);
  border: 1px dashed rgba(212, 160, 67, 0.4);
  border-radius: 8px;
  padding: 20px;
  margin-top: 30px;
  
  h4 {
    color: #D4A043;
    margin-bottom: 15px;
    font-size: 1.1rem;
  }
  
  ol {
    margin: 0;
    padding-right: 20px;
    color: #ccc;
    line-height: 1.8;
    
    li {
      margin-bottom: 10px;
    }
  }
  
  code {
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
    color: #D4A043;
    font-family: 'Courier New', monospace;
  }
`;

export function SimplePlanManager() {
  const { subscription, loading, refresh } = useSubscription();
  const access = usePlanAccess(subscription);
  const [copiedPlan, setCopiedPlan] = useState<string | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePlan = async (planType: PlanType) => {
    if (!subscription || changingPlan) return;
    
    setChangingPlan(true);
    setMessage(null);
    
    try {
      // נסה לעדכן דרך RPC function
      const { data, error } = await supabase.rpc('update_user_plan_type', {
        new_plan_type: planType
      });
      
      if (error) {
        // אם RPC לא עובד, נסה דרך SQL ישיר (יתכשל בגלל RLS אבל נראה את השגיאה)
        console.log('RPC failed, trying direct update (will likely fail due to RLS):', error);
        
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({ plan_type: planType })
          .eq('user_id', subscription.user_id);
        
        if (updateError) {
          // אם גם זה נכשל, הצג הודעת שגיאה והעתק SQL
          if (updateError.message.includes('policy') || updateError.message.includes('permission')) {
            const sql = `UPDATE public.user_subscriptions 
SET plan_type = '${planType}' 
WHERE user_id = '${subscription.user_id}';`;
            
            navigator.clipboard.writeText(sql);
            setCopiedPlan(planType);
            setMessage({
              type: 'error',
              text: `לא ניתן לשנות חבילה דרך האפליקציה. SQL הועתק ללוח. נא להריץ ב-Supabase SQL Editor.`
            });
          } else {
            setMessage({ type: 'error', text: `שגיאה: ${updateError.message}` });
          }
        } else {
          // הצלחה דרך update ישיר (לא אמור לקרות בגלל RLS)
          setMessage({ type: 'success', text: `החבילה שונתה ל-${PLAN_CONFIG[planType].label}!` });
          await refresh();
        }
      } else if (data && data.success) {
        // הצלחה דרך RPC
        setMessage({ type: 'success', text: `החבילה שונתה ל-${PLAN_CONFIG[planType].label}!` });
        await refresh();
      } else {
        // RPC החזיר שגיאה
        setMessage({ 
          type: 'error', 
          text: data?.error || 'שגיאה לא ידועה בעדכון החבילה' 
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `שגיאה: ${err.message}` });
    } finally {
      setChangingPlan(false);
    }
  };

  const handleCopySQL = (planType: PlanType) => {
    if (!subscription) return;
    
    const sql = `UPDATE public.user_subscriptions 
SET plan_type = '${planType}' 
WHERE user_id = '${subscription.user_id}';`;
    
    navigator.clipboard.writeText(sql);
    setCopiedPlan(planType);
    setTimeout(() => setCopiedPlan(null), 2000);
  };

  if (loading) {
    return (
      <Container>
        <Header>
          <h2>📦 ניהול חבילות</h2>
          <p>טוען...</p>
        </Header>
      </Container>
    );
  }

  if (!subscription) {
    return (
      <Container>
        <Header>
          <h2>📦 ניהול חבילות</h2>
          <p style={{ color: '#ff4d4d' }}>אין חבילה פעילה. נא להתחבר או ליצור subscription.</p>
        </Header>
      </Container>
    );
  }

  if (!access) {
    return (
      <Container>
        <Header>
          <h2>📦 ניהול חבילות</h2>
          <p style={{ color: '#ff4d4d' }}>שגיאה בטעינת הרשאות. ייתכן שה-plan_type לא תקין.</p>
        </Header>
      </Container>
    );
  }

  const planConfig = PLAN_CONFIG[subscription.plan_type];
  const maxAnalyses = planConfig.maxAnalysesPerMonth === -1 ? '∞' : planConfig.maxAnalysesPerMonth;

  return (
    <Container>
      <Header>
        <h2>📦 ניהול חבילות</h2>
        <p>בדוק ושינוי חבילות בקלות</p>
      </Header>

      <CurrentPlanCard>
        <div className="plan-name">{access.planLabel}</div>
        <div className="plan-details">
          <div className="detail-item">
            <div className="label">ניתוחים</div>
            <div className="value">
              {subscription.analyses_used_monthly} / {maxAnalyses}
            </div>
          </div>
          <div className="detail-item">
            <div className="label">דקות</div>
            <div className="value">
              {subscription.minutes_used_monthly} / {planConfig.maxMinutesPerMonth}
            </div>
          </div>
          <div className="detail-item">
            <div className="label">ניתן להריץ ניתוח</div>
            <div className="value">{access.canRunAnalysis() ? '✅ כן' : '❌ לא'}</div>
          </div>
          <div className="detail-item">
            <div className="label">יש דקות זמינות</div>
            <div className="value">{access.hasMinutesLeft() ? '✅ כן' : '❌ לא'}</div>
          </div>
        </div>
      </CurrentPlanCard>

      <h3 style={{ color: '#D4A043', marginBottom: '20px', textAlign: 'center' }}>
        בחר חבילה חדשה:
      </h3>

      <PlansGrid>
        {ACTIVE_PLANS.map((planType) => {
          const isActive = subscription.plan_type === planType;
          const plan = PLAN_CONFIG[planType];
          const canSelect = !isActive;

          return (
            <PlanCard
              key={planType}
              $isActive={isActive}
              $canSelect={canSelect}
            >
              <h3>{plan.label}</h3>
              <div className="plan-type">{planType}</div>
              <div className="plan-features">
                <div className="feature">
                  {plan.maxAnalysesPerMonth === -1 ? '∞' : plan.maxAnalysesPerMonth} ניתוחים/חודש
                </div>
                <div className="feature">
                  {plan.maxMinutesPerMonth} דקות/חודש
                </div>
                <div className="feature">
                  עד {plan.maxVideoMinutes} דקות לסרטון
                </div>
                {plan.maxStudents && (
                  <div className="feature">
                    עד {plan.maxStudents} תלמידים
                  </div>
                )}
              </div>
              <button
                className="change-button"
                onClick={() => canSelect && handleChangePlan(planType)}
                disabled={isActive || changingPlan}
              >
                {isActive
                  ? 'חבילה פעילה'
                  : changingPlan
                  ? 'מעדכן...'
                  : '🔄 שנה חבילה'}
              </button>
            </PlanCard>
          );
        })}
      </PlansGrid>

      {message && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
          background: message.type === 'success' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
          border: `1px solid ${message.type === 'success' ? '#4CAF50' : '#f44336'}`,
          color: message.type === 'success' ? '#4CAF50' : '#f44336',
          textAlign: 'center',
          fontWeight: 600
        }}>
          {message.text}
        </div>
      )}
      
      <InstructionsBox>
        <h4>📝 איך לשנות חבילה:</h4>
        <ol>
          <li>לחץ על כפתור <strong>"🔄 שנה חבילה"</strong> של החבילה הרצויה</li>
          <li>החבילה תתעדכן אוטומטית ללא צורך ברענון</li>
          <li>אם יש שגיאה, נסה דרך <strong>Supabase Dashboard → SQL Editor</strong></li>
        </ol>
      </InstructionsBox>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button
          onClick={refresh}
          style={{
            background: 'transparent',
            border: '1px solid #D4A043',
            color: '#D4A043',
            borderRadius: '50px',
            padding: '12px 30px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(212, 160, 67, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          🔄 רענן נתונים
        </button>
      </div>
    </Container>
  );
}

