import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import styled, { createGlobalStyle, keyframes, css } from 'styled-components';
import { GoogleGenAI } from "@google/genai";
import { SubscriptionProvider, useSubscription } from '@/context/SubscriptionProvider';
import { supabase } from '@/lib/supabaseClient';
import { SignUpComponent } from '@/components/SignUpComponent';
import { PlansInfoModal } from '@/components/PlansInfoModal';
import { AuthModal } from '@/components/AuthModal';
import { SettingsModal } from '@/components/SettingsModal';
import { AdminPanel } from '@/components/AdminPanel';
import { SimplePlanManager } from '@/components/SimplePlanManager';
import { PlanTester } from '@/components/PlanTester';
import { TestUserInterface } from '@/components/TestUserInterface';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { PLAN_CONFIG } from '@/config/planConfig';
import { PlanType } from '@/types/subscription';
import './index.css';

// --- Types ---
type TrackId = 'actors' | 'musicians' | 'creators' | 'influencers';

interface ExpertAnalysis {
  role: string;
  insight: string;
  tips: string;
  score: number; // Individual expert score
}

interface AnalysisResult {
  expertAnalysis: ExpertAnalysis[];
  hook: string; // The "Golden Insight"
  committee: {
    summary: string;
    finalTips: string[];
  };
}

// --- Constants ---
// הערה: המגבלות האמיתיות נקבעות לפי החבילה דרך planAccess
// אלה הן מגבלות כלליות רק ל-validation ראשוני
const MAX_VIDEO_SECONDS = 5 * 60; // 5 minutes
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

const TRACK_DESCRIPTIONS: Record<string, string> = {
  actors: 'חדר האודישנים הראשי של הפקות הדרמה המובילות בישראל ובעולם אצלך בכיס. הסטנדרט הוא קולנועי וחסר פשרות.',
  musicians: 'פאנל השופטים של תוכניות המוזיקה הגדולות והלייבלים המובילים אצלך בכיס.',
  creators: 'האלגוריתם של הרשתות החברתיות (טיקטוק/רילס/יוטיוב) אצלך בכיס.',
  influencers: 'חדר האסטרטגיה של המותגים הגדולים ומשרדי הפרסום המובילים אצלך בכיס.',
};

// --- Global Styles & Animation ---

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(212, 160, 67, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(212, 160, 67, 0); }
  100% { box-shadow: 0 0 0 0 rgba(212, 160, 67, 0); }
`;

const glowReady = keyframes`
  0% { box-shadow: 0 0 5px rgba(212, 160, 67, 0.3); border-color: rgba(212, 160, 67, 0.5); }
  50% { box-shadow: 0 0 25px rgba(212, 160, 67, 0.7); border-color: #D4A043; transform: scale(1.02); }
  100% { box-shadow: 0 0 5px rgba(212, 160, 67, 0.3); border-color: rgba(212, 160, 67, 0.5); }
`;

const breathingHigh = keyframes`
  0% { 
    box-shadow: 0 0 20px rgba(212, 160, 67, 0.6); 
    transform: scale(1); 
    filter: brightness(100%);
    border-color: rgba(212, 160, 67, 0.5);
  }
  50% { 
    box-shadow: 0 0 60px rgba(255, 215, 0, 0.8); 
    transform: scale(1.02); 
    filter: brightness(140%);
    border-color: #fff;
  }
  100% { 
    box-shadow: 0 0 20px rgba(212, 160, 67, 0.6); 
    transform: scale(1); 
    filter: brightness(100%);
    border-color: rgba(212, 160, 67, 0.5);
  }
`;

const GlobalStyle = createGlobalStyle`
  body {
    background-color: #050505;
    color: #e0e0e0;
    font-family: 'Assistant', sans-serif;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }
  
  ::selection {
    background: #D4A043;
    color: #000;
  }

  ::-webkit-scrollbar {
    width: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #0f0f0f; 
  }
  ::-webkit-scrollbar-thumb {
    background: #333; 
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #D4A043; 
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Frank Ruhl Libre', serif;
    margin: 0;
  }
`;

// --- Styled Components ---

const AppContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (max-width: 600px) {
    padding: 20px 15px;
  }
`;

// -- Header Section --

const Header = styled.header`
  text-align: center;
  margin-bottom: 30px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${fadeIn} 0.8s ease-out;
`;

const Title = styled.h1`
  font-size: 3.5rem;
  color: #D4A043; /* Metallic Gold */
  margin: 10px 0 5px;
  letter-spacing: 3px;
  text-transform: uppercase;
  background: linear-gradient(to bottom, #fcf6ba, #bf953f, #b38728, #fbf5b7, #aa771c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 10px rgba(212, 160, 67, 0.3));
  
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
  @media (max-width: 480px) {
    font-size: 2rem;
    letter-spacing: 1px;
  }
`;

const Subtitle = styled.h2`
  font-family: 'Playfair Display', serif;
  font-size: 1.4rem;
  color: #D4A043;
  margin-bottom: 10px;
  font-weight: 400;

  @media (max-width: 480px) {
    font-size: 1.2rem;
  }
`;

const Description = styled.p`
  color: #888;
  font-size: 1rem;
  max-width: 600px;
  line-height: 1.6;
  margin-bottom: 30px;
  padding: 0 10px;
`;

const CTAButton = styled.button`
  background: linear-gradient(135deg, #b8862e 0%, #e6be74 50%, #b8862e 100%);
  background-size: 200% auto;
  color: #000;
  border: none;
  border-radius: 50px;
  padding: 12px 35px;
  font-family: 'Assistant', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(212, 160, 67, 0.3);

  &:hover {
    background-position: right center;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(212, 160, 67, 0.5);
  }
`;

// -- Capabilities Button --

const CapabilitiesButton = styled.button`
  background: #000;
  border: 1px solid #D4A043;
  color: #D4A043;
  border-radius: 50px;
  padding: 10px 30px;
  font-family: 'Assistant', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin: 20px 0 40px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s ease;
  box-shadow: 0 0 10px rgba(212, 160, 67, 0.1);

  &:hover {
    background: rgba(212, 160, 67, 0.1);
    box-shadow: 0 0 15px rgba(212, 160, 67, 0.3);
    transform: translateY(-2px);
  }

  span {
    background: linear-gradient(90deg, #D4A043, #e6be74);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
`;

// -- Modal --

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
  animation: ${fadeIn} 0.3s ease-out;
`;

const ModalContent = styled.div`
  background: #0a0a0a;
  border: 1px solid #D4A043;
  border-radius: 12px;
  width: 95%;
  max-width: 800px;
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
`;

const ModalTitle = styled.h2`
  color: #D4A043;
  font-size: 1.5rem;
  margin-bottom: 10px;
`;

const ModalSubtitle = styled.p`
  color: #ccc;
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0;
  max-width: 600px;
  margin: 0 auto;
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
  &:hover { color: #D4A043; }
`;

const ModalTabs = styled.div`
  display: flex;
  border-bottom: 1px solid #D4A043;
  margin-top: 20px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const ModalTab = styled.button<{ $active: boolean }>`
  flex: 1;
  background: ${props => props.$active ? 'linear-gradient(to top, rgba(212, 160, 67, 0.1), transparent)' : 'transparent'};
  border: none;
  border-bottom: 3px solid ${props => props.$active ? '#D4A043' : 'transparent'};
  color: ${props => props.$active ? '#D4A043' : '#888'};
  padding: 15px;
  font-weight: 700;
  font-family: 'Assistant', sans-serif;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;

  &:hover {
    color: #D4A043;
  }
`;

const TrackDescriptionText = styled.p`
  text-align: center;
  color: #999;
  font-size: 1rem;
  margin: 25px auto 10px;
  max-width: 750px;
  line-height: 1.5;
  padding: 0 20px;
`;

const ModalBody = styled.div`
  padding: 25px;
  overflow-y: auto;
`;

const ModalRow = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
  border-bottom: 1px solid #1a1a1a;
  padding-bottom: 15px;

  &:last-child {
    border-bottom: none;
  }
`;

const ModalRole = styled.div`
  color: #e6be74;
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 5px;
  text-align: right;
`;

const ModalDesc = styled.div`
  color: #e0e0e0;
  font-size: 0.95rem;
  text-align: right;
`;

// -- Track Selection --

const SectionLabel = styled.div`
  color: #e0e0e0;
  font-size: 1.2rem;
  margin-bottom: 20px;
  font-weight: 600;
  position: relative;
  display: inline-block;
  text-align: center;
  
  &::after {
    content: '';
    display: block;
    width: 40px;
    height: 2px;
    background: #D4A043;
    margin: 8px auto 0;
  }
`;

// -- Expert Selection Controls --

const ExpertControlBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 20px;
  
  @media (max-width: 650px) {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
`;

const ExpertControlText = styled.div`
  color: #ccc;
  font-size: 0.95rem;
  padding-right: 5px;

  strong {
    color: #D4A043;
    font-weight: 600;
  }
`;

const ExpertToggleGroup = styled.div`
  display: flex;
  background: rgba(255,255,255,0.05);
  border-radius: 50px;
  padding: 4px;
  border: 1px solid #333;
  gap: 5px;
`;

const ExpertToggleButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#D4A043' : 'transparent'};
  color: ${props => props.$active ? '#000' : props.disabled ? '#555' : '#888'};
  border: none;
  border-radius: 50px;
  padding: 6px 18px;
  font-size: 0.85rem;
  font-family: 'Assistant', sans-serif;
  font-weight: 700;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.3s;
  white-space: nowrap;
  opacity: ${props => props.disabled ? 0.4 : 1};

  &:hover:not(:disabled) {
    color: ${props => props.$active ? '#000' : '#D4A043'};
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  width: 100%;
  margin-bottom: 30px;
  
  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const TrackCard = styled.div<{ $active: boolean }>`
  background: ${props => props.$active ? 'rgba(212, 160, 67, 0.15)' : 'rgba(20, 20, 20, 0.6)'};
  border: 1px solid ${props => props.$active ? '#D4A043' : '#333'};
  border-radius: 12px;
  padding: 20px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  height: 100px;
  
  &:hover {
    border-color: #D4A043;
    background: rgba(212, 160, 67, 0.05);
    transform: translateY(-5px);
  }

  svg {
    width: 32px;
    height: 32px;
    margin-bottom: 10px;
    stroke: ${props => props.$active ? '#D4A043' : '#888'};
    transition: stroke 0.3s;
  }

  span {
    color: ${props => props.$active ? '#D4A043' : '#aaa'};
    font-size: 0.9rem;
    font-weight: 600;
    text-align: center;
  }
`;

// -- Features Grid (Resized to match TrackCard) --

const FeatureCard = styled.div<{ $selected: boolean }>`
  background: ${props => props.$selected ? 'rgba(212, 160, 67, 0.1)' : '#0a0a0a'};
  border: 1px solid ${props => props.$selected ? '#D4A043' : '#222'};
  border-radius: 12px;
  padding: 10px;
  text-align: center;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  position: relative;
  height: 100px;

  &:hover {
    border-color: #D4A043;
    background: rgba(212, 160, 67, 0.05);
    transform: translateY(-5px);
  }

  /* Checkmark */
  &::after {
    content: '✓';
    position: absolute;
    top: 5px;
    left: 8px;
    color: #D4A043;
    opacity: ${props => props.$selected ? 1 : 0};
    font-weight: bold;
    transition: opacity 0.2s;
    font-size: 14px;
  }
`;

const FeatureTitle = styled.h4<{ $selected: boolean }>`
  color: ${props => props.$selected ? '#D4A043' : '#ccc'};
  font-size: 0.9rem;
  font-weight: 700;
  margin: 0;
  line-height: 1.2;
`;

const FeatureDesc = styled.p`
  color: #e0e0e0;
  font-size: 0.75rem;
  line-height: 1.1;
  margin: 5px 0 0 0;
  font-weight: 400;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

// -- Upload Section --

const UploadContainer = styled.div<{ $hasFile?: boolean }>`
  background: ${props => props.$hasFile ? '#000' : '#0f0f0f'};
  border: 2px dashed ${props => props.$hasFile ? '#D4A043' : '#333'};
  border-radius: 16px;
  padding: ${props => props.$hasFile ? '0' : '40px'};
  width: 100%;
  max-width: 700px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  margin-bottom: 20px;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
  
  @media (max-width: 480px) {
    padding: ${props => props.$hasFile ? '0' : '30px 15px'};
  }
  
  &:hover {
    border-color: #D4A043;
    background: ${props => props.$hasFile ? '#000' : '#111'};
  }
`;

const UploadContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
`;

const UploadIcon = styled.div`
  font-size: 50px;
  color: #D4A043;
  margin-bottom: 15px;
  filter: drop-shadow(0 0 10px rgba(212, 160, 67, 0.2));
`;

const UploadTitle = styled.h3`
  color: #fff;
  font-size: 1.2rem;
  margin-bottom: 5px;
  font-family: 'Assistant', sans-serif;
  font-weight: 700;
  text-align: center;
`;

const UploadSubtitle = styled.p`
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 25px;
  text-align: center;
`;

const FileInput = styled.input`
  display: none;
`;

const UploadButton = styled.label`
  background: #D4A043;
  color: #000;
  padding: 12px 30px;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
  
  &:hover {
    background: #e6be74;
  }
`;

const FullSizePreview = styled.div`
  width: 100%;
  height: 100%;
  min-height: 350px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  position: relative;

  video, img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    max-height: 500px;
  }
`;

const RemoveFileBtn = styled.button`
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  border: 1px solid #D4A043;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    background: #D4A043;
    color: #000;
  }
`;

// -- PDF Upload Section --

const PdfUploadWrapper = styled.div`
  width: 100%;
  max-width: 700px;
  display: flex;
  justify-content: center;
  margin-top: -10px;
  margin-bottom: 20px;
`;

const PdfUploadLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(212, 160, 67, 0.4);
  padding: 12px 25px;
  border-radius: 8px;
  color: #e6be74;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
  font-weight: 600;

  &:hover {
    background: rgba(212, 160, 67, 0.15);
    border-color: #D4A043;
    color: #fff;
    transform: translateY(-1px);
  }
`;

const PdfFileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(212, 160, 67, 0.1);
  border: 1px solid rgba(212, 160, 67, 0.3);
  padding: 8px 15px;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 0.9rem;
  animation: ${fadeIn} 0.3s ease-out;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }
`;

const RemovePdfBtnSmall = styled.button`
  background: none;
  border: none;
  color: #D4A043;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`;

// -- Input Section --

const InputWrapper = styled.div`
  width: 100%;
  max-width: 700px;
  position: relative;
  margin-top: 20px;
`;

const MainInput = styled.textarea`
  width: 100%;
  background: #0a0a0a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 15px;
  color: #e0e0e0;
  font-family: 'Assistant', sans-serif;
  font-size: 1rem;
  min-height: 80px;
  resize: vertical;
  transition: border-color 0.3s;
  
  &:focus {
    outline: none;
    border-color: #D4A043;
  }
  
  &::placeholder {
    color: #999;
    font-weight: 500;
  }
`;

const ActionButton = styled.button<{ $isReady?: boolean; $isLoading?: boolean }>`
  width: 100%;
  margin-top: 15px;
  background: linear-gradient(90deg, #b8862e, #e6be74, #b8862e);
  background-size: 200% auto;
  color: #000;
  border: 2px solid transparent;
  padding: 15px;
  border-radius: 50px;
  font-weight: 800;
  font-size: 1.1rem;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(212, 160, 67, 0.2);
  transition: all 0.3s;
  
  /* Ready state animation */
  ${props => props.$isReady && !props.$isLoading && css`
    animation: ${glowReady} 2s infinite ease-in-out;
  `}

  /* Loading state styles */
  ${props => props.$isLoading && css`
    animation: ${breathingHigh} 1.5s infinite ease-in-out;
    background: linear-gradient(90deg, #D4A043, #FFF8DC, #D4A043);
    background-size: 200% auto;
    opacity: 1 !important;
    cursor: wait !important;
    color: #000 !important;
    border-color: #fff;
    text-shadow: none;
    font-weight: 800;
  `}

  &:hover:not(:disabled) {
    transform: scale(1.02);
    box-shadow: 0 6px 25px rgba(212, 160, 67, 0.4);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorMsg = styled.div`
  color: #ff4d4d;
  font-size: 0.9rem;
  margin-top: 10px;
  text-align: center;
`;

// -- Response Section --

const ResponseArea = styled.div`
  width: 100%;
  max-width: 900px;
  margin-top: 40px;
  animation: ${fadeIn} 0.5s ease-out;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const SectionTitleExternal = styled.h3`
  color: #D4A043;
  font-size: 1rem;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const CompactResultBox = styled.div`
  background: linear-gradient(145deg, #111, #080808);
  border: 1px solid rgba(212, 160, 67, 0.3);
  padding: 15px 20px;
  border-radius: 8px;
  margin: 0 auto 10px;
  max-width: 600px;
  width: 100%;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.4);

  p {
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.4;
    color: #e0e0e0;
    font-family: 'Assistant', sans-serif;
    margin: 0;
  }
`;

const HookText = styled.p`
  color: #fff !important;
  font-style: italic;
  font-family: 'Frank Ruhl Libre', serif !important;
`;

// -- Premium Expert Cards --

const ExpertsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 25px;
`;

const ExpertResultCard = styled.div`
  background: linear-gradient(145deg, #111, #0a0a0a);
  border: 1px solid #333;
  border-top: 1px solid #D4A043;
  border-radius: 4px;
  padding: 25px;
  position: relative;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  transition: transform 0.3s;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 40px rgba(212, 160, 67, 0.15);
    border-color: #555;
  }

  /* Decorative Stars */
  &::before, &::after {
    content: '✦';
    position: absolute;
    color: #D4A043;
    font-size: 14px;
    opacity: 0.5;
  }
  &::before { top: 8px; left: 8px; }
  &::after { bottom: 8px; right: 8px; }

  h4 {
    color: #D4A043;
    font-size: 1.2rem;
    margin-bottom: 15px;
    border-bottom: 1px solid rgba(212, 160, 67, 0.3);
    padding-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-family: 'Frank Ruhl Libre', serif;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
`;

const ExpertScore = styled.span`
  background: #D4A043;
  color: #000;
  font-family: 'Assistant', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 2px 8px;
  border-radius: 4px;
`;

const ExpertSectionTitle = styled.h5`
  color: #888;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 15px;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 5px;
  
  svg { width: 14px; height: 14px; color: #D4A043; }
`;

const ExpertText = styled.p`
  color: #ccc;
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 10px;
  `;

// -- Committee Section --

const CommitteeSection = styled.div`
  margin-top: 40px;
  position: relative;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const CommitteeText = styled.p`
  font-size: 1.1rem;
  line-height: 1.6;
  color: #e0e0e0;
  margin: 0;
`;

const CommitteeTips = styled.div`
  background: rgba(255,255,255,0.03);
  padding: 20px;
  border-radius: 8px;
  text-align: right;
  max-width: 600px;
  width: 100%;
  margin: 20px auto 30px;
  border: 1px dashed #444;

  h5 {
    color: #D4A043;
    margin-bottom: 10px;
    font-size: 1.1rem;
  }
  
  ul {
    padding-right: 20px;
    margin: 0;
  }
  li {
    margin-bottom: 8px;
    color: #ccc;
  }
`;

const FinalScore = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  margin-top: 10px;
  
  .number {
    font-size: 4rem;
    font-weight: 800;
    line-height: 1;
    color: #fff;
    text-shadow: 0 0 20px rgba(212, 160, 67, 0.4);
  }
  .label {
    color: #D4A043;
    font-size: 1rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 5px;
  }
`;

// -- Action Buttons (Footer of Response) --

const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 20px;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.1);
  justify-content: center;
  flex-wrap: wrap;

  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const SecondaryButton = styled.button`
  background: transparent;
  border: 1px solid #888;
  color: #ccc;
  padding: 12px 25px;
  border-radius: 50px;
  font-family: 'Assistant', sans-serif;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  &:hover {
    border-color: #fff;
    color: #fff;
    background: rgba(255,255,255,0.05);
  }
`;

const PrimaryButton = styled.button`
  background: linear-gradient(135deg, #b8862e 0%, #e6be74 50%, #b8862e 100%);
  background-size: 200% auto;
  border: none;
  color: #000;
  padding: 12px 25px;
  border-radius: 50px;
  font-family: 'Assistant', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 4px 15px rgba(212, 160, 67, 0.2);

  &:hover:not(:disabled) {
    background-position: right center;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(212, 160, 67, 0.4);
  }

  &:disabled {
    opacity: 0.7;
    cursor: wait;
  }
`;

const PremiumBadge = styled.span`
  background: rgba(212, 160, 67, 0.15);
  color: #D4A043;
  border: 1px solid rgba(212, 160, 67, 0.3);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 1px;
`;

// --- SVGs ---

const PhoneStarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <path d="M12 18h.01" />
    <path d="M14.5 9.5l-2.5-1.5-2.5 1.5 1-3-2.5-1.5h3l1.5-3 1.5 3h3l-2.5 1.5 1 3z" style={{ fill: 'currentColor', stroke: 'none' }} opacity="0.5"/>
    <path d="M12 6v6" opacity="0.01"/>
  </svg>
);

const TheaterMasksIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 10.5C2 5.8 5.8 2 10.5 2h3C18.2 2 22 5.8 22 10.5v1c0 4.7-3.8 8.5-8.5 8.5h-3C5.8 20 2 16.2 2 11.5v-1z" />
    <path d="M8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    <path d="M16 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    <path d="M12 16c-2.5 0-4-2-4-2s1.5-2 4-2 4 2 4 2-1.5 2-4 2z" />
  </svg>
);

const MicrophoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const MusicNoteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const CinematicCameraIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <circle cx="9" cy="12" r="3" />
    <path d="M16 16l6 2V6l-6 2" />
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
);
const UploadIconSmall = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
const BulbIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2v1"></path><path d="M12 6a7 7 0 0 1 7 7c0 2-2 3-2 3v2a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-2s-2-1-2-3a7 7 0 0 1 7-7z"></path></svg>
);
const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z" />
  </svg>
);

// Updated Subtle Icons
const SubtleSparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3 7h7l-6 5 2 8-6-5-6 5 2-8-6-5h7z" />
  </svg>
);
const SubtleDocumentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

const PdfIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

// --- Logo Component ---

const LogoContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
`;

const LogoPlaceholder = styled.div`
  width: 180px;
  height: 100px;
  border: 1px dashed rgba(212, 160, 67, 0.3);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(212, 160, 67, 0.5);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: #D4A043;
    color: #D4A043;
  }
`;

const HiddenLogoInput = styled.input`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
`;

const StyledLogoImg = styled.img`
  width: 100%;
  height: auto;
  max-width: 320px;
  object-fit: contain;
`;

const AppLogo = () => {
  return (
    <LogoContainer>
      <StyledLogoImg 
        src="/Logo.png" 
        alt="Logo"
      />
    </LogoContainer>
  );
};

// --- Modal Component ---

const CapabilitiesModal = ({ isOpen, onClose, activeTab, setActiveTab }: { isOpen: boolean, onClose: () => void, activeTab: string, setActiveTab: (t: string) => void }) => {
  if (!isOpen) return null;

  const content: Record<string, { role: string; desc: string }[]> = {
    actors: [
      { role: 'הבמאי', desc: 'בניית הסצנה, פיצוח הרצון, חלוקה לביטים.' },
      { role: 'מלהקת ראשית', desc: 'טייפקאסט, אמינות, האם הוא "חי" את הדמות.' },
      { role: 'התסריטאי', desc: 'דיוק בטקסט, הבנת הסאב-טקסט והניואנסים.' },
      { role: 'מאמן משחק', desc: 'מתח גופני, בחירות רגשיות, זיכרון חושי.' },
      { role: 'צלם ראשי', desc: 'מציאת האור, קשר עין, עבודה מול עדשה.' },
      { role: 'מומחה שפת גוף', desc: 'הלימה בין גוף לטקסט, מיקרו-הבעות.' },
      { role: 'מנטור אודישנים', desc: 'הצגה עצמית, כניסה ויציאה מדמות.' },
      { role: 'אסטרטג קריירה', desc: 'התאמה לתיק עבודות, פוטנציאל ליהוק.' },
    ],
    musicians: [
       { role: 'מאמן ווקאלי', desc: 'טכניקה, דיוק בצליל, נשימה, תמיכה.' },
       { role: 'מפיק מוזיקלי', desc: 'ריתמיקה, גרוב, דינמיקה, עיבוד.' },
       { role: 'השופט הקשוח', desc: 'ייחודיות, חותם אישי, כריזמה.' },
       { role: 'מומחה פרפורמנס', desc: 'הגשה, תנועה על במה, קשר עם הקהל.' },
       { role: 'מומחה אינטרפרטציה', desc: 'רגש, חיבור לטקסט, אמינות בהגשה.' },
       { role: 'סטיילינג ותדמית', desc: 'לוק, נראות, התאמה לז\'אנר.' },
       { role: 'מנהל רפרטואר', desc: 'בחירת שיר, התאמה למנעד ולזמר.' },
       { role: 'עורך רדיו', desc: 'פוטנציאל רדיופוני, מסחריות.' },
    ],
    creators: [
       { role: 'אסטרטג ויראליות', desc: 'הבטחה מול ביצוע, פוטנציאל שיתוף.' },
       { role: 'מאסטר הוקים', desc: '3 שניות ראשונות, לכידת תשומת לב.' },
       { role: 'עורך וידאו', desc: 'קצב וזרימה, חיתוכים, זום, אפקטים.' },
       { role: 'האקר אלגוריתם', desc: 'זמן צפייה, צפייה חוזרת.' },
       { role: 'מומחה אנרגיה', desc: 'וייב, אותנטיות, התאמה לטרנדים.' },
       { role: 'עורך הפקה', desc: 'ערך הפקה, תאורה, איכות סאונד, כתוביות.' },
       { role: 'גורו מעורבות', desc: 'הנעה לפעולה, עידוד תגובות.' },
       { role: 'תסריטאי רשת', desc: 'פאנץ\', הידוק מסרים, סטוריטלינג קצר.' },
    ],
    influencers: [
       { role: 'מאסטר רטוריקה', desc: 'דיקציה, שטף דיבור, שכנוע והעברת מסר.' },
       { role: 'בונה סמכות', desc: 'מיצוב כמומחה, אמינות מקצועית וביטחון.' },
       { role: 'סטוריטלר עסקי', desc: 'העברת מסר מורכב בפשטות ורגש.' },
       { role: 'מומחה שפת גוף', desc: 'פתיחות, ביטחון עצמי, תנועות ידיים.' },
       { role: 'מנהל מותג אישי', desc: 'בידול, ערכים, שפה ויזואלית אחידה.' },
       { role: 'כריזמה בימתית', desc: 'נוכחות, החזקת קהל, אנרגיה גבוהה.' },
       { role: 'קופירייטר שיווקי', desc: 'דיוק המסר, הנעה לפעולה אפקטיבית.' },
       { role: 'אסטרטג תוכן', desc: 'ערך לקהל, בניית אמון לאורך זמן.' },
    ]
  };

  const tabs = [
    { id: 'actors', label: 'שחקנים ואודישנים' },
    { id: 'musicians', label: 'זמרים ומוזיקאים' },
    { id: 'creators', label: 'יוצרי תוכן וכוכבי רשת' },
    { id: 'influencers', label: 'משפיענים ומותגים' },
  ];

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
          <ModalTitle>יכולות האפליקציה של סוכן העל</ModalTitle>
          <ModalSubtitle>
            פשוט וקל<br/>
            מעלים סרטון, מצרפים קובץ הנחיות או תסריט (לדיוק מקסימלי),
            כותבים הנחיה, הוראות או שאלות למומחים (אופציונלי) ולוחצים על אקשן !
          </ModalSubtitle>
        </ModalHeader>
        
        <ModalTabs>
          {tabs.map(tab => (
            <ModalTab 
              key={tab.id} 
              $active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </ModalTab>
          ))}
        </ModalTabs>

        <TrackDescriptionText>
           {TRACK_DESCRIPTIONS[activeTab]}
        </TrackDescriptionText>
        
        <ModalBody>
          {content[activeTab]?.map((item, idx) => (
             <ModalRow key={idx}>
               <ModalRole>{item.role}</ModalRole>
               <ModalDesc>{item.desc}</ModalDesc>
             </ModalRow>
          )) || <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>תוכן בבנייה...</div>}
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );
};

// --- Main App Logic ---

const TRACKS = [
  { id: 'actors', label: 'שחקנים ואודישנים', icon: <TheaterMasksIcon /> },
  { id: 'musicians', label: 'זמרים ומוזיקאים', icon: <MusicNoteIcon /> },
  { id: 'creators', label: 'יוצרי תוכן וכוכבי רשת', icon: <PhoneStarIcon /> },
  { id: 'influencers', label: 'משפיענים ומותגים', icon: <MicrophoneIcon /> },
];

const EXPERTS_BY_TRACK: Record<string, { title: string; desc: string }[]> = {
  creators: [
    { title: 'אסטרטג ויראליות', desc: 'הבטחה מול ביצוע, פוטנציאל שיתוף' },
    { title: 'מאסטר הוקים', desc: '3 שניות ראשונות, לכידת תשומת לב' },
    { title: 'עורך וידאו', desc: 'קצב וזרימה, חיתוכים, זום, אפקטים' },
    { title: 'האקר אלגוריתם', desc: 'זמן צפייה, צפייה חוזרת' },
    { title: 'מומחה אנרגיה', desc: 'וייב, אותנטיות, התאמה לטרנדים' },
    { title: 'עורך הפקה', desc: 'ערך הפקה, תאורה, איכות סאונד' },
    { title: 'גורו מעורבות', desc: 'הנעה לפעולה, עידוד תגובות' },
    { title: 'תסריטאי רשת', desc: 'פאנץ\', הידוק מסרים, סטוריטלינג' },
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
};

// --- Login Component ---

const LoginContainer = styled.div`
  max-width: 500px;
  margin: 50px auto;
  padding: 40px;
  background: #0a0a0a;
  border: 1px solid #D4A043;
  border-radius: 12px;
  box-shadow: 0 0 40px rgba(212, 160, 67, 0.2);
`;

const LoginTitle = styled.h2`
  color: #D4A043;
  text-align: center;
  margin-bottom: 30px;
  font-size: 1.8rem;
`;

const LoginForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const LoginInput = styled.input`
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

const LoginButton = styled.button`
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

const TestUserInfo = styled.div`
  background: rgba(212, 160, 67, 0.1);
  border: 1px dashed rgba(212, 160, 67, 0.4);
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  text-align: center;
  
  h3 {
    color: #D4A043;
    font-size: 1rem;
    margin-bottom: 10px;
  }
  
  p {
    color: #ccc;
    font-size: 0.9rem;
    margin: 5px 0;
  }
`;

const UserInfo = styled.div`
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #333;
  
  p {
    color: #ccc;
    margin: 5px 0;
  }
  
  strong {
    color: #D4A043;
  }
`;

const LogoutButton = styled.button`
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

  &:hover {
    border-color: #D4A043;
    color: #D4A043;
  }
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

const LoginComponent = ({ onLogin, onSwitchToSignUp }: { onLogin: () => void; onSwitchToSignUp: () => void }) => {
  const [email, setEmail] = useState('viralytest@test.com');
  const [password, setPassword] = useState('Test123456!@#');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // נסה להתחבר קודם
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // אם המשתמש לא קיים או שגיאת credentials, נסה ליצור אותו
        if (signInError.message.includes('Invalid login credentials') || 
            signInError.message.includes('Email not confirmed') ||
            signInError.message.includes('User not found')) {
          
          console.log('User not found or invalid credentials, attempting to create...');
          setCreatingUser(true);
          setError('יוצר משתמש חדש...');
          
          // נסה ליצור משתמש - בלי emailRedirectTo כי זה יכול לגרום לבעיות
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(), // ודא שהאימייל תקין
            password,
            options: {
              data: {
                plan_type: 'creators', // Set plan_type in metadata for trigger
              }
            }
          });

          if (signUpError) {
            // אם המשתמש כבר קיים, נסה להתחבר שוב
            if (signUpError.message.includes('already registered') || 
                signUpError.message.includes('User already registered')) {
              
              console.log('User already exists, trying to sign in again...');
              const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              
              if (retryError) {
                if (retryError.message.includes('Email not confirmed') || 
                    retryError.message.includes('email_not_confirmed')) {
                  setError('המשתמש קיים אבל האימייל לא אומת. אנא השבית "Email confirmation" ב-Supabase Dashboard או אמת את המשתמש ידנית.');
                } else {
                  setError(`שגיאה בהתחברות: ${retryError.message}`);
                }
              } else if (retryData?.session) {
                onLogin();
                return;
              }
            } else {
              // בדוק אם זו שגיאת email invalid
              if (signUpError.message.includes('invalid') || signUpError.message.includes('Invalid')) {
                setError(`האימייל לא תקין או חסום ב-Supabase. נסה אימייל אחר (למשל: viralytest@gmail.com) או צור את המשתמש ידנית ב-Supabase Dashboard → Authentication → Users`);
              } else {
                setError(`שגיאה ביצירת משתמש: ${signUpError.message}. נסה ליצור את המשתמש ידנית ב-Supabase Dashboard.`);
              }
            }
            setCreatingUser(false);
            setLoading(false);
            return;
          }

          // אם ה-signup הצליח
          if (signUpData?.user) {
            setCreatingUser(false);
            console.log('User created successfully:', signUpData.user.id);
            
            // אם יש session מיד (אימות אימייל מושבת), התחבר
            if (signUpData.session) {
              onLogin();
              return;
            }
            
            // אם אין session, נסה להתחבר (לפעמים Supabase מאמת אוטומטית)
            const { data: autoSignIn, error: autoSignInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            
            if (autoSignInError) {
              if (autoSignInError.message.includes('Email not confirmed') || 
                  autoSignInError.message.includes('email_not_confirmed')) {
                setError('המשתמש נוצר בהצלחה! אבל האימייל לא אומת. אנא השבית "Email confirmation" ב-Supabase Dashboard (Authentication → Settings) או אמת את המשתמש ידנית.');
              } else {
                setError(`המשתמש נוצר אבל לא ניתן להתחבר: ${autoSignInError.message}. נסה להתחבר שוב בעוד רגע.`);
              }
            } else if (autoSignIn?.session) {
              onLogin();
              return;
            }
          } else {
            setError('המשתמש לא נוצר. נסה שוב או פנה למנהל המערכת.');
            setCreatingUser(false);
          }
        } else {
          setError(`שגיאה בהתחברות: ${signInError.message}`);
        }
        setCreatingUser(false);
        setLoading(false);
        return;
      }

      // אם ההתחברות הצליחה
      if (signInData?.session) {
        onLogin();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer>
      <LoginTitle>התחברות למערכת</LoginTitle>
      
      <TestUserInfo>
        <h3>📋 פרטי משתמש בדיקה</h3>
        <p><strong>אימייל:</strong> viralytest@test.com</p>
        <p><strong>סיסמה:</strong> Test123456!@#</p>
      </TestUserInfo>

      <LoginForm onSubmit={handleLogin}>
        <LoginInput
          type="email"
          placeholder="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <LoginInput
          type="password"
          placeholder="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <LoginButton type="submit" disabled={loading}>
          {loading ? 'מתחבר...' : 'התחבר'}
        </LoginButton>
      </LoginForm>
      
      <SwitchModeButton onClick={onSwitchToSignUp}>
        אין לך חשבון? הירשם כאן
      </SwitchModeButton>
    </LoginContainer>
  );
};

const App = () => {
  const [activeTrack, setActiveTrack] = useState<TrackId>('actors');
  const [selectedExperts, setSelectedExperts] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [authModalInitialPlan, setAuthModalInitialPlan] = useState<PlanType | undefined>(undefined);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'signup'>('login');
  const [modalTab, setModalTab] = useState('actors');
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isTestUser, setIsTestUser] = useState(false);
  const [showTestInterface, setShowTestInterface] = useState(false);
  
  // Subscription and plan access
  const { subscription, loading: subscriptionLoading, refresh: refreshSubscription } = useSubscription();
  const basePlanAccess = usePlanAccess(subscription);
  
  // אם המשתמש הוא אדמין, תן לו את כל היכולות (creators_extreme)
  const planAccess = isAdmin ? (() => {
    const adminPlan = PLAN_CONFIG['creators_extreme'];
    return {
      planLabel: 'אדמין - גישה מלאה',
      maxExperts: adminPlan.maxExperts,
      maxTracks: adminPlan.maxTracks,
      maxVideoMinutes: adminPlan.maxVideoMinutes,
      maxVideoMB: adminPlan.maxVideoMB,
      hasFeature: (feature: string) => true, // כל הפיצ'רים פתוחים
      canUploadVideo: () => true, // ללא הגבלות
      canRunAnalysis: () => true, // ללא הגבלות
      hasMinutesLeft: () => true, // ללא הגבלות
      canAddStudent: () => true, // ללא הגבלות
      canSelectExpert: () => true, // ללא הגבלות
      canSelectTrack: () => true, // ללא הגבלות
    };
  })() : basePlanAccess;
  
  const handleUpgradePlan = async (newPlan: PlanType) => {
    if (!subscription) return;
    
    try {
      const { data, error } = await supabase.rpc('update_user_plan_type', {
        new_plan_type: newPlan
      });
      
      if (error) {
        alert(`שגיאה בשדרוג החבילה: ${error.message}`);
      } else if (data?.success) {
        alert(`החבילה שודרגה ל-${PLAN_CONFIG[newPlan].label}!`);
        setIsPlansModalOpen(false);
        // Refresh subscription
        window.location.reload();
      }
    } catch (err: any) {
      alert(`שגיאה: ${err.message}`);
    }
  };
  
  // Results
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [averageScore, setAverageScore] = useState<number>(0);
  const [previousResult, setPreviousResult] = useState<AnalysisResult | null>(null);
  const [isImprovementMode, setIsImprovementMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Listen to auth changes (but don't auto-check on mount)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[App] Auth state changed:', event, session?.user?.id);
      
      // טיפול באימות אימייל
      if (event === 'SIGNED_IN' && session) {
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (urlParams.get('type') === 'email' || hashParams.get('type') === 'email') {
          console.log('[App] Email verification detected, reloading page...');
          // המשתמש אימת את האימייל - רענן את הדף כדי לטעון את ה-subscription
          setTimeout(() => {
            window.location.href = window.location.origin + window.location.pathname;
          }, 1500);
        }
      }
      
      if (session?.user) {
        setUser(session.user);
        // Check if user is admin
        const userRole = session.user.user_metadata?.role;
        const isAdminUser = userRole === 'admin';
        setIsAdmin(isAdminUser);
        
        // Check if user is test user
        const testUserEmail = 'viralytest@test.com';
        const isTestUserEmail = session.user.email?.toLowerCase() === testUserEmail.toLowerCase();
        setIsTestUser(isTestUserEmail);
        
        console.log('[App] User logged in:', {
          id: session.user.id,
          email: session.user.email,
          isAdmin: isAdminUser,
          isTestUser: isTestUserEmail
        });
        // Don't auto-open admin panel - user needs to click Settings button
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsTestUser(false);
        setShowAdminPanel(false);
        setShowTestInterface(false);
        console.log('[App] User logged out');
      }
      setCheckingAuth(false);
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const userRole = session.user.user_metadata?.role;
        const isAdminUser = userRole === 'admin';
        setIsAdmin(isAdminUser);
        
        // Check if user is test user
        const testUserEmail = 'viralytest@test.com';
        const isTestUserEmail = session.user.email?.toLowerCase() === testUserEmail.toLowerCase();
        setIsTestUser(isTestUserEmail);
        
        // Don't auto-open admin panel - user needs to click Settings button
      }
      setCheckingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // תמיד מתחיל עם 3 המובילים (ברירת מחדל)
    const defaults = EXPERTS_BY_TRACK[activeTrack].slice(0, 3).map(e => e.title);
    setSelectedExperts(defaults);
  }, [activeTrack]);

  // הגדר תחום ראשוני לפי החבילה או default_track של המשתמש
  useEffect(() => {
    if (!user) return;
    
    // אם עדיין טוען את ה-subscription, המתן
    if (subscriptionLoading) {
      console.log('[App] Waiting for subscription to load...');
      return;
    }
    
    // אם אין subscription או planAccess, לא לעדכן את התחום
    if (!subscription || !planAccess) {
      console.log('[App] No subscription or planAccess yet:', { subscription, planAccess });
      return;
    }
    
    console.log('[App] Setting initial track:', {
      default_track: subscription.default_track,
      plan_type: subscription.plan_type,
      maxTracks: planAccess.maxTracks,
      currentTrack: activeTrack
    });
    
    // אם יש default_track ב-subscription, השתמש בו
    if (subscription.default_track && ['actors', 'musicians', 'creators', 'influencers'].includes(subscription.default_track)) {
      if (activeTrack !== subscription.default_track) {
        console.log('[App] Setting track from subscription.default_track:', subscription.default_track);
        setActiveTrack(subscription.default_track as TrackId);
      }
      return;
    }
    
    // אם החבילה מוגבלת לתחום אחד (trial או creators) ואין default_track, הגדר את actors כברירת מחדל
    if (planAccess.maxTracks === 1 && !subscription.default_track) {
      if (activeTrack !== 'actors') {
        console.log('[App] Setting track to actors (default for single-track plan)');
        setActiveTrack('actors');
      }
    }
  }, [planAccess, subscription, user, subscriptionLoading, activeTrack]);
  
  // בדיקה אם משתמש חדש צריך לבחור תחום
  const [showTrackSelectionModal, setShowTrackSelectionModal] = useState(false);
  const [isSavingTrack, setIsSavingTrack] = useState(false);
  
  useEffect(() => {
    if (!user || !subscription || !planAccess) return;
    
    // בדוק אם זה משתמש חדש (נוצר היום) ואין לו default_track
    const userCreatedToday = new Date(user.created_at);
    const today = new Date();
    const isNewUser = userCreatedToday.toDateString() === today.toDateString();
    
    // אם החבילה מאפשרת יותר מתחום אחד, והמשתמש חדש, ואין לו default_track
    if (isNewUser && !subscription.default_track && planAccess.maxTracks > 1) {
      setShowTrackSelectionModal(true);
    }
  }, [user, subscription, planAccess]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCheckingAuth(false);
    // Reset app state
    setFile(null);
    setPdfFile(null);
    setPreviewUrl(null);
    setResult(null);
    setPreviousResult(null);
    setIsImprovementMode(false);
  };

  const handleTrackChange = async (id: string) => {
    // כשלא מחובר - אפשר לעבור בין כל התחומים
    if (!user) {
      setActiveTrack(id as TrackId);
      setResult(null);
      setPreviousResult(null);
      setIsImprovementMode(false);
      if (['actors', 'musicians', 'creators', 'influencers'].includes(id)) {
        setModalTab(id);
      }
      return;
    }
    
    // כשיש משתמש - בדוק אם יש הרשאה לבחור תחום
    if (!planAccess) {
      // אם אין planAccess, עדיין אפשר לבחור תחום (למקרה של משתמש חדש)
      setActiveTrack(id as TrackId);
      setResult(null);
      setPreviousResult(null);
      setIsImprovementMode(false);
      if (['actors', 'musicians', 'creators', 'influencers'].includes(id)) {
        setModalTab(id);
      }
      return;
    }
    
    // בחבילת נסיון ויוצרים (maxTracks = 1) - אפשר לבחור תחום אחד
    // אם כבר יש default_track, אפשר לשנות אותו רק אם זה התחום הנוכחי
    if (planAccess.maxTracks <= 1) {
      // אם יש default_track והמשתמש מנסה לשנות לתחום אחר - לא לאפשר
      if (subscription?.default_track && subscription.default_track !== id) {
        // המשתמש כבר בחר תחום - לא לאפשר שינוי
        return;
      }
      // אם אין default_track או שהמשתמש בוחר את התחום שכבר נבחר - אפשר
    }
    
    // בחבילת יוצרים באקסטרים (maxTracks > 1) - כל התחומים פתוחים
    setActiveTrack(id as TrackId);
    setResult(null);
    setPreviousResult(null);
    setIsImprovementMode(false);
    
    // שמור את התחום הנבחר כברירת מחדל
    if (subscription && ['actors', 'musicians', 'creators', 'influencers'].includes(id)) {
      try {
        console.log('[handleTrackChange] Saving default track:', { user_id: user.id, track: id });
        const { data, error } = await supabase.rpc('update_user_default_track', {
          p_user_id: user.id,
          p_default_track: id
        });
        if (error) {
          console.error('[handleTrackChange] Error saving default track:', error);
          // נסה לעדכן ישירות דרך הטבלה
          const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({ default_track: id })
            .eq('user_id', user.id);
          if (updateError) {
            console.error('[handleTrackChange] Direct update also failed:', updateError);
          } else {
            console.log('[handleTrackChange] Track saved via direct update');
          }
        } else {
          console.log('[handleTrackChange] Track saved successfully via RPC:', data);
          // וודא שהעדכון נשמר
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: verifySubscription } = await supabase
            .from('user_subscriptions')
            .select('default_track')
            .eq('user_id', user.id)
            .maybeSingle();
          console.log('[handleTrackChange] Verified subscription after save:', verifySubscription);
          
          // רענן את ה-subscription ב-Provider כדי שהעדכון יופיע מיד
          if (verifySubscription?.default_track === id) {
            console.log('[handleTrackChange] Refreshing subscription provider...');
            await refreshSubscription();
          }
        }
      } catch (err) {
        console.error('[handleTrackChange] Error saving default track:', err);
      }
    }
    
    // Sync modal tab with active track if possible
    if (['actors', 'musicians', 'creators', 'influencers'].includes(id)) {
        setModalTab(id);
    }
  };

  const toggleExpert = (title: string) => {
    setSelectedExperts(prev => {
      if (prev.includes(title)) {
        // אם המומחה כבר נבחר, הסר אותו
        return prev.filter(t => t !== title);
      } else {
        // כשלא מחובר - אפשר לבחור כל המומחים
        if (!user) {
          return [...prev, title];
        }
        
        // כשיש משתמש - בדוק את המגבלה לפי החבילה
        const maxExperts = planAccess?.maxExperts || 8;
        if (prev.length >= maxExperts) {
          // אם הגעת למגבלה, אפשר רק להחליף (לא להוסיף)
          if (maxExperts <= 3) {
            // בחבילת ניסיון - לא ניתן להוסיף יותר מ-3, רק להחליף
            alert(`החבילה שלך מוגבלת ל-${maxExperts} מומחים. הסר מומחה קיים כדי לבחור אחר במקומו.`);
            return prev;
          }
          return prev;
        }
        return [...prev, title];
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const resetInput = () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // כשלא מחובר - אפשר להעלות קבצים (בלי בדיקות)
    if (!user) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setFile(selectedFile);
      setPreviewUrl(objectUrl);
      if (!isImprovementMode) {
        setResult(null);
      }
      return;
    }

    // כשיש משתמש - בדוק מגבלות לפי החבילה
    if (!planAccess) {
      alert("אין הרשאה להעלות קבצים. נא לבדוק את החבילה שלך.");
      resetInput();
      return;
    }
    
    const maxMB = planAccess.maxVideoMB;
    const maxBytes = maxMB * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      alert(`הקובץ גדול מדי. מגבלת החבילה שלך: עד ${maxMB}MB.`);
      resetInput();
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);

    const finalizeSelection = () => {
      setFile(selectedFile);
      setPreviewUrl(objectUrl);
      if (!isImprovementMode) {
        setResult(null);
      }
    };

    if (selectedFile.type.startsWith('video')) {
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.src = objectUrl;

      videoEl.onloadedmetadata = () => {
        if (!planAccess) {
          alert("אין הרשאה להעלות סרטונים. נא לבדוק את החבילה שלך.");
          URL.revokeObjectURL(objectUrl);
          resetInput();
          return;
        }
        
        const maxMinutes = planAccess.maxVideoMinutes;
        const maxSeconds = maxMinutes * 60;
        if (videoEl.duration > maxSeconds) {
          alert(`הסרטון חורג מהמגבלה של החבילה שלך: עד ${maxMinutes} דקות.`);
          URL.revokeObjectURL(objectUrl);
          resetInput();
          return;
        }
        finalizeSelection();
      };

      videoEl.onerror = () => {
        alert("לא ניתן לקרוא את המטא-דאטה של הווידאו. נסה קובץ אחר.");
        URL.revokeObjectURL(objectUrl);
        resetInput();
      };
    } else {
      finalizeSelection();
    }
  };
  
  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedPdf = e.target.files[0];
      if (selectedPdf.type === 'application/pdf') {
        setPdfFile(selectedPdf);
      } else {
        alert("נא להעלות קובץ PDF בלבד");
      }
    }
  };

  const handleRemovePdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPdfFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleReset = () => {
    setFile(null);
    setPdfFile(null);
    setPreviewUrl(null);
    setPrompt('');
    setResult(null);
    setPreviousResult(null);
    setIsImprovementMode(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadImprovedTake = () => {
    if (result) {
      setPreviousResult(result);
    }
    setResult(null);
    setIsImprovementMode(true);
    setFile(null);
    setPreviewUrl(null);
    // Keep PDF if uploaded, or clear it? Let's keep it as it might be relevant.
    setPrompt(''); 
    
    setTimeout(() => {
      document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' });
      fileInputRef.current?.click();
    }, 100);
  };

  const handleExportPdf = () => {
    if (!result) return;

    if (!planAccess || !planAccess.hasFeature('pdf_export')) {
      alert('יצוא ל-PDF זמין רק לחבילות מסוימות. שדרג את החבילה שלך להמשך.');
      return;
    }

    const contentElement = document.getElementById('analysis-content');
    if (!contentElement) {
      alert('לא נמצא תוכן ניתוח לייצוא.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) {
      alert('נא לאפשר חלונות קופצים כדי לייצא ל-PDF.');
      return;
    }

    const styles = `
      @page {
        size: A4;
        margin: 0;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body { 
        direction: rtl; 
        font-family: 'Assistant', sans-serif; 
        background: #050505 !important; 
        color: #f5f5f5 !important; 
        padding: 32px 32px 40px 32px;
      }
      h1,h2,h3,h4,h5,h6 {
        font-family: 'Frank Ruhl Libre', serif;
        color: #D4A043 !important;
        margin: 0 0 10px;
      }
      p, li, span, div {
        color: #e0e0e0;
      }
      .export-wrapper { max-width: 1000px; margin: 0 auto; }
      .export-header { 
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px; 
      }
      .export-header-text {
        text-align: right;
        flex: 1;
        margin-right: 16px;
      }
      .export-note { color: #999; font-size: 11px; margin-top: 4px; }
      .export-logo-left {
        flex: 0 0 auto;
      }
      .export-logo-left img {
        max-width: 120px;
        height: auto;
      }
      /* אל תציג כפתורים וקישורים */
      a, button { display: none !important; }
      /* רשימות */
      ul { padding-right: 20px; margin: 0; }
      li { margin-bottom: 6px; }
      /* איקונים – קטנים ועדינים יותר */
      svg { max-width: 16px; max-height: 16px; }
    `;

    const doc = printWindow.document;
    doc.open();
    doc.write(`
      <html dir="rtl">
        <head>
          <title>דו"ח ניתוח וידאו</title>
        </head>
        <body>
          <div class="export-wrapper">
            <div class="export-header">
              <div class="export-header-text">
                <h2>דו"ח ניתוח - Video Director Pro</h2>
                <div class="export-note">נוצר במסלול פרימיום • ${new Date().toLocaleString('he-IL')}</div>
              </div>
              <div class="export-logo-left">
                <img src="/Logo.png" alt="Viraly Logo" />
              </div>
            </div>
            ${contentElement.innerHTML}
          </div>
        </body>
      </html>
    `);

    // העתקה של כל ה-CSS מהאפליקציה כדי שהעיצוב ב-PDF יהיה נאמן למקור
    try {
      const headNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
      headNodes.forEach(node => {
        doc.head.appendChild(node.cloneNode(true));
      });

      const styleTag = doc.createElement('style');
      styleTag.textContent = styles;
      doc.head.appendChild(styleTag);
    } catch (e) {
      console.error('Failed to clone styles into print window', e);
    }

    doc.close();

    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        if (!base64data) {
           reject(new Error("Failed to read file"));
           return;
        }
        const base64Content = base64data.split(',')[1];
        resolve({
          inlineData: {
            data: base64Content,
            mimeType: file.type
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyze = async () => {
    if ((!prompt.trim() && !file) || selectedExperts.length < 3) return;
    
    // Start playing video when analysis begins
    if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.play().catch(e => console.log('Playback not allowed:', e));
    }

    setLoading(true);
    
    try {
      // Corrected API key retrieval
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
if (!apiKey) {
  alert("חסר מפתח API. נא להגדיר VITE_GEMINI_API_KEY.");
  setLoading(false);
  return;
}
const ai = new GoogleGenAI({ apiKey });
      const expertPanel = selectedExperts.join(', ');

      let extraContext = '';
      if (isImprovementMode && previousResult) {
        extraContext = `
          CONTEXT: This is a "Second Take" (Attempt #2).
          The user is trying to improve based on previous feedback.
          
          TASK: Compare this new take to the previous analysis (implied). 
          Did they improve? Point out specific improvements in the expert analysis.
        `;
      }
      
      let pdfContext = '';
      if (pdfFile) {
        pdfContext = `
          ADDITIONAL CONTEXT: The user has attached a PDF document (Script, Audition Instructions, or Guidelines). 
          Use the content of this PDF to check if the video matches the requirements, lines, or tone described in the document.
          This is crucial for the "Script Analysis" or "Director" roles if selected.
        `;
      }

      const systemInstruction = `
        You are "Viraly", a world-class Video Director and Analyst.
        Current Mode: ${activeTrack}.
        Panel: ${expertPanel}.
        
        Task: Analyze the user's input (Idea/Script or Video File) strictly in HEBREW.
        
        CRITICAL: OUTPUT MUST BE 100% HEBREW. DO NOT USE ENGLISH WORDS IN THE DISPLAYED TEXT.
        Translate strictly:
        - Hook -> "עוגן" or "מקדם צפייה"
        - Cut -> "חיתוך"
        - Frame -> "פריים" (Transliteration allowed for standard industry terms)
        - Lighting -> "תאורה"
        - Script -> "תסריט"
        - Shot -> "שוט" or "צילום"
        - Viral -> "ויראלי"
        - Composition -> "קומפוזיציה"
        - Timeline -> "ציר הזמן"
        
        ${extraContext}
        ${pdfContext}

        Return the result as a raw JSON object with this exact structure (Keys must be English, Values MUST be Hebrew):
        {
          "expertAnalysis": [
            {
              "role": "Expert Title (Hebrew)",
              "insight": "Deep professional analysis from this expert's unique POV (Hebrew only)",
              "tips": "Actionable, specific tips for the next take (Hebrew only)",
              "score": number (1-100)
            }
          ],
          "hook": "The 'Golden Tip'. A single, explosive, game-changing sentence. It must be the absolute secret weapon for this specific video. Phrased as a direct, powerful, and unforgettable command that will transform the user's career. (Hebrew only)",
          "committee": {
            "summary": "A comprehensive summary from the entire committee, synthesizing the views (Hebrew only)",
            "finalTips": ["Tip 1 (Hebrew)", "Tip 2 (Hebrew)", "Tip 3 (Hebrew)"]
          }
        }

        Important:
        - "expertAnalysis" array must contain an object for EACH selected expert in the panel.
        - "hook" is NOT a suggestion for a video hook. It is the "Golden Insight" of the analysis.
        - "score" for each expert must be authentic (1-100).
        - Use purely Hebrew professional terms.
        - Do not use Markdown formatting inside the JSON strings.
      `;

      const parts = [];
      
      // Force a text part if prompt is empty to ensure API stability
      if (!prompt.trim()) {
        parts.push({ text: "Please analyze the attached media based on the system instructions." });
      } else {
        parts.push({ text: prompt });
      }
      
      if (file) {
        if (file.size > MAX_FILE_BYTES) {
           alert("הקובץ גדול מדי. מגבלה: עד 5 דקות או 20MB.");
           setLoading(false);
           return;
        }
        try {
          const imagePart = await fileToGenerativePart(file);
          parts.push(imagePart);
        } catch (e) {
          console.error("File processing error", e);
          alert("שגיאה בעיבוד הקובץ");
          setLoading(false);
          return;
        }
      }

      if (pdfFile) {
         try {
           const pdfPart = await fileToGenerativePart(pdfFile);
           parts.push(pdfPart);
         } catch(e) {
            console.error("PDF processing error", e);
         }
      }

      const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
        contents: { parts },
        config: { 
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      // Robust JSON Parsing
      let jsonText = response.text || '{}';
      // Clean potential markdown fencing from the model
      jsonText = jsonText.replace(/```json|```/g, '').trim();
      
      let parsedResult: AnalysisResult;
      try {
        parsedResult = JSON.parse(jsonText) as AnalysisResult;
      } catch (e) {
        console.error("JSON Parse Error", e);
        console.log("Raw Text:", jsonText);
        alert("התקבלה תשובה לא תקינה מהמערכת. אנא נסה שוב.");
        setLoading(false);
        return;
      }
      
      // Calculate average
      if (parsedResult.expertAnalysis && parsedResult.expertAnalysis.length > 0) {
        const total = parsedResult.expertAnalysis.reduce((acc, curr) => acc + curr.score, 0);
        setAverageScore(Math.round(total / parsedResult.expertAnalysis.length));
      }

      setResult(parsedResult);
      
      // Jump to results area immediately
      setTimeout(() => {
        const resultsElement = document.getElementById('results-area');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);

    } catch (error: any) {
      console.error("API Error:", error);
      const code = error?.error?.code || error?.status;
      if (code === 429) {
        alert("חרגת ממכסת הקריאות למודל Gemini בחשבון גוגל. יש להמתין לחידוש המכסה או לשדרג חבילה.");
      } else if (code === 503) {
        alert("המודל של Gemini כרגע עמוס (503). נסה שוב בעוד כמה דקות.");
      } else {
        alert("אירעה שגיאה בניתוח. ייתכן שהאינטרנט איטי, יש עומס על המערכת או בעיית API.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = handleAnalyze;

  // בדוק אם מוכן לניתוח - צריך לפחות 3 מומחים אבל לא יותר מהמגבלה
  const minExperts = 3;
  const maxExperts = planAccess?.maxExperts || 8;
  const hasEnoughExperts = selectedExperts.length >= minExperts && selectedExperts.length <= maxExperts;
  // כשלא מחובר - תמיד מוכן (אבל יפתח חלון חבילות בלחיצה)
  // כשיש משתמש - בדוק הגבלות
  const isReady = !user 
    ? (!!prompt || !!file) && hasEnoughExperts
    : (!!prompt || !!file) && hasEnoughExperts && planAccess?.canRunAnalysis() && planAccess?.hasMinutesLeft();

  const currentExpertsList = EXPERTS_BY_TRACK[activeTrack];
  
  const handleSetTop3 = () => {
    const top3 = currentExpertsList.slice(0, 3).map(e => e.title);
    setSelectedExperts(top3);
  };

  const handleSetAll = () => {
    const all = currentExpertsList.map(e => e.title);
    setSelectedExperts(all);
  };

  const isTop3 = () => {
    const top3 = currentExpertsList.slice(0, 3).map(e => e.title);
    if (selectedExperts.length !== 3) return false;
    return top3.every(t => selectedExperts.includes(t));
  };

  const isAll = () => {
    return selectedExperts.length === currentExpertsList.length;
  };

  if (checkingAuth) {
    return (
      <>
        <GlobalStyle />
        <AppContainer>
          <div style={{ textAlign: 'center', color: '#D4A043', marginTop: '100px' }}>
            טוען...
          </div>
        </AppContainer>
      </>
    );
  }

  return (
    <>
      <GlobalStyle />
      <AppContainer>
        <Header>
          <AppLogo />
          <Title>Video Director Pro</Title>
          <Subtitle>בינת וידאו לשחקנים, זמרים ויוצרי תוכן</Subtitle>
          <Description>
            סוכן על שמשלב ריאליטי, קולנוע, מוזיקה ומשפיענים.<br/>
            קבל ניתוח עומק, הערות מקצועיות וליווי עד לפריצה הגדולה.
          </Description>
          {user && (
            <div style={{ 
              textAlign: 'center', 
              margin: '15px 0',
              padding: '10px 0'
            }}>
              <p style={{ color: '#D4A043', margin: '0 0 10px 0', fontSize: '0.95rem' }}>
                מחובר כ: <strong style={{ color: '#e0e0e0' }}>{user.email}</strong>
              </p>
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <LogoutButton 
                  onClick={handleLogout}
                  style={{ 
                    padding: '8px 16px',
                    fontSize: '0.85rem'
                  }}
                >
                  🚪 התנתק
                </LogoutButton>
                <LogoutButton 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Settings button clicked, isAdmin:', isAdmin, 'isTestUser:', isTestUser);
                    if (isAdmin) {
                      console.log('Opening admin panel...');
                      setShowAdminPanel(true);
                    } else if (isTestUser) {
                      setShowTestInterface(true);
                    } else {
                      setIsSettingsModalOpen(true);
                    }
                  }}
                  style={{ 
                    padding: '8px 16px',
                    fontSize: '0.85rem'
                  }}
                >
                  ⚙️ {isAdmin ? 'פאנל ניהול' : isTestUser ? '🧪 ממשק בדיקות' : 'הגדרות'}
                </LogoutButton>
              </div>
            </div>
          )}
          <div style={{ 
            width: '200px', 
            height: '1px', 
            background: '#333', 
            margin: user ? '10px auto 30px auto' : '10px auto 40px auto'
          }}></div>
          {!user && (
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <CTAButton onClick={() => setIsAuthModalOpen(true)}>
                🔐 התחבר / הרשם
              </CTAButton>
            </div>
          )}
          <CTAButton onClick={() => {
            // אם המשתמש לא מחובר או אין לו חבילה מתאימה, העבר לבחירת חבילה
            if (!user || !planAccess || !planAccess.canRunAnalysis()) {
              setIsPlansModalOpen(true);
            } else {
              document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' });
            }
          }}>
            העלה סרטון וקבל ניתוח מלא
          </CTAButton>
          
          <CapabilitiesButton onClick={() => setIsModalOpen(true)}>
             יכולות האפליקציה של סוכן העל <SparklesIcon />
          </CapabilitiesButton>
          <CapabilitiesButton onClick={() => setIsPlansModalOpen(true)} style={{ marginTop: '10px' }}>
             📦 חבילות והצעות
          </CapabilitiesButton>
        </Header>
        
        <CapabilitiesModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          activeTab={modalTab}
          setActiveTab={setModalTab}
        />
        
        <PlansInfoModal
          isOpen={isPlansModalOpen}
          onClose={() => setIsPlansModalOpen(false)}
          currentPlan={subscription?.plan_type}
          onUpgrade={handleUpgradePlan}
          onSignUpWithPlan={(planType) => {
            setIsPlansModalOpen(false);
            setAuthModalInitialPlan(planType);
            setAuthModalInitialMode('signup');
            setIsAuthModalOpen(true);
          }}
        />
        
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            setIsAuthModalOpen(false);
            setAuthModalInitialPlan(undefined);
            setAuthModalInitialMode('login');
          }}
          onSuccess={() => {
            setCheckingAuth(true);
            setTimeout(() => {
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user) {
                  setUser(session.user);
                }
                setCheckingAuth(false);
              });
            }, 500);
            setAuthModalInitialPlan(undefined);
            setAuthModalInitialMode('login');
          }}
          initialPlan={authModalInitialPlan}
          initialMode={authModalInitialMode}
        />
        
        {user && !isAdmin && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            userEmail={user.email}
          />
        )}
        
        {/* חלון בחירת תחום למשתמש חדש */}
        {showTrackSelectionModal && user && planAccess && planAccess.maxTracks > 1 && (
          <ModalOverlay onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTrackSelectionModal(false);
            }
          }}>
            <ModalContent onClick={e => e.stopPropagation()}>
              <ModalCloseBtn 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowTrackSelectionModal(false);
                }}
              >✕</ModalCloseBtn>
              <ModalHeader>
                <ModalTitle>🎯 בחר תחום ניתוח</ModalTitle>
                <ModalSubtitle>
                  זה הכניסה הראשונה שלך! בחר את התחום שבו תרצה להתמחות.
                  <br/>
                  הבחירה תישמר כברירת מחדל לכל כניסה עתידית.
                </ModalSubtitle>
              </ModalHeader>
              <div style={{ padding: '30px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                {TRACKS.map((track) => (
                  <TrackCard
                    key={track.id}
                    $active={activeTrack === track.id}
                    onClick={async () => {
                      if (isSavingTrack) return; // מניעת לחיצות מרובות
                      setIsSavingTrack(true);
                      try {
                        await handleTrackChange(track.id);
                        // המתן קצת כדי שהעדכון יסתיים
                        await new Promise(resolve => setTimeout(resolve, 500));
                        // רענון ה-subscription כדי לוודא שהעדכון נשמר
                        if (subscription) {
                          const { data: updatedSubscription } = await supabase
                            .from('user_subscriptions')
                            .select('*')
                            .eq('user_id', user.id)
                            .single();
                          if (updatedSubscription?.default_track === track.id) {
                            console.log('[TrackSelection] Track saved successfully:', track.id);
                            setShowTrackSelectionModal(false);
                          } else {
                            console.warn('[TrackSelection] Track may not have been saved, retrying...');
                            // נסה שוב
                            await supabase.rpc('update_user_default_track', {
                              p_user_id: user.id,
                              p_default_track: track.id
                            });
                            setShowTrackSelectionModal(false);
                          }
                        } else {
                          setShowTrackSelectionModal(false);
                        }
                      } catch (err) {
                        console.error('[TrackSelection] Error saving track:', err);
                        alert('שגיאה בשמירת התחום. נסה שוב.');
                      } finally {
                        setIsSavingTrack(false);
                      }
                    }}
                    style={{
                      cursor: isSavingTrack ? 'wait' : 'pointer',
                      padding: '20px',
                      textAlign: 'center',
                      opacity: isSavingTrack ? 0.7 : 1
                    }}
                  >
                    {track.icon}
                    <span style={{ display: 'block', marginTop: '10px' }}>{track.label}</span>
                    {isSavingTrack && activeTrack === track.id && (
                      <div style={{ marginTop: '10px', color: '#D4A043', fontSize: '0.9rem' }}>
                        שומר...
                      </div>
                    )}
                  </TrackCard>
                ))}
              </div>
            </ModalContent>
          </ModalOverlay>
        )}
        
        <SectionLabel>בחר את מסלול הניתוח שלך:</SectionLabel>
        <Grid>
          {TRACKS.map((track, index) => {
            // כשלא מחובר - הכל פתוח
            if (!user) {
              const isActive = activeTrack === track.id;
              return (
                <TrackCard 
                  key={track.id} 
                  $active={isActive}
                  onClick={() => handleTrackChange(track.id)}
                  style={{
                    opacity: 1,
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {track.icon}
                  <span>{track.label}</span>
                </TrackCard>
              );
            }
            
            // כשיש משתמש מחובר - בדוק הגבלות
            const maxTracks = planAccess?.maxTracks || 4;
            
            // בחבילת נסיון ויוצרים (maxTracks = 1) - אפשר לבחור תחום אחד
            // אם יש default_track, רק התחום הזה פתוח
            let isDisabled = false;
            if (planAccess) {
              if (maxTracks <= 1) {
                // אם יש default_track, רק התחום הזה פתוח
                if (subscription?.default_track) {
                  isDisabled = track.id !== subscription.default_track;
                } else {
                  // אם אין default_track, כל התחומים פתוחים לבחירה (אבל רק אחד)
                  isDisabled = false;
                }
              } else {
                // בחבילת יוצרים באקסטרים (maxTracks > 1) - כל התחומים פתוחים
                isDisabled = false;
              }
            } else {
              // אם אין planAccess, כל התחומים פתוחים (למקרה של משתמש חדש)
              isDisabled = false;
            }
            
            const isActive = activeTrack === track.id;
            
            return (
              <TrackCard 
                key={track.id} 
                $active={isActive}
                onClick={() => !isDisabled && handleTrackChange(track.id)}
                style={{
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  position: 'relative'
                }}
              >
                {isDisabled && !isActive && (
                  <div style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    background: '#ff4d4d',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>
                    🔒
                  </div>
                )}
                {track.icon}
                <span>{track.label}</span>
              </TrackCard>
            );
          })}
        </Grid>
        
        <TrackDescriptionText>
           {TRACK_DESCRIPTIONS[activeTrack]}
        </TrackDescriptionText>

        <SectionLabel>מי הם צוות המומחים שלך?</SectionLabel>
        
        <ExpertControlBar>
           <ExpertControlText>
             הנבחרת שלך ב<strong>{TRACKS.find(t => t.id === activeTrack)?.label}</strong>: אלו המומחים ומה הם בודקים
             {user && planAccess && (
               <span style={{ color: '#D4A043', marginRight: '10px' }}>
                 ({selectedExperts.length} / {planAccess.maxExperts} מומחים)
               </span>
             )}
             {!user && (
               <span style={{ color: '#D4A043', marginRight: '10px' }}>
                 ({selectedExperts.length} / 8 מומחים)
               </span>
             )}
           </ExpertControlText>
           <ExpertToggleGroup>
              <ExpertToggleButton 
                $active={isTop3()} 
                onClick={handleSetTop3}
                disabled={user && (!planAccess || (planAccess?.maxExperts || 0) <= 3)}
              >
                3 המובילים
              </ExpertToggleButton>
              <ExpertToggleButton 
                $active={isAll()} 
                onClick={handleSetAll}
                disabled={user && (!planAccess || (planAccess?.maxExperts || 0) <= 3)}
              >
                כל המומחים
              </ExpertToggleButton>
           </ExpertToggleGroup>
        </ExpertControlBar>

        <Grid>
          {EXPERTS_BY_TRACK[activeTrack].map((expert, i) => {
            const isSelected = selectedExperts.includes(expert.title);
            
            // כשלא מחובר - הכל פתוח
            if (!user) {
              return (
                <FeatureCard 
                  key={i} 
                  $selected={isSelected}
                  onClick={() => toggleExpert(expert.title)}
                  style={{
                    opacity: 1,
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <FeatureTitle $selected={isSelected}>{expert.title}</FeatureTitle>
                  <FeatureDesc>{expert.desc}</FeatureDesc>
                </FeatureCard>
              );
            }
            
            // כשיש משתמש מחובר - בדוק הגבלות
            const maxExperts = planAccess?.maxExperts || 8;
            const canSelect = !isSelected && selectedExperts.length < maxExperts;
            const isDisabled = !planAccess || (!isSelected && !canSelect);
            
            return (
              <FeatureCard 
                key={i} 
                $selected={isSelected}
                onClick={() => !isDisabled && toggleExpert(expert.title)}
                style={{
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  position: 'relative'
                }}
              >
                {isDisabled && !isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    background: '#ff4d4d',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>
                    🔒
                  </div>
                )}
                <FeatureTitle $selected={isSelected}>{expert.title}</FeatureTitle>
                <FeatureDesc>{expert.desc}</FeatureDesc>
              </FeatureCard>
            );
          })}
        </Grid>

        <UploadContainer id="upload-section" $hasFile={!!previewUrl}>
          {previewUrl ? (
            <FullSizePreview>
              <RemoveFileBtn onClick={handleRemoveFile}>✕</RemoveFileBtn>
              {file?.type.startsWith('video') ? (
                <video
                  ref={videoRef}
                  src={previewUrl}
                  controls
                  muted
                  playsInline
                  webkit-playsinline="true"
                  x5-playsinline="true"
                />
              ) : (
                <img src={previewUrl} alt="preview" />
              )}
            </FullSizePreview>
          ) : (
            <UploadContent>
              <UploadIcon><CinematicCameraIcon /></UploadIcon>
              <UploadTitle>
                {isImprovementMode ? 'העלה טייק משופר (ניסיון 2)' : `העלה סרטון ${TRACKS.find(t => t.id === activeTrack)?.label}`}
              </UploadTitle>
              <UploadSubtitle>
                {user && planAccess 
                  ? `עד ${planAccess.maxVideoMinutes} דקות או ${planAccess.maxVideoMB}MB`
                  : 'עד 5 דקות או 20MB'}
              </UploadSubtitle>
              
              <UploadButton>
                {isImprovementMode ? 'בחר קובץ לשיפור' : 'העלה סרטון עכשיו'}
                <FileInput 
                  type="file" 
                  accept="video/*,image/*" 
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                />
              </UploadButton>
            </UploadContent>
          )}
        </UploadContainer>

        <PdfUploadWrapper>
          {pdfFile ? (
            <PdfFileInfo>
              <PdfIcon />
              <span>{pdfFile.name}</span>
              <RemovePdfBtnSmall onClick={handleRemovePdf} title="הסר קובץ">
                <CloseIcon />
              </RemovePdfBtnSmall>
            </PdfFileInfo>
          ) : (
            <PdfUploadLabel>
              <PdfIcon />
              צרף תסריט / הנחיות (PDF)
              <input 
                type="file" 
                accept="application/pdf" 
                onChange={handlePdfSelect} 
                style={{ display: 'none' }} 
                ref={pdfInputRef}
              />
            </PdfUploadLabel>
          )}
        </PdfUploadWrapper>

        <InputWrapper>
          <MainInput 
            placeholder={isImprovementMode ? "מה שינית בטייק הזה? (אופציונלי)" : "כתוב כאן תיאור קצר: מה מטרת הסרטון? מה המסר? (אופציונלי)"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <ActionButton 
            onClick={() => {
              // אם לא מחובר - הסבר ופתח חלון חבילות
              if (!user) {
                alert('כדי להריץ ניתוח, נא להתחבר או להירשם ולבחור חבילה מתאימה.');
                setIsPlansModalOpen(true);
                return;
              }
              // אם יש משתמש אבל אין הרשאה - פתח חלון חבילות
              if (!planAccess || !planAccess.canRunAnalysis() || !planAccess.hasMinutesLeft()) {
                setIsPlansModalOpen(true);
                return;
              }
              // אחרת - הרץ ניתוח
              handleGenerate();
            }}
            disabled={loading || !isReady}
            $isReady={isReady}
            $isLoading={loading}
          >
            {loading ? 'צוות המומחים צופה כעת בסרטון' : (isImprovementMode ? 'נתח שיפורים' : 'אקשן !')}
          </ActionButton>
          {user && planAccess && !planAccess.canRunAnalysis() && (
            <ErrorMsg>הגעת למכסת הניתוחים החודשית. שדרג את החבילה להמשך.</ErrorMsg>
          )}
          {user && planAccess && !planAccess.hasMinutesLeft() && (
            <ErrorMsg>הגעת למכסת הדקות החודשית. שדרג את החבילה להמשך.</ErrorMsg>
          )}
          {selectedExperts.length < 3 && (
            <ErrorMsg>נא לבחור לפחות 3 מומחים כדי להמשיך</ErrorMsg>
          )}
        </InputWrapper>

        {result && (
          <ResponseArea id="results-area">
            <div id="analysis-content">
              {result.hook && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <SectionTitleExternal>
                    <SubtleSparkleIcon /> טיפ זהב של הפאנל <SubtleSparkleIcon />
                  </SectionTitleExternal>
                  <CompactResultBox>
                    <HookText>"{result.hook}"</HookText>
                  </CompactResultBox>
                </div>
              )}

              <SectionLabel style={{ textAlign: 'center', display: 'block', marginTop: '20px' }}>ניתוח פאנל המומחים</SectionLabel>
              
              <ExpertsGrid>
                {result.expertAnalysis?.map((expert, idx) => (
                  <ExpertResultCard key={idx}>
                    <h4>{expert.role} <ExpertScore>{expert.score}</ExpertScore></h4>
                    
                    <ExpertSectionTitle><EyeIcon /> זווית מקצועית</ExpertSectionTitle>
                    <ExpertText>{expert.insight}</ExpertText>
                    
                    <ExpertSectionTitle><BulbIcon /> טיפים לשיפור</ExpertSectionTitle>
                    <ExpertText style={{ color: '#fff', fontWeight: 500 }}>{expert.tips}</ExpertText>
                  </ExpertResultCard>
                )) || <p style={{textAlign: 'center', color: '#666'}}>טוען ניתוח...</p>}
              </ExpertsGrid>

              {result.committee && (
                <CommitteeSection>
                  <SectionTitleExternal>
                     <SubtleDocumentIcon /> סיכום ועדת המומחים
                  </SectionTitleExternal>
                  <CompactResultBox>
                    <CommitteeText>{result.committee.summary}</CommitteeText>
                  </CompactResultBox>
                  
                  {result.committee.finalTips && result.committee.finalTips.length > 0 && (
                    <CommitteeTips>
                      <h5>טיפים מנצחים לעתיד:</h5>
                      <ul>
                        {result.committee.finalTips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </CommitteeTips>
                  )}
                  
                  <FinalScore>
                    <span className="number">{averageScore}</span>
                    <span className="label">ציון ויראליות משוקלל</span>
                  </FinalScore>
                </CommitteeSection>
              )}
            </div>

            <ActionButtonsContainer>
              <PrimaryButton onClick={handleExportPdf} disabled={loading || !planAccess?.hasFeature('pdf_export')}>
                <PdfIcon />
                יצוא ניתוח ל-PDF <PremiumBadge>פרימיום</PremiumBadge>
              </PrimaryButton>
              <SecondaryButton onClick={handleReset}>
                <RefreshIcon />
                התחל מחדש
              </SecondaryButton>
              <PrimaryButton onClick={handleUploadImprovedTake}>
                <UploadIconSmall />
                העלה טייק משופר
              </PrimaryButton>
            </ActionButtonsContainer>

          </ResponseArea>
        )}
      </AppContainer>
      
      {showAdminPanel && (
        <AdminPanel onBack={() => {
          console.log('Closing admin panel...');
          setShowAdminPanel(false);
        }} />
      )}
      
      {/* ממשק בדיקות למשתמש viralytest@test.com */}
      {showTestInterface && isTestUser && (
        <TestUserInterface
          onClose={() => setShowTestInterface(false)}
          currentTrack={activeTrack}
          onTrackChange={(track) => handleTrackChange(track)}
          selectedExperts={selectedExperts}
          onExpertToggle={(expert) => {
            if (selectedExperts.includes(expert)) {
              setSelectedExperts(selectedExperts.filter(e => e !== expert));
            } else {
              setSelectedExperts([...selectedExperts, expert]);
            }
          }}
        />
      )}
    </>
  );
};

// טיפול בשגיאות בטעינת האפליקציה
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  const root = createRoot(rootElement);
  root.render(
    <SubscriptionProvider>
      <App />
    </SubscriptionProvider>
  );
} catch (error) {
  console.error('Error starting application:', error);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
        text-align: center;
        font-family: 'Assistant', sans-serif;
        color: #e0e0e0;
        background-color: #050505;
      ">
        <h1 style="color: #D4A043; margin-bottom: 20px;">שגיאה בטעינת האפליקציה</h1>
        <p style="margin-bottom: 10px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
        <p style="color: #888; font-size: 14px; margin-top: 20px;">
          אנא בדוק את הקונסול לפרטים נוספים
        </p>
      </div>
    `;
  }
}
