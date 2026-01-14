import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useSubscription } from '@/context/SubscriptionProvider';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { PLAN_CONFIG } from '@/config/planConfig';
import { supabase } from '@/lib/supabaseClient';

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
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
  max-width: 600px;
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
  
  &:hover {
    background: rgba(212, 160, 67, 0.1);
    border-color: #D4A043;
    transform: rotate(90deg);
  }
`;

const ModalBody = styled.div`
  padding: 30px;
`;

const Section = styled.div`
  margin-bottom: 30px;
  
  h3 {
    color: #D4A043;
    font-size: 1.3rem;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(212, 160, 67, 0.2);
  }
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  
  .label {
    color: #888;
    font-size: 0.95rem;
  }
  
  .value {
    color: #e0e0e0;
    font-size: 1rem;
    font-weight: 600;
    
    &.highlight {
      color: #D4A043;
    }
  }
`;

const StatusBadge = styled.span<{ $active: boolean }>`
  background: ${props => props.$active 
    ? 'rgba(76, 175, 80, 0.2)' 
    : 'rgba(244, 67, 54, 0.2)'};
  color: ${props => props.$active ? '#4CAF50' : '#f44336'};
  border: 1px solid ${props => props.$active 
    ? 'rgba(76, 175, 80, 0.4)' 
    : 'rgba(244, 67, 54, 0.4)'};
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
`;

const UpdatesList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: #0a0a0a;
  }
  &::-webkit-scrollbar-thumb {
    background: #D4A043;
    border-radius: 2px;
  }
`;

const UpdateItem = styled.div<{ $unread: boolean }>`
  background: ${props => props.$unread 
    ? 'rgba(212, 160, 67, 0.1)' 
    : 'rgba(255, 255, 255, 0.02)'};
  border: 1px solid ${props => props.$unread 
    ? 'rgba(212, 160, 67, 0.3)' 
    : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 10px;
  
  .update-title {
    color: ${props => props.$unread ? '#D4A043' : '#ccc'};
    font-weight: 700;
    font-size: 1rem;
    margin-bottom: 8px;
  }
  
  .update-content {
    color: #aaa;
    font-size: 0.9rem;
    line-height: 1.5;
    margin-bottom: 8px;
  }
  
  .update-date {
    color: #666;
    font-size: 0.8rem;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #666;
  
  .icon {
    font-size: 3rem;
    margin-bottom: 15px;
    opacity: 0.5;
  }
  
  p {
    font-size: 1rem;
  }
`;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

interface UserUpdate {
  id: string;
  title: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  userEmail
}) => {
  const { subscription, loading, refresh } = useSubscription();
  const planAccess = usePlanAccess(subscription);
  const [updates, setUpdates] = useState<UserUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  useEffect(() => {
    // לא לטעון עדכונים - רק אם יש עדכונים דרך פאנל אדמין, הם יוצגו
    if (isOpen) {
      setLoadingUpdates(false);
      setUpdates([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const planConfig = subscription ? PLAN_CONFIG[subscription.plan_type] : null;
  const maxAnalyses = planConfig?.maxAnalysesPerMonth === -1 ? '∞' : planConfig?.maxAnalysesPerMonth || 0;

  return (
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
          <h2>⚙️ הגדרות</h2>
        </ModalHeader>

        <ModalBody>
          <Section>
            <h3>פרטי חשבון</h3>
            <InfoRow>
              <span className="label">אימייל:</span>
              <span className="value">{userEmail}</span>
            </InfoRow>
            <InfoRow>
              <span className="label">סטטוס:</span>
              <StatusBadge $active={subscription?.status === 'active'}>
                {subscription?.status === 'active' ? 'פעיל' : 'לא פעיל'}
              </StatusBadge>
            </InfoRow>
          </Section>

          {subscription && planConfig && (
            <Section>
              <h3>פרטי מנוי</h3>
              <InfoRow>
                <span className="label">חבילה:</span>
                <span className="value highlight">{planConfig.label}</span>
              </InfoRow>
              <InfoRow>
                <span className="label">ניתוחים בשימוש:</span>
                <span className="value">
                  {subscription.analyses_used_monthly} / {maxAnalyses}
                </span>
              </InfoRow>
              <InfoRow>
                <span className="label">דקות בשימוש:</span>
                <span className="value">
                  {subscription.minutes_used_monthly} / {planConfig.maxMinutesPerMonth}
                </span>
              </InfoRow>
              <InfoRow>
                <span className="label">תאריך יצירה:</span>
                <span className="value">
                  {new Date(subscription.created_at).toLocaleDateString('he-IL')}
                </span>
              </InfoRow>
              <InfoRow>
                <span className="label">עודכן לאחרונה:</span>
                <span className="value">
                  {new Date(subscription.updated_at).toLocaleDateString('he-IL')}
                </span>
              </InfoRow>
            </Section>
          )}

          {updates.length > 0 && (
            <Section>
              <h3>עדכונים והודעות</h3>
              <UpdatesList>
                {updates.map((update) => (
                  <UpdateItem key={update.id} $unread={!update.is_read}>
                    <div className="update-title">{update.title}</div>
                    <div className="update-content">{update.content}</div>
                    <div className="update-date">
                      {new Date(update.created_at).toLocaleDateString('he-IL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </UpdateItem>
                ))}
              </UpdatesList>
            </Section>
          )}
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );
};

