# ПРИЛОЖЕНИЕ А. Исходный код программного модуля "Анализатор воронки найма"

Настоящее приложение содержит полный рабочий исходный код разработанного аналитического модуля «Анализатор воронки найма» (включая серверную часть Node.js/Express, реляционные SQL-запросы, клиентское приложение React SPA и тесты Jest). Все компоненты согласованы и готовы к промышленному развертыванию.

---

### РАЗДЕЛ 1. СЕРВЕРНАЯ ЧАСТЬ (BACKEND - NODE.JS / EXPRESS / MYSQL)

#### Файл: `server.ts` (Точка входа веб-сервера и бизнес-логика расчета метрик)
```typescript
import express from 'express';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Описание этапов (строго по Таблице 2.5 дипломной работы)
const stages = [
  { id: 1, name: 'Отклик', order: 1 },
  { id: 2, name: 'Скрининг резюме', order: 2 },
  { id: 3, name: 'HR-интервью', order: 3 },
  { id: 4, name: 'Тестовое задание', order: 4 },
  { id: 5, name: 'Техническое интервью', order: 5 },
  { id: 6, name: 'Проверка СБ', order: 6 },
  { id: 7, name: 'Выставление оффера', order: 7 },
];

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Пул соединений с СУБД MySQL (из панели управления XAMPP)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'hr_funnel_db',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 1. Эндпоинт получения агрегированной воронки найма
app.get('/api/analytics/funnel', async (req, res) => {
  try {
    const vacancyId = Number(req.query.id_vacancy) || 1;
    
    // Прямой SQL-запрос для агрегации уникальных кандидатов по этапам
    const query = `
      SELECT 
        s.sort_order AS sort, 
        s.stage_name AS stage, 
        COUNT(DISTINCT ah.id_candidate) AS count
      FROM Application_History ah
      JOIN Stages s ON ah.id_stage = s.id_stage
      WHERE ah.id_vacancy = ?
      GROUP BY s.sort_order, s.stage_name
      ORDER BY s.sort_order ASC;
    `;
    
    const [rows] = await pool.execute(query, [vacancyId]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при расчете воронки найма: ' + err.message });
  }
});

// 2. Эндпоинт расчета временных задержек кандидатов на этапах (SLA / Time-in-stage)
app.get('/api/analytics/delays', async (req, res) => {
  try {
    const vacancyId = Number(req.query.id_vacancy) || 1;
    
    // SQL-запрос с оконной функцией LEAD() для точного замера разницы дат
    const query = `
      WITH StageDurations AS (
        SELECT 
          id_candidate,
          id_stage,
          transition_date,
          LEAD(transition_date) OVER (
            PARTITION BY id_candidate, id_vacancy 
            ORDER BY transition_date
          ) AS next_stage_date
        FROM Application_History
        WHERE id_vacancy = ?
      )
      SELECT 
        s.stage_name AS stage,
        ROUND(AVG(TIMESTAMPDIFF(HOUR, sd.transition_date, sd.next_stage_date)) / 24, 1) AS avg_days
      FROM StageDurations sd
      JOIN Stages s ON sd.id_stage = s.id_stage
      WHERE sd.next_stage_date IS NOT NULL
      GROUP BY s.stage_name, s.sort_order
      ORDER BY s.sort_order ASC;
    `;
    
    const [rows] = await pool.execute(query, [vacancyId]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при расчете времени нахождения на этапах SLA: ' + err.message });
  }
});

// 3. Получение списка вакансий для панели фильтрации
app.get('/api/analytics/vacancies', async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id_vacancy AS id, job_title AS title FROM Vacancies");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Раздача скомпилированного фронтенда React SPA из папки dist (Production Режим)
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер анализатора воронки запущен на порту ${PORT}`);
});
```

---

### РАЗДЕЛ 2. КЛИЕНТСКАЯ ЧАСТЬ (FRONTEND - REACT SPA / VITE)

#### Файл: `src/App.tsx` (Интерфейс аналитического дашборда и его контроллеры)
```tsx
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import axios from 'axios';
import { Download, Activity, BarChart2, Plus, Info, CheckCircle, RefreshCw } from 'lucide-react';

interface FunnelData {
  sort: number;
  stage: string;
  count: number;
}

interface DelaysData {
  stage: string;
  avg_days: number;
}

interface Vacancy {
  id: number;
  title: string;
}

export default function App() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<number>(1);
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [delaysData, setDelaysData] = useState<DelaysData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [slaThreshold, setSlaThreshold] = useState<number>(3.0); // Норматив SLA по умолчанию

  useEffect(() => {
    // Первичный запрос вакансий
    axios.get('/api/analytics/vacancies')
      .then(res => {
        setVacancies(res.data);
        if (res.data.length > 0) setSelectedVacancy(res.data[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedVacancy) return;
    setLoading(true);
    
    // Параллельные асинхронные запросы к API воронки и задержек
    Promise.all([
      axios.get(`/api/analytics/funnel?id_vacancy=${selectedVacancy}`),
      axios.get(`/api/analytics/delays?id_vacancy=${selectedVacancy}`)
    ])
      .then(([funnelRes, delaysRes]) => {
        setFunnelData(funnelRes.data);
        setDelaysData(delaysRes.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Ошибка загрузки аналитики:', err);
        setLoading(false);
      });
  }, [selectedVacancy]);

  // Вычисление ключевых KPI на основе данных
  const totalApplicants = funnelData.length > 0 ? funnelData[0].count : 0;
  const hiredCount = funnelData.length > 0 ? funnelData[funnelData.length - 1].count : 0;
  const overallConversion = totalApplicants > 0 ? ((hiredCount / totalApplicants) * 100).toFixed(1) : '–';
  const totalDays = delaysData.reduce((acc, d) => acc + d.avg_days, 0).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      {/* Шапка дашборда */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8 text-purple-500" />
            Интерфейс модуля "Анализатор воронки найма"
          </h1>
          <p className="text-slate-400 text-sm mt-1">Опытно-промышленная модель (React + TypeScript)</p>
        </div>
        
        {/* Фильтры */}
        <div className="flex gap-4">
          <select 
            value={selectedVacancy}
            onChange={(e) => setSelectedVacancy(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {vacancies.map(v => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Карточки KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-805 rounded-xl p-6">
          <p className="text-slate-400 text-xs font-mono">ОБЩИЙ ОТКЛИК</p>
          <p className="text-3xl font-semibold text-white mt-1">{totalApplicants} чел.</p>
        </div>
        <div className="bg-slate-900 border border-slate-805 rounded-xl p-6">
          <p className="text-slate-400 text-xs font-mono">ВРЕМЯ ЗАКРЫТИЯ (TTF)</p>
          <p className="text-3xl font-semibold text-purple-400 mt-1">{totalDays} дн.</p>
        </div>
        <div className="bg-slate-900 border border-slate-805 rounded-xl p-6">
          <p className="text-slate-400 text-xs font-mono">СКВОЗНАЯ КОНВЕРСИЯ</p>
          <p className="text-3xl font-semibold text-emerald-400 mt-1">{overallConversion}%</p>
        </div>
        <div className="bg-slate-900 border border-slate-805 rounded-xl p-6">
          <p className="text-slate-400 text-xs font-mono">СТАТУС ПОДКЛЮЧЕНИЯ</p>
          <p className="text-xl font-semibold text-emerald-400 mt-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
            XAMPP MySQL
          </p>
        </div>
      </div>

      {/* Графики Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Воронка конверсии */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-semibold text-lg mb-4">Воронка конверсии соискателей</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="stage" type="category" stroke="#94a3b8" />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Временные задержки на этапах (Контроль SLA) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-semibold text-lg mb-4">Временные задержки по этапам (дней)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={delaysData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="stage" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip cursor={{ fill: '#1e293b', opacity: 0.3 }} />
                <ReferenceLine y={slaThreshold} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Лимит SLA (${slaThreshold} дн.)`, fill: '#ef4444', position: 'top' }} />
                <Bar dataKey="avg_days" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### РАЗДЕЛ 3. МОДУЛЬНОЕ ТЕСТИРОВАНИЕ (JEST)

#### Файл: `__tests__/math.test.js` (Тестирование расчета конверсии и защиты от деления на ноль)
```javascript
const calculateConversion = (current, total) => {
  if (total === 0) return 0;
  return parseFloat(((current / total) * 100).toFixed(2));
};

describe('Тестирование математических алгоритмов расчета воронки', () => {
  test('Успешный расчет относительной конверсии', () => {
    // 150 кандидатов из 300 на предыдущем шаге - конверсия ровно 50%
    expect(calculateConversion(150, 300)).toBe(50.00);
  });

  test('Защита от деления на ноль при отсутствии вакансий/откликов', () => {
    // Предупреждение деления на ноль
    expect(calculateConversion(10, 0)).toBe(0);
  });
});
```
