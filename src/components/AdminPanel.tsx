import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { supabase } from '@/lib/supabaseClient';
import { PlanType } from '@/types/subscription';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  email: string;
  created_at: string;
  raw_user_meta_data?: {
    role?: string;
    plan_type?: PlanType;
  };
}

interface Analysis {
  id: string;
  user_id: string;
  track: string;
  average_score: number;
  created_at: string;
  user_email?: string;
}

interface Video {
  id: string;
  user_id: string;
  file_name: string;
  file_size_mb: number;
  duration_seconds: number;
  created_at: string;
  user_email?: string;
}

interface Benefit {
  id: string;
  benefit_type: 'free_week' | 'free_month' | 'discount_percentage' | 'free_analyses' | 'registration_coupon';
  title: string;
  description?: string;
  plan_type?: PlanType;
  discount_percentage?: number;
  free_analyses_count?: number;
  free_days?: number;
  coupon_code?: string;
  coupon_valid_until?: string;
  is_active: boolean;
  created_at: string;
}

interface AdminStats {
  total_users: number;
  users_last_30_days: number;
  total_analyses: number;
  total_videos: number;
  total_admins: number;
  plan_distribution?: Record<string, number>;
}

// ============================================================================
// Styled Components
// ============================================================================

const AdminContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  z-index: 10000;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #D4A043;
`;

const Title = styled.h1`
  color: #D4A043;
  font-size: 2rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const BackButton = styled.button`
  background: transparent;
  border: 1px solid #fff;
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s;
  
  &:hover {
    background: #D4A043;
    border-color: #D4A043;
    color: #000;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  border-bottom: 1px solid #D4A043;
  padding-bottom: 10px;
`;

const Tab = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#D4A043' : 'transparent'};
  color: ${props => props.$active ? '#000' : '#D4A043'};
  border: none;
  padding: 12px 24px;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-size: 1rem;
  font-weight: ${props => props.$active ? '700' : '400'};
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: ${props => props.$active ? '#D4A043' : 'rgba(212, 160, 67, 0.2)'};
  }
`;

const ContentArea = styled.div`
  background: #1a1a1a;
  border-radius: 12px;
  padding: 30px;
  min-height: 500px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled.div`
  background: #0a0a0a;
  border: 2px solid #D4A043;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
`;

const StatNumber = styled.div`
  font-size: 3rem;
  font-weight: 700;
  color: #D4A043;
  margin-bottom: 10px;
`;

const StatLabel = styled.div`
  font-size: 1rem;
  color: #fff;
  margin-bottom: 5px;
`;

const StatSubLabel = styled.div`
  font-size: 0.85rem;
  color: #999;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
`;

const TableHeader = styled.thead`
  background: #D4A043;
  color: #000;
`;

const TableHeaderCell = styled.th`
  padding: 15px;
  text-align: right;
  font-weight: 700;
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
  border-bottom: 1px solid #333;
  
  &:hover {
    background: rgba(212, 160, 67, 0.1);
  }
`;

const TableCell = styled.td`
  padding: 15px;
  color: #fff;
`;

const ActionButton = styled.button`
  background: #D4A043;
  color: #000;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  margin: 0 5px;
  transition: all 0.3s;
  
  &:hover {
    background: #e6be74;
    transform: scale(1.05);
  }
`;

const DangerButton = styled(ActionButton)`
  background: #ff4d4d;
  color: #fff;
  
  &:hover {
    background: #ff6666;
  }
`;

const RefreshButton = styled.button`
  background: #D4A043;
  color: #000;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: #e6be74;
  }
`;

const FiltersContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const FilterSelect = styled.select`
  background: #0a0a0a;
  border: 1px solid #D4A043;
  color: #fff;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
`;

const SearchInput = styled.input`
  background: #0a0a0a;
  border: 1px solid #D4A043;
  color: #fff;
  padding: 10px;
  border-radius: 8px;
  flex: 1;
  min-width: 200px;
  
  &::placeholder {
    color: #999;
  }
`;

const FormContainer = styled.div`
  max-width: 600px;
  margin: 0 auto;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const FormLabel = styled.label`
  display: block;
  color: #D4A043;
  margin-bottom: 8px;
  font-weight: 700;
`;

const FormInput = styled.input`
  width: 100%;
  background: #0a0a0a;
  border: 1px solid #D4A043;
  color: #fff;
  padding: 12px;
  border-radius: 8px;
  font-size: 1rem;
  
  &::placeholder {
    color: #999;
  }
`;

const FormTextarea = styled.textarea`
  width: 100%;
  background: #0a0a0a;
  border: 1px solid #D4A043;
  color: #fff;
  padding: 12px;
  border-radius: 8px;
  font-size: 1rem;
  min-height: 120px;
  resize: vertical;
  
  &::placeholder {
    color: #999;
  }
`;

const FormCheckbox = styled.input`
  margin-left: 10px;
`;

const CheckboxLabel = styled.label`
  color: #fff;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const SubTabsContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid #333;
  padding-bottom: 10px;
`;

const SubTab = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#D4A043' : 'transparent'};
  color: ${props => props.$active ? '#000' : '#D4A043'};
  border: none;
  padding: 10px 20px;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-weight: ${props => props.$active ? '700' : '400'};
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: ${props => props.$active ? '#D4A043' : 'rgba(212, 160, 67, 0.2)'};
  }
`;

const LoadingText = styled.div`
  text-align: center;
  color: #999;
  padding: 40px;
  font-size: 1.2rem;
`;

const PlanDistributionCard = styled.div`
  background: #0a0a0a;
  border: 2px solid #D4A043;
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
`;

const PlanDistributionTitle = styled.h3`
  color: #D4A043;
  margin-bottom: 15px;
`;

const PlanItem = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid #333;
  
  &:last-child {
    border-bottom: none;
  }
`;

// ============================================================================
// Main Component
// ============================================================================

export const AdminPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'analyses' | 'videos' | 'alerts'>('overview');
  const [activeSubTab, setActiveSubTab] = useState<'send_update' | 'manage_coupons' | 'manage_trials' | 'history'>('send_update');
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  
  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userPlanFilter, setUserPlanFilter] = useState('all');
  
  // Form states
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [updateToAllUsers, setUpdateToAllUsers] = useState(true);
  const [updateAttachBenefit, setUpdateAttachBenefit] = useState(false);
  
  const [benefitForm, setBenefitForm] = useState<Partial<Benefit>>({
    benefit_type: 'free_week',
    title: '',
    description: '',
    is_active: true
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        await loadStats();
      } else if (activeTab === 'users') {
        await loadUsers();
      } else if (activeTab === 'analyses') {
        await loadAnalyses();
      } else if (activeTab === 'videos') {
        await loadVideos();
      } else if (activeTab === 'alerts' && activeSubTab === 'manage_coupons') {
        await loadBenefits();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_stats');
      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
      // Fallback: load manually from tables
      const { data: analysesData } = await supabase.from('analyses').select('id');
      const { data: videosData } = await supabase.from('videos').select('id');
      const { data: usersData } = await supabase.rpc('get_admin_users').catch(() => ({ data: [] }));
      
      const totalUsers = usersData?.length || 0;
      const usersLast30Days = usersData?.filter((u: any) => {
        const created = new Date(u.created_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return created > thirtyDaysAgo;
      }).length || 0;
      
      setStats({
        total_users: totalUsers,
        users_last_30_days: usersLast30Days,
        total_analyses: analysesData?.length || 0,
        total_videos: videosData?.length || 0,
        total_admins: usersData?.filter((u: any) => u.role === 'admin').length || 0,
        plan_distribution: {}
      });
    }
  };

  const loadUsers = async () => {
    try {
      const { data: usersData, error } = await supabase.rpc('get_admin_users');
      if (error) throw error;
      
      const usersWithMeta = usersData.map((user: any) => ({
        id: user.id,
        email: user.email || '',
        created_at: user.created_at,
        raw_user_meta_data: {
          role: user.role,
          plan_type: user.plan_type
        }
      }));
      
      setUsers(usersWithMeta);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get user emails
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: usersData } = await supabase.rpc('get_admin_users').catch(() => ({ data: [] }));
      
      const analysesWithEmails = data.map(analysis => ({
        ...analysis,
        user_email: usersData?.find((u: any) => u.id === analysis.user_id)?.email || 'Unknown'
      }));
      
      setAnalyses(analysesWithEmails);
    } catch (error) {
      console.error('Error loading analyses:', error);
    }
  };

  const loadVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get user emails
      const userIds = [...new Set(data.map(v => v.user_id))];
      const { data: usersData } = await supabase.rpc('get_admin_users').catch(() => ({ data: [] }));
      
      const videosWithEmails = data.map(video => ({
        ...video,
        user_email: usersData?.find((u: any) => u.id === video.user_id)?.email || 'Unknown'
      }));
      
      setVideos(videosWithEmails);
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const loadBenefits = async () => {
    try {
      const { data, error } = await supabase
        .from('benefits')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setBenefits(data || []);
    } catch (error) {
      console.error('Error loading benefits:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) return;
    
    try {
      const { error } = await supabase.rpc('delete_admin_user', { p_user_id: userId });
      if (error) throw error;
      await loadUsers();
      alert('משתמש נמחק בהצלחה');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(`שגיאה במחיקת משתמש: ${error.message || 'Unknown error'}`);
    }
  };

  const handleUpdateUserPlan = async (userId: string, planType: PlanType) => {
    try {
      const { error } = await supabase.rpc('update_user_plan_admin', {
        p_user_id: userId,
        p_plan_type: planType
      });
      if (error) throw error;
      await loadUsers();
      alert('חבילת המשתמש עודכנה בהצלחה');
    } catch (error: any) {
      console.error('Error updating user plan:', error);
      alert(`שגיאה בעדכון חבילת המשתמש: ${error.message || 'Unknown error'}`);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: 'user' | 'admin') => {
    try {
      const { error } = await supabase.rpc('update_user_role', {
        p_user_id: userId,
        p_role: role
      });
      if (error) throw error;
      await loadUsers();
      alert('תפקיד המשתמש עודכן בהצלחה');
    } catch (error: any) {
      console.error('Error updating user role:', error);
      alert(`שגיאה בעדכון תפקיד המשתמש: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSendUpdate = async () => {
    if (!updateTitle || !updateContent) {
      alert('אנא מלא את כל השדות הנדרשים');
      return;
    }
    
    setLoading(true);
    try {
      if (updateToAllUsers) {
        const { data: usersData } = await supabase.rpc('get_admin_users').catch(() => ({ data: [] }));
        const userIds = usersData?.map((u: any) => u.id) || [];
        
        const updates = userIds.map((userId: string) => ({
          user_id: userId,
          title: updateTitle,
          content: updateContent,
          is_read: false
        }));
        
        for (const update of updates) {
          await supabase.from('user_updates').insert(update);
        }
      }
      
      alert('העדכון נשלח בהצלחה');
      setUpdateTitle('');
      setUpdateContent('');
      setUpdateToAllUsers(true);
      setUpdateAttachBenefit(false);
    } catch (error) {
      console.error('Error sending update:', error);
      alert('שגיאה בשליחת העדכון');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBenefit = async () => {
    if (!benefitForm.title) {
      alert('אנא מלא את כותרת ההטבה');
      return;
    }
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const benefitData: any = {
        benefit_type: benefitForm.benefit_type,
        title: benefitForm.title,
        description: benefitForm.description,
        is_active: benefitForm.is_active ?? true,
        created_by: user?.id
      };
      
      if (benefitForm.plan_type) benefitData.plan_type = benefitForm.plan_type;
      if (benefitForm.discount_percentage) benefitData.discount_percentage = benefitForm.discount_percentage;
      if (benefitForm.free_analyses_count) benefitData.free_analyses_count = benefitForm.free_analyses_count;
      if (benefitForm.free_days) benefitData.free_days = benefitForm.free_days;
      if (benefitForm.coupon_code) benefitData.coupon_code = benefitForm.coupon_code;
      if (benefitForm.coupon_valid_until) benefitData.coupon_valid_until = benefitForm.coupon_valid_until;
      
      const { error } = await supabase.from('benefits').insert(benefitData);
      if (error) throw error;
      
      alert('הטבה נוצרה בהצלחה');
      setBenefitForm({
        benefit_type: 'free_week',
        title: '',
        description: '',
        is_active: true
      });
      await loadBenefits();
    } catch (error) {
      console.error('Error creating benefit:', error);
      alert('שגיאה ביצירת הטבה');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    if (userSearch && !user.email.toLowerCase().includes(userSearch.toLowerCase())) return false;
    if (userRoleFilter !== 'all' && user.raw_user_meta_data?.role !== userRoleFilter) return false;
    if (userPlanFilter !== 'all' && user.raw_user_meta_data?.plan_type !== userPlanFilter) return false;
    return true;
  });

  const renderOverview = () => (
    <>
      <StatsGrid>
        <StatCard>
          <StatNumber>{stats?.total_users || 0}</StatNumber>
          <StatLabel>סה"כ משתמשים</StatLabel>
          <StatSubLabel>{stats?.users_last_30_days || 0} נרשמו ב-30 יום האחרונים</StatSubLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats?.total_analyses || 0}</StatNumber>
          <StatLabel>סה"כ ניתוחים</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats?.total_videos || 0}</StatNumber>
          <StatLabel>סה"כ וידאו</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats?.total_admins || 0}</StatNumber>
          <StatLabel>מנהלים</StatLabel>
        </StatCard>
      </StatsGrid>
      
      {stats?.plan_distribution && Object.keys(stats.plan_distribution).length > 0 && (
        <PlanDistributionCard>
          <PlanDistributionTitle>פילוח לפי דרגות מנוי</PlanDistributionTitle>
          {Object.entries(stats.plan_distribution).map(([plan, count]) => (
            <PlanItem key={plan}>
              <span>{plan}</span>
              <span>{count} משתמשים</span>
            </PlanItem>
          ))}
        </PlanDistributionCard>
      )}
    </>
  );

  const renderUsers = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <RefreshButton onClick={loadUsers}>
          🔄 רענן
        </RefreshButton>
        <h2 style={{ color: '#D4A043', margin: 0 }}>משתמשים ({filteredUsers.length})</h2>
      </div>
      
      <FiltersContainer>
        <FilterSelect value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)}>
          <option value="all">כל התפקידים</option>
          <option value="user">משתמש</option>
          <option value="admin">אדמין</option>
        </FilterSelect>
        <FilterSelect value={userPlanFilter} onChange={(e) => setUserPlanFilter(e.target.value)}>
          <option value="all">כל הדרגות</option>
          <option value="trial">נסיון</option>
          <option value="creators">יוצרים</option>
          <option value="creators_extreme">יוצרים באקסטרים</option>
          <option value="coach">מאמנים</option>
          <option value="coach_pro">מאמנים פרו</option>
        </FilterSelect>
        <SearchInput
          type="text"
          placeholder="חפש לפי אימייל או שם..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
      </FiltersContainer>
      
      {loading ? (
        <LoadingText>טוען משתמשים...</LoadingText>
      ) : (
        <Table>
          <TableHeader>
            <tr>
              <TableHeaderCell>אימייל</TableHeaderCell>
              <TableHeaderCell>תפקיד</TableHeaderCell>
              <TableHeaderCell>חבילה</TableHeaderCell>
              <TableHeaderCell>תאריך הרשמה</TableHeaderCell>
              <TableHeaderCell>פעולות</TableHeaderCell>
            </tr>
          </TableHeader>
          <TableBody>
            {filteredUsers.map(user => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.raw_user_meta_data?.role || 'user'}</TableCell>
                <TableCell>{user.raw_user_meta_data?.plan_type || 'אין'}</TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString('he-IL')}</TableCell>
                <TableCell>
                  <ActionButton onClick={() => {
                    const newPlan = prompt('הזן חבילה חדשה (trial/creators/creators_extreme/coach/coach_pro):');
                    if (newPlan) {
                      handleUpdateUserPlan(user.id, newPlan as PlanType);
                    }
                  }}>
                    ערוך חבילה
                  </ActionButton>
                  <ActionButton onClick={() => {
                    const currentRole = user.raw_user_meta_data?.role || 'user';
                    const newRole = currentRole === 'admin' ? 'user' : 'admin';
                    if (confirm(`האם אתה בטוח שברצונך לשנות את תפקיד המשתמש ל-${newRole === 'admin' ? 'אדמין' : 'משתמש'}?`)) {
                      handleUpdateUserRole(user.id, newRole);
                    }
                  }}>
                    {user.raw_user_meta_data?.role === 'admin' ? 'הסר אדמין' : 'הפוך לאדמין'}
                  </ActionButton>
                  <DangerButton onClick={() => handleDeleteUser(user.id)}>
                    מחק
                  </DangerButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );

  const renderAnalyses = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <RefreshButton onClick={loadAnalyses}>
          🔄 רענן
        </RefreshButton>
        <h2 style={{ color: '#D4A043', margin: 0 }}>ניתוחים ({analyses.length})</h2>
      </div>
      
      {loading ? (
        <LoadingText>טוען ניתוחים...</LoadingText>
      ) : (
        <Table>
          <TableHeader>
            <tr>
              <TableHeaderCell>משתמש</TableHeaderCell>
              <TableHeaderCell>טרק</TableHeaderCell>
              <TableHeaderCell>ציון ממוצע</TableHeaderCell>
              <TableHeaderCell>תאריך</TableHeaderCell>
            </tr>
          </TableHeader>
          <TableBody>
            {analyses.map(analysis => (
              <TableRow key={analysis.id}>
                <TableCell>{analysis.user_email || analysis.user_id}</TableCell>
                <TableCell>{analysis.track}</TableCell>
                <TableCell>{analysis.average_score}</TableCell>
                <TableCell>{new Date(analysis.created_at).toLocaleDateString('he-IL')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );

  const renderVideos = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <RefreshButton onClick={loadVideos}>
          🔄 רענן
        </RefreshButton>
        <h2 style={{ color: '#D4A043', margin: 0 }}>וידאו ({videos.length})</h2>
      </div>
      
      {loading ? (
        <LoadingText>טוען וידאו...</LoadingText>
      ) : (
        <Table>
          <TableHeader>
            <tr>
              <TableHeaderCell>תאריך</TableHeaderCell>
              <TableHeaderCell>משך</TableHeaderCell>
              <TableHeaderCell>גודל</TableHeaderCell>
              <TableHeaderCell>שם קובץ</TableHeaderCell>
            </tr>
          </TableHeader>
          <TableBody>
            {videos.map(video => (
              <TableRow key={video.id}>
                <TableCell>{new Date(video.created_at).toLocaleDateString('he-IL')}</TableCell>
                <TableCell>{video.duration_seconds} שניות</TableCell>
                <TableCell>{video.file_size_mb.toFixed(2)} MB</TableCell>
                <TableCell>{video.file_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );

  const renderAlerts = () => {
    if (activeSubTab === 'send_update') {
      return (
        <FormContainer>
          <h2 style={{ color: '#D4A043', marginBottom: '20px' }}>שליחת עדכון</h2>
          <FormGroup>
            <FormLabel>כותרת העדכון *</FormLabel>
            <FormInput
              type="text"
              placeholder="לדוגמה: עדכון חדש באפליקציה!"
              value={updateTitle}
              onChange={(e) => setUpdateTitle(e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <FormLabel>תוכן העדכון *</FormLabel>
            <FormTextarea
              placeholder="הזן את תוכן העדכון..."
              value={updateContent}
              onChange={(e) => setUpdateContent(e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <CheckboxLabel>
              <FormCheckbox
                type="checkbox"
                checked={updateToAllUsers}
                onChange={(e) => setUpdateToAllUsers(e.target.checked)}
              />
              לכל המשתמשים
            </CheckboxLabel>
          </FormGroup>
          <FormGroup>
            <CheckboxLabel>
              <FormCheckbox
                type="checkbox"
                checked={updateAttachBenefit}
                onChange={(e) => setUpdateAttachBenefit(e.target.checked)}
              />
              צרף הטבה לעדכון
            </CheckboxLabel>
          </FormGroup>
          <ActionButton onClick={handleSendUpdate} disabled={loading}>
            {loading ? 'שולח...' : 'שלח'}
          </ActionButton>
        </FormContainer>
      );
    }
    
    if (activeSubTab === 'manage_coupons') {
      return (
        <>
          <h2 style={{ color: '#D4A043', marginBottom: '20px' }}>ניהול קופונים</h2>
          
          <FormContainer style={{ marginBottom: '30px', background: '#0a0a0a', padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ color: '#D4A043', marginBottom: '15px' }}>יצירת הטבה חדשה</h3>
            <FormGroup>
              <FormLabel>סוג ההטבה *</FormLabel>
              <FilterSelect
                value={benefitForm.benefit_type}
                onChange={(e) => setBenefitForm({ ...benefitForm, benefit_type: e.target.value as any })}
              >
                <option value="free_week">שבוע חינם</option>
                <option value="free_month">חודש חינם</option>
                <option value="discount_percentage">% הנחה</option>
                <option value="free_analyses">ניתוחים מתנה</option>
                <option value="registration_coupon">קופון הנחה להרשמה</option>
              </FilterSelect>
            </FormGroup>
            <FormGroup>
              <FormLabel>כותרת *</FormLabel>
              <FormInput
                type="text"
                value={benefitForm.title}
                onChange={(e) => setBenefitForm({ ...benefitForm, title: e.target.value })}
                placeholder="לדוגמה: שבוע חינם על חבילת יוצרים"
              />
            </FormGroup>
            <FormGroup>
              <FormLabel>תיאור</FormLabel>
              <FormTextarea
                value={benefitForm.description || ''}
                onChange={(e) => setBenefitForm({ ...benefitForm, description: e.target.value })}
                placeholder="תיאור מפורט של ההטבה..."
              />
            </FormGroup>
            {benefitForm.benefit_type === 'discount_percentage' && (
              <FormGroup>
                <FormLabel>אחוז הנחה</FormLabel>
                <FormInput
                  type="number"
                  min="0"
                  max="100"
                  value={benefitForm.discount_percentage || ''}
                  onChange={(e) => setBenefitForm({ ...benefitForm, discount_percentage: parseInt(e.target.value) })}
                />
              </FormGroup>
            )}
            {benefitForm.benefit_type === 'free_analyses' && (
              <FormGroup>
                <FormLabel>מספר ניתוחים</FormLabel>
                <FormInput
                  type="number"
                  min="0"
                  value={benefitForm.free_analyses_count || ''}
                  onChange={(e) => setBenefitForm({ ...benefitForm, free_analyses_count: parseInt(e.target.value) })}
                />
              </FormGroup>
            )}
            {(benefitForm.benefit_type === 'free_week' || benefitForm.benefit_type === 'free_month') && (
              <FormGroup>
                <FormLabel>מספר ימים</FormLabel>
                <FormInput
                  type="number"
                  min="0"
                  value={benefitForm.free_days || ''}
                  onChange={(e) => setBenefitForm({ ...benefitForm, free_days: parseInt(e.target.value) })}
                />
              </FormGroup>
            )}
            <FormGroup>
              <FormLabel>חבילה (אופציונלי)</FormLabel>
              <FilterSelect
                value={benefitForm.plan_type || ''}
                onChange={(e) => setBenefitForm({ ...benefitForm, plan_type: e.target.value as PlanType || undefined })}
              >
                <option value="">כל החבילות</option>
                <option value="trial">נסיון</option>
                <option value="creators">יוצרים</option>
                <option value="creators_extreme">יוצרים באקסטרים</option>
                <option value="coach">מאמנים</option>
                <option value="coach_pro">מאמנים פרו</option>
              </FilterSelect>
            </FormGroup>
            {benefitForm.benefit_type === 'registration_coupon' && (
              <>
                <FormGroup>
                  <FormLabel>קוד קופון</FormLabel>
                  <FormInput
                    type="text"
                    value={benefitForm.coupon_code || ''}
                    onChange={(e) => setBenefitForm({ ...benefitForm, coupon_code: e.target.value })}
                    placeholder="לדוגמה: WELCOME2024"
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>תוקף עד</FormLabel>
                  <FormInput
                    type="datetime-local"
                    value={benefitForm.coupon_valid_until ? new Date(benefitForm.coupon_valid_until).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setBenefitForm({ ...benefitForm, coupon_valid_until: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  />
                </FormGroup>
              </>
            )}
            <FormGroup>
              <CheckboxLabel>
                <FormCheckbox
                  type="checkbox"
                  checked={benefitForm.is_active ?? true}
                  onChange={(e) => setBenefitForm({ ...benefitForm, is_active: e.target.checked })}
                />
                פעיל
              </CheckboxLabel>
            </FormGroup>
            <ActionButton onClick={handleCreateBenefit} disabled={loading}>
              {loading ? 'יוצר...' : 'צור הטבה'}
            </ActionButton>
          </FormContainer>
          
          <h3 style={{ color: '#D4A043', marginBottom: '15px' }}>הטבות קיימות</h3>
          {loading ? (
            <LoadingText>טוען הטבות...</LoadingText>
          ) : (
            <Table>
              <TableHeader>
                <tr>
                  <TableHeaderCell>סוג</TableHeaderCell>
                  <TableHeaderCell>כותרת</TableHeaderCell>
                  <TableHeaderCell>חבילה</TableHeaderCell>
                  <TableHeaderCell>סטטוס</TableHeaderCell>
                  <TableHeaderCell>פעולות</TableHeaderCell>
                </tr>
              </TableHeader>
              <TableBody>
                {benefits.map(benefit => (
                  <TableRow key={benefit.id}>
                    <TableCell>{benefit.benefit_type}</TableCell>
                    <TableCell>{benefit.title}</TableCell>
                    <TableCell>{benefit.plan_type || 'כל החבילות'}</TableCell>
                    <TableCell>{benefit.is_active ? 'פעיל' : 'לא פעיל'}</TableCell>
                    <TableCell>
                      <ActionButton onClick={async () => {
                        try {
                          const { error } = await supabase.rpc('update_benefit', {
                            p_benefit_id: benefit.id,
                            p_benefit_data: {
                              is_active: !benefit.is_active
                            }
                          });
                          if (error) throw error;
                          await loadBenefits();
                        } catch (error: any) {
                          console.error('Error updating benefit:', error);
                          alert(`שגיאה בעדכון הטבה: ${error.message || 'Unknown error'}`);
                        }
                      }}>
                        {benefit.is_active ? 'השבת' : 'הפעל'}
                      </ActionButton>
                      <DangerButton onClick={async () => {
                        if (confirm('האם אתה בטוח שברצונך למחוק הטבה זו?')) {
                          try {
                            const { error } = await supabase.rpc('delete_benefit', {
                              p_benefit_id: benefit.id
                            });
                            if (error) throw error;
                            await loadBenefits();
                            alert('הטבה נמחקה בהצלחה');
                          } catch (error: any) {
                            console.error('Error deleting benefit:', error);
                            alert(`שגיאה במחיקת הטבה: ${error.message || 'Unknown error'}`);
                          }
                        }
                      }}>
                        מחק
                      </DangerButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      );
    }
    
    return <div>תת-טאב זה עדיין בפיתוח</div>;
  };

  return (
    <AdminContainer>
      <Header>
        <Title>
          🔧 פאנל ניהול מתקדם
        </Title>
        <BackButton onClick={onBack}>← חזרה</BackButton>
      </Header>
      
      <TabsContainer>
        <Tab $active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
          📊 סקירה כללית
        </Tab>
        <Tab $active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
          👥 משתמשים ({users.length})
        </Tab>
        <Tab $active={activeTab === 'analyses'} onClick={() => setActiveTab('analyses')}>
          📄 ניתוחים ({analyses.length})
        </Tab>
        <Tab $active={activeTab === 'videos'} onClick={() => setActiveTab('videos')}>
          🎬 וידאו ({videos.length})
        </Tab>
        <Tab $active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')}>
          🔔 התראות והטבות
        </Tab>
      </TabsContainer>
      
      {activeTab === 'alerts' && (
        <SubTabsContainer>
          <SubTab $active={activeSubTab === 'send_update'} onClick={() => setActiveSubTab('send_update')}>
            → שליחת עדכון
          </SubTab>
          <SubTab $active={activeSubTab === 'manage_coupons'} onClick={() => setActiveSubTab('manage_coupons')}>
            🎫 ניהול קופונים
          </SubTab>
          <SubTab $active={activeSubTab === 'manage_trials'} onClick={() => setActiveSubTab('manage_trials')}>
            ⭐ ניהול התנסויות
          </SubTab>
          <SubTab $active={activeSubTab === 'history'} onClick={() => setActiveSubTab('history')}>
            📜 היסטוריה
          </SubTab>
        </SubTabsContainer>
      )}
      
      <ContentArea>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'analyses' && renderAnalyses()}
        {activeTab === 'videos' && renderVideos()}
        {activeTab === 'alerts' && renderAlerts()}
      </ContentArea>
    </AdminContainer>
  );
};

