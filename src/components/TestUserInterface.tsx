import React, { useState } from 'react';
import styled from 'styled-components';
import { SimplePlanManager } from './SimplePlanManager';
import { PlanTester } from './PlanTester';
import { useSubscription } from '@/context/SubscriptionProvider';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { supabase } from '@/lib/supabaseClient';

const TestInterfaceContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.98);
  z-index: 3000;
  overflow-y: auto;
  padding: 20px;
`;

const TestInterfaceContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
`;

const CloseButton = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(212, 160, 67, 0.2);
  border: 2px solid #D4A043;
  color: #D4A043;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  font-size: 24px;
  cursor: pointer;
  z-index: 3001;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: all 0.3s;
  
  &:hover {
    background: rgba(212, 160, 67, 0.4);
    transform: scale(1.1);
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 40px;
  padding-top: 20px;
  
  h1 {
    color: #D4A043;
    font-size: 2.5rem;
    margin-bottom: 10px;
  }
  
  p {
    color: #888;
    font-size: 1.1rem;
  }
`;

const Section = styled.div`
  margin-bottom: 40px;
`;

const SectionTitle = styled.h2`
  color: #D4A043;
  font-size: 1.8rem;
  margin-bottom: 20px;
  text-align: center;
  border-bottom: 2px solid rgba(212, 160, 67, 0.3);
  padding-bottom: 10px;
`;

const InfoCard = styled.div`
  background: rgba(212, 160, 67, 0.1);
  border: 2px solid #D4A043;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
  
  h3 {
    color: #D4A043;
    margin-bottom: 15px;
    font-size: 1.3rem;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(212, 160, 67, 0.2);
    
    &:last-child {
      border-bottom: none;
    }
    
    .label {
      color: #888;
      font-weight: 600;
    }
    
    .value {
      color: #D4A043;
      font-weight: 700;
    }
  }
`;

const TrackSelector = styled.div`
  background: rgba(15, 15, 15, 0.8);
  border: 2px solid rgba(212, 160, 67, 0.3);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
`;

const TrackGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 20px;
`;

const TrackCard = styled.div<{ $active: boolean }>`
  background: ${props => props.$active ? 'rgba(212, 160, 67, 0.2)' : 'rgba(15, 15, 15, 0.8)'};
  border: 2px solid ${props => props.$active ? '#D4A043' : 'rgba(212, 160, 67, 0.3)'};
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: #D4A043;
    transform: translateY(-3px);
  }
  
  h4 {
    color: ${props => props.$active ? '#D4A043' : '#ccc'};
    margin: 10px 0 5px 0;
  }
  
  .desc {
    color: #888;
    font-size: 0.9rem;
  }
`;

const ExpertSelector = styled.div`
  background: rgba(15, 15, 15, 0.8);
  border: 2px solid rgba(212, 160, 67, 0.3);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
`;

const ExpertGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 20px;
`;

const ExpertCard = styled.div<{ $selected: boolean }>`
  background: ${props => props.$selected ? 'rgba(212, 160, 67, 0.2)' : 'rgba(15, 15, 15, 0.8)'};
  border: 2px solid ${props => props.$selected ? '#D4A043' : 'rgba(212, 160, 67, 0.3)'};
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: #D4A043;
    transform: translateY(-2px);
  }
  
  h4 {
    color: ${props => props.$selected ? '#D4A043' : '#ccc'};
    margin: 0 0 8px 0;
    font-size: 1.1rem;
  }
  
  .desc {
    color: #888;
    font-size: 0.85rem;
  }
`;

const TRACKS = [
  { id: 'actors', label: 'שחקנים ואודישנים', icon: '🎬', desc: 'חדר האודישנים הראשי של הפקות הדרמה המובילות' },
  { id: 'musicians', label: 'זמרים ומוזיקאים', icon: '🎵', desc: 'פאנל השופטים של תוכניות המוזיקה הגדולות' },
  { id: 'creators', label: 'יוצרי תוכן וכוכבי רשת', icon: '📱', desc: 'האלגוריתם של הרשתות החברתיות' },
  { id: 'influencers', label: 'משפיענים ומותגים', icon: '💼', desc: 'חדר האסטרטגיה של המותגים הגדולים' },
];

const EXPERTS_BY_TRACK: Record<string, { title: string; desc: string }[]> = {
  actors: [
    { title: 'הבמאי', desc: 'בניית הסצנה, פיצוח הרצון' },
    { title: 'מלהקת ראשית', desc: 'טייפקאסט, אמינות, דמות' },
    { title: 'התסריטאי', desc: 'דיוק בטקסט, סאב-טקסט' },
    { title: 'מאמן משחק', desc: 'מתח גופני, בחירות רגשיות' },
    { title: 'צלם ראשי', desc: 'מציאת האור, קשר עין, עדשה' },
    { title: 'מומחה שפת גוף', desc: 'הלימה בין גוף לטקסט' },
    { title: 'מנטור אודישנים', desc: 'הצגה עצמית, כניסה לדמות' },
    { title: 'אסטרטג קריירה', desc: 'התאמה לתיק עבודות, ליהוק' },
  ],
  musicians: [
    { title: 'מאמן ווקאלי', desc: 'טכניקה, דיוק בצליל, נשימה' },
    { title: 'מפיק מוזיקלי', desc: 'ריתמיקה, גרוב, דינמיקה, עיבוד' },
    { title: 'השופט הקשוח', desc: 'ייחודיות, חותם אישי, כריזמה' },
    { title: 'מומחה פרפורמנס', desc: 'הגשה, תנועה על במה, קהל' },
    { title: 'מומחה אינטרפרטציה', desc: 'רגש, חיבור לטקסט, אמינות' },
    { title: 'סטיילינג ותדמית', desc: 'לוק, נראות, התאמה לז\'אנר' },
    { title: 'מנהל רפרטואר', desc: 'בחירת שיר, התאמה למנעד' },
    { title: 'עורך רדיו', desc: 'פוטנציאל רדיופוני, מסחריות' },
  ],
  creators: [
    { title: 'מפיק תוכן', desc: 'אלגוריתם, ויראליות, engagement' },
    { title: 'אסטרטג פלטפורמות', desc: 'אופטימיזציה לכל פלטפורמה' },
    { title: 'מומחה הוק', desc: '3 שניות ראשונות, תפיסת תשומת לב' },
    { title: 'אנליסטיקן', desc: 'נתונים, מגמות, ביצועים' },
    { title: 'בונה קהילה', desc: 'אינטראקציה, מעורבות, נאמנות' },
    { title: 'ברנדר', desc: 'זהות ויזואלית, עקביות, זיהוי' },
    { title: 'מומחה SEO', desc: 'מילות מפתח, תגיות, חיפוש' },
    { title: 'מנהל קריירה', desc: 'שיתופי פעולה, מיתוג, צמיחה' },
  ],
  influencers: [
    { title: 'מאסטר רטוריקה', desc: 'דיקציה, שטף דיבור, שכנוע' },
    { title: 'בונה סמכות', desc: 'מיצוב כמומחה, אמינות מקצועית' },
    { title: 'סטוריטלר עסקי', desc: 'העברת מסר מורכב בפשטות' },
    { title: 'מומחה שפת גוף', desc: 'פתיחות, ביטחון עצמי, תנועות' },
    { title: 'מנהל מותג אישי', desc: 'בידול, ערכים, שפה ויזואלית' },
    { title: 'כריזמה בימתית', desc: 'נוכחות, החזקת קהל, אנרגיה' },
    { title: 'קופירייטר שיווקי', desc: 'דיוק המסר, הנעה לפעולה' },
    { title: 'אסטרטג תוכן', desc: 'ערך לקהל, בניית אמון' },
  ],
};

interface TestUserInterfaceProps {
  onClose: () => void;
  currentTrack: string;
  onTrackChange: (track: string) => void;
  selectedExperts: string[];
  onExpertToggle: (expert: string) => void;
}

export const TestUserInterface: React.FC<TestUserInterfaceProps> = ({
  onClose,
  currentTrack,
  onTrackChange,
  selectedExperts,
  onExpertToggle
}) => {
  const { subscription, loading: subscriptionLoading, refresh } = useSubscription();
  const planAccess = usePlanAccess(subscription);
  const [savingTrack, setSavingTrack] = useState(false);

  const handleTrackChange = async (trackId: string) => {
    if (savingTrack) return;
    setSavingTrack(true);
    
    try {
      onTrackChange(trackId);
      
      // שמור את התחום הנבחר
      if (subscription && ['actors', 'musicians', 'creators', 'influencers'].includes(trackId)) {
        const { error } = await supabase.rpc('update_user_default_track', {
          p_user_id: subscription.user_id,
          p_default_track: trackId
        });
        
        if (error) {
          console.error('[TestUserInterface] Error saving track:', error);
        } else {
          console.log('[TestUserInterface] Track saved successfully');
          await refresh();
        }
      }
    } catch (err) {
      console.error('[TestUserInterface] Error changing track:', err);
    } finally {
      setSavingTrack(false);
    }
  };

  const currentExperts = EXPERTS_BY_TRACK[currentTrack] || [];

  return (
    <TestInterfaceContainer>
      <CloseButton onClick={onClose}>✕</CloseButton>
      
      <TestInterfaceContent>
        <Header>
          <h1>🧪 ממשק בדיקות - viralytest@test.com</h1>
          <p>ממשק בדיקות מלא: מעבר בין חבילות, בחירת תחומים, בחירת מומחים ועוד</p>
        </Header>

        {/* מידע על החבילה הנוכחית */}
        <Section>
          <SectionTitle>📦 מידע על החבילה הנוכחית</SectionTitle>
          {subscriptionLoading ? (
            <InfoCard>
              <p style={{ color: '#888', textAlign: 'center' }}>טוען...</p>
            </InfoCard>
          ) : subscription && planAccess ? (
            <InfoCard>
              <h3>{planAccess.planLabel}</h3>
              <div className="info-row">
                <span className="label">סוג חבילה:</span>
                <span className="value">{subscription.plan_type}</span>
              </div>
              <div className="info-row">
                <span className="label">סטטוס:</span>
                <span className="value">{subscription.status}</span>
              </div>
              <div className="info-row">
                <span className="label">ניתוחים שנוצלו:</span>
                <span className="value">
                  {subscription.analyses_used_monthly} / {planAccess.maxAnalysesPerMonth === -1 ? '∞' : planAccess.maxAnalysesPerMonth}
                </span>
              </div>
              <div className="info-row">
                <span className="label">דקות שנוצלו:</span>
                <span className="value">
                  {subscription.minutes_used_monthly} / {planAccess.maxMinutesPerMonth}
                </span>
              </div>
              <div className="info-row">
                <span className="label">תחום ברירת מחדל:</span>
                <span className="value">{subscription.default_track || 'לא נבחר'}</span>
              </div>
              <div className="info-row">
                <span className="label">ניתן להריץ ניתוח:</span>
                <span className="value">{planAccess.canRunAnalysis() ? '✅ כן' : '❌ לא'}</span>
              </div>
              <div className="info-row">
                <span className="label">יש דקות זמינות:</span>
                <span className="value">{planAccess.hasMinutesLeft() ? '✅ כן' : '❌ לא'}</span>
              </div>
            </InfoCard>
          ) : (
            <InfoCard>
              <p style={{ color: '#ff4d4d', textAlign: 'center' }}>
                אין subscription פעיל. נא ליצור subscription ב-Supabase.
              </p>
            </InfoCard>
          )}
        </Section>

        {/* בחירת תחום */}
        <Section>
          <SectionTitle>🎯 בחירת תחום ניתוח</SectionTitle>
          <TrackSelector>
            <TrackGrid>
              {TRACKS.map((track) => (
                <TrackCard
                  key={track.id}
                  $active={currentTrack === track.id}
                  onClick={() => handleTrackChange(track.id)}
                  style={{ cursor: savingTrack ? 'wait' : 'pointer', opacity: savingTrack ? 0.7 : 1 }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{track.icon}</div>
                  <h4>{track.label}</h4>
                  <div className="desc">{track.desc}</div>
                  {savingTrack && currentTrack === track.id && (
                    <div style={{ marginTop: '10px', color: '#D4A043', fontSize: '0.9rem' }}>
                      שומר...
                    </div>
                  )}
                </TrackCard>
              ))}
            </TrackGrid>
          </TrackSelector>
        </Section>

        {/* בחירת מומחים */}
        <Section>
          <SectionTitle>👥 בחירת מומחים לתחום: {TRACKS.find(t => t.id === currentTrack)?.label}</SectionTitle>
          <ExpertSelector>
            <p style={{ color: '#888', marginBottom: '15px', textAlign: 'center' }}>
              בחר מומחים לניתוח (לפחות 3)
            </p>
            <ExpertGrid>
              {currentExperts.map((expert) => {
                const isSelected = selectedExperts.includes(expert.title);
                return (
                  <ExpertCard
                    key={expert.title}
                    $selected={isSelected}
                    onClick={() => onExpertToggle(expert.title)}
                  >
                    <h4>{expert.title}</h4>
                    <div className="desc">{expert.desc}</div>
                    {isSelected && (
                      <div style={{ marginTop: '10px', color: '#D4A043', fontSize: '0.9rem' }}>
                        ✓ נבחר
                      </div>
                    )}
                  </ExpertCard>
                );
              })}
            </ExpertGrid>
            <div style={{ marginTop: '20px', textAlign: 'center', color: '#888' }}>
              נבחרו: {selectedExperts.length} מומחים
              {selectedExperts.length < 3 && (
                <span style={{ color: '#ff4d4d', display: 'block', marginTop: '5px' }}>
                  נא לבחור לפחות 3 מומחים
                </span>
              )}
            </div>
          </ExpertSelector>
        </Section>

        {/* מעבר בין חבילות */}
        <Section>
          <SectionTitle>🔄 מעבר בין חבילות</SectionTitle>
          <SimplePlanManager />
        </Section>

        {/* בדיקת חבילות */}
        <Section>
          <SectionTitle>🧪 בדיקת חבילות</SectionTitle>
          <PlanTester />
        </Section>
      </TestInterfaceContent>
    </TestInterfaceContainer>
  );
};

