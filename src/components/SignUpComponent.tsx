import React, { useState } from 'react';
import styled from 'styled-components';
import { supabase } from '@/lib/supabaseClient';
import { PLAN_CONFIG, ACTIVE_PLANS } from '@/config/planConfig';
import { PlanType } from '@/types/subscription';

const SignUpContainer = styled.div`
  max-width: 600px;
  margin: 50px auto;
  padding: 40px;
  background: #0a0a0a;
  border: 1px solid #D4A043;
  border-radius: 12px;
  box-shadow: 0 0 40px rgba(212, 160, 67, 0.2);
`;

const SignUpTitle = styled.h2`
  color: #D4A043;
  text-align: center;
  margin-bottom: 30px;
  font-size: 1.8rem;
`;

const SignUpForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const SignUpInput = styled.input`
  width: 100%;
  background: #0f0f0f;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 15px;
  color: #e0e0e0;
  font-family: 'Assistant', sans-serif;
  font-size: 1rem;
  transition: border-color 0.3s;
  
  &:focus {
    outline: none;
    border-color: #D4A043;
  }
  
  &::placeholder {
    color: #999;
  }
`;

const PlanSelectionSection = styled.div`
  margin-top: 20px;
  padding: 20px;
  background: rgba(212, 160, 67, 0.05);
  border: 1px solid rgba(212, 160, 67, 0.3);
  border-radius: 8px;
`;

const PlanSelectionTitle = styled.h3`
  color: #D4A043;
  font-size: 1.2rem;
  margin-bottom: 15px;
  text-align: center;
`;

const PlansGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-top: 15px;
`;

const PlanOption = styled.div<{ $selected: boolean }>`
  background: ${props => props.$selected ? 'rgba(212, 160, 67, 0.2)' : '#0f0f0f'};
  border: 2px solid ${props => props.$selected ? '#D4A043' : '#333'};
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
  
  &:hover {
    border-color: #D4A043;
    transform: translateY(-2px);
  }
  
  h4 {
    color: ${props => props.$selected ? '#D4A043' : '#ccc'};
    font-size: 1.1rem;
    margin-bottom: 8px;
  }
  
  .plan-desc {
    color: #888;
    font-size: 0.85rem;
    margin-top: 5px;
  }
  
  .plan-features {
    color: #aaa;
    font-size: 0.8rem;
    margin-top: 8px;
    text-align: right;
    
    .feature {
      margin: 3px 0;
      
      &::before {
        content: '• ';
        color: #D4A043;
      }
    }
  }
`;

const SignUpButton = styled.button`
  background: linear-gradient(135deg, #b8862e 0%, #e6be74 50%, #b8862e 100%);
  background-size: 200% auto;
  color: #000;
  border: none;
  border-radius: 50px;
  padding: 15px;
  font-family: 'Assistant', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(212, 160, 67, 0.3);
  margin-top: 10px;

  &:hover:not(:disabled) {
    background-position: right center;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(212, 160, 67, 0.5);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorMsg = styled.div`
  color: #ff4d4d;
  font-size: 0.9rem;
  text-align: center;
  margin-top: 10px;
`;

const SuccessMsg = styled.div`
  color: #4CAF50;
  font-size: 0.9rem;
  text-align: center;
  margin-top: 10px;
`;

const SwitchModeButton = styled.button`
  background: transparent;
  border: 1px solid #888;
  color: #ccc;
  padding: 10px 20px;
  border-radius: 50px;
  font-family: 'Assistant', sans-serif;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 15px;
  width: 100%;

  &:hover {
    border-color: #D4A043;
    color: #D4A043;
  }
`;

interface SignUpComponentProps {
  onSignUp: () => void;
  onSwitchToLogin: () => void;
}

export const SignUpComponent: React.FC<SignUpComponentProps> = ({ onSignUp, onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('trial');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validation
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

    try {
      // Create user in Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            plan_type: selectedPlan, // Set plan_type in metadata for trigger
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered') || 
            signUpError.message.includes('User already registered')) {
          setError('משתמש עם האימייל הזה כבר קיים. נסה להתחבר במקום.');
        } else {
          setError(`שגיאה ביצירת משתמש: ${signUpError.message}`);
        }
        setLoading(false);
        return;
      }

      if (signUpData?.user) {
        setSuccess('המשתמש נוצר בהצלחה! מתחבר...');
        
        // Wait a bit for the trigger to create subscription
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to sign in automatically
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInError) {
          if (signInError.message.includes('Email not confirmed') || 
              signInError.message.includes('email_not_confirmed')) {
            setError('המשתמש נוצר אבל האימייל לא אומת. אנא השבית "Email confirmation" ב-Supabase Dashboard או אמת את המשתמש ידנית.');
          } else {
            setError(`המשתמש נוצר אבל לא ניתן להתחבר: ${signInError.message}. נסה להתחבר ידנית.`);
          }
        } else if (signInData?.session) {
          onSignUp();
        }
      } else {
        setError('המשתמש לא נוצר. נסה שוב או פנה למנהל המערכת.');
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'שגיאה ביצירת משתמש');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SignUpContainer>
      <SignUpTitle>הרשמה למערכת</SignUpTitle>
      
      <SignUpForm onSubmit={handleSignUp}>
        <SignUpInput
          type="email"
          placeholder="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <SignUpInput
          type="password"
          placeholder="סיסמה (לפחות 6 תווים)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <SignUpInput
          type="password"
          placeholder="אימות סיסמה"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
        />

        <PlanSelectionSection>
          <PlanSelectionTitle>בחר חבילה:</PlanSelectionTitle>
          <PlansGrid>
            {ACTIVE_PLANS.map((planType) => {
              const plan = PLAN_CONFIG[planType];
              const isSelected = selectedPlan === planType;
              
              return (
                <PlanOption
                  key={planType}
                  $selected={isSelected}
                  onClick={() => setSelectedPlan(planType)}
                >
                  <h4>{plan.label}</h4>
                  <div className="plan-desc">{planType}</div>
                  <div className="plan-features">
                    <div className="feature">
                      {plan.maxAnalysesPerMonth === -1 ? '∞' : plan.maxAnalysesPerMonth} ניתוחים/חודש
                    </div>
                    <div className="feature">
                      עד {plan.maxVideoMinutes} דקות לסרטון
                    </div>
                    {plan.maxTracks === 1 && (
                      <div className="feature">תחום אחד</div>
                    )}
                    {plan.maxTracks > 1 && (
                      <div className="feature">כל התחומים</div>
                    )}
                  </div>
                </PlanOption>
              );
            })}
          </PlansGrid>
        </PlanSelectionSection>

        {error && <ErrorMsg>{error}</ErrorMsg>}
        {success && <SuccessMsg>{success}</SuccessMsg>}
        
        <SignUpButton type="submit" disabled={loading}>
          {loading ? 'יוצר משתמש...' : 'הרשמה'}
        </SignUpButton>
      </SignUpForm>

      <SwitchModeButton onClick={onSwitchToLogin}>
        כבר יש לך חשבון? התחבר כאן
      </SwitchModeButton>
    </SignUpContainer>
  );
};

