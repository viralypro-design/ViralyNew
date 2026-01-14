import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { supabase } from '@/lib/supabaseClient';
import { PLAN_CONFIG, ACTIVE_PLANS } from '@/config/planConfig';
import { PlanType } from '@/types/subscription';

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
  animation: ${fadeIn} 0.3s ease-out;
`;

const ModalContent = styled.div`
  background: linear-gradient(145deg, #0a0a0a, #111);
  border: 2px solid #D4A043;
  border-radius: 20px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 0 60px rgba(212, 160, 67, 0.4), 0 0 100px rgba(212, 160, 67, 0.1);
  animation: ${fadeIn} 0.4s ease-out;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: #0a0a0a;
  }
  &::-webkit-scrollbar-thumb {
    background: #D4A043;
    border-radius: 3px;
  }
`;

const ModalHeader = styled.div`
  padding: 30px 30px 20px;
  text-align: center;
  border-bottom: 1px solid rgba(212, 160, 67, 0.2);
  position: relative;
  
  h2 {
    color: #D4A043;
    font-size: 2rem;
    margin-bottom: 10px;
    font-weight: 700;
    text-shadow: 0 0 20px rgba(212, 160, 67, 0.3);
  }
  
  p {
    color: #aaa;
    font-size: 0.95rem;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: transparent;
  border: 1px solid rgba(212, 160, 67, 0.3);
  color: #D4A043;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.3s;
  z-index: 10;
  
  &:hover {
    background: rgba(212, 160, 67, 0.1);
    border-color: #D4A043;
    transform: rotate(90deg);
  }
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid rgba(212, 160, 67, 0.2);
  margin: 0 30px;
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 3px solid ${props => props.$active ? '#D4A043' : 'transparent'};
  color: ${props => props.$active ? '#D4A043' : '#666'};
  padding: 15px;
  font-family: 'Assistant', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    color: #D4A043;
  }
`;

const FormContainer = styled.div`
  padding: 30px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Input = styled.input`
  width: 100%;
  background: rgba(15, 15, 15, 0.8);
  border: 1px solid rgba(212, 160, 67, 0.3);
  border-radius: 10px;
  padding: 15px 20px;
  color: #e0e0e0;
  font-family: 'Assistant', sans-serif;
  font-size: 1rem;
  transition: all 0.3s;
  
  &:focus {
    outline: none;
    border-color: #D4A043;
    box-shadow: 0 0 20px rgba(212, 160, 67, 0.2);
    background: rgba(15, 15, 15, 0.95);
  }
  
  &::placeholder {
    color: #666;
  }
`;

const PlanSelectionButton = styled.button<{ $selected: boolean }>`
  width: 100%;
  background: ${props => props.$selected 
    ? 'linear-gradient(135deg, rgba(212, 160, 67, 0.2), rgba(212, 160, 67, 0.1))' 
    : 'rgba(15, 15, 15, 0.8)'};
  border: 2px solid ${props => props.$selected ? '#D4A043' : 'rgba(212, 160, 67, 0.3)'};
  border-radius: 12px;
  padding: 15px 20px;
  color: ${props => props.$selected ? '#D4A043' : '#ccc'};
  font-family: 'Assistant', sans-serif;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  &:hover {
    border-color: #D4A043;
    transform: translateX(-3px);
    box-shadow: 0 5px 20px rgba(212, 160, 67, 0.2);
  }
  
  .plan-name {
    font-weight: 700;
    font-size: 1.1rem;
  }
  
  .plan-details {
    font-size: 0.85rem;
    color: #888;
    margin-top: 5px;
  }
`;

const PlanModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 20px;
  animation: ${fadeIn} 0.3s ease-out;
`;

const PlanModalContent = styled.div`
  background: linear-gradient(145deg, #0a0a0a, #111);
  border: 2px solid #D4A043;
  border-radius: 20px;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 30px;
  box-shadow: 0 0 60px rgba(212, 160, 67, 0.4);
`;

const PlanModalTitle = styled.h3`
  color: #D4A043;
  font-size: 1.5rem;
  margin-bottom: 20px;
  text-align: center;
`;

const PlansGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-top: 20px;
`;

const PlanOption = styled.div<{ $selected: boolean }>`
  background: ${props => props.$selected 
    ? 'linear-gradient(135deg, rgba(212, 160, 67, 0.25), rgba(212, 160, 67, 0.15))' 
    : 'rgba(15, 15, 15, 0.8)'};
  border: 2px solid ${props => props.$selected ? '#D4A043' : 'rgba(212, 160, 67, 0.3)'};
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
  
  &:hover {
    border-color: #D4A043;
    transform: translateY(-3px);
    box-shadow: 0 10px 30px rgba(212, 160, 67, 0.3);
  }
  
  h4 {
    color: ${props => props.$selected ? '#D4A043' : '#ccc'};
    font-size: 1.2rem;
    margin-bottom: 8px;
    font-weight: 700;
  }
  
  .plan-features {
    color: #888;
    font-size: 0.85rem;
    margin-top: 10px;
    text-align: right;
    
    .feature {
      margin: 5px 0;
      
      &::before {
        content: '• ';
        color: #D4A043;
      }
    }
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  background: linear-gradient(135deg, #b8862e 0%, #e6be74 50%, #b8862e 100%);
  background-size: 200% auto;
  color: #000;
  border: none;
  border-radius: 50px;
  padding: 16px;
  font-family: 'Assistant', sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(212, 160, 67, 0.3);
  margin-top: 10px;
  position: relative;
  overflow: hidden;

  &:hover:not(:disabled) {
    background-position: right center;
    transform: translateY(-2px);
    box-shadow: 0 6px 30px rgba(212, 160, 67, 0.5);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }
  
  &:hover::before {
    left: 100%;
  }
`;

const ErrorMsg = styled.div`
  color: #ff4d4d;
  font-size: 0.9rem;
  text-align: center;
  padding: 10px;
  background: rgba(255, 77, 77, 0.1);
  border: 1px solid rgba(255, 77, 77, 0.3);
  border-radius: 8px;
`;

const SuccessMsg = styled.div`
  color: #4CAF50;
  font-size: 0.9rem;
  text-align: center;
  padding: 10px;
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 8px;
`;

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPlan?: PlanType;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialPlan,
  initialMode = 'login'
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(initialPlan || 'trial');
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [showTrackSelection, setShowTrackSelection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // עדכן את המצב כאשר initialPlan או initialMode משתנים
  React.useEffect(() => {
    if (isOpen) {
      if (initialMode) {
        setMode(initialMode);
      }
      if (initialPlan) {
        setSelectedPlan(initialPlan);
      }
    }
  }, [isOpen, initialPlan, initialMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        setError(`שגיאה בהתחברות: ${signInError.message}`);
        setLoading(false);
        return;
      }

      if (data?.session) {
        setSuccess('התחברת בהצלחה!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError('הסיסמאות לא תואמות');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      setLoading(false);
      return;
    }

    // בדיקה שחבילת נסיון או יוצרים דורשת בחירת תחום
    if ((selectedPlan === 'trial' || selectedPlan === 'creators') && !selectedTrack) {
      setError('נא לבחור תחום ניתוח');
      setLoading(false);
      return;
    }

    try {
      // קבל את ה-URL הנוכחי ל-redirect אחרי אימות
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            plan_type: selectedPlan,
          },
          emailRedirectTo: redirectUrl
        }
      });

      if (signUpError) {
        setError(`שגיאה ביצירת משתמש: ${signUpError.message}`);
        setLoading(false);
        return;
      }

      if (signUpData?.user) {
        setSuccess('המשתמש נוצר בהצלחה! מתחבר...');
        
        // המתן שהטריגר יוצר את ה-subscription
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // בדוק אם יש subscription, אם לא - צור אותו ידנית
        const { data: existingSubscription } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', signUpData.user.id)
          .single();
        
        // עדכן את ה-subscription עם החבילה והתחום באמצעות RPC
        if (selectedTrack && (selectedPlan === 'trial' || selectedPlan === 'creators')) {
          try {
            const { error: trackError } = await supabase.rpc('update_user_default_track', {
              p_user_id: signUpData.user.id,
              p_default_track: selectedTrack
            });
            if (trackError) {
              console.error('Error updating default track:', trackError);
            }
          } catch (err) {
            console.error('Error updating default track:', err);
          }
        }

        if (!existingSubscription) {
          // אם אין subscription, צור אותו ידנית
          const { error: subError } = await supabase
            .from('user_subscriptions')
            .insert({
              user_id: signUpData.user.id,
              plan_type: selectedPlan,
              status: 'active',
              minutes_used_monthly: 0,
              analyses_used_monthly: 0,
              default_track: selectedTrack || null
            });
          
          if (subError) {
            console.error('Error creating subscription:', subError);
            // נמשיך גם אם יש שגיאה - אולי הטריגר יצר אותו
          }
        } else {
          // עדכן את ה-subscription עם החבילה והתחום
          const updateData: any = { plan_type: selectedPlan };
          if (selectedTrack) {
            updateData.default_track = selectedTrack;
          }
          
          const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update(updateData)
            .eq('user_id', signUpData.user.id);
          
          if (updateError) {
            console.error('Error updating subscription:', updateError);
            // נסה דרך RPC אם יש default_track
            if (selectedTrack) {
              try {
                await supabase.rpc('update_user_default_track', {
                  p_user_id: signUpData.user.id,
                  p_default_track: selectedTrack
                });
              } catch (err) {
                console.error('Error updating default track via RPC:', err);
              }
            }
          }
        }
        
        // רענן את ה-subscription לפני התחברות
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInError) {
          // אם יש שגיאה אבל המשתמש נוצר, יכול להיות שצריך אימות אימייל
          if (signInError.message.includes('email') || signInError.message.includes('confirm')) {
            setSuccess('המשתמש נוצר בהצלחה! אנא אמת את האימייל שלך ונסה להתחבר שוב.');
          } else {
            setError(`המשתמש נוצר אבל לא ניתן להתחבר: ${signInError.message}`);
          }
        } else if (signInData?.session) {
          setSuccess('נרשמת והתחברת בהצלחה!');
          // רענן את ה-subscription
          setTimeout(async () => {
            // רענן את ה-subscription דרך context
            await new Promise(resolve => setTimeout(resolve, 500));
            onSuccess();
            onClose();
          }, 500);
        }
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת משתמש');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ModalOverlay onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}>
        <ModalContent onClick={e => e.stopPropagation()}>
          <CloseButton 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          >
            ✕
          </CloseButton>
          <ModalHeader>
            <h2>{mode === 'login' ? 'התחברות' : 'הרשמה'}</h2>
            <p>{mode === 'login' ? 'התחבר לחשבון שלך' : 'צור חשבון חדש והתחל להשתמש'}</p>
          </ModalHeader>

          <TabsContainer>
            <Tab $active={mode === 'login'} onClick={() => { setMode('login'); setError(null); }}>
              התחברות
            </Tab>
            <Tab $active={mode === 'signup'} onClick={() => { setMode('signup'); setError(null); }}>
              הרשמה
            </Tab>
          </TabsContainer>

          <FormContainer>
            {mode === 'login' ? (
              <Form onSubmit={handleLogin}>
                <Input
                  type="email"
                  placeholder="אימייל"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="סיסמה"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {error && <ErrorMsg>{error}</ErrorMsg>}
                {success && <SuccessMsg>{success}</SuccessMsg>}
                <SubmitButton type="submit" disabled={loading}>
                  {loading ? 'מתחבר...' : 'התחבר'}
                </SubmitButton>
              </Form>
            ) : (
              <Form onSubmit={handleSignUp}>
                <Input
                  type="email"
                  placeholder="אימייל"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="סיסמה (לפחות 6 תווים)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Input
                  type="password"
                  placeholder="אימות סיסמה"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
                
                <PlanSelectionButton
                  $selected={true}
                  type="button"
                  onClick={() => setShowPlanSelection(true)}
                >
                  <div>
                    <div className="plan-name">{PLAN_CONFIG[selectedPlan].label}</div>
                    <div className="plan-details">
                      {PLAN_CONFIG[selectedPlan].maxAnalysesPerMonth === -1 
                        ? '∞' 
                        : PLAN_CONFIG[selectedPlan].maxAnalysesPerMonth} ניתוחים/חודש
                    </div>
                  </div>
                  <span style={{ fontSize: '1.2rem' }}>▼</span>
                </PlanSelectionButton>

                {/* הצג חלון בחירת תחום אם נבחרה חבילת נסיון או יוצרים */}
                {(selectedPlan === 'trial' || selectedPlan === 'creators') && (
                  <>
                    {selectedTrack ? (
                      <div style={{ 
                        marginTop: '15px', 
                        padding: '15px', 
                        background: 'rgba(212, 160, 67, 0.1)', 
                        border: '1px solid rgba(212, 160, 67, 0.3)', 
                        borderRadius: '8px',
                        textAlign: 'right'
                      }}>
                        <div style={{ color: '#D4A043', fontWeight: 600, marginBottom: '5px' }}>
                          תחום נבחר: {selectedTrack === 'actors' ? 'שחקנים ואודישנים' : 
                                       selectedTrack === 'musicians' ? 'זמרים ומוזיקאים' :
                                       selectedTrack === 'creators' ? 'יוצרי תוכן וכוכבי רשת' :
                                       'משפיענים ומותגים'}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTrackSelection(true)}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(212, 160, 67, 0.3)',
                            color: '#D4A043',
                            padding: '8px 15px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            marginTop: '8px'
                          }}
                        >
                          שנה תחום
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowTrackSelection(true)}
                        style={{
                          width: '100%',
                          marginTop: '15px',
                          padding: '15px',
                          background: 'rgba(212, 160, 67, 0.1)',
                          border: '2px dashed rgba(212, 160, 67, 0.5)',
                          borderRadius: '8px',
                          color: '#D4A043',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: 600
                        }}
                      >
                        בחר תחום ניתוח
                      </button>
                    )}
                  </>
                )}

                {error && <ErrorMsg>{error}</ErrorMsg>}
                {success && <SuccessMsg>{success}</SuccessMsg>}
                <SubmitButton 
                  type="submit" 
                  disabled={loading || ((selectedPlan === 'trial' || selectedPlan === 'creators') && !selectedTrack)}
                >
                  {loading ? 'נרשם...' : 'הרשמה'}
                </SubmitButton>
                {(selectedPlan === 'trial' || selectedPlan === 'creators') && !selectedTrack && (
                  <div style={{ 
                    color: '#ff4d4d', 
                    fontSize: '0.85rem', 
                    textAlign: 'center', 
                    marginTop: '10px' 
                  }}>
                    נא לבחור תחום ניתוח
                  </div>
                )}
              </Form>
            )}
          </FormContainer>
        </ModalContent>
      </ModalOverlay>

      {showPlanSelection && (
        <PlanModal onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowPlanSelection(false);
          }
        }}>
          <PlanModalContent onClick={e => e.stopPropagation()}>
            <button
              type="button"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: '1px solid rgba(212, 160, 67, 0.3)',
                color: '#D4A043',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                zIndex: 10
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPlanSelection(false);
              }}
            >
              ✕
            </button>
            <PlanModalTitle>בחר חבילה</PlanModalTitle>
            <PlansGrid>
              {ACTIVE_PLANS.map((planType) => {
                const plan = PLAN_CONFIG[planType];
                const isSelected = selectedPlan === planType;
                
                return (
                  <PlanOption
                    key={planType}
                    $selected={isSelected}
                    onClick={() => {
                      setSelectedPlan(planType);
                      setShowPlanSelection(false);
                      // אם החבילה היא נסיון או יוצרים, אפס את בחירת התחום
                      if (planType === 'trial' || planType === 'creators') {
                        setSelectedTrack(null);
                      }
                    }}
                  >
                    <h4>{plan.label}</h4>
                    <div className="plan-features">
                      <div className="feature">
                        {plan.maxAnalysesPerMonth === -1 ? '∞' : plan.maxAnalysesPerMonth} ניתוחים
                      </div>
                      <div className="feature">
                        עד {plan.maxVideoMinutes} דקות
                      </div>
                    </div>
                  </PlanOption>
                );
              })}
            </PlansGrid>
          </PlanModalContent>
        </PlanModal>
      )}

      {showTrackSelection && (
        <PlanModal onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowTrackSelection(false);
          }
        }}>
          <PlanModalContent onClick={e => e.stopPropagation()}>
            <button
              type="button"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: '1px solid rgba(212, 160, 67, 0.3)',
                color: '#D4A043',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                zIndex: 10
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTrackSelection(false);
              }}
            >
              ✕
            </button>
            <PlanModalTitle>בחר תחום ניתוח</PlanModalTitle>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '15px',
              marginTop: '20px'
            }}>
              {[
                { id: 'actors', label: 'שחקנים ואודישנים' },
                { id: 'musicians', label: 'זמרים ומוזיקאים' },
                { id: 'creators', label: 'יוצרי תוכן וכוכבי רשת' },
                { id: 'influencers', label: 'משפיענים ומותגים' }
              ].map((track) => {
                const isSelected = selectedTrack === track.id;
                return (
                  <PlanOption
                    key={track.id}
                    $selected={isSelected}
                    onClick={() => {
                      setSelectedTrack(track.id);
                      setShowTrackSelection(false);
                    }}
                  >
                    <h4>{track.label}</h4>
                  </PlanOption>
                );
              })}
            </div>
          </PlanModalContent>
        </PlanModal>
      )}
    </>
  );
};

