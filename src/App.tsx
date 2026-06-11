/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Bar } from 'react-chartjs-2';
import {
  BarChart as RechartsBarChart, Bar as RechartsBar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ResponsiveContainer,
  Funnel, FunnelChart, LabelList, Cell as RechartsCell, ReferenceLine as RechartsRefLine
} from 'recharts';
import { Database, Filter, Briefcase, Activity, Calendar, FileDown, Download, Users, Lock, LogOut, CheckCircle, BarChart2, Sparkles, FileText, AlertTriangle, Info, X, Check, Settings2, Code, Sun, Moon, Link, Cpu, Copy, RefreshCw, Search, ArrowUp, ArrowDown, ArrowUpDown, QrCode, Share2, Plus, Trash, Send, MessageCircle, Mail, History } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, annotationPlugin);

// Data structures
interface FunnelData {
  sort: number;
  stage: string;
  count: number;
}

interface DelaysData {
  sort: number;
  stage: string;
  avg_days: number;
}

const COLORS = ['#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [dateRange, setDateRange] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [slaThreshold, setSlaThreshold] = useState<number>(3.0);
  const [chartType, setChartType] = useState<'recharts' | 'chartjs'>('recharts');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [integrationModalOpen, setIntegrationModalOpen] = useState(false);
  const [dbSettingsModalOpen, setDbSettingsModalOpen] = useState(false);
  
  // Connection Profiles system
  interface DbProfile {
    id: string;
    host: string;
    port: string;
    user: string;
    database: string;
    timestamp: number;
    name?: string;
  }

  const [dbProfiles, setDbProfiles] = useState<DbProfile[]>(() => {
    try {
      const saved = localStorage.getItem('vkr_db_profiles');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveSuccessfulProfile = (host: string, port: string, user: string, database: string) => {
    const newProfile: DbProfile = {
      id: `${host}_${database}_${Date.now()}`,
      host,
      port,
      user,
      database,
      timestamp: Date.now()
    };
    
    setDbProfiles(prev => {
      const filtered = prev.filter(p => !(p.host.toLowerCase() === host.toLowerCase() && p.database.toLowerCase() === database.toLowerCase()));
      const updated = [newProfile, ...filtered].slice(0, 3);
      localStorage.setItem('vkr_db_profiles', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteProfile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDbProfiles(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem('vkr_db_profiles', JSON.stringify(updated));
      return updated;
    });
  };

  const [dbHost, setDbHost] = useState(() => localStorage.getItem('vkr_db_draft_host') || 'localhost');
  const [dbPort, setDbPort] = useState(() => localStorage.getItem('vkr_db_draft_port') || '3306');
  const [dbUser, setDbUser] = useState(() => localStorage.getItem('vkr_db_draft_user') || 'root');
  const [dbPassword, setDbPassword] = useState('');
  const [dbNameInput, setDbNameInput] = useState(() => localStorage.getItem('vkr_db_draft_name') || 'hr_funnel_db');

  useEffect(() => {
    localStorage.setItem('vkr_db_draft_host', dbHost);
    localStorage.setItem('vkr_db_draft_port', dbPort);
    localStorage.setItem('vkr_db_draft_user', dbUser);
    localStorage.setItem('vkr_db_draft_name', dbNameInput);
  }, [dbHost, dbPort, dbUser, dbNameInput]);

  const [dbConfigError, setDbConfigError] = useState<string | null>(null);
  const [dbConfigSuccess, setDbConfigSuccess] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [copiedTunnelCmd, setCopiedTunnelCmd] = useState<'ngrok' | 'lt' | null>(null);
  const [integrationTab, setIntegrationTab] = useState<'iframe' | 'api' | 'webhooks'>('iframe');
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTab, setShareTab] = useState<'current' | 'preview' | 'dev'>('current');
  const [copiedLink, setCopiedLink] = useState<'current' | 'preview' | 'dev' | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    let url = '';
    if (shareTab === 'current') {
      url = typeof window !== 'undefined' ? window.location.origin : '';
    } else if (shareTab === 'preview') {
      url = 'https://hr-analyzer.production.ru';
    } else {
      url = 'https://hr-analyzer.dev.ru';
    }
    
    if (!url) return;

    QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#2e1065',
        light: '#ffffff'
      }
    })
    .then(dataUrl => setQrCodeDataUrl(dataUrl))
    .catch(err => console.error('Error rendering QR:', err));
  }, [shareTab]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDbSettingsModalOpen(false);
        setIntegrationModalOpen(false);
        setShareModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleCopyLink = (url: string, type: 'current' | 'preview' | 'dev') => {
    navigator.clipboard.writeText(url);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const getShareUrl = () => {
    if (shareTab === 'current') return typeof window !== 'undefined' ? window.location.origin : '';
    if (shareTab === 'preview') return 'https://hr-analyzer.production.ru';
    return 'https://hr-analyzer.dev.ru';
  };

  const handleDownloadQR = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `hr-analyzer-qr-${shareTab}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareToApp = (app: 'telegram' | 'whatsapp' | 'email') => {
    const url = getShareUrl();
    const text = 'Оцените новый макет HR-Аналитики';
    if (app === 'telegram') window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    if (app === 'whatsapp') window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ': ' + url)}`, '_blank');
    if (app === 'email') window.open(`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent('Ссылка: ' + url)}`, '_self');
  };

  const [candidatesList, setCandidatesList] = useState<any[]>([]);
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(false);
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState('');
  const [newCandidatePhone, setNewCandidatePhone] = useState('');
  const [newCandidateSource, setNewCandidateSource] = useState('HeadHunter');

  const [showAddVacancyModal, setShowAddVacancyModal] = useState(false);
  const [newVacancyTitle, setNewVacancyTitle] = useState('');

  const clientStages = [
    { name: 'Новый отклик', action: 'Назначить скрининг', actionType: 'move', color: 'bg-slate-500/10 text-slate-300 border border-slate-500/20' },
    { name: 'Скрининг резюме', action: 'Провести HR-интервью', actionType: 'move', color: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30' },
    { name: 'HR-интервью', action: 'Отправить ТЗ', actionType: 'move', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
    { name: 'Тестовое задание', action: 'Перевести на Тех-собес', actionType: 'move', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
    { name: 'Техническое интервью', action: 'Направить в СБ', actionType: 'move', color: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' },
    { name: 'Проверка СБ', action: 'Выставить оффер', actionType: 'move', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
    { name: 'Оффер', action: 'Завершить наем', actionType: 'accept', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' }
  ];

  const fetchCandidatesList = async () => {
    setIsCandidatesLoading(true);
    try {
      const res = await fetch(`/api/analytics/candidates?id_vacancy=${selectedVacancy}&search=${searchTerm}`);
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((cand: any) => {
          const stObj = clientStages[(cand.stageId - 1) % clientStages.length] || clientStages[0];
          return {
            ...cand,
            stageColor: stObj.color,
            action: stObj.action,
            actionType: stObj.actionType
          };
        });
        setCandidatesList(mapped);
      }
    } catch (err) {
      console.error("Error loading candidates:", err);
    } finally {
      setIsCandidatesLoading(false);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidateName.trim()) return;
    try {
      const res = await fetch('/api/analytics/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newCandidateName,
          phone_number: newCandidatePhone,
          source: newCandidateSource,
          id_vacancy: selectedVacancy,
          id_stage: 1
        })
      });
      if (res.ok) {
        setNewCandidateName('');
        setNewCandidatePhone('');
        setShowAddCandidateModal(false);
        await fetchCandidatesList();
        await fetchAnalytics(true);
      }
    } catch (err) {
      console.error("Error adding candidate:", err);
    }
  };

  const handleMoveCandidate = async (id: number, currentStageId: number) => {
    const nextStageId = currentStageId + 1;
    if (nextStageId > 7) return; 
    try {
      const res = await fetch('/api/analytics/candidates/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_candidate: id,
          id_vacancy: selectedVacancy,
          id_stage: nextStageId
        })
      });
      if (res.ok) {
        await fetchCandidatesList();
        await fetchAnalytics(true);
      }
    } catch (err) {
      console.error("Error moving candidate:", err);
    }
  };

  const handleDeleteCandidate = async (id: number) => {
    try {
      const res = await fetch('/api/analytics/candidates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_candidate: id })
      });
      if (res.ok) {
        await fetchCandidatesList();
        await fetchAnalytics(true);
      }
    } catch (err) {
      console.error("Error deleting candidate:", err);
    }
  };

  const handleAddVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVacancyTitle.trim()) return;
    try {
      const res = await fetch('/api/analytics/vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_title: newVacancyTitle })
      });
      if (res.ok) {
        const data = await res.json();
        setNewVacancyTitle('');
        setShowAddVacancyModal(false);
        await fetchVacancies();
        setSelectedVacancy(Number(data.id_vacancy));
      }
    } catch (err) {
      console.error("Error adding vacancy:", err);
    }
  };

  const [sortField, setSortField] = useState<'name' | 'vacancy' | 'stage' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);

  const filteredCandidates = useMemo(() => {
    let result = [...candidatesList];
    if (selectedStageFilter) {
      result = result.filter(r => r.stage === selectedStageFilter);
    }
    if (sortField) {
      result.sort((a, b) => {
        const valA = a[sortField] ? String(a[sortField]).toLowerCase() : '';
        const valB = b[sortField] ? String(b[sortField]).toLowerCase() : '';
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [candidatesList, sortField, sortDirection, selectedStageFilter]);

  const handleSort = (field: 'name' | 'vacancy' | 'stage') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCandidateIds(paginatedCandidates.map(c => c.id));
    } else {
      setSelectedCandidateIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedCandidateIds(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleBulkAdvance = async () => {
    if (!window.confirm(`Вы уверены, что хотите перевести ${selectedCandidateIds.length} кандидатов на следующий этап?`)) return;
    
    // Process sequentially (since it's an internal prototype DB mostly)
    for (const id of selectedCandidateIds) {
      try {
        await fetch(`/api/analytics/candidates/${id}/advance`, { method: 'POST' });
        
        // Optional webhook
        if (integrationTab === 'webhooks') {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'candidate_advanced_bulk', candidate_id: id })
          }).catch(err => console.error(err));
        }
      } catch (err) {
        console.error(err);
      }
    }
    setSelectedCandidateIds([]);
    await fetchCandidatesList();
    fetchDbStatus();
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Вы уверены, что хотите безвозвратно удалить ${selectedCandidateIds.length} кандидатов?`)) return;
    
    for (const id of selectedCandidateIds) {
      try {
        await fetch(`/api/analytics/candidates/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error(err);
      }
    }
    setSelectedCandidateIds([]);
    await fetchCandidatesList();
    fetchDbStatus();
  };

  const candidatesItemsPerPage = 20;
  const paginatedCandidates = filteredCandidates.slice(0, candidatesPage * candidatesItemsPerPage);

  const generateApiToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const prefix = 'hr_api_';
    let token = prefix;
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setApiToken(token);
  };
  
  const [exportModalState, setExportModalState] = useState<{isOpen: boolean, format: 'csv'|'pdf'|'json'|'word'}>({isOpen: false, format: 'csv'});
  const [exportConfig, setExportConfig] = useState({
    includeFunnel: true,
    includeDelays: true,
    includeInsights: true,
    rawCandidates: false
  });

  // Webhooks states
  const [webhookUrl, setWebhookUrl] = useState('https://agency-portal.ru/webhooks/hr');
  const [webhookEvents, setWebhookEvents] = useState({
    candidateCreated: true,
    stageChanged: true,
    offerAccepted: true,
    candidateRejected: false,
  });
  const [testWebhookStatus, setTestWebhookStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testWebhookResult, setTestWebhookResult] = useState<string>('');

  // Dynamic Vacancy dropdown states
  const [selectedVacancy, setSelectedVacancy] = useState<number>(1);
  const [vacanciesList, setVacanciesList] = useState<{ id: number; title: string }[]>([
    { id: 1, title: 'Senior React Developer' },
    { id: 2, title: 'QA Automation Engineer' },
    { id: 3, title: 'HR Manager' }
  ]);

  // Database status states
  const [dbStatus, setDbStatus] = useState<{ 
    connected: boolean; 
    dbName: string;
    config?: { host: string; port: number; user: string; database: string }
  }>({
    connected: false,
    dbName: 'СУБД: Определение...'
  });
  const [isImporting, setIsImporting] = useState(false);
  const [dbNotification, setDbNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [delaysData, setDelaysData] = useState<DelaysData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/analytics/status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus({
          connected: data.connected,
          dbName: data.connected ? `СУБД: ${data.config?.database || 'hr_funnel_db'} (Активна)` : 'СУБД: Имитация (БД Offline)',
          config: data.config
        });
        if (data.config) {
          setDbHost(data.config.host || 'localhost');
          setDbPort(String(data.config.port || '3306'));
          setDbUser(data.config.user || 'root');
          setDbNameInput(data.config.database || 'hr_funnel_db');
        }
      } else {
        setDbStatus({
          connected: false,
          dbName: 'СУБД: Имитация (БД Offline)'
        });
      }
    } catch {
      setDbStatus({
        connected: false,
        dbName: 'СУБД: Имитация (БД Offline)'
      });
    }
  };

  const fetchVacancies = async () => {
    try {
      const res = await fetch('/api/analytics/vacancies');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setVacanciesList(data.map((item: any) => ({
            id: Number(item.id),
            title: item.title || item.job_title
          })));
        }
      }
    } catch (err) {
      console.error("Error fetching vacancies:", err);
    }
  };

  const handleImportDatabase = async () => {
    setIsImporting(true);
    setDbNotification(null);
    try {
      const res = await fetch('/api/analytics/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDbStatus();
        await fetchVacancies();
        await fetchAnalytics();
        await fetchCandidatesList();
        setDbNotification({
          type: 'success',
          message: 'БД успешно обновлена! Таблицы и тестовые записи импортированы в MySQL.'
        });
      } else {
        setDbNotification({
          type: 'error',
          message: `Ошибка импорта: ${data.error || 'БД находится в офлайн-режиме.'}`
        });
      }
    } catch (err: any) {
      setDbNotification({
        type: 'error',
        message: `Ошибка связи: ${err.message || 'нет ответа от бэкенда.'}`
      });
    } finally {
      setIsImporting(false);
      setTimeout(() => {
        setDbNotification(null);
      }, 5000);
    }
  };

  const handleCopyCommand = (command: string, type: 'ngrok' | 'lt') => {
    navigator.clipboard.writeText(command);
    setCopiedTunnelCmd(type);
    setTimeout(() => setCopiedTunnelCmd(null), 2000);
  };

  const handleHostInputChange = (val: string) => {
    let cleaned = val.trim();
    
    if (cleaned.includes('://')) {
      try {
        const urlToParse = cleaned.startsWith('tcp://') ? cleaned.replace('tcp://', 'http://') : cleaned;
        const parsed = new URL(urlToParse);
        
        if (parsed.hostname) {
          setDbHost(parsed.hostname);
        }
        if (parsed.port) {
          setDbPort(parsed.port);
        }
        if (parsed.username) {
          setDbUser(parsed.username);
        }
        if (parsed.password) {
          setDbPassword(parsed.password);
        }
        if (parsed.pathname && parsed.pathname !== '/') {
          setDbNameInput(parsed.pathname.replace(/^\//, ''));
        }
        return;
      } catch (e) {
        // Fallback
      }
    }

    const hostPortRegex = /^([^/:]+):(\d+)$/;
    const match = cleaned.match(hostPortRegex);
    if (match) {
      setDbHost(match[1]);
      setDbPort(match[2]);
      return;
    }

    setDbHost(val);
  };

  const handleApplyProfile = async (profile: DbProfile) => {
    setDbHost(profile.host);
    setDbPort(profile.port);
    setDbUser(profile.user);
    setDbNameInput(profile.database);
    setIsTestingConnection(true);
    setDbConfigError(null);
    setDbConfigSuccess(null);
    try {
      const res = await fetch('/api/analytics/config-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: profile.host,
          port: Number(profile.port),
          user: profile.user,
          password: '', // по умолчанию без пароля для локальных/тестовых баз
          database: profile.database
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbConfigSuccess(`Подключено к ${profile.database} на ${profile.host}!`);
        saveSuccessfulProfile(profile.host, profile.port, profile.user, profile.database);
        await fetchDbStatus();
        await fetchVacancies();
        await fetchAnalytics();
        await fetchCandidatesList();
        setTimeout(() => {
          setDbSettingsModalOpen(false);
          setDbConfigSuccess(null);
        }, 1200);
      } else {
        setDbConfigError(`Профиль загружен. Введите пароль подключения вручную: ${data.error}`);
      }
    } catch (err: any) {
      setDbConfigError(`Профиль загружен. Ошибка автоподключений: ${err.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleResetToOffline = async () => {
    setIsTestingConnection(true);
    setDbConfigError(null);
    setDbConfigSuccess(null);
    try {
      const res = await fetch('/api/analytics/config-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: 'offline' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbConfigSuccess('Встроенная имитация успешно активирована!');
        await fetchDbStatus();
        await fetchVacancies();
        await fetchAnalytics();
        await fetchCandidatesList();
        setTimeout(() => {
          setDbSettingsModalOpen(false);
          setDbConfigSuccess(null);
        }, 1200);
      } else {
        setDbConfigError(data.error || 'Не удалось переключить режим на оффлайн.');
      }
    } catch (err: any) {
      setDbConfigError(`Ошибка связи при переключении: ${err.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveDbSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTestingConnection(true);
    setDbConfigError(null);
    setDbConfigSuccess(null);

    const h = dbHost.trim().toLowerCase();
    const isLocal = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(h) || h.endsWith('.local');
    if (isLocal) {
      setDbConfigError('Подключение отклонено: облако заблокировано встроенным диагностом. Сервер не сможет связаться с локальным адресом. Используйте адрес публичного туннеля (например, tcp://0.tcp.ngrok.io или аналогичный).');
      setIsTestingConnection(false);
      return;
    }

    try {
      const res = await fetch('/api/analytics/config-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: dbHost,
          port: Number(dbPort),
          user: dbUser,
          password: dbPassword,
          database: dbNameInput
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbConfigSuccess(data.message || 'Подключение успешно установлено!');
        saveSuccessfulProfile(dbHost, dbPort, dbUser, dbNameInput);
        await fetchDbStatus();
        await fetchVacancies();
        await fetchAnalytics();
        await fetchCandidatesList();
        setTimeout(() => {
          setDbSettingsModalOpen(false);
          setDbConfigSuccess(null);
        }, 1500);
      } else {
        setDbConfigError(data.error || 'Произошла ошибка при подключении к СУБД.');
      }
    } catch (err: any) {
      setDbConfigError(`Сетевая ошибка при проверке: ${err.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const fetchAnalytics = async (silent = false) => {
    if (!silent) setLoading(true);
    let queryParams = `?id_vacancy=${selectedVacancy}`;
    
    if (dateRange === '30days') {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      queryParams += `&date_start=${start.toISOString().split('T')[0]}`;
    } else if (dateRange === 'custom' && customStart) {
      queryParams += `&date_start=${customStart}`;
      if (customEnd) queryParams += `&date_end=${customEnd}`;
    }

    try {
      const [funnelRes, delaysRes] = await Promise.all([
        fetch(`/api/analytics/funnel${queryParams}`).then(res => res.json()),
        fetch(`/api/analytics/delays${queryParams}`).then(res => res.json())
      ]);
      setFunnelData(funnelRes);
      setDelaysData(delaysRes);
    } catch (err) {
      console.error("API Fetch Error:", err);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError('Введите данные');
      return;
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        setIsAuthenticated(true);
        setLoginError('');
      } else {
        setLoginError('Ошибка авторизации');
      }
    } catch {
       setIsAuthenticated(true);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDbStatus();
      fetchVacancies();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCandidatesList();
    }
  }, [isAuthenticated, selectedVacancy, searchTerm]);

  useEffect(() => {
    if (isAuthenticated) {
      if (dateRange === 'custom') {
         if (!customStart) {
             const now = new Date();
             const thirtyDaysAgo = new Date();
             thirtyDaysAgo.setDate(now.getDate() - 30);
             setCustomStart(thirtyDaysAgo.toISOString().split('T')[0]);
             setCustomEnd(now.toISOString().split('T')[0]);
         }
      }
      fetchAnalytics();
    }
  }, [isAuthenticated, dateRange, customStart, customEnd, selectedVacancy]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      fetchAnalytics(true);
    }, 60000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, dateRange, customStart, customEnd, selectedVacancy]);

  const totalApplicants = funnelData.length > 0 ? funnelData[0].count : 0;
  const hiredCount = funnelData.length > 0 ? funnelData[funnelData.length - 1].count : 0;
  const overallConversion = totalApplicants > 0 ? ((hiredCount / totalApplicants) * 100).toFixed(1) : 0;

  // Calculate detailed data for the grid
  const detailedData = funnelData.map((fData, index) => {
    const delayData = delaysData.find(d => d.sort === fData.sort);
    const prevCount = index > 0 ? funnelData[index - 1].count : fData.count;
    const conversion = prevCount > 0 ? ((fData.count / prevCount) * 100).toFixed(1) : "0.0";
    const dropoff = index > 0 ? prevCount - fData.count : 0;
    
    return {
      ...fData,
      avg_days: delayData ? delayData.avg_days : 0,
      conversion,
      dropoff
    };
  });

  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [simCandidatesCount, setSimCandidatesCount] = useState<number>(300);
  const [simConversion, setSimConversion] = useState<'standard' | 'strict' | 'loyal'>('standard');
  const [simSpeed, setSimSpeed] = useState<'normal' | 'fast' | 'slow'>('normal');
  
  const handleSimulate = async () => {
    setLoading(true);
    setSimulationModalOpen(false);
    try {
      await fetch('/api/analytics/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vacancyId: selectedVacancy,
          candidatesCount: simCandidatesCount,
          conversion: simConversion,
          speed: simSpeed
        })
      });
      await fetchAnalytics();
      await fetchCandidatesList();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const openExportModal = (format: 'csv' | 'pdf' | 'json' | 'word') => {
    setExportModalState({ isOpen: true, format });
  };

  const closeExportModal = () => {
    setExportModalState({ ...exportModalState, isOpen: false });
  };

  const processExport = () => {
    if (exportModalState.format === 'word') {
      closeExportModal();
      
      const table1Rows = detailedData.map(row => `
        <tr>
          <td style="text-align: center; border: 1px solid #000000; padding: 6px;">${row.sort}</td>
          <td style="border: 1px solid #000000; padding: 6px;">${row.stage}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 6px;">${row.count}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 6px;">${row.dropoff}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 6px;">${row.conversion}%</td>
        </tr>
      `).join('');

      const table2Rows = detailedData.map(row => {
        const isViolation = row.avg_days > slaThreshold;
        const statusText = isViolation 
          ? `SLA превышен на ${(row.avg_days - slaThreshold).toFixed(1)} дн.` 
          : "В пределах нормы SLA";
        const statusColor = isViolation ? "#990000" : "#006600";
        return `
          <tr>
            <td style="text-align: center; border: 1px solid #000000; padding: 6px;">${row.sort}</td>
            <td style="border: 1px solid #000000; padding: 6px;">${row.stage}</td>
            <td style="text-align: center; border: 1px solid #000000; padding: 6px;">${row.avg_days.toFixed(1)}</td>
            <td style="text-align: center; border: 1px solid #000000; padding: 6px;">${slaThreshold.toFixed(1)}</td>
            <td style="text-align: center; border: 1px solid #000000; padding: 6px; color: ${statusColor}; font-weight: bold;">${statusText}</td>
          </tr>
        `;
      }).join('');

      const compiledInsights = insights.map((ins: any) => `
        <div style="border-left: 3px solid #333333; padding-left: 10px; margin-bottom: 12px;">
          <strong style="color: #111111;">[Автовывод] ${ins.title}:</strong>
          <span style="color: #333333;">${ins.text}</span>
        </div>
      `).join('');

      const docHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Результаты экспериментальной эксплуатации</title>
        <style>
          @page {
            size: A4;
            margin: 2cm 2cm 2cm 3cm; /* ГОСТ Спецификации полей для ВКР: левое 3см, остальные 2см */
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 14pt;
            line-height: 1.5;
            color: #000000;
          }
          .title {
            font-size: 16pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 24pt;
            text-transform: uppercase;
          }
          .section-title {
            font-size: 14pt;
            font-weight: bold;
            margin-top: 18pt;
            margin-bottom: 12pt;
            page-break-after: avoid;
          }
          p {
            text-indent: 1.25cm; /* Абзацный отступ ГОСТ 1.25 см */
            margin-top: 0;
            margin-bottom: 12pt;
            text-align: justify; /* Выравнивание по ширине */
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12pt;
            margin-bottom: 12pt;
            font-size: 12pt;
          }
          th {
            font-weight: bold;
            background-color: #f2f2f2;
            border: 1px solid #000000;
            padding: 6px;
            text-align: center;
          }
          td {
            border: 1px solid #000000;
            padding: 6px;
          }
          .table-title {
            font-size: 12pt;
            font-style: italic;
            text-align: left;
            margin-bottom: 6px;
            text-indent: 0;
          }
          .signature-section {
            margin-top: 40pt;
            font-size: 12pt;
            line-height: 1.3;
          }
          .signature-table {
            width: 100%;
            border: none;
          }
          .signature-table td {
            border: none;
            padding: 8px;
          }
          .page-break {
            page-break-before: always;
          }
        </style>
      </head>
      <body>
        <div class="title">
          ПРИЛОЖЕНИЕ А<br/>
          (справочное)<br/>
          Результаты экспериментальной эксплуатации программного модуля «Анализатор воронки найма»
        </div>

        <p>Настоящее приложение содержит отчетные материалы по результатам проведения экспериментальной эксплуатации разработанного программного модуля «Анализатор воронки найма» (Recruitment Funnel Analyzer) в рамках выполнения выпускной квалификационной работы.</p>
        
        <p>Целью проведения экспериментальной эксплуатации являлась апробация разработанных алгоритмов извлечения, преобразования и загрузки данных (ETL) из реляционных СУБД (MySQL/XAMPP), проверка точности формулирования математических метрик (конверсий, SLA, Time-to-fill) и оценка применимости интерактивных инструментов визуализации в реальных бизнес-процессах управления персоналом (HR-аналитики).</p>

        <div class="section-title">1. Общая характеристика экспериментальной выборки</div>
        <p>Для проведения экспериментов и расчетов в базу данных была загружена пилотная транзакционная выборка событий движения кандидатов. Общее количество соискателей в анализируемом контуре составило <strong>${totalApplicants} человек</strong>. В результате комплексного прохождения всех этапов отбора до стадии финального трудоустройства (принятый оффер) было доведено <strong>${hiredCount} человек</strong>. Интегральный показатель сквозной конверсии воронки составил <strong>${overallConversion}%</strong>.</p>

        <div class="section-title">2. Анализ конверсии воронки подбора персонала</div>
        <p>Расчет сквозной и поэтапной конверсий производится на основе отношения числа кандидатов, прошедших на текущий шаг, к численности на предыдущем шаге отбора по формуле:</p>
        <p style="text-align: center; text-indent: 0;"><em>C<sub>i</sub> = (N<sub>i</sub> / N<sub>i-1</sub>) &times; 100%</em></p>
        <p>Данные о прохождении воронки кандидатами представлены в таблице А.1.</p>

        <div class="table-title">Таблица А.1 &ndash; Динамика прохождения этапов и показатели конверсии</div>
        <table>
          <thead>
            <tr>
              <th style="width: 8%;">№</th>
              <th>Этап подбора персонала</th>
              <th style="width: 18%;">Кандидатов (чел.)</th>
              <th style="width: 18%;">Отсев (чел.)</th>
              <th style="width: 18%;">Конверсия (%)</th>
            </tr>
          </thead>
          <tbody>
            ${table1Rows}
          </tbody>
        </table>

        <p>Из данных таблицы А.1 видно, что разработанный математический аппарат наглядно идентифицирует точки наибольшего отсева соискателей. Собранная статистика позволяет формулировать объективные рекомендации по оптимизации критериев первичного отбора.</p>

        <div class="page-break"></div>

        <div class="section-title">3. Анализ соблюдения нормативов регламентного времени (SLA)</div>
        <p>Каждый этап воронки подбора регулируется нормативом предельного времени ожидания кандидата (Service Level Agreement, SLA), заданного в системе как <strong>${slaThreshold.toFixed(1)} дн.</strong> Оценка соблюдения регламентов приведена в таблице А.2.</p>

        <div class="table-title">Таблица А.2 &ndash; Оценка средних временных задержек и отклонений от SLA</div>
        <table>
          <thead>
            <tr>
              <th style="width: 8%;">№</th>
              <th>Этап подбора персонала</th>
              <th style="width: 22%;">Ср. время (дн.)</th>
              <th style="width: 22%;">Номинал SLA (дн.)</th>
              <th style="width: 25%;">Статус контроля</th>
            </tr>
          </thead>
          <tbody>
            ${table2Rows}
          </tbody>
        </table>

        <p>Превышение установленных лимитов SLA на определенных этапах сигнализирует о перегруженности ответственных лиц или неоптимальности внутренней цепочки согласований.</p>

        <div class="section-title">4. Аналитические выводы и экспертные рекомендации</div>
        <p>Встроенный интеллектуальный агент автоматического формулирования выводов на основе текущих показателей сгенерировал следующие замечания:</p>

        <div style="margin-top: 10px; margin-bottom: 20px; text-indent: 0;">
          ${compiledInsights}
        </div>

        <p>Сформулированные рекомендации могут быть внедрены в бизнес-процессы HR-департамента для устранения "узких горлышек" и сокращения показателя Time-to-fill.</p>

        <div class="section-title">5. Подтверждение результатов (Шаблон Акта)</div>
        <p>Данный отчет может выступать в качестве формального подтверждения внедрения или проведения успешного тестирования в рамках дипломной работы.</p>

        <div class="signature-section">
          <table class="signature-table">
            <tr>
              <td style="width: 100%; font-weight: bold; text-align: right;">РАЗРАБОТЧИК:</td>
            </tr>
            <tr>
              <td style="text-align: right;">
                Студент группы ПИ-21<br/>
                _________________ / Комаров М.Н. /<br/>
                <br/>
                <span style="font-size: 10pt; color: #555555;">«____» __________________ 2026 г.</span>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
      `;

      const blob = new Blob(['\uFEFF' + docHtml], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Vkr_Experimental_Results_Report.doc`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (exportModalState.format === 'pdf') {
      closeExportModal();
      const originalTheme = theme;
      setTheme('light');
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setTheme(originalTheme);
        }, 1000);
      }, 300);
      return;
    }

    if (exportModalState.format === 'json') {
      const exportData: any = {};
      if (exportConfig.includeFunnel) exportData.funnel = detailedData;
      if (exportConfig.includeDelays) exportData.delays = delaysData;
      if (exportConfig.includeInsights) {
        exportData.insights = insights.map((item: any) => ({
          type: item.type,
          title: item.title,
          text: item.text,
        }));
      }
      if (exportConfig.rawCandidates) {
        exportData.candidates = filteredCandidates.map(cand => ({
          id: cand.id,
          name: cand.name,
          phone: cand.phone || '',
          source: cand.source || '',
          vacancy: cand.vacancy,
          stage: cand.stage,
          date: cand.date
        }));
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `analytics_export_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      closeExportModal();
      return;
    }

    // CSV format
    let csvContent = "";
    let currentRow = 1; // 1-based index in Excel

    if (exportConfig.includeFunnel) {
      csvContent += "=== ВОРОНКА НАЙМА ===\n"; currentRow++;
      csvContent += "Этап;Кандидатов;Отсев;Конверсия (%)\n"; currentRow++;
      
      const startDataRow = currentRow; // Row offset where the data list starts
      detailedData.forEach((row, i) => {
        const itemRow = startDataRow + i;
        let countVal = row.count;
        let dropoffVal: string | number = row.dropoff;
        let convVal: string | number = row.conversion;

        if (i === 0) {
          dropoffVal = 0;
          convVal = "100";
        } else {
          // Dropoff (Отсев): previous count - current count
          dropoffVal = `=B${itemRow-1}-B${itemRow}`;
          // Conversion (Конверсия %): current count / previous count * 100
          convVal = `=IF(B${itemRow-1}>0;ROUND((B${itemRow}/B${itemRow-1})*100;1);0)`;
        }
        
        csvContent += `"${row.sort}. ${row.stage}";${countVal};${dropoffVal};${convVal}\n`;
        currentRow++;
      });
      
      const lastFunnelRow = startDataRow + detailedData.length - 1;
      csvContent += `"Итого отсеяно (СУММ)";;=SUM(C${startDataRow}:C${lastFunnelRow});\n`; currentRow++;
      csvContent += `"Средняя конверсия (СРЗНАЧ)";;;=ROUND(AVERAGE(D${startDataRow}:D${lastFunnelRow});1)\n`; currentRow++;
      csvContent += "\n"; currentRow++;
    }

    if (exportConfig.includeDelays) {
      csvContent += "=== ВРЕМЕННЫЕ ЗАДЕРЖКИ (SLA) ===\n"; currentRow++;
      csvContent += "Этап;Ср. время (дни);Лимит SLA (дни);Статус контроля\n"; currentRow++;
      
      const startDelayRow = currentRow;
      delaysData.forEach((row, i) => {
        const itemRow = startDelayRow + i;
        const statusFormula = `=IF(B${itemRow}>C${itemRow};"SLA превышен на " & ROUND(B${itemRow}-C${itemRow};1) & " дн.";"В пределах нормы")`;
        csvContent += `"${row.sort}. ${row.stage}";${row.avg_days};${slaThreshold};"${statusFormula}"\n`;
        currentRow++;
      });
      
      const lastDelayRow = startDelayRow + delaysData.length - 1;
      csvContent += `"Общее среднее время (СРЗНАЧ)";=ROUND(AVERAGE(B${startDelayRow}:B${lastDelayRow});1);;\n`; currentRow++;
      csvContent += "\n"; currentRow++;
    }

    if (exportConfig.includeInsights) {
      csvContent += "=== АВТОМАТИЧЕСКИЙ АНАЛИЗ ОТКЛОНЕНИЙ ===\n";
      csvContent += "Тип;Заголовок;Описание\n";
      csvContent += insights.map(i => `"${i.type}";"${i.title}";"${i.text}"`).join("\n") + "\n\n";
    }

    if (exportConfig.rawCandidates) {
      csvContent += "=== ЛОГИ КАНДИДАТОВ ===\n";
      csvContent += "ID;ФИО Кандидата;Телефон;Источник;Вакансия;Этап;Дата перехода\n";
      csvContent += filteredCandidates.map(cand => 
        `${cand.id};"${cand.name}";"${cand.phone || ''}";"${cand.source || ''}";"${cand.vacancy}";"${cand.stage}";"${cand.date || ''}"`
      ).join("\n") + "\n\n";
    }
    
    // Add BOM for Excel 
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `analytics_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    closeExportModal();
  };

  const generateInsights = () => {
    if (detailedData.length === 0) return [];
    
    const aiInsights = [];
    
    let maxDropoffStage = null;
    let maxDropoffCount = 0;
    let slaViolations: { stage: string; days: number; diff: string }[] = [];

    detailedData.forEach((row, idx) => {
      if (row.dropoff > maxDropoffCount && idx > 0) {
        maxDropoffCount = row.dropoff;
        maxDropoffStage = row.stage;
      }
      if (row.avg_days > slaThreshold) {
        slaViolations.push({ stage: row.stage, days: row.avg_days, diff: (row.avg_days - slaThreshold).toFixed(1) });
      }
    });

    if (maxDropoffStage) {
      aiInsights.push({
        type: 'warning',
        icon: <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 mr-2 flex-shrink-0" />,
        color: theme === 'dark' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50/80 text-amber-800',
        title: 'Узкое горлышко конверсии',
        text: `Наивысший процент отсева происходит на этапе ${maxDropoffStage} (потеряно ${maxDropoffCount} канд.). Оптимизируйте требования или процесс оценки.`,
      });
    }

    if (slaViolations.length > 0) {
      slaViolations.forEach(v => {
        aiInsights.push({
          type: 'danger',
          icon: <ClockIcon className="w-4 h-4 text-red-400 mt-0.5 mr-2 flex-shrink-0" />,
          color: theme === 'dark' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50/80 text-red-800',
          title: 'Нарушение SLA',
          text: `Задержка: Этап ${v.stage} занимает ${v.days} дн. (превышение норматива на ${v.diff} дн.). Существует риск потери кандидатов...`,
        });
      });
    } else {
      aiInsights.push({
        type: 'danger',
        icon: <ClockIcon className="w-4 h-4 text-red-400 mt-0.5 mr-2 flex-shrink-0" />,
        color: theme === 'dark' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50/80 text-red-800',
        title: 'Нарушение SLA',
        text: `Задержка: Нормативные показатели SLA соблюдены. Не выявлено этапов, превышающих ${slaThreshold} дня.`,
      });
    }

    aiInsights.push({
      type: 'info',
      icon: <Info className="w-4 h-4 text-blue-400 mt-0.5 mr-2 flex-shrink-0" />,
      color: theme === 'dark' ? 'border-blue-500/30 bg-blue-500/10 text-blue-200' : 'border-blue-200 bg-blue-50/80 text-blue-800',
      title: 'Замечание по воронке',
      text: `Общая конверсия составляет ${overallConversion}%. Чтобы повысить количество офферов, рассмотрите расширение верхней границы воронки (сорсинг).`,
    });

    return aiInsights;
  };

  const ClockIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  );

  const insights = generateInsights();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
           {/* Decorative elements */}
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
           
           <h2 className="text-2xl text-white mt-2 mb-6 flex items-center justify-center font-medium">
              <div className="bg-purple-600 rounded-lg w-10 h-10 flex items-center justify-center mr-3 font-bold text-white shadow-lg shadow-purple-900/50">HR</div>
              Анализатор воронки
           </h2>
           <p className="text-slate-400 mb-8 text-center text-sm">Авторизация для доступа к аналитике</p>
           
           <form onSubmit={handleLogin} className="space-y-5">
             <div>
               <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-medium">Email (рабочий)</label>
               <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hr@company.com" 
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-shadow" 
                  required 
               />
             </div>
             <div>
               <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-medium">Пароль</label>
               <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-shadow" 
                  required 
               />
             </div>
             {loginError && <p className="text-red-400 text-sm text-center">{loginError}</p>}
             <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2.5 rounded-lg transition-colors mt-8 shadow-lg shadow-purple-900/20 flex items-center justify-center">
               <Lock className="w-4 h-4 mr-2 opacity-70"/>
               Войти в систему
             </button>
           </form>
           <div className="mt-6 text-center">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 bg-slate-800/50 px-2 py-1 rounded">Режим прототипа: введите любые данные</span>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans print:bg-white print:text-black ${theme === 'dark' ? 'bg-[#0b0f19] text-white' : 'theme-light text-slate-900 bg-white'}`}>
      {/* Top Navbar */}
      <div className="bg-[#111827] border-b border-slate-800 px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between print:hidden gap-4">
         <div className="flex flex-wrap items-center gap-2 mb-1 md:mb-0">
            <div className="bg-purple-600 rounded-md w-9 h-9 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">HR</div>
            <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Анализатор воронки найма</h1>
            <span className="bg-[#3b2063] border border-purple-700/50 text-purple-300 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium">РАБОЧИЙ ПРОТОТИП</span>
            <span className={`border text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium hidden sm:inline-flex items-center gap-1.5 ${
              dbStatus.connected 
                ? 'bg-emerald-950/45 border-emerald-500/40 text-emerald-300' 
                : 'bg-amber-950/45 border-amber-500/40 text-amber-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              {dbStatus.dbName}
            </span>
         </div>
         <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-3 sm:gap-6 text-sm text-slate-400 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 pl-0 md:pl-6 ml-0 md:ml-2 w-full md:w-auto">
            <span>Студент: <strong className="text-white font-medium tracking-wide">Комаров М.Н.</strong></span>
            
            <div className="flex space-x-4 border-l border-slate-800 pl-6 self-end sm:self-auto">
              <button onClick={() => setShareModalOpen(true)} className="text-slate-500 hover:text-purple-400 transition-colors flex items-center space-x-1 cursor-pointer" title="Поделиться и QR-код">
                <QrCode className="w-5 h-5" />
              </button>

              <button onClick={() => setIntegrationModalOpen(true)} className="text-slate-500 hover:text-blue-400 transition-colors flex items-center space-x-1" title="Интеграция">
                <Code className="w-5 h-5" />
              </button>
              
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-slate-500 hover:text-amber-400 transition-colors flex items-center space-x-1" title="Сменить тему">
                 {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button onClick={() => setIsAuthenticated(false)} className="text-slate-500 hover:text-white transition-colors flex items-center space-x-1" title="Выйти">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
         </div>
      </div>

      <div id="dashboard-content" className="p-6 md:p-10">
        {/* Professional Print Header - Only shown during printing */}
        <div className="hidden print:block border-b-2 border-slate-950 pb-6 mb-8 text-black">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-4">
              <div className="bg-slate-950 text-white w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl border-2 border-slate-950">
                HR
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">Официальный аналитический отчет</h1>
                <p className="text-xs text-slate-600 font-mono tracking-wider mt-0.5">HR-ANALYZER // МОНИТОРИНГ И ETL-МЕТРИКИ ВОРОНКИ НАЙМА</p>
              </div>
            </div>
            <div className="text-right font-mono text-[11px] text-slate-700 space-y-1">
              <div><strong className="text-slate-900 font-semibold">Разработчик:</strong> Комаров М.Н.</div>
              <div><strong className="text-slate-900 font-semibold">Роль:</strong> Студент-разработчик</div>
              <div><strong className="text-slate-900 font-semibold">Дата генерации:</strong> {new Date().toLocaleDateString('ru-RU')}</div>
              <div><strong className="text-slate-900 font-semibold">Протокол контроля:</strong> IDEF0 / ETL-K-98</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-200 text-xs text-slate-800">
            <div>
              <p className="text-slate-400 uppercase tracking-widest text-[9px] font-bold mb-1">СВЕДЕНИЯ О КОМИССИИ</p>
              <p className="font-semibold text-slate-900">Аттестационная комиссия HR-систем</p>
              <p className="text-slate-500 text-[11px]">Цифровая экосистема управления человеческим капиталом</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase tracking-widest text-[9px] font-bold mb-1">ФОКУСНАЯ ВАКАНСИЯ</p>
              <p className="font-semibold text-slate-900">
                {vacanciesList.find(v => v.id === selectedVacancy)?.title || 'Senior React Developer'}
              </p>
              <p className="text-slate-500 text-[11px]">Департамент фронтенд-разработки</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase tracking-widest text-[9px] font-bold mb-1">АНАЛИЗИРУЕМЫЙ ПЕРИОД</p>
              <p className="font-semibold text-slate-900">
                {dateRange === 'all' && 'За все время наблюдений'}
                {dateRange === '30days' && 'Последние 30 календарных дней'}
                {dateRange === 'custom' && `Интервал: ${customStart || '...'} по ${customEnd || '...'}`}
              </p>
              <p className="text-slate-500 text-[11px]">Формат агрегации: Динамический</p>
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-slate-800/80 gap-4 print:border-b-2 print:border-gray-300">
          <div>
            <h2 className="text-lg font-medium text-slate-100 print:text-black">Аналитика подбора</h2>
            <p className="text-slate-400 text-sm mt-1 print:text-gray-600">Основано на модели IDEF0 и ETL-агрегации</p>
          </div>

          <div className="flex md:flex-row flex-col items-stretch md:items-center gap-3 print:hidden w-full md:w-auto">
          {/* Mock Filters */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 text-sm text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-2xl sm:rounded-full border border-slate-800 shadow-sm print:hidden">
            <Calendar className="w-4 h-4 text-purple-400 ml-2" />
            <select 
              className="bg-transparent text-slate-300 outline-none pr-3 py-1 cursor-pointer"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="all" className="bg-slate-900">За все время</option>
              <option value="30days" className="bg-slate-900">За 30 дней</option>
              <option value="custom" className="bg-slate-900">Произвольный период</option>
            </select>
            {dateRange === 'custom' && (
              <div className="flex items-center space-x-2 border-l border-slate-700 pl-3">
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-transparent text-slate-300 outline-none cursor-pointer"
                />
                <span className="text-slate-500">-</span>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-transparent text-slate-300 outline-none pr-2 cursor-pointer"
                />
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 shadow-sm print:hidden">
            <span title="Настройка порога SLA" className="text-slate-400">SLA:</span>
            <input 
              title="Порог SLA (в днях)"
              type="number" 
              step="0.5"
              min="0.5"
              max="30"
              value={slaThreshold}
              onChange={(e) => setSlaThreshold(Number(e.target.value) || 3.0)}
              className="bg-transparent text-slate-300 outline-none w-12 text-center cursor-pointer"
            />
            <span className="text-slate-500 text-xs">дн.</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-300 bg-slate-900/80 pl-4 pr-2 py-1.5 rounded-full border border-slate-800 shadow-sm print:hidden">
            <Briefcase className="w-4 h-4 text-purple-400" />
            <select
              value={selectedVacancy}
              onChange={(e) => setSelectedVacancy(Number(e.target.value))}
              className="bg-transparent text-slate-300 outline-none pr-1 cursor-pointer font-medium text-xs sm:text-sm max-w-[170px] truncate"
            >
              {vacanciesList.map((v) => (
                <option key={v.id} value={v.id} className="bg-slate-950 text-slate-300">
                  {v.title}
                </option>
              ))}
            </select>
            <button 
              onClick={() => setShowAddVacancyModal(true)} 
              className="p-1 hover:bg-slate-800 rounded-full transition-colors group cursor-pointer"
              title="Добавить новую вакансию"
            >
              <Plus className="w-4 h-4 text-slate-400 group-hover:text-purple-400" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setSimulationModalOpen(true)}
              className="flex items-center space-x-2 text-sm text-blue-100 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 transition-colors px-4 py-2 rounded-full"
              title="Симуляция данных"
            >
              <Settings2 className="w-4 h-4 text-blue-400" />
              <span className="font-medium hidden sm:inline-block">Генерация данных</span>
            </button>
            <button 
              onClick={() => openExportModal('json')}
              className="flex items-center space-x-2 text-sm text-amber-100 bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 transition-colors px-4 py-2 rounded-full"
              title="Выгрузить в JSON"
            >
              <Database className="w-4 h-4 text-amber-400" />
              <span className="font-medium hidden sm:inline-block">JSON</span>
            </button>
            <button 
              onClick={() => openExportModal('csv')}
              className="flex items-center space-x-2 text-sm text-emerald-100 bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors px-4 py-2 rounded-full"
              title="Выгрузить в CSV"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span className="font-medium hidden sm:inline-block">CSV</span>
            </button>
            <button 
              onClick={() => openExportModal('pdf')}
              className="flex items-center space-x-2 text-sm text-white bg-purple-600 hover:bg-purple-700 transition-colors px-4 py-2 rounded-full shadow-sm shadow-purple-900/50 cursor-pointer"
              title="Печатный отчет по ГОСТ в формате PDF"
            >
              <Download className="w-4 h-4" />
              <span className="font-medium">Экспорт PDF</span>
            </button>
            <button 
              onClick={() => openExportModal('word')}
              className="flex items-center space-x-2 text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-2 rounded-full shadow-sm shadow-blue-950/50 cursor-pointer"
              title="Готовый раздел диплома в формате Word (.doc)"
            >
              <FileText className="w-4 h-4" />
              <span className="font-medium">Экспорт Word</span>
            </button>
          </div>
        </div>
      </div>

      {simulationModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">
                Параметры симуляции
              </h3>
              <button onClick={() => setSimulationModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-400 mb-4">Настройте параметры воронки для текущей вакансии:</div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-medium">Количество кандидатов</label>
                  <input 
                    type="number"
                    min="10"
                    max="10000"
                    value={simCandidatesCount}
                    onChange={(e) => setSimCandidatesCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <p className="text-xs text-slate-500 mt-1">Определяет размер потока входящих откликов (10 - 10000).</p>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-medium">Профиль конверсии (отсев)</label>
                  <select
                    value={simConversion}
                    onChange={(e) => setSimConversion(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
                  >
                    <option value="standard">Стандартный (Равномерный отсев)</option>
                    <option value="strict">Строгий скрининг (Отсев &gt; 50% на старте)</option>
                    <option value="loyal">Лояльный (Пропускает большинство)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-medium">Динамика по времени (SLA)</label>
                  <select
                    value={simSpeed}
                    onChange={(e) => setSimSpeed(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
                  >
                    <option value="normal">Обычный процесс</option>
                    <option value="fast">Очень быстро (преимущественно 1-2 дня)</option>
                    <option value="slow">Сильные задержки (нарушение SLA)</option>
                  </select>
                </div>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex justify-end space-x-3 bg-slate-900/50">
              <button onClick={() => setSimulationModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                Отмена
              </button>
              <button 
                onClick={handleSimulate}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Database className="w-4 h-4 mr-2" />
                Сгенерировать
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddVacancyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Новая вакансия
              </h3>
              <button onClick={() => setShowAddVacancyModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddVacancy}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Название вакансии (job_title)</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Senior QA Automation Engineer"
                    value={newVacancyTitle}
                    onChange={(e) => setNewVacancyTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm rounded-lg p-2.5 text-slate-200 outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 transition-all font-sans"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-800 flex justify-end space-x-3 bg-slate-950/20">
                <button type="button" onClick={() => setShowAddVacancyModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer">
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-550 transition-colors shadow-lg shadow-purple-600/10 cursor-pointer"
                >
                  Создать вакансию
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddCandidateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Добавить кандидата
              </h3>
              <button onClick={() => setShowAddCandidateModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCandidate}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium font-sans">ФИО Кандидата</label>
                  <input
                    type="text"
                    required
                    placeholder="Иванов Иван Иванович"
                    value={newCandidateName}
                    onChange={(e) => setNewCandidateName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm rounded-lg p-2.5 text-slate-200 outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 transition-all font-sans"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium font-sans">Номер телефона</label>
                  <input
                    type="text"
                    placeholder="+7 (999) 000-00-00"
                    value={newCandidatePhone}
                    onChange={(e) => setNewCandidatePhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm rounded-lg p-2.5 text-slate-200 outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 transition-all font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium font-sans">Источник привлечения</label>
                  <select
                    value={newCandidateSource}
                    onChange={(e) => setNewCandidateSource(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm rounded-lg p-2.5 text-slate-200 outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 transition-all font-sans"
                  >
                    <option value="HeadHunter">HeadHunter</option>
                    <option value="Habr Career">Хабр Карьера</option>
                    <option value="Referral">Рекомендация</option>
                    <option value="Telegram">Telegram канал/чат</option>
                    <option value="In-house sourcing">Прямой хантинг</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-800 flex justify-end space-x-3 bg-slate-950/20">
                <button type="button" onClick={() => setShowAddCandidateModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer">
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-550 transition-colors shadow-lg shadow-purple-600/10 cursor-pointer"
                >
                  Добавить в воронку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {exportModalState.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">
                Настройки экспорта ({
                  exportModalState.format === 'csv' ? 'CSV' : 
                  exportModalState.format === 'pdf' ? 'PDF (Печать)' : 
                  exportModalState.format === 'word' ? 'MS Word (.DOC)' : 'JSON'
                })
              </h3>
              <button type="button" onClick={closeExportModal} className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-850">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-400 mb-4">
                {exportModalState.format === 'word' 
                  ? 'Будет автоматически сгенерировано приложение к вашему диплому («Результаты экспериментальной эксплуатации») по всем академическим стандартам ГОСТ (шрифт Times New Roman, полуторный интервал, ГОСТ-таблицы, выводы и блок подписей комиссии):'
                  : `Выберите данные, которые необходимо экспортировать в ${exportModalState.format.toUpperCase()} файл:`
                }
              </div>
              
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportConfig.includeFunnel ? 'bg-purple-600 border-purple-600' : 'bg-slate-800 border-slate-700 group-hover:border-slate-500'}`}>
                  {exportConfig.includeFunnel && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input type="checkbox" className="hidden" checked={exportConfig.includeFunnel} onChange={() => setExportConfig({...exportConfig, includeFunnel: !exportConfig.includeFunnel})} />
                <span className="text-slate-200">Воронка кандидатов (этапы и конверсия)</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportConfig.includeDelays ? 'bg-purple-600 border-purple-600' : 'bg-slate-800 border-slate-700 group-hover:border-slate-500'}`}>
                  {exportConfig.includeDelays && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input type="checkbox" className="hidden" checked={exportConfig.includeDelays} onChange={() => setExportConfig({...exportConfig, includeDelays: !exportConfig.includeDelays})} />
                <span className="text-slate-200">Временные задержки (SLA)</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportConfig.includeInsights ? 'bg-purple-600 border-purple-600' : 'bg-slate-800 border-slate-700 group-hover:border-slate-500'}`}>
                  {exportConfig.includeInsights && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input type="checkbox" className="hidden" checked={exportConfig.includeInsights} onChange={() => setExportConfig({...exportConfig, includeInsights: !exportConfig.includeInsights})} />
                <span className="text-slate-200">Автоматический анализ отклонений</span>
              </label>

              {exportModalState.format === 'csv' && (
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportConfig.rawCandidates ? 'bg-purple-600 border-purple-600' : 'bg-slate-800 border-slate-700 group-hover:border-slate-500'}`}>
                    {exportConfig.rawCandidates && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={exportConfig.rawCandidates} onChange={() => setExportConfig({...exportConfig, rawCandidates: !exportConfig.rawCandidates})} />
                  <span className="text-slate-200">Сырые логи кандидатов</span>
                </label>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex justify-end space-x-3 bg-slate-900/50">
              <button onClick={closeExportModal} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                Отмена
              </button>
              <button 
                onClick={processExport}
                className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Сформировать {
                  exportModalState.format === 'word' ? 'Word (ГОСТ)' : exportModalState.format.toUpperCase()
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {integrationModalOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setIntegrationModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40 flex-shrink-0 select-text">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Code className="w-5 h-5 text-blue-400 mr-2" />
                Интеграция модуля
              </h3>
              <button 
                type="button" 
                onClick={() => setIntegrationModalOpen(false)} 
                className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-800/85"
                title="Закрыть (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-shrink-0 select-text">
              <div className="flex border-b border-slate-800">
                  <div 
                    onClick={() => setIntegrationTab('iframe')}
                    className={`flex-1 py-3 px-4 flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${integrationTab === 'iframe' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                  >
                     <Link className="w-4 h-4 mr-2" />
                     Iframe Встраивание
                  </div>
                  <div 
                    onClick={() => setIntegrationTab('api')}
                    className={`flex-1 py-3 px-4 flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${integrationTab === 'api' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                  >
                     <Cpu className="w-4 h-4 mr-2" />
                     REST API / Токен
                  </div>
                  <div 
                    onClick={() => setIntegrationTab('webhooks')}
                    className={`flex-1 py-3 px-4 flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${integrationTab === 'webhooks' ? 'text-amber-400 border-b-2 border-amber-500 bg-amber-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                  >
                     <Database className="w-4 h-4 mr-2" />
                     Webhooks
                  </div>
              </div>
            </div>
               
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] select-text scrollbar-thin scrollbar-thumb-slate-800">
                 {integrationTab === 'iframe' && (
                   <div className="animate-in fade-in zoom-in-95 duration-200">
                     <h4 className="text-slate-200 font-medium mb-2 text-sm">HTML-код для встраивания</h4>
                     <p className="text-slate-400 text-xs mb-4">
                        Скопируйте данный код и вставьте его на любую страницу вашего корпоративного портала (например, Bitrix24, Confluence или внутренний сайт), чтобы отобразить этот дашборд.
                     </p>
                     <div className="relative group">
                       <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="bg-slate-700 hover:bg-slate-600 p-1.5 rounded flex items-center text-xs text-white" onClick={() => alert('Код скопирован!')}>
                            <Copy className="w-3 h-3 mr-1" /> Скопировать
                         </button>
                       </div>
<pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto text-[11px] text-emerald-400 font-mono">
{`<iframe 
  src="${window.location.origin}" 
  width="100%" 
  height="800px" 
  style="border: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"
  allow="clipboard-write"
  title="Аналитика найма"
></iframe>`}
</pre>
                     </div>
                     
                     <div className="mt-6 bg-blue-900/20 border border-blue-800/50 p-4 rounded-xl">
                       <h4 className="text-blue-300 font-medium text-sm flex items-center mb-1">
                         <Info className="w-4 h-4 mr-1.5" />
                         Требования политики безопасности (CORS)
                       </h4>
                       <p className="text-slate-400 text-xs">
                         Убедитесь, что CSP (Content Security Policy) вашего сайта разрешает загрузку фреймов с текущего домена. Для включения кросс-доменной авторизации обратитесь к администратору сервера.
                       </p>
                     </div>
                   </div>
                 )}

                 {integrationTab === 'api' && (
                   <div className="animate-in fade-in zoom-in-95 duration-200">
                     <h4 className="text-slate-200 font-medium mb-2 text-sm">Генерация API-токена</h4>
                     <p className="text-slate-400 text-xs mb-4">
                        Уникальный токен доступа позволяет сторонним сервисам безопасно обращаться к REST API нашего аналитического модуля для получения данных напрямую.
                     </p>

                     <div className="bg-slate-900 border border-slate-700 p-5 rounded-xl mb-6">
                       {!apiToken ? (
                         <div className="text-center py-4">
                           <button 
                             onClick={generateApiToken}
                             className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors inline-flex items-center text-sm shadow-lg shadow-emerald-900/20"
                           >
                             <Cpu className="w-4 h-4 mr-2" /> Сгенерировать токен доступа
                           </button>
                         </div>
                       ) : (
                         <div>
                           <div className="text-xs text-slate-400 mb-1.5 uppercase font-medium tracking-wider">Ваш новый токен:</div>
                           <div className="flex gap-2">
                             <input 
                               type="text" 
                               value={apiToken}
                               readOnly
                               className="flex-1 bg-slate-950 border border-emerald-500/50 rounded-lg px-4 py-2.5 text-emerald-400 font-mono text-sm outline-none w-full shadow-inner"
                             />
                             <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-lg font-medium transition-colors inline-flex items-center text-sm shadow-md" onClick={() => alert('Токен скопирован!')}>
                                <Copy className="w-4 h-4" />
                             </button>
                           </div>
                           <p className="text-amber-400/80 text-xs mt-3 flex items-start">
                             <AlertTriangle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                             Надежно сохраните этот токен. При его утере вам придется сгенерировать новый и обновить все интеграции.
                           </p>
                         </div>
                       )}
                     </div>

                     <div className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 bg-slate-700 text-slate-300 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-bl-lg">Инструкция администратора</div>
                       


                       <h5 className="text-slate-200 font-medium text-sm mb-3">Настройка XAMPP:</h5>
                       <ol className="list-decimal pl-4 space-y-2 text-slate-400 text-xs leading-relaxed">
                         <li>Откройте файл конфигурации Apache в вашей установке XAMPP <code>C:\xampp\apache\conf\httpd.conf</code> (путь по умолчанию).</li>
                         <li>Убедитесь, что модуль <code>mod_setenvif</code> включен (уберите # в начале строки <code>LoadModule setenvif_module modules/mod_setenvif.so</code>).</li>
                         <li>Добавьте в ваш блок <code>&lt;VirtualHost&gt;</code> или в файл <code>.htaccess</code> следующее правило для проверки заголовка:
                           <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 my-1 mt-2 text-[#a5d6ff] font-mono text-[10px]">
SetEnvIf Authorization "^Bearer ${apiToken || 'ВАШ_СГЕНЕРИРОВАННЫЙ_ТОКЕН'}$" valid_token<br/>
Order Deny,Allow<br/>
Deny from all<br/>
Allow from env=valid_token
                           </pre>
                         </li>
                         <li>Перезапустите Apache через панель управления XAMPP, чтобы применить настройки.</li>
                         <li>Теперь ваши интеграции могут отправлять GET-запросы на <code>{window.location.origin}/api/analytics/funnel</code>, передавая в заголовках: <code className="bg-slate-900 border border-slate-700 px-1 py-0.5 rounded text-emerald-400 font-mono whitespace-nowrap">Authorization: Bearer ТОКЕН</code></li>
                       </ol>

                     </div>
                   </div>
                 )}

                  {integrationTab === 'webhooks' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200 text-slate-300 mb-6 border-b border-slate-800 pb-6">
                      <h4 className="text-slate-200 font-medium mb-1 text-sm">Управление Webhooks-оповещениями</h4>
                      <p className="text-slate-400 text-xs mb-4">
                         Webhooks позволяют автоматически информировать ваши сторонние системы (например, Bitrix24, Telegram-боты или внутренние CRM-системы на XAMPP) в режиме реального времени о ключевых действиях рекрутера.
                      </p>

                      <div className="space-y-4 bg-slate-900 border border-slate-700/80 p-5 rounded-xl mb-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target URL (Адрес назначения)</label>
                          <input 
                            type="text" 
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500/50 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs outline-none transition-colors"
                            placeholder="https://your-domain.company.com/webhook"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">События для триггера</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex items-center space-x-2.5 cursor-pointer text-xs">
                              <input 
                                type="checkbox" 
                                checked={webhookEvents.candidateCreated}
                                onChange={(e) => setWebhookEvents({...webhookEvents, candidateCreated: e.target.checked})}
                                className="accent-amber-500"
                              />
                              <span>Новый отклик кандидата</span>
                            </label>
                            <label className="flex items-center space-x-2.5 cursor-pointer text-xs">
                              <input 
                                type="checkbox" 
                                checked={webhookEvents.stageChanged}
                                onChange={(e) => setWebhookEvents({...webhookEvents, stageChanged: e.target.checked})}
                                className="accent-amber-500"
                              />
                              <span>Смена этапа отбора (Transition)</span>
                            </label>
                            <label className="flex items-center space-x-2.5 cursor-pointer text-xs">
                              <input 
                                type="checkbox" 
                                checked={webhookEvents.offerAccepted}
                                onChange={(e) => setWebhookEvents({...webhookEvents, offerAccepted: e.target.checked})}
                                className="accent-amber-500"
                              />
                              <span>Выставление и принятие оффера</span>
                            </label>
                            <label className="flex items-center space-x-2.5 cursor-pointer text-xs">
                              <input 
                                type="checkbox" 
                                checked={webhookEvents.candidateRejected}
                                onChange={(e) => setWebhookEvents({...webhookEvents, candidateRejected: e.target.checked})}
                                className="accent-amber-500"
                              />
                              <span>Отказ / Дисквалификация</span>
                            </label>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <span className="text-[11px] text-slate-400">Payload Format: <code className="text-amber-400 font-mono">application/json</code> (POST)</span>
                          <button 
                            onClick={async () => {
                              if (!webhookUrl) return;
                              setTestWebhookStatus('sending');
                              setTestWebhookResult('');
                              try {
                                const mockPayload = {
                                  event: "candidate.stage_changed",
                                  timestamp: new Date().toISOString(),
                                  data: {
                                    id_candidate: 98112,
                                    name: "Иванов Игорь Игоревич",
                                    vacancy: "Senior React Developer",
                                    old_stage: "HR-интервью",
                                    new_stage: "Тестовое задание",
                                    updated_by: "Recruiter"
                                  }
                                };
                                
                                const response = await fetch('/api/analytics/test-webhook', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ url: webhookUrl, payload: mockPayload })
                                });
                                
                                const data = await response.json();
                                if (response.ok && data.success) {
                                   setTestWebhookStatus('success');
                                   setTestWebhookResult(`HTTP ${data.status} — Тестовое событие доставлено! Ответ сервера: ${data.response || 'No response body'}`);
                                } else {
                                   setTestWebhookStatus('error');
                                   setTestWebhookResult(`Не удалось доставить: ${data.error || 'Ответ со статусом ' + data.status}`);
                                }
                              } catch (err: any) {
                                setTestWebhookStatus('error');
                                setTestWebhookResult(`Сетевая ошибка отправки: ${err.message}`);
                              }
                            }}
                            disabled={testWebhookStatus === 'sending'}
                            className="px-4 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-500 rounded transition-colors disabled:opacity-50"
                          >
                            {testWebhookStatus === 'sending' ? 'Отправка...' : 'Отправить Тестовый Webhook'}
                          </button>
                        </div>
                        
                        {testWebhookStatus !== 'idle' && (
                          <div className={`p-3 rounded-lg text-xs font-mono border ${
                            testWebhookStatus === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' : 
                            testWebhookStatus === 'sending' ? 'bg-slate-900 border-slate-700 text-slate-400' :
                            'bg-red-950/40 border-red-500/30 text-red-400'
                          }`}>
                            {testWebhookResult || 'Соединение с сервером...'}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl">
                        <h5 className="text-slate-200 font-medium text-xs mb-1.5 uppercase tracking-wider">Пример Payload-запроса</h5>
                        <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[#a5d6ff] font-mono text-[10px] overflow-x-auto max-h-36">
{`{
  "event": "candidate.stage_changed",
  "timestamp": "2026-06-08T21:24:00Z",
  "data": {
    "id_candidate": 98112,
    "name": "Иванов Игорь Игоревич",
    "old_stage": "HR-интервью",
    "new_stage": "Тестовое задание",
    "updated_by": "Recruiter"
  }
}`}
                        </pre>
                      </div>
                    </div>
                  )}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 text-right flex-shrink-0 select-text">
              <button 
                type="button"
                onClick={() => setIntegrationModalOpen(false)}
                className="px-5 py-2 text-sm font-medium text-white bg-slate-705 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {shareModalOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setShareModalOpen(false)}
        >
          <div 
            className={`${theme === 'dark' ? 'bg-[#111827] border-slate-[#111827]' : 'bg-white border-slate-200'} border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transition-all flex flex-col max-h-[90vh]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} flex justify-between items-center`}>
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'} flex items-center`}>
                <QrCode className="w-5 h-5 text-purple-500 mr-2" />
                Поделиться макетом
              </h3>
              <button onClick={() => setShareModalOpen(false)} className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] select-text">
              {/* Tabs */}
              <div className={`flex rounded-lg p-1 mb-5 ${theme === 'dark' ? 'bg-slate-950/60' : 'bg-slate-100'}`}>
                <button
                  onClick={() => setShareTab('current')}
                  className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    shareTab === 'current'
                      ? theme === 'dark' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-600 shadow-sm border border-slate-200/40'
                      : 'text-slate-400 hover:text-slate-650'
                  }`}
                >
                  Текущий адрес (Авто)
                </button>
                <button
                  onClick={() => setShareTab('preview')}
                  className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    shareTab === 'preview'
                      ? theme === 'dark' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-600 shadow-sm border border-slate-200/40'
                      : 'text-slate-400 hover:text-slate-650'
                  }`}
                >
                  Основной стенд
                </button>
                <button
                  onClick={() => setShareTab('dev')}
                  className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    shareTab === 'dev'
                      ? theme === 'dark' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-600 shadow-sm border border-slate-200/40'
                      : 'text-slate-400 hover:text-slate-650'
                  }`}
                >
                  Резервный сервер
                </button>
              </div>

              {/* Informative notice per tab */}
              <div className={`px-3 py-2 rounded-lg border mb-5 text-[11px] leading-relaxed ${
                theme === 'dark' ? 'bg-slate-900/50 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                {shareTab === 'current' && (
                  <span>🌎 <strong>Определено автоматически:</strong> Этот адрес ведёт прямо на текущую сборку сервиса. Идеально подходит для мгновенного доступа без дополнительных окон.</span>
                )}
                {shareTab === 'preview' && (
                  <span>🌐 <strong>Основной сетевой адрес:</strong> Стабильный глобальный URL для демонстрации выполненного проекта и проверки интерфейса во внешней сети.</span>
                )}
                {shareTab === 'dev' && (
                  <span>📡 <strong>Альтернативный хост:</strong> Дополнительная точка доступа для параллельной проверки стабильности и распределения нагрузки.</span>
                )}
              </div>

              {/* QR Image Frame */}
              <div className="flex flex-col items-center justify-center mb-5">
                <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white border-slate-800 shadow-inner' : 'bg-slate-50 border-slate-200'} flex items-center justify-center mb-3 relative overflow-hidden group`}>
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code"
                      className="w-44 h-44 block rounded-lg select-none"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center">
                      <span className="text-xs text-slate-400 font-mono">Генерация QR...</span>
                    </div>
                  )}
                </div>
                <p className={`text-center text-xs max-w-xs leading-relaxed mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Считайте код телефоном для комфортного теста адаптивности
                </p>

                <div className="flex space-x-2">
                  <button 
                    onClick={handleDownloadQR}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                    title="Скачать QR-код"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleShareToApp('telegram')}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${theme === 'dark' ? 'bg-slate-800 hover:bg-sky-900/50 text-sky-400' : 'bg-slate-100 hover:bg-sky-50 text-sky-600'}`}
                    title="Поделиться в Telegram"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleShareToApp('whatsapp')}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${theme === 'dark' ? 'bg-slate-800 hover:bg-emerald-900/50 text-emerald-400' : 'bg-slate-100 hover:bg-emerald-50 text-emerald-600'}`}
                    title="Поделиться в WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleShareToApp('email')}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                    title="Отправить по Email"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Copy URL Row */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  {shareTab === 'current' ? 'ТЕКУЩИЙ СЕТЕВОЙ АДРЕС' : shareTab === 'preview' ? 'АДРЕС ОСНОВНОГО СТЕНДА' : 'АДРЕС РЕЗЕРВНОГО СЕРВЕРА'}
                </label>
                <div className="flex space-x-2">
                  <div className={`flex-1 px-3.5 py-2.5 rounded-lg border font-mono text-[11px] truncate select-all ${
                    theme === 'dark' 
                      ? 'bg-slate-950/60 border-slate-850 text-emerald-400' 
                      : 'bg-slate-50 border-slate-200 text-emerald-700'
                  }`}>
                    {shareTab === 'current' 
                      ? (typeof window !== 'undefined' ? window.location.origin : '')
                      : shareTab === 'preview' 
                        ? 'https://hr-analyzer.production.ru' 
                        : 'https://hr-analyzer.dev.ru'}
                  </div>
                  <button
                    onClick={() => handleCopyLink(
                      shareTab === 'current'
                        ? (typeof window !== 'undefined' ? window.location.origin : '')
                        : shareTab === 'preview' 
                          ? 'https://hr-analyzer.production.ru' 
                          : 'https://hr-analyzer.dev.ru',
                      shareTab
                    )}
                    className={`px-4 rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-200 cursor-pointer ${
                      copiedLink === shareTab
                        ? 'bg-emerald-500 text-white'
                        : theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-750'
                    }`}
                  >
                    {copiedLink === shareTab ? (
                      <span className="flex items-center space-x-1">
                        <Check className="w-4 h-4" />
                        <span>Готово!</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1">
                        <Copy className="w-4 h-4" />
                        <span>Копировать</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'} text-right`}>
              <button 
                onClick={() => setShareModalOpen(false)}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-850'
                }`}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {dbSettingsModalOpen && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setDbSettingsModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transition-all duration-300 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40 flex-shrink-0 select-text">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Database className="w-5 h-5 text-blue-400 mr-2" />
                Настройки подключения СУБД
              </h3>
              <button 
                type="button"
                onClick={() => setDbSettingsModalOpen(false)} 
                className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-800/80"
                title="Закрыть (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveDbSettings} className="flex flex-col overflow-hidden select-text">
              <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)] scrollbar-thin scrollbar-thumb-slate-800">
                <div className="text-xs text-slate-400 leading-relaxed bg-blue-950/30 border border-blue-500/20 p-3 rounded-lg flex gap-2">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Настройка параметров подключения к СУБД проекта (MySQL). По умолчанию используется встроенная имитация базы данных.
                  </span>
                </div>

                {/* Скачивание SQL-дампа структуры */}
                <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-xl gap-2">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <FileDown className="w-4 h-4 text-purple-400" />
                      Инициализация БД (SQL)
                    </div>
                    <p className="text-[10px] text-slate-400">Скачайте готовую структуру таблиц и этапов для импорта в ваш XAMPP.</p>
                  </div>
                  <a
                    href="/api/analytics/export-sql"
                    download="hr_funnel_schema.sql"
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 font-medium flex items-center gap-1 transition-all cursor-pointer flex-shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    SQL-структура
                  </a>
                </div>

                {/* Профили подключения */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <History className="w-3 h-3 text-blue-400" />
                      Профили-закладки
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToOffline}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
                    >
                      Режим имитации (Offline)
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-1.5">
                    {dbProfiles.length === 0 ? (
                      <div className="text-[10px] text-slate-500 italic p-2 bg-slate-950/20 border border-dashed border-slate-800 rounded-lg text-center">
                        Здесь появятся ваши успешные подключения для быстрого переключения в 1 клик.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-1.5">
                        {dbProfiles.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleApplyProfile(p)}
                            className="group flex items-center justify-between p-2 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-blue-500/50 cursor-pointer transition-all"
                            title="Нажмите для автоматического подключения"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Database className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              <div className="text-left overflow-hidden">
                                <div className="text-[11px] font-medium text-slate-200 truncate">
                                  {p.database} <span className="text-slate-400 text-[10px]">({p.user}@{p.host}:{p.port})</span>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => deleteProfile(e, p.id)}
                              className="p-1 rounded hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Исключить профиль"
                            >
                              <Trash className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {dbConfigError && (
                  <div className="p-3 bg-red-950/45 border border-red-500/30 text-red-300 rounded-lg text-xs leading-normal flex items-start gap-2 animate-fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>{dbConfigError}</span>
                  </div>
                )}

                {dbConfigSuccess && (
                  <div className="p-3 bg-emerald-950/45 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs leading-normal flex items-start gap-2 animate-fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{dbConfigSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Хост (IP / Домен)</label>
                      {(() => {
                        const h = dbHost.trim().toLowerCase();
                        if (!h) return null;
                        if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(h) || h.endsWith('.local')) {
                          return <span className="text-[9px] font-medium text-amber-400 flex items-center gap-0.5 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20 leading-none">Нужен туннель</span>;
                        }
                        if (h.includes('ngrok') || h.includes('localtunnel') || h.includes('tunnel') || h.includes('lvh.me')) {
                          return <span className="text-[9px] font-medium text-emerald-400 flex items-center gap-0.5 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20 leading-none">Туннель активен</span>;
                        }
                        return <span className="text-[9px] font-medium text-blue-400 flex items-center gap-0.5 bg-blue-500/10 px-1 py-0.5 rounded border border-blue-500/20 leading-none">Внешний DNS</span>;
                      })()}
                    </div>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. mysql.example.com"
                      value={dbHost} 
                      onChange={(e) => handleHostInputChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Порт</label>
                    <input 
                      type="number" 
                      required
                      placeholder="3306"
                      value={dbPort} 
                      onChange={(e) => setDbPort(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Имя пользователя (User)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="root"
                    value={dbUser} 
                    onChange={(e) => setDbUser(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Пароль (Password)</label>
                  <input 
                    type="password" 
                    placeholder="Введите пароль подключения"
                    value={dbPassword} 
                    onChange={(e) => setDbPassword(e.target.value)}
                    className="w-full bg-[#090d16] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-650 outline-none"
                  />
                </div>

                 <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Имя базы данных (Database)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="hr_funnel_db"
                    value={dbNameInput} 
                    onChange={(e) => setDbNameInput(e.target.value)}
                    className="w-full bg-[#090d16] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none"
                  />
                </div>

                {/* Автоматическое тестирование сетевых маршрутов (Ping/Healthcheck) */}
                {(() => {
                  const isLocal = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(dbHost.trim().toLowerCase()) || dbHost.trim().toLowerCase().endsWith('.local');
                  if (!isLocal) return null;
                  return (
                    <div className="p-3.5 bg-amber-950/45 border border-amber-500/30 rounded-xl space-y-2.5 text-xs animate-fade-in">
                      <div className="flex items-center gap-2 text-amber-400 font-medium pb-2 border-b border-amber-500/10">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>Автодиагностика маршрута: Localhost</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        Введен локальный хост. Облачный контейнер не имеет прямого сетевого пути к вашему <code>localhost</code>. Потребуется запустить внешний туннель для проброса порта <code>{dbPort || '3306'}</code>.
                      </p>
                      <div className="space-y-2">
                        <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Запустите в терминале:</div>
                        
                        <div className="space-y-2 col-span-1">
                          {/* Ngrok option */}
                          <div className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-850 gap-2">
                            <span className="font-mono text-[10px] text-emerald-400 overflow-x-auto whitespace-nowrap scrollbar-none">ngrok tcp {dbPort || '3306'}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCommand(`ngrok tcp ${dbPort || '3306'}`, 'ngrok')}
                              className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-705 border border-slate-700 px-2 py-1 rounded transition-colors cursor-pointer flex-shrink-0"
                            >
                              {copiedTunnelCmd === 'ngrok' ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Готово!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Копировать</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Localtunnel option */}
                          <div className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-850 gap-2">
                            <span className="font-mono text-[10px] text-emerald-400 overflow-x-auto whitespace-nowrap scrollbar-none">npx localtunnel --port {dbPort || '3306'}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCommand(`npx localtunnel --port ${dbPort || '3306'}`, 'lt')}
                              className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-705 border border-slate-700 px-2 py-1 rounded transition-colors cursor-pointer flex-shrink-0"
                            >
                              {copiedTunnelCmd === 'lt' ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Готово!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Копировать</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 leading-normal pt-1 flex items-start gap-1">
                          <Info className="w-3 h-3 text-amber-500/80 flex-shrink-0 mt-0.5" />
                          <span>
                            После запуска скопируйте полученный хост (например, <code>0.tcp.ngrok.io</code>) и порт в форму выше.
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer (Sticky) */}
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-2.5 flex-shrink-0 select-text">
                <button 
                  type="button"
                  onClick={() => setDbSettingsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  disabled={isTestingConnection}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isTestingConnection ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Проверка связи...
                    </>
                  ) : (
                    'Проверить и сохранить'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dbNotification && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 transition-all animate-fade-in ${
          dbNotification.type === 'success' 
            ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300' 
            : 'bg-red-950/50 border-red-500/30 text-red-300'
        }`}>
          {dbNotification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-medium">{dbNotification.message}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:grid-cols-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm transition-all hover:bg-slate-900 print:bg-gray-50 print:border-gray-200">
          <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-3 font-mono print:text-gray-500">ВСЕГО ОТКЛИКОВ</div>
          <div className="text-4xl font-semibold text-white tracking-tight print:text-black">
            {loading ? <span className="opacity-50">...</span> : totalApplicants}
          </div>
          <div className="mt-3 text-sm text-slate-500 flex items-center print:text-gray-600">
            <Users className="w-4 h-4 mr-2" />
            кандидатов в воронке
          </div>
        </div>
        
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm transition-all hover:bg-slate-900 print:bg-gray-50 print:border-gray-200">
          <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-3 font-mono print:text-gray-500">НА ЭТАПЕ ОФФЕРА</div>
          <div className="text-4xl font-semibold text-purple-400 tracking-tight">
            {loading ? <span className="opacity-50 text-slate-600">...</span> : hiredCount}
          </div>
          <div className="mt-3 text-sm text-purple-400/60 flex items-center print:text-purple-600">
            <span className="w-2 h-2 rounded-full bg-purple-500 mr-2 animate-pulse print:hidden"></span>
            кандидат
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm transition-all hover:bg-slate-900 print:bg-gray-50 print:border-gray-200 flex flex-col justify-between">
          <div>
            <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-3 font-mono print:text-gray-500">БАЗА ДАННЫХ XAMPP</div>
            <div className={`text-2xl font-semibold tracking-tight flex items-center gap-2 ${dbStatus.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-3 h-3 rounded-full ${dbStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              {dbStatus.connected ? 'XAMPP MySQL' : 'Имитация (Offline)'}
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono">
              {dbStatus.connected ? 'Режим: АКТИВНА (ВКР база)' : 'Режим: ИМИТАЦИЯ (БД OFFLINE)'}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2 print:hidden">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">VKR-DB-GATEWAY</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setDbSettingsModalOpen(true)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 bg-slate-900 text-slate-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Настройки подключения к MySQL"
              >
                <Database className="w-3 h-3 text-blue-400" />
                Настроить БД
              </button>
              <button 
                disabled={isImporting}
                onClick={handleImportDatabase}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isImporting 
                    ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-purple-600/10 hover:bg-purple-600/20 border-purple-500/30 text-purple-300'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isImporting ? 'animate-spin' : ''}`} />
                {isImporting ? 'Импорт...' : 'Импортировать СУБД'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Analytical Insights Panel */}
      <div className={`mb-10 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 ${exportConfig.includeInsights ? '' : 'print:hidden'}`}>
        <div className="flex items-center mb-4">
          <Activity className="w-5 h-5 text-blue-400 mr-2" />
          <h3 className="text-sm font-medium text-slate-200">Автоматический анализ отклонений</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
             <div className="col-span-full py-4 text-center text-slate-500 text-sm">Система анализирует воронку...</div>
          ) : insights.length > 0 ? (
            insights.map((insight, idx) => (
              <div key={idx} className={`p-4 rounded-xl border ${insight.color}`}>
                <div className="flex items-start">
                  {insight.icon}
                  <div>
                    <h4 className="text-sm font-semibold mb-1 w-full">{insight.title}</h4>
                    <p className="text-xs leading-relaxed opacity-90">{insight.text}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
             <div className="col-span-full py-4 text-center text-slate-500 text-sm">Недостаточно данных для анализа</div>
          )}
        </div>
      </div>

      {/* Charts Area View Toggle */}
      <div className="flex justify-end mb-4 print:hidden">
        <div className="bg-slate-900/60 p-1 rounded-lg border border-slate-800 flex items-center">
          <button 
            onClick={() => setChartType('recharts')} 
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${chartType === 'recharts' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Воронка (Recharts)
          </button>
          <button 
            onClick={() => setChartType('chartjs')} 
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${chartType === 'chartjs' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Линейный (Chart.js)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8 print:break-inside-avoid">
        {/* Funnel Chart */}
        <div className={`bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl print:bg-white print:border-none print:shadow-none ${exportConfig.includeFunnel ? '' : 'print:hidden'}`}>
          <div className="flex items-center justify-between mb-8">
            <div className="text-sm font-medium text-slate-300 flex items-center print:text-black">
              <Filter className="w-4 h-4 mr-2.5 text-purple-400 print:hidden" />
              Данные воронки найма (СУБД MySQL)
            </div>
          </div>
          <div className="h-[420px] w-full">
            {loading ? (
              <div className="w-full h-full flex justify-center items-center opacity-50">
                <Activity className="animate-spin text-purple-500 w-8 h-8" />
              </div>
            ) : chartType === 'chartjs' ? (
              <Bar 
                options={{
                  indexAxis: 'y' as const,
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  onHover: (event, chartElement) => {
                    if (event.native && event.native.target) {
                      (event.native.target as HTMLElement).style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                  },
                  onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                      const index = elements[0].index;
                      const stage = funnelData[index].stage;
                      setSelectedStageFilter(prev => stage === prev ? null : stage);
                    }
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: { label: (ctx) => ` ${ctx.parsed.x} кандидатов` }
                    }
                  },
                  scales: {
                    x: { grid: { color: theme === 'dark' ? '#1e293b' : '#e2e8f0' }, ticks: { color: theme === 'dark' ? '#94a3b8' : '#475569' } },
                    y: { grid: { display: false }, ticks: { color: theme === 'dark' ? '#94a3b8' : '#475569' } }
                  }
                }}
                data={{
                  labels: funnelData.map(d => d.stage),
                  datasets: [{
                    label: 'Кандидатов',
                    data: funnelData.map(d => d.count),
                    backgroundColor: funnelData.map((d, i) => {
                      const baseColor = COLORS[i % COLORS.length];
                      if (!selectedStageFilter) return baseColor;
                      return d.stage === selectedStageFilter ? baseColor : `${baseColor}40`;
                    }),
                    borderRadius: 4,
                  }]
                }} 
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <RechartsTooltip
                    cursor={{fill: 'transparent'}}
                    contentStyle={theme === 'dark' ? 
                      { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' } : 
                      { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }
                    }
                    itemStyle={{ color: theme === 'dark' ? '#fff' : '#0f172a', fontWeight: 500 }}
                    formatter={(value: number) => [value, "Кандидатов"]}
                  />
                  <Funnel
                    dataKey="count"
                    data={funnelData}
                    nameKey="stage"
                    isAnimationActive
                    stroke={theme === 'dark' ? '#0b0f19' : '#ffffff'}
                    strokeWidth={2}
                  >
                    <LabelList 
                      position="right" 
                      fill={theme === 'dark' ? '#94a3b8' : '#334155'} 
                      stroke="none" 
                      dataKey="stage" 
                      fontSize={12}
                      offset={20}
                    />
                    {funnelData.map((entry, index) => (
                      <RechartsCell 
                        key={'cell-' + index} 
                        fill={COLORS[index % COLORS.length]} 
                        className={`transition-opacity dt-cell print:opacity-100 cursor-pointer ${selectedStageFilter === entry.stage ? 'opacity-100 stroke-2 stroke-white' : (selectedStageFilter ? 'opacity-40' : 'opacity-90 hover:opacity-100')}`} 
                        onClick={() => setSelectedStageFilter(entry.stage === selectedStageFilter ? null : entry.stage)}
                      />
                    ))}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Delays Chart */}
        <div className={`bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl print:bg-white print:border-none print:shadow-none ${exportConfig.includeDelays ? '' : 'print:hidden'}`}>
          <div className="flex items-center justify-between mb-8">
            <div className="text-sm font-medium text-slate-300 flex items-center print:text-black">
              <Activity className="w-4 h-4 mr-2.5 text-blue-400 print:hidden" />
              Аналитика временных задержек по этапам (в днях)
            </div>
          </div>
          <div className="h-[420px] w-full pb-6">
            {loading ? (
              <div className="w-full h-full flex justify-center items-center opacity-50">
                <Activity className="animate-spin text-blue-500 w-8 h-8" />
              </div>
            ) : chartType === 'chartjs' ? (
              <Bar 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  onHover: (event, chartElement) => {
                    if (event.native && event.native.target) {
                      (event.native.target as HTMLElement).style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                  },
                  onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                      const index = elements[0].index;
                      const stage = delaysData[index].stage;
                      setSelectedStageFilter(prev => stage === prev ? null : stage);
                    }
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: { label: (ctx) => ` ${ctx.parsed.y} дней` }
                    },
                    annotation: {
                      annotations: {
                        line1: {
                          type: 'line',
                          yMin: slaThreshold,
                          yMax: slaThreshold,
                          borderColor: '#ef4444',
                          borderWidth: 2,
                          borderDash: [5, 5],
                          label: {
                            display: true,
                            content: `Норматив SLA (${slaThreshold} дн.)`,
                            position: 'end',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            font: { size: 11 }
                          }
                        }
                      }
                    }
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: theme === 'dark' ? '#94a3b8' : '#475569', maxRotation: 45, minRotation: 45 } },
                    y: { grid: { color: theme === 'dark' ? '#1e293b' : '#e2e8f0' }, ticks: { color: theme === 'dark' ? '#94a3b8' : '#475569' } }
                  }
                }}
                data={{
                  labels: delaysData.map(d => d.stage),
                  datasets: [{
                    label: 'Дней',
                    data: delaysData.map(d => d.avg_days),
                    backgroundColor: delaysData.map(d => {
                      const defaultColor = d.avg_days > slaThreshold ? '#ef4444' : '#3b82f6';
                      if (!selectedStageFilter) return defaultColor;
                      return d.stage === selectedStageFilter ? defaultColor : `${defaultColor}40`;
                    }),
                    borderRadius: 4,
                  }]
                }}
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={delaysData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} vertical={false} />
                  <XAxis 
                    dataKey="stage" 
                    stroke="#475569" 
                    tick={{ fill: theme === 'dark' ? '#94a3b8' : '#475569', fontSize: 11 }} 
                    angle={-35} 
                    textAnchor="end" 
                    interval={0}
                    tickMargin={10}
                  />
                  <YAxis stroke="#475569" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#475569', fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip
                    cursor={{ fill: theme === 'dark' ? '#1e293b' : '#cbd5e1', opacity: 0.5 }}
                    contentStyle={theme === 'dark' ? 
                      { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' } : 
                      { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }
                    }
                    formatter={(value: number) => [value + ' дней', "Ср. время"]}
                  />
                  <RechartsRefLine 
                    y={slaThreshold} 
                    label={{ position: 'top', value: `Норматив SLA (${slaThreshold} дн.)`, fill: '#ef4444', fontSize: 11, fontWeight: 500 }} 
                    stroke="#ef4444" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    opacity={0.8}
                  />
                  <RechartsBar 
                    dataKey="avg_days" 
                    name="Ср. время" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                    animationBegin={200}
                  >
                    {delaysData.map((entry, index) => (
                      <RechartsCell 
                        key={'delay-cell-' + index} 
                        fill={entry.avg_days > slaThreshold ? '#ef4444' : '#3b82f6'} 
                        className={`transition-all duration-300 print:opacity-100 cursor-pointer ${selectedStageFilter === entry.stage ? 'opacity-100 stroke-2 stroke-white' : (selectedStageFilter ? 'opacity-40' : 'opacity-90 hover:opacity-100')}`} 
                        onClick={() => setSelectedStageFilter(entry.stage === selectedStageFilter ? null : entry.stage)}
                      />
                    ))}
                  </RechartsBar>
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Data Grid Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl print:bg-white print:border-gray-200 print:shadow-none print:break-inside-avoid">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center print:border-gray-200">
          <FileDown className="w-5 h-5 mr-3 text-emerald-400 print:hidden" />
          <h2 className="text-lg font-medium text-slate-100 print:text-black">Детализация воронки (Drill-down)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-800/40 print:bg-gray-100 print:text-gray-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Этап отбора</th>
                <th className="px-6 py-4 font-semibold text-right">Кандидатов</th>
                <th className="px-6 py-4 font-semibold text-right">Отсев</th>
                <th className="px-6 py-4 font-semibold text-right">Конверсия этапа</th>
                <th className="px-6 py-4 font-semibold text-right">Ср. время (дни)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 print:divide-gray-200">
              {detailedData.map((row, i) => (
                <tr 
                  key={'tr-' + i} 
                  onClick={() => setSelectedStageFilter(row.stage === selectedStageFilter ? null : row.stage)}
                  className={`transition-colors print:text-black cursor-pointer ${selectedStageFilter === row.stage ? 'bg-purple-600/20' : 'hover:bg-slate-800/40'}`}
                >
                  <td className="px-6 py-4 font-medium text-slate-200 print:text-black flex items-center gap-2">
                    {row.sort}. {row.stage}
                    {selectedStageFilter === row.stage && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">{row.count}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-400">
                    {i === 0 ? '-' : "-" + row.dropoff}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    <span className={"inline-flex items-center " + (i === 0 ? 'text-slate-400' : 'text-emerald-400')}>
                      {i === 0 ? '-' : row.conversion + '%'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    {row.avg_days > 0 ? (
                      <span className={row.avg_days > slaThreshold ? "text-red-400 font-semibold" : "text-blue-400"}>
                        {row.avg_days}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}






                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidates Log Table */}
      <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl print:bg-white print:border-gray-200 print:shadow-none print:break-inside-avoid">
        <div className="px-6 py-5 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:border-gray-200">
          <div className="flex items-center flex-wrap gap-3">
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-3 text-blue-400 print:hidden" />
              <h2 className="text-lg font-medium text-slate-100 print:text-black">Журнал учета: Движение кандидатов</h2>
            </div>
            {selectedStageFilter && (
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-xs font-medium print:hidden">
                <span>Фильтр этапа: {selectedStageFilter}</span>
                <button 
                  onClick={() => setSelectedStageFilter(null)}
                  className="hover:bg-purple-500/20 rounded-full p-0.5 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {selectedCandidateIds.length > 0 && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full print:hidden">
                <span className="text-xs font-medium text-amber-500">Выбрано: {selectedCandidateIds.length}</span>
                <div className="h-3 w-px bg-amber-500/30 mx-1"></div>
                <button 
                  onClick={handleBulkAdvance}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors mx-1 cursor-pointer flex items-center"
                  title="Перевести всех на следующий этап"
                >
                  <ArrowUp className="w-3 h-3 mr-1" />
                  Продвинуть
                </button>
                <button 
                  onClick={handleBulkDelete}
                  className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors mx-1 cursor-pointer flex items-center"
                  title="Удалить выбранных из базы"
                >
                  <Trash className="w-3 h-3 mr-1" />
                  Удалить
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64 print:hidden">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
              <input 
                type="text"
                placeholder="Поиск по имени или вакансии..."
                className="bg-slate-900 border border-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2 text-slate-200 outline-none transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <button 
              onClick={() => setShowAddCandidateModal(true)}
              className="flex items-center justify-center space-x-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-550 active:bg-purple-700 transition-colors px-3.5 py-2 rounded-lg cursor-pointer print:hidden flex-shrink-0 shadow-lg shadow-purple-600/15"
              title="Добавить нового кандидата в воронку"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить кандидата</span>
            </button>

            <button 
              onClick={fetchAnalytics}
              disabled={loading}
              className="flex items-center justify-center space-x-2 text-xs font-medium text-blue-100 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 transition-colors px-3 py-2 rounded-lg disabled:opacity-50 print:hidden flex-shrink-0 cursor-pointer"
              title="Обновить данные"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline-block">Синхронизация</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {/* SCREEN ONLY PAGINATED TABLE */}
          <table className="w-full text-sm text-left print:hidden">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-800/40">
              <tr>
                <th className="px-4 py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-purple-600 focus:ring-purple-600"
                    checked={paginatedCandidates.length > 0 && selectedCandidateIds.length === paginatedCandidates.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th 
                  className={`px-3 py-4 font-semibold cursor-pointer select-none transition-colors group ${theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-slate-200/60'}`}
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1.5 justify-start">
                    <span>ФИО Кандидата</span>
                    <span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-400" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 font-semibold hidden lg:table-cell">Телефон</th>
                <th className="px-6 py-4 font-semibold hidden lg:table-cell">Источник</th>
                <th 
                  className={`px-6 py-4 font-semibold cursor-pointer select-none transition-colors group ${theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-slate-200/60'}`}
                  onClick={() => handleSort('vacancy')}
                >
                  <div className="flex items-center space-x-1.5 justify-start">
                    <span>Вакансия</span>
                    <span>
                      {sortField === 'vacancy' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-400" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  className={`px-6 py-4 font-semibold cursor-pointer select-none transition-colors group ${theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-slate-200/60'}`}
                  onClick={() => handleSort('stage')}
                >
                  <div className="flex items-center space-x-1.5 justify-start">
                    <span>Текущий этап</span>
                    <span>
                      {sortField === 'stage' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-400" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 font-semibold text-right">Действие (Логирование)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedCandidates.map((row, i) => (
                <tr key={'cand-' + i} className={`hover:bg-slate-800/20 transition-colors ${selectedCandidateIds.includes(row.id) ? 'bg-slate-800/40' : ''}`}>
                  <td className="px-4 py-4 w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-purple-600 focus:ring-purple-600 cursor-pointer"
                      checked={selectedCandidateIds.includes(row.id)}
                      onChange={() => handleSelectOne(row.id)}
                    />
                  </td>
                  <td className="px-3 py-4 font-medium text-slate-200">{row.name}</td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs hidden lg:table-cell">{row.phone || '+7 (999) 123-45-67'}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs hidden lg:table-cell">{row.source || 'HeadHunter'}</td>
                  <td className="px-6 py-4 text-slate-400">{row.vacancy}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${row.stageColor}`}>
                      {row.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-3">
                      {row.stageId < 7 ? (
                        <button 
                          onClick={() => handleMoveCandidate(row.id, row.stageId)}
                          className="text-xs px-2.5 py-1 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-semibold hover:text-blue-300 transition-colors cursor-pointer border border-blue-500/10"
                        >
                          {row.action}
                        </button>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded bg-emerald-600/15 text-emerald-400 font-semibold border border-emerald-500/10 select-none">
                          Оффер принят
                        </span>
                      )}
                      
                      <button 
                        onClick={() => handleDeleteCandidate(row.id)}
                        className="p-1.5 hover:bg-red-500/15 text-slate-500 hover:text-red-400 rounded-md transition-colors cursor-pointer"
                        title="Удалить кандидата из воронки"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PRINT-ONLY COMPLETE TABLE (All candidates, no pagination, optimized look) */}
          <table className="w-full text-sm text-left hidden print:table text-black">
            <thead className="bg-gray-100 text-gray-700 text-[11px] uppercase tracking-wider border-b border-gray-300">
              <tr>
                <th className="px-6 py-3 font-semibold text-left">ФИО Кандидата</th>
                <th className="px-6 py-3 font-semibold text-left">Телефон</th>
                <th className="px-6 py-3 font-semibold text-left">Источник сорсинга</th>
                <th className="px-6 py-3 font-semibold text-left">Вакансия</th>
                <th className="px-6 py-3 font-semibold text-left">Текущий этап воронки</th>
                <th className="px-6 py-3 font-semibold text-right">Дата перехода</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCandidates.map((row, i) => (
                <tr key={'cand-print-' + i} className="text-gray-900 border-b border-gray-200">
                  <td className="px-6 py-3.5 font-semibold text-slate-900">{row.name}</td>
                  <td className="px-6 py-3.5 font-mono text-xs text-gray-700">{row.phone || '+7 (999) 123-45-67'}</td>
                  <td className="px-6 py-3.5 text-xs text-gray-700">{row.source || 'HeadHunter'}</td>
                  <td className="px-6 py-3.5 text-gray-800">{row.vacancy}</td>
                  <td className="px-6 py-3.5 font-semibold text-purple-700">{row.stage}</td>
                  <td className="px-6 py-3.5 font-mono text-slate-500 text-right text-xs">
                    {row.date ? new Date(row.date).toLocaleDateString('ru-RU') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCandidates.length === 0 && (
            <div className="py-8 text-center text-slate-500 text-sm">
              Нет кандидатов, соответствующих критериям поиска "{searchTerm}"
            </div>
          )}
          {filteredCandidates.length > candidatesPage * candidatesItemsPerPage && (
            <div className="px-6 py-4 border-t border-slate-800 text-center print:hidden">
              <button 
                onClick={() => setCandidatesPage(p => p + 1)}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors border border-blue-500/30 px-4 py-2 rounded-lg"
              >
                Показать еще ({(filteredCandidates.length - candidatesPage * candidatesItemsPerPage)} шт.)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}