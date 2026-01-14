import React from 'react';
import styled from 'styled-components';
import { PLAN_CONFIG, ACTIVE_PLANS } from '@/config/planConfig';
import { PlanType } from '@/types/subscription';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 10px;
  animation: fadeIn 0.3s ease-out;
  cursor: pointer;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalContent = styled.div`
  background: #0a0a0a;
  border: 1px solid #D4A043;
  border-radius: 12px;
  width: 95%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 0 40px rgba(212, 160, 67, 0.2);
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  padding: 25px 25px 15px;
  text-align: center;
  border-bottom: 1px solid #222;
  
  h2 {
    color: #D4A043;
    font-size: 1.8rem;
    margin-bottom: 10px;
  }
  
  p {
    color: #ccc;
    font-size: 0.95rem;
    line-height: 1.5;
  }
`;

const ModalCloseBtn = styled.button`
  position: absolute;
  top: 15px;
  right: 15px;
  background: transparent;
  border: none;
  color: #666;
  font-size: 24px;
  cursor: pointer;
  transition: color 0.2s;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  
  &:hover { 
    color: #D4A043;
    background: rgba(212, 160, 67, 0.1);
  }
`;

const ModalBody = styled.div`
  padding: 25px;
`;

const PlansContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
`;

const PlanCard = styled.div<{ $isRecommended?: boolean }>`
  background: ${props => props.$isRecommended ? 'rgba(212, 160, 67, 0.15)' : '#0f0f0f'};
  border: 2px solid ${props => props.$isRecommended ? '#D4A043' : '#333'};
  border-radius: 12px;
  padding: 25px;
  position: relative;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(212, 160, 67, 0.3);
    border-color: #D4A043;
  }
  
  ${props => props.$isRecommended && `
    &::before {
      content: '⭐ מומלץ';
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
    color: #D4A043;
    font-size: 1.5rem;
    margin-bottom: 10px;
    margin-top: ${props => props.$isRecommended ? '25px' : '0'};
  }
  
  .plan-type {
    color: #888;
    font-size: 0.85rem;
    margin-bottom: 20px;
  }
  
  .plan-price {
    color: #D4A043;
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 20px;
  }
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  
  li {
    color: #ccc;
    font-size: 0.9rem;
    margin-bottom: 10px;
    padding-right: 25px;
    position: relative;
    
    &::before {
      content: '✓';
      position: absolute;
      right: 0;
      color: #D4A043;
      font-weight: bold;
    }
    
    &.unavailable {
      color: #666;
      text-decoration: line-through;
      
      &::before {
        content: '✗';
        color: #666;
      }
    }
  }
`;

const ComparisonTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 30px;
  
  th, td {
    padding: 12px;
    text-align: right;
    border-bottom: 1px solid #333;
  }
  
  th {
    color: #D4A043;
    font-weight: 700;
    background: rgba(212, 160, 67, 0.1);
  }
  
  td {
    color: #ccc;
  }
  
  tr:hover {
    background: rgba(212, 160, 67, 0.05);
  }
`;

interface PlansInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: PlanType;
  onUpgrade?: (planType: PlanType) => void;
  onSignUpWithPlan?: (planType: PlanType) => void;
  isUserLoggedIn?: boolean; // האם המשתמש מחובר
  hasPaymentSystem?: boolean; // האם יש מערכת תשלומים (לעתיד)
}

export const PlansInfoModal: React.FC<PlansInfoModalProps> = ({ 
  isOpen, 
  onClose, 
  currentPlan,
  onUpgrade,
  onSignUpWithPlan,
  isUserLoggedIn = false,
  hasPaymentSystem = false // בשלב זה אין מערכת תשלומים
}) => {
  if (!isOpen) return null;

  const getFeatureText = (plan: typeof PLAN_CONFIG[PlanType], key: string) => {
    switch (key) {
      case 'analyses':
        return plan.maxAnalysesPerMonth === -1 ? 'ללא הגבלה' : `${plan.maxAnalysesPerMonth} ניתוחים/חודש`;
      case 'minutes':
        return `${plan.maxMinutesPerMonth} דקות/חודש`;
      case 'video':
        return `עד ${plan.maxVideoMinutes} דקות או ${plan.maxVideoMB}MB`;
      case 'experts':
        return plan.maxExperts === 8 ? 'כל המומחים (8)' : `${plan.maxExperts} מומחים`;
      case 'tracks':
        return plan.maxTracks === 4 ? 'כל התחומים (4)' : 'תחום אחד';
      case 'pdf':
        return plan.features.pdf_export ? '✓ זמין' : '✗ לא זמין';
      case 'advanced':
        return plan.features.advanced_analysis ? '✓ זמין' : '✗ לא זמין';
      case 'compare':
        return plan.features.compare_videos ? '✓ זמין' : '✗ לא זמין';
      default:
        return '';
    }
  };

  return (
    <ModalOverlay onClick={(e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    }}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalCloseBtn 
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
        >✕</ModalCloseBtn>
        <ModalHeader>
          <h2>📦 חבילות והצעות</h2>
          <p>בחר את החבילה המתאימה לך ביותר</p>
        </ModalHeader>
        
        <ModalBody>
          <PlansContainer>
            {ACTIVE_PLANS.map((planType) => {
              const plan = PLAN_CONFIG[planType];
              const isCurrent = currentPlan === planType;
              
              return (
                <PlanCard 
                  key={planType}
                  $isRecommended={planType === 'creators'}
                >
                  <h3>{plan.label}</h3>
                  <div className="plan-type">{planType}</div>
                  {isCurrent && (
                    <div style={{
                      background: '#D4A043',
                      color: '#000',
                      padding: '5px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'inline-block',
                      marginBottom: '15px'
                    }}>
                      ✓ החבילה שלך
                    </div>
                  )}
                  
                  <FeatureList>
                    <li>{getFeatureText(plan, 'analyses')}</li>
                    <li>{getFeatureText(plan, 'minutes')}</li>
                    <li>{getFeatureText(plan, 'video')}</li>
                    <li>{getFeatureText(plan, 'experts')}</li>
                    <li>{getFeatureText(plan, 'tracks')}</li>
                    <li className={plan.features.pdf_export ? '' : 'unavailable'}>
                      יצוא ל-PDF
                    </li>
                    <li className={plan.features.advanced_analysis ? '' : 'unavailable'}>
                      ניתוח מתקדם
                    </li>
                    <li className={plan.features.compare_videos ? '' : 'unavailable'}>
                      השוואת סרטונים
                    </li>
                  </FeatureList>
                  
                  {!isCurrent && (
                    <button
                      onClick={() => {
                        // אם המשתמש מחובר - שדרג ישירות (או פתח תשלום אם יש מערכת תשלומים)
                        if (isUserLoggedIn) {
                          if (hasPaymentSystem) {
                            // בעתיד: פתח חלון תשלום
                            // TODO: Implement payment flow
                            alert('מערכת תשלומים תפתח כאן בעתיד');
                          } else if (onUpgrade) {
                            // בשלב זה, בלי תשלומים - עדכן ישירות
                            onUpgrade(planType);
                          }
                        } else if (onSignUpWithPlan) {
                          // אם המשתמש לא מחובר - פתח טופס הרשמה
                          onSignUpWithPlan(planType);
                        }
                      }}
                      style={{
                        width: '100%',
                        marginTop: '20px',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #b8862e 0%, #e6be74 50%, #b8862e 100%)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {isUserLoggedIn 
                        ? (hasPaymentSystem ? '💳 שדרג עם תשלום' : '🔄 שדרג לחבילה זו')
                        : '📝 הרשמה לחבילה זו'
                      }
                    </button>
                  )}
                </PlanCard>
              );
            })}
          </PlansContainer>
          
          <ComparisonTable>
            <thead>
              <tr>
                <th>תכונה</th>
                {ACTIVE_PLANS.map(planType => (
                  <th key={planType}>{PLAN_CONFIG[planType].label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ניתוחים חודשיים</td>
                {ACTIVE_PLANS.map(planType => (
                  <td key={planType}>{getFeatureText(PLAN_CONFIG[planType], 'analyses')}</td>
                ))}
              </tr>
              <tr>
                <td>דקות חודשיות</td>
                {ACTIVE_PLANS.map(planType => (
                  <td key={planType}>{getFeatureText(PLAN_CONFIG[planType], 'minutes')}</td>
                ))}
              </tr>
              <tr>
                <td>אורך סרטון</td>
                {ACTIVE_PLANS.map(planType => (
                  <td key={planType}>{getFeatureText(PLAN_CONFIG[planType], 'video')}</td>
                ))}
              </tr>
              <tr>
                <td>מספר מומחים</td>
                {ACTIVE_PLANS.map(planType => (
                  <td key={planType}>{getFeatureText(PLAN_CONFIG[planType], 'experts')}</td>
                ))}
              </tr>
              <tr>
                <td>מספר תחומים</td>
                {ACTIVE_PLANS.map(planType => (
                  <td key={planType}>{getFeatureText(PLAN_CONFIG[planType], 'tracks')}</td>
                ))}
              </tr>
              <tr>
                <td>יצוא PDF</td>
                {ACTIVE_PLANS.map(planType => (
                  <td key={planType}>{getFeatureText(PLAN_CONFIG[planType], 'pdf')}</td>
                ))}
              </tr>
              <tr>
                <td>ניתוח מתקדם</td>
                {ACTIVE_PLANS.map(planType => (
                  <td key={planType}>{getFeatureText(PLAN_CONFIG[planType], 'advanced')}</td>
                ))}
              </tr>
              <tr>
                <td>השוואת סרטונים</td>
                {ACTIVE_PLANS.map(planType => (
                  <td key={planType}>{getFeatureText(PLAN_CONFIG[planType], 'compare')}</td>
                ))}
              </tr>
            </tbody>
          </ComparisonTable>
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );
};

