import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { createServer as createViteServer } from 'vite';
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

const appHistoryFallback: any[] = [];
const candidatesFallback: any[] = [];
const vacanciesListFallback = [
  { id: 1, title: 'Senior React Developer' },
  { id: 2, title: 'Java Backend Developer' },
  { id: 3, title: 'UI/UX Designer' },
  { id: 4, title: 'Data Scientist' },
  { id: 5, title: 'Product Manager' },
  { id: 6, title: 'DevOps Engineer' },
  { id: 7, title: 'QA Automation Engineer' },
  { id: 8, title: 'HR Manager' }
];

let useRealMySQL = false;

// Текущие конфигурации подключения к СУБД
let currentDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', 
  database: process.env.DB_DATABASE || 'hr_funnel_db',
  port: Number(process.env.DB_PORT) || 3306,
};

// Подключение к MySQL
let pool = mysql.createPool({
  ...currentDbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Проверка связи и создание структуры таблиц ВКР
async function checkAndInitDatabase(forceRebuild = false) {
  try {
    const connection = await pool.getConnection();
    console.log("MySQL подключен!");
    useRealMySQL = true;

    if (forceRebuild) {
      console.log("Запущен принудительный сброс и импорт структуры БД...");
      await connection.query("SET FOREIGN_KEY_CHECKS = 0;");
      await connection.query("DROP TABLE IF EXISTS Application_History;");
      await connection.query("DROP TABLE IF EXISTS Candidates;");
      await connection.query("DROP TABLE IF EXISTS Vacancies;");
      await connection.query("DROP TABLE IF EXISTS Recruiters;");
      await connection.query("DROP TABLE IF EXISTS Stages;");
      await connection.query("SET FOREIGN_KEY_CHECKS = 1;");
    }

    // 1. Таблица Этапов
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Stages (
        id_stage INT PRIMARY KEY,
        stage_name VARCHAR(100) NOT NULL,
        sort_order INT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Заполнение этапов
    const [stagesRows]: any = await connection.query("SELECT COUNT(*) as count FROM Stages");
    if (stagesRows[0].count === 0) {
      for (const s of stages) {
        await connection.query("INSERT INTO Stages (id_stage, stage_name, sort_order) VALUES (?, ?, ?)", [s.id, s.name, s.order]);
      }
    }

    // 2. Таблица Рекрутеров
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Recruiters (
        id_recruiter INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        is_active TINYINT DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [recRows]: any = await connection.query("SELECT COUNT(*) as count FROM Recruiters");
    if (recRows[0].count === 0) {
      await connection.query("INSERT INTO Recruiters (id_recruiter, full_name, email) VALUES (1, 'Герасимов В.В.', 'gerasimov@pvguti.ru')");
    }

    // 3. Таблица Вакансий
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Vacancies (
        id_vacancy INT AUTO_INCREMENT PRIMARY KEY,
        id_recruiter INT NOT NULL,
        job_title VARCHAR(255) NOT NULL,
        open_date DATETIME NOT NULL,
        close_date DATETIME NULL,
        status VARCHAR(50) DEFAULT 'В работе',
        FOREIGN KEY (id_recruiter) REFERENCES Recruiters(id_recruiter) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [vacRows]: any = await connection.query("SELECT COUNT(*) as count FROM Vacancies");
    if (vacRows[0].count === 0) {
      await connection.query("INSERT INTO Vacancies (id_vacancy, id_recruiter, job_title, open_date) VALUES (1, 1, 'Senior React Developer', NOW())");
      await connection.query("INSERT INTO Vacancies (id_vacancy, id_recruiter, job_title, open_date) VALUES (2, 1, 'Java Backend Developer', NOW())");
      await connection.query("INSERT INTO Vacancies (id_vacancy, id_recruiter, job_title, open_date) VALUES (3, 1, 'UI/UX Designer', NOW())");
      await connection.query("INSERT INTO Vacancies (id_vacancy, id_recruiter, job_title, open_date) VALUES (4, 1, 'Data Scientist', NOW())");
      await connection.query("INSERT INTO Vacancies (id_vacancy, id_recruiter, job_title, open_date) VALUES (5, 1, 'Product Manager', NOW())");
      await connection.query("INSERT INTO Vacancies (id_vacancy, id_recruiter, job_title, open_date) VALUES (6, 1, 'DevOps Engineer', NOW())");
      await connection.query("INSERT INTO Vacancies (id_vacancy, id_recruiter, job_title, open_date) VALUES (7, 1, 'QA Automation Engineer', NOW())");
      await connection.query("INSERT INTO Vacancies (id_vacancy, id_recruiter, job_title, open_date) VALUES (8, 1, 'HR Manager', NOW())");
    }

    // 4. Таблица Кандидатов
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Candidates (
        id_candidate INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        source VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Таблица Событий (История)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Application_History (
        id_history INT AUTO_INCREMENT PRIMARY KEY,
        id_candidate INT NOT NULL,
        id_vacancy INT NOT NULL,
        id_stage INT NOT NULL,
        transition_date DATETIME NOT NULL,
        status VARCHAR(50) DEFAULT 'В процессе',
        FOREIGN KEY (id_stage) REFERENCES Stages(id_stage) ON DELETE CASCADE,
        FOREIGN KEY (id_vacancy) REFERENCES Vacancies(id_vacancy) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Заполнение логов
    const [historyRows]: any = await connection.query("SELECT COUNT(*) as count FROM Application_History");
    if (historyRows[0].count === 0) {
      await seedMySQLDatabase(connection);
    }

    connection.release();
  } catch (err: any) {
    console.log("🟡 MySQL не запущен. Работаем в демонстрационном режиме в памяти.");
    useRealMySQL = false;
    initFallbackDatabase();
  }
}

// Заливка тестовых логов
async function seedMySQLDatabase(connection: mysql.PoolConnection) {
  const baseDate = new Date().getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  let c = 1;

  const insertPath = async (vacancyId: number, count: number, stagesCount: number, delays: number[]) => {
    for (let i = 0; i < count; i++) {
      // Создаем запись кандидата
      await connection.query("INSERT INTO Candidates (id_candidate, full_name, phone_number, source) VALUES (?, ?, '79991234567', 'HeadHunter')", [c, `Кандидат №${c}`]);
      
      let curTime = baseDate - (Math.random() * 90 * dayMs);
      for (let s = 1; s <= stagesCount; s++) {
        const mysqlDate = new Date(curTime).toISOString().slice(0, 19).replace('T', ' ');
        await connection.query(
          "INSERT INTO Application_History (id_candidate, id_vacancy, id_stage, transition_date) VALUES (?, ?, ?, ?)",
          [c, vacancyId, s, mysqlDate]
        );
        curTime += (delays[s - 1] || 1) * dayMs * (0.9 + Math.random() * 0.2);
      }
      c++;
    }
  };

  // 1. Senior React Developer (1250 откликов, узкое горлышко на Тестовом 7.8 дн)
  const d1 = [1.2, 2.0, 7.8, 3.1, 2.5, 4.0, 1.5];
  await insertPath(1, 400, 1, d1);
  await insertPath(1, 430, 2, d1);
  await insertPath(1, 240, 3, d1);
  await insertPath(1, 115, 4, d1);
  await insertPath(1, 40, 5, d1);
  await insertPath(1, 7, 6, d1);
  await insertPath(1, 18, 7, d1);

  // 2. Java Backend Developer
  const d2 = [2.1, 3.2, 1.5, 4.0, 3.0, 2.0, 1.0];
  await insertPath(2, 300, 1, d2);
  await insertPath(2, 250, 2, d2);
  await insertPath(2, 180, 3, d2);
  await insertPath(2, 90, 4, d2);
  await insertPath(2, 35, 5, d2);
  await insertPath(2, 12, 6, d2);
  await insertPath(2, 15, 7, d2);

  // 3. UI/UX Designer
  const d3 = [1.0, 1.5, 2.2, 8.5, 1.8, 1.0, 2.0];
  await insertPath(3, 200, 1, d3);
  await insertPath(3, 170, 2, d3);
  await insertPath(3, 110, 3, d3);
  await insertPath(3, 50, 4, d3);
  await insertPath(3, 22, 5, d3);
  await insertPath(3, 15, 6, d3);
  await insertPath(3, 11, 7, d3);

  // 4. Data Scientist
  const d4 = [2.5, 4.0, 3.5, 6.0, 2.0, 3.0, 1.8];
  await insertPath(4, 150, 1, d4);
  await insertPath(4, 120, 2, d4);
  await insertPath(4, 80, 3, d4);
  await insertPath(4, 45, 4, d4);
  await insertPath(4, 18, 5, d4);
  await insertPath(4, 10, 6, d4);
  await insertPath(4, 6, 7, d4);

  // 5. Product Manager
  const d5 = [3.0, 2.5, 5.0, 2.0, 4.5, 1.5, 2.0];
  await insertPath(5, 100, 1, d5);
  await insertPath(5, 80, 2, d5);
  await insertPath(5, 60, 3, d5);
  await insertPath(5, 30, 4, d5);
  await insertPath(5, 15, 5, d5);
  await insertPath(5, 9, 6, d5);
  await insertPath(5, 4, 7, d5);

  // 6. DevOps Engineer
  const d6 = [1.5, 2.0, 3.0, 1.2, 5.5, 2.5, 1.0];
  await insertPath(6, 110, 1, d6);
  await insertPath(6, 95, 2, d6);
  await insertPath(6, 70, 3, d6);
  await insertPath(6, 40, 4, d6);
  await insertPath(6, 25, 5, d6);
  await insertPath(6, 11, 6, d6);
  await insertPath(6, 8, 7, d6);

  // 7. QA Automation Engineer (840 откликов, задержка на Скрининге 4.5 дн)
  const d7 = [4.5, 1.5, 1.2, 2.0, 1.5, 2.0, 1.0];
  await insertPath(7, 330, 1, d7);
  await insertPath(7, 300, 2, d7);
  await insertPath(7, 120, 3, d7);
  await insertPath(7, 58, 4, d7);
  await insertPath(7, 20, 5, d7);
  await insertPath(7, 4, 6, d7);
  await insertPath(7, 8, 7, d7);

  // 8. HR Manager
  const d8 = [1.0, 2.2, 1.8, 1.5, 2.0, 1.0, 3.0];
  await insertPath(8, 90, 1, d8);
  await insertPath(8, 80, 2, d8);
  await insertPath(8, 50, 3, d8);
  await insertPath(8, 30, 4, d8);
  await insertPath(8, 15, 5, d8);
  await insertPath(8, 8, 6, d8);
  await insertPath(8, 5, 7, d8);
}

function initFallbackDatabase() {
  appHistoryFallback.length = 0;
  candidatesFallback.length = 0;
  const baseDate = new Date().getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  let c = 1;

  const firstNames = ['Александр', 'Михаил', 'Максим', 'Артем', 'Даниил', 'Иван', 'Дмитрий', 'Кирилл', 'Андрей', 'Егор', 'Анна', 'Мария', 'Елена', 'Дарья', 'Алина', 'Ирина', 'Екатерина', 'Виктория', 'Ольга', 'Наталья'];
  const lastNames = ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Михайлов', 'Новиков', 'Федоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семенов', 'Егоров', 'Павлов', 'Козлов', 'Степанов', 'Николаев'];

  const simulatePaths = (vacancyId: number, count: number, stagesCount: number, delays: number[]) => {
    for (let i = 0; i < count; i++) {
      let curTime = baseDate - (Math.random() * 90 * dayMs);
      
      const isMale = Math.random() > 0.5;
      const nameIdx = isMale ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 10) + 10;
      const lastIdx = Math.floor(Math.random() * 20);
      const fsName = firstNames[nameIdx];
      const lsName = lastNames[lastIdx] + (isMale ? '' : 'а');
      
      candidatesFallback.push({
        id_candidate: c,
        full_name: `${lsName} ${fsName}`,
        phone_number: `+7999${Math.floor(1000000 + Math.random() * 9000000)}`,
        source: Math.random() > 0.35 ? 'HeadHunter' : 'Habr Career'
      });

      for (let s = 1; s <= stagesCount; s++) {
        appHistoryFallback.push({
          id_candidate: c,
          id_vacancy: vacancyId,
          id_stage: s,
          transition_date: curTime,
        });
        curTime += (delays[s - 1] || 1) * dayMs * (0.9 + Math.random() * 0.2);
      }
      c++;
    }
  };

  // 1. Senior React Developer (1250 откликов)
  const d1 = [1.2, 2.0, 7.8, 3.1, 2.5, 4.0, 1.5];
  simulatePaths(1, 400, 1, d1);
  simulatePaths(1, 430, 2, d1);
  simulatePaths(1, 240, 3, d1);
  simulatePaths(1, 115, 4, d1);
  simulatePaths(1, 40, 5, d1);
  simulatePaths(1, 7, 6, d1);
  simulatePaths(1, 18, 7, d1);

  // 2. Java Backend Developer
  const d2 = [2.1, 3.2, 1.5, 4.0, 3.0, 2.0, 1.0];
  simulatePaths(2, 300, 1, d2);
  simulatePaths(2, 250, 2, d2);
  simulatePaths(2, 180, 3, d2);
  simulatePaths(2, 90, 4, d2);
  simulatePaths(2, 35, 5, d2);
  simulatePaths(2, 12, 6, d2);
  simulatePaths(2, 15, 7, d2);

  // 3. UI/UX Designer
  const d3 = [1.0, 1.5, 2.2, 8.5, 1.8, 1.0, 2.0];
  simulatePaths(3, 200, 1, d3);
  simulatePaths(3, 170, 2, d3);
  simulatePaths(3, 110, 3, d3);
  simulatePaths(3, 50, 4, d3);
  simulatePaths(3, 22, 5, d3);
  simulatePaths(3, 15, 6, d3);
  simulatePaths(3, 11, 7, d3);

  // 4. Data Scientist
  const d4 = [2.5, 4.0, 3.5, 6.0, 2.0, 3.0, 1.8];
  simulatePaths(4, 150, 1, d4);
  simulatePaths(4, 120, 2, d4);
  simulatePaths(4, 80, 3, d4);
  simulatePaths(4, 45, 4, d4);
  simulatePaths(4, 18, 5, d4);
  simulatePaths(4, 10, 6, d4);
  simulatePaths(4, 6, 7, d4);

  // 5. Product Manager
  const d5 = [3.0, 2.5, 5.0, 2.0, 4.5, 1.5, 2.0];
  simulatePaths(5, 100, 1, d5);
  simulatePaths(5, 80, 2, d5);
  simulatePaths(5, 60, 3, d5);
  simulatePaths(5, 30, 4, d5);
  simulatePaths(5, 15, 5, d5);
  simulatePaths(5, 9, 6, d5);
  simulatePaths(5, 4, 7, d5);

  // 6. DevOps Engineer
  const d6 = [1.5, 2.0, 3.0, 1.2, 5.5, 2.5, 1.0];
  simulatePaths(6, 110, 1, d6);
  simulatePaths(6, 95, 2, d6);
  simulatePaths(6, 70, 3, d6);
  simulatePaths(6, 40, 4, d6);
  simulatePaths(6, 25, 5, d6);
  simulatePaths(6, 11, 6, d6);
  simulatePaths(6, 8, 7, d6);

  // 7. QA Automation Engineer (840 откликов)
  const d7 = [4.5, 1.5, 1.2, 2.0, 1.5, 2.0, 1.0];
  simulatePaths(7, 330, 1, d7);
  simulatePaths(7, 300, 2, d7);
  simulatePaths(7, 120, 3, d7);
  simulatePaths(7, 58, 4, d7);
  simulatePaths(7, 20, 5, d7);
  simulatePaths(7, 4, 6, d7);
  simulatePaths(7, 8, 7, d7);

  // 8. HR Manager
  const d8 = [1.0, 2.2, 1.8, 1.5, 2.0, 1.0, 3.0];
  simulatePaths(8, 90, 1, d8);
  simulatePaths(8, 80, 2, d8);
  simulatePaths(8, 50, 3, d8);
  simulatePaths(8, 30, 4, d8);
  simulatePaths(8, 15, 5, d8);
  simulatePaths(8, 8, 6, d8);
  simulatePaths(8, 5, 7, d8);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  await checkAndInitDatabase();

  app.use(express.json());

  // Prototype Mock for JWT Login + bcrypt hashing concept check (from diploma)
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email && password) {
      res.json({ token: 'mock_jwt_token_123', user: { role: 'Recruiter' } });
    } else {
      res.status(401).json({ error: 'Неверные данные' });
    }
  });

  // API для симуляции
  app.post('/api/analytics/simulate', (req, res) => {
    try {
      const dbType = req.body.profile || 'default';
      const vacancyId = Number(req.body.vacancyId) || 1;
      const count = Number(req.body.candidatesCount) || 500;
      const conversion = req.body.conversion || 'standard';
      const speed = req.body.speed || 'normal';

      // 1. Убираем кандидатов и историю только для выбранной вакансии
      const historyToKeep = appHistoryFallback.filter(h => h.id_vacancy !== vacancyId);
      const candidatesToKeepIds = new Set(historyToKeep.map(h => h.id_candidate));
      
      const newCandidatesFallback = candidatesFallback.filter(c => candidatesToKeepIds.has(c.id_candidate));
      
      appHistoryFallback.length = 0;
      historyToKeep.forEach(h => appHistoryFallback.push(h));
      
      candidatesFallback.length = 0;
      newCandidatesFallback.forEach(c => candidatesFallback.push(c));
      
      const baseDate = new Date().getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      let c = candidatesFallback.length > 0 ? Math.max(...candidatesFallback.map(can => can.id_candidate)) + 1 : 1;
      
      const firstNames = ['Александр', 'Михаил', 'Максим', 'Артем', 'Даниил', 'Иван', 'Дмитрий', 'Кирилл', 'Андрей', 'Егор', 'Анна', 'Мария', 'Елена', 'Дарья', 'Алина', 'Ирина', 'Екатерина', 'Виктория', 'Ольга', 'Наталья'];
      const lastNames = ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Михайлов', 'Новиков', 'Федоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семенов', 'Егоров', 'Павлов', 'Козлов', 'Степанов', 'Николаев'];

      const simulatePaths = (vId: number, dropCount: number, stagesCount: number, delayArr: number[]) => {
        for(let i=0; i<dropCount; i++) {
          let curTime = baseDate - (Math.random() * 90 * dayMs);
          
          const isMale = Math.random() > 0.5;
          const nameIdx = isMale ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 10) + 10;
          const lastIdx = Math.floor(Math.random() * 20);
          const fsName = firstNames[nameIdx];
          const lsName = lastNames[lastIdx] + (isMale ? '' : 'а');
          
          candidatesFallback.push({
            id_candidate: c,
            full_name: `${lsName} ${fsName}`,
            phone_number: `+7999${Math.floor(1000000 + Math.random() * 9000000)}`,
            source: Math.random() > 0.35 ? 'HeadHunter' : 'Habr Career'
          });

          for(let s=1; s<=stagesCount; s++) {
            appHistoryFallback.push({
              id_candidate: c,
              id_vacancy: vId,
              id_stage: s,
              transition_date: curTime,
            });
            curTime += (delayArr[s-1] || 1) * dayMs * (0.8 + Math.random()*0.4);
          }
          c++;
        }
      };

      let multiplier = 1.0;
      if (speed === 'fast') multiplier = 0.3;
      else if (speed === 'slow') multiplier = 2.5;

      const baseDelays = [1.5, 2.5, 3.0, 4.0, 2.0, 3.0, 1.5].map(x => x * multiplier);
      
      let rates = [0.3, 0.4, 0.4, 0.5, 0.5, 0.3]; // standard
      if (conversion === 'strict') {
         rates = [0.65, 0.6, 0.5, 0.5, 0.4, 0.4];
      } else if (conversion === 'loyal') {
         rates = [0.1, 0.15, 0.1, 0.2, 0.1, 0.1];
      }

      let remaining = count;
      for (let s = 1; s <= 7; s++) {
        if (s === 7) {
          simulatePaths(vacancyId, remaining, s, baseDelays);
        } else {
          const dropAtThisStage = Math.floor(remaining * rates[s-1]);
          simulatePaths(vacancyId, dropAtThisStage, s, baseDelays);
          remaining -= dropAtThisStage;
        }
      }

      res.json({ success: true, count: appHistoryFallback.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API для считывания Кандидатов по выбранной Вакансии
  app.get('/api/analytics/candidates', async (req, res) => {
    try {
      const vacancyId = Number(req.query.id_vacancy) || 1;
      const search = ((req.query.search || '') as string).toLowerCase();

      let list: any[] = [];

      if (useRealMySQL) {
        const query = `
          SELECT 
            c.id_candidate AS id,
            c.full_name AS name,
            c.phone_number AS phone,
            c.source AS source,
            v.job_title AS vacancy,
            s.stage_name AS stage,
            s.id_stage AS stageId,
            ah.transition_date AS date,
            ah.status AS actionStatus
          FROM Candidates c
          JOIN Application_History ah ON c.id_candidate = ah.id_candidate
          JOIN Vacancies v ON ah.id_vacancy = v.id_vacancy
          JOIN Stages s ON ah.id_stage = s.id_stage
          WHERE ah.id_vacancy = ? AND ah.id_history = (
            SELECT MAX(id_history)
            FROM Application_History
            WHERE id_candidate = c.id_candidate AND id_vacancy = ?
          )
          ORDER BY ah.transition_date DESC;
        `;
        const [rows]: any = await pool.execute(query, [vacancyId, vacancyId]);
        list = rows;
      } else {
        const latestHistory: Record<number, any> = {};
        for (const h of appHistoryFallback) {
          if (h.id_vacancy === vacancyId) {
            const cid = h.id_candidate;
            if (!latestHistory[cid] || h.transition_date > latestHistory[cid].transition_date) {
              latestHistory[cid] = h;
            }
          }
        }

        for (const cidStr in latestHistory) {
          const cid = Number(cidStr);
          const hist = latestHistory[cid];
          const cand = candidatesFallback.find(x => x.id_candidate === cid) || {
            id_candidate: cid,
            full_name: `Кандидат №${cid}`,
            phone_number: '+79991234567',
            source: 'HeadHunter'
          };

          const stageObj = stages.find(st => st.id === hist.id_stage) || stages[0];

          list.push({
            id: cid,
            name: cand.full_name,
            phone: cand.phone_number || '+79991234567',
            source: cand.source || 'HeadHunter',
            vacancy: vacanciesListFallback.find(v => v.id === vacancyId)?.title || 'Senior React Developer',
            stage: stageObj.name,
            stageId: stageObj.id,
            date: hist.transition_date,
            actionStatus: hist.status || 'В процессе'
          });
        }
        
        list.sort((a, b) => b.date - a.date);
      }

      if (search) {
        list = list.filter(item => 
          item.name.toLowerCase().includes(search) || 
          item.stage.toLowerCase().includes(search) ||
          item.vacancy.toLowerCase().includes(search)
        );
      }

      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API создания нового кандидата
  app.post('/api/analytics/candidates', async (req, res) => {
    try {
      const { full_name, phone_number, source, id_vacancy, id_stage } = req.body;
      const name = full_name || 'Тестовый Кандидат';
      const phone = phone_number || '+79901234567';
      const src = source || 'HeadHunter';
      const vacancyId = Number(id_vacancy) || 1;
      const stageId = Number(id_stage) || 1;

      if (useRealMySQL) {
        const [candRes]: any = await pool.execute(
          "INSERT INTO Candidates (full_name, phone_number, source) VALUES (?, ?, ?)",
          [name, phone, src]
        );
        const lastCandId = candRes.insertId;

        const mysqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await pool.execute(
          "INSERT INTO Application_History (id_candidate, id_vacancy, id_stage, transition_date, status) VALUES (?, ?, ?, ?, 'В процессе')",
          [lastCandId, vacancyId, stageId, mysqlDate]
        );

        res.json({ success: true, id_candidate: lastCandId });
      } else {
        const lastCandId = candidatesFallback.length > 0 ? Math.max(...candidatesFallback.map(c => c.id_candidate)) + 1 : 1;
        candidatesFallback.push({
          id_candidate: lastCandId,
          full_name: name,
          phone_number: phone,
          source: src
        });

        appHistoryFallback.push({
          id_candidate: lastCandId,
          id_vacancy: vacancyId,
          id_stage: stageId,
          transition_date: Date.now(),
          status: 'В процессе'
        });

        res.json({ success: true, id_candidate: lastCandId });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API сдвига кандидата по этапам
  app.post('/api/analytics/candidates/move', async (req, res) => {
    try {
      const { id_candidate, id_vacancy, id_stage } = req.body;
      const cid = Number(id_candidate);
      const vid = Number(id_vacancy);
      const sid = Number(id_stage);

      if (useRealMySQL) {
        const mysqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await pool.execute(
          "INSERT INTO Application_History (id_candidate, id_vacancy, id_stage, transition_date, status) VALUES (?, ?, ?, ?, 'В процессе')",
          [cid, vid, sid, mysqlDate]
        );
        res.json({ success: true });
      } else {
        appHistoryFallback.push({
          id_candidate: cid,
          id_vacancy: vid,
          id_stage: sid,
          transition_date: Date.now(),
          status: 'В процессе'
        });
        res.json({ success: true });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API изменения вакансий (создать новую вакансию)
  app.post('/api/analytics/vacancies', async (req, res) => {
    try {
      const { job_title } = req.body;
      if (!job_title) {
        return res.status(400).json({ error: 'Пожалуйста, введите название вакансии' });
      }

      if (useRealMySQL) {
        const [resVac]: any = await pool.execute(
          "INSERT INTO Vacancies (id_recruiter, job_title, open_date) VALUES (1, ?, NOW())",
          [job_title]
        );
        res.json({ success: true, id_vacancy: resVac.insertId, job_title });
      } else {
        const nextId = vacanciesListFallback.length > 0 ? Math.max(...vacanciesListFallback.map(v => v.id)) + 1 : 1;
        vacanciesListFallback.push({
          id: nextId,
          title: job_title
        });
        res.json({ success: true, id_vacancy: nextId, job_title });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API удаления кандидата
  app.post('/api/analytics/candidates/delete', async (req, res) => {
    try {
      const { id_candidate } = req.body;
      const cid = Number(id_candidate);

      if (useRealMySQL) {
        await pool.execute("DELETE FROM Candidates WHERE id_candidate = ?", [cid]);
        res.json({ success: true });
      } else {
        const candIdx = candidatesFallback.findIndex(c => c.id_candidate === cid);
        if (candIdx !== -1) {
          candidatesFallback.splice(candIdx, 1);
        }
        for (let i = appHistoryFallback.length - 1; i >= 0; i--) {
          if (appHistoryFallback[i].id_candidate === cid) {
            appHistoryFallback.splice(i, 1);
          }
        }
        res.json({ success: true });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test Webhook Gateway
  app.post('/api/analytics/test-webhook', async (req, res) => {
    try {
      const { url, payload } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
      }
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'HR-Analyzer-Webhook-Agent'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        });
        
        const responseText = await response.text();
        res.json({
          success: response.ok,
          status: response.status,
          response: responseText.slice(0, 500)
        });
      } catch (fetchErr: any) {
        res.json({
          success: false,
          error: `Ошибка соединения: ${fetchErr.message}`
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API статуса БД
  app.get('/api/analytics/status', (req, res) => {
    res.json({
      connected: useRealMySQL,
      dbName: useRealMySQL ? `${currentDbConfig.database} (${currentDbConfig.host}:${currentDbConfig.port})` : 'Встроенная симуляция (БД Offline)',
      config: {
        host: currentDbConfig.host,
        port: currentDbConfig.port,
        user: currentDbConfig.user,
        database: currentDbConfig.database
      }
    });
  });

  // API экспорта SQL-дампа структуры
  app.get('/api/analytics/export-sql', (req, res) => {
    const sqlDump = `-- =====================================================================
-- Скрипт инициализации структуры БД Воронки найма (HR Funnel)
-- Сгенерировано системой автодиагностики VKR-DB-GATEWAY
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Сброс таблиц, если они существуют
DROP TABLE IF EXISTS Application_History;
DROP TABLE IF EXISTS Candidates;
DROP TABLE IF EXISTS Vacancies;
DROP TABLE IF EXISTS Recruiters;
DROP TABLE IF EXISTS Stages;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Таблица Этапов
CREATE TABLE Stages (
  id_stage INT PRIMARY KEY,
  stage_name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Заполнение этапов воронки
INSERT INTO Stages (id_stage, stage_name, sort_order) VALUES
(1, 'Отклик', 1),
(2, 'Скрининг резюме', 2),
(3, 'HR-интервью', 3),
(4, 'Тестовое задание', 4),
(5, 'Техническое интервью', 5),
(6, 'Проверка СБ', 6),
(7, 'Выставление оффера', 7);

-- 2. Таблица Рекрутеров
CREATE TABLE Recruiters (
  id_recruiter INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  is_active TINYINT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Создание дефолтного HR-менеджера
INSERT INTO Recruiters (id_recruiter, full_name, email, is_active) VALUES
(1, 'Герасимов В.В.', 'gerasimov@pvguti.ru', 1);

-- 3. Таблица Вакансий
CREATE TABLE Vacancies (
  id_vacancy INT AUTO_INCREMENT PRIMARY KEY,
  id_recruiter INT NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  open_date DATETIME NOT NULL,
  close_date DATETIME NULL,
  status VARCHAR(50) DEFAULT 'В работе',
  FOREIGN KEY (id_recruiter) REFERENCES Recruiters(id_recruiter) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Начальные вакансии
INSERT INTO Vacancies (id_vacancy, id_recruiter, job_title, open_date, status) VALUES
(1, 1, 'Senior React Developer', NOW(), 'В работе'),
(2, 1, 'Java Backend Developer', NOW(), 'В работе'),
(3, 1, 'UI/UX Designer', NOW(), 'В работе'),
(4, 1, 'Data Scientist', NOW(), 'В работе'),
(5, 1, 'Product Manager', NOW(), 'В работе'),
(6, 1, 'DevOps Engineer', NOW(), 'В работе'),
(7, 1, 'QA Automation Engineer', NOW(), 'В работе'),
(8, 1, 'HR Manager', NOW(), 'В работе');

-- 4. Таблица Кандидатов
CREATE TABLE Candidates (
  id_candidate INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  source VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Таблица Истории переходов (Логи жизненного цикла кандидата)
CREATE TABLE Application_History (
  id_history INT AUTO_INCREMENT PRIMARY KEY,
  id_candidate INT NOT NULL,
  id_vacancy INT NOT NULL,
  id_stage INT NOT NULL,
  transition_date DATETIME NOT NULL,
  status VARCHAR(50) DEFAULT 'В процессе',
  FOREIGN KEY (id_stage) REFERENCES Stages(id_stage) ON DELETE CASCADE,
  FOREIGN KEY (id_vacancy) REFERENCES Vacancies(id_vacancy) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Индексы для оптимизации сложных запросов (аналитика SLA, воронка и задержки)
CREATE INDEX idx_history_stage ON Application_History(id_stage);
CREATE INDEX idx_history_vacancy ON Application_History(id_vacancy);
CREATE INDEX idx_history_candidate ON Application_History(id_candidate);
CREATE INDEX idx_history_date ON Application_History(transition_date);

-- =====================================================================
-- Конец скрипта. Схема готова к импорту.
-- =====================================================================
`;

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', 'attachment; filename="hr_funnel_schema.sql"');
    res.send(sqlDump);
  });

  // API Настройки подключения к БД
  app.post('/api/analytics/config-db', async (req, res) => {
    const { host, port, user, password, database } = req.body;
    try {
      if (host === 'offline') {
        try {
          await pool.end();
        } catch (e) {
          console.log("Error closing pool on default reset:", e);
        }
        useRealMySQL = false;
        return res.json({
          success: true,
          message: 'Успешно переключено на встроенную имитацию базы данных!'
        });
      }

      if (!host || !user || !database) {
        return res.status(400).json({ success: false, error: 'Хост, пользователь и имя базы данных обязательны.' });
      }

      // Close previous pool if possible
      try {
        await pool.end();
      } catch (e) {
        console.log("Error closing old pool:", e);
      }

      currentDbConfig = {
        host,
        port: Number(port) || 3306,
        user,
        password: password || '',
        database
      };

      // Create new pool
      pool = mysql.createPool({
        ...currentDbConfig,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      // Try connection
      const connection = await pool.getConnection();
      connection.release();

      useRealMySQL = true;

      // Automatically try to initialize DB tables if they don't exist
      await checkAndInitDatabase(false);

      res.json({ 
        success: true, 
        message: `Подключение к базе данных ${database} на ${host}:${port} успешно установлено!` 
      });
    } catch (err: any) {
      useRealMySQL = false;
      res.status(500).json({ 
        success: false, 
        error: `Не удалось подключиться к базе данных: ${err.message}` 
      });
    }
  });

  // API списка вакансий (динамически из БД)
  app.get('/api/analytics/vacancies', async (req, res) => {
    try {
      if (useRealMySQL) {
        const [rows] = await pool.execute("SELECT id_vacancy AS id, job_title AS title FROM Vacancies");
        res.json(rows);
      } else {
        res.json(vacanciesListFallback);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Импорта / Пересоздания структуры БД
  app.post('/api/analytics/import', async (req, res) => {
    try {
      // Сначала жестко проверяем связь с MySQL
      try {
        const connection = await pool.getConnection();
        connection.release();
      } catch (dbErr: any) {
        useRealMySQL = false;
        return res.status(503).json({
          success: false,
          error: 'СУБД MySQL в XAMPP отключена или не отвечает. Пожалуйста, запустите MySQL в панели управления XAMPP и убедитесь, что порт 3306 активен.'
        });
      }

      await checkAndInitDatabase(true);
      if (!useRealMySQL) {
        return res.status(503).json({
          success: false,
          error: 'Инициализация прошла неудачно. База данных MySQL офлайн.'
        });
      }
      res.json({ success: true, message: 'Структура базы данных успешно импортирована!' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API экспорта полной структуры и данных СУБД в формате .sql
  app.get('/api/analytics/export-sql', async (req, res) => {
    try {
      let stagesData: any[] = [];
      let recruitersData: any[] = [];
      let vacanciesData: any[] = [];
      let candidatesData: any[] = [];
      let historyData: any[] = [];

      if (useRealMySQL) {
        // Извлекаем реальные данные из MySQL
        const [stagesRows]: any = await pool.query("SELECT * FROM Stages ORDER BY sort_order ASC");
        stagesData = stagesRows;

        const [recRows]: any = await pool.query("SELECT * FROM Recruiters");
        recruitersData = recRows;

        const [vacRows]: any = await pool.query("SELECT * FROM Vacancies");
        vacanciesData = vacRows;

        const [candRows]: any = await pool.query("SELECT * FROM Candidates");
        candidatesData = candRows;

        const [histRows]: any = await pool.query("SELECT * FROM Application_History ORDER BY id_history ASC");
        historyData = histRows;
      } else {
        // Генерируем из fallback-коллекций в памяти
        stagesData = stages.map(s => ({ id_stage: s.id, stage_name: s.name, sort_order: s.order }));
        recruitersData = [{ id_recruiter: 1, full_name: 'Герасимов В.В.', email: 'gerasimov@pvguti.ru', is_active: 1 }];
        vacanciesData = vacanciesListFallback.map(v => ({
          id_vacancy: v.id,
          id_recruiter: 1,
          job_title: v.title,
          open_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          close_date: null,
          status: 'В работе'
        }));
        candidatesData = candidatesFallback;
        historyData = appHistoryFallback.map((h, i) => ({
          id_history: i + 1,
          id_candidate: h.id_candidate,
          id_vacancy: h.id_vacancy,
          id_stage: h.id_stage,
          transition_date: new Date(h.transition_date).toISOString().slice(0, 19).replace('T', ' '),
          status: 'В процессе'
        }));
      }

      // Формируем контент SQL-скрипта
      let sql = `-- ==========================================
-- СТРУКТУРА И ДАННЫЕ СУБД MYSQL ДЛЯ ДИПЛОМА
-- Проектирование модуля для анализа воронки найма
-- Разработано: Комаров М.Н., Группа ПИ-21
-- Сгенерировано системой: ${new Date().toLocaleDateString('ru-RU')}
-- ==========================================

CREATE DATABASE IF NOT EXISTS \`hr_funnel_db\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`hr_funnel_db\`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS \`Application_History\`;
DROP TABLE IF EXISTS \`Candidates\`;
DROP TABLE IF EXISTS \`Vacancies\`;
DROP TABLE IF EXISTS \`Recruiters\`;
DROP TABLE IF EXISTS \`Stages\`;
SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------
-- 1. Таблица \`Stages\` (Справочник этапов воронки)
-- --------------------------------------------------------
CREATE TABLE \`Stages\` (
  \`id_stage\` INT NOT NULL,
  \`stage_name\` VARCHAR(100) NOT NULL,
  \`sort_order\` INT NOT NULL,
  PRIMARY KEY (\`id_stage\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

      // Вставляем этапы
      if (stagesData.length > 0) {
        sql += `INSERT INTO \`Stages\` (\`id_stage\`, \`stage_name\`, \`sort_order\`) VALUES\n`;
        sql += stagesData.map(s => `(${s.id_stage}, '${s.stage_name.replace(/'/g, "''")}', ${s.sort_order})`).join(',\n') + ';\n\n';
      }

      sql += `-- --------------------------------------------------------
-- 2. Таблица \`Recruiters\` (Рекрутеры)
-- --------------------------------------------------------
CREATE TABLE \`Recruiters\` (
  \`id_recruiter\` INT NOT NULL AUTO_INCREMENT,
  \`full_name\` VARCHAR(255) NOT NULL,
  \`email\` VARCHAR(100) NOT NULL,
  \`is_active\` TINYINT DEFAULT 1,
  PRIMARY KEY (\`id_recruiter\`),
  UNIQUE KEY \`email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

      // Вставляем рекрутеров
      if (recruitersData.length > 0) {
        sql += `INSERT INTO \`Recruiters\` (\`id_recruiter\`, \`full_name\`, \`email\`, \`is_active\`) VALUES\n`;
        sql += recruitersData.map(r => `(${r.id_recruiter}, '${r.full_name.replace(/'/g, "''")}', '${r.email.replace(/'/g, "''")}', ${r.is_active || 1})`).join(',\n') + ';\n\n';
      }

      sql += `-- --------------------------------------------------------
-- 3. Таблица \`Vacancies\` (Вакансии)
-- --------------------------------------------------------
CREATE TABLE \`Vacancies\` (
  \`id_vacancy\` INT NOT NULL AUTO_INCREMENT,
  \`id_recruiter\` INT NOT NULL,
  \`job_title\` VARCHAR(255) NOT NULL,
  \`open_date\` DATETIME NOT NULL,
  \`close_date\` DATETIME DEFAULT NULL,
  \`status\` VARCHAR(50) DEFAULT 'В работе',
  PRIMARY KEY (\`id_vacancy\`),
  CONSTRAINT \`fk_v_recruiter\` FOREIGN KEY (\`id_recruiter\`) REFERENCES \`Recruiters\` (\`id_recruiter\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

      // Вставляем вакансии
      if (vacanciesData.length > 0) {
        sql += `INSERT INTO \`Vacancies\` (\`id_vacancy\`, \`id_recruiter\`, \`job_title\`, \`open_date\`, \`close_date\`, \`status\`) VALUES\n`;
        sql += vacanciesData.map(v => {
          const openStr = v.open_date instanceof Date ? v.open_date.toISOString().slice(0, 19).replace('T', ' ') : String(v.open_date);
          const closeStr = v.close_date ? (v.close_date instanceof Date ? `'${v.close_date.toISOString().slice(0, 19).replace('T', ' ')}'` : `'${v.close_date}'`) : 'NULL';
          return `(${v.id_vacancy}, ${v.id_recruiter}, '${v.job_title.replace(/'/g, "''")}', '${openStr}', ${closeStr}, '${(v.status || "В работе").replace(/'/g, "''")}')`;
        }).join(',\n') + ';\n\n';
      }

      sql += `-- --------------------------------------------------------
-- 4. Таблица \`Candidates\` (Кандидаты)
-- --------------------------------------------------------
CREATE TABLE \`Candidates\` (
  \`id_candidate\` INT NOT NULL AUTO_INCREMENT,
  \`full_name\` VARCHAR(255) NOT NULL,
  \`phone_number\` VARCHAR(50) NOT NULL,
  \`source\` VARCHAR(100) NOT NULL,
  PRIMARY KEY (\`id_candidate\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

      // Вставляем кандидатов пачками по 500 штук, чтобы избежать перегрузки SQL-парсера
      if (candidatesData.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < candidatesData.length; i += batchSize) {
          const batch = candidatesData.slice(i, i + batchSize);
          sql += `INSERT INTO \`Candidates\` (\`id_candidate\`, \`full_name\`, \`phone_number\`, \`source\`) VALUES\n`;
          sql += batch.map(c => `(${c.id_candidate}, '${c.full_name.replace(/'/g, "''")}', '${c.phone_number.replace(/'/g, "''")}', '${c.source.replace(/'/g, "''")}')`).join(',\n') + ';\n\n';
        }
      }

      sql += `-- --------------------------------------------------------
-- 5. Таблица \`Application_History\` (История движения кандидатов)
-- --------------------------------------------------------
CREATE TABLE \`Application_History\` (
  \`id_history\` INT NOT NULL AUTO_INCREMENT,
  \`id_candidate\` INT NOT NULL,
  \`id_vacancy\` INT NOT NULL,
  \`id_stage\` INT NOT NULL,
  \`transition_date\` DATETIME NOT NULL,
  \`status\` VARCHAR(50) DEFAULT 'В процессе',
  PRIMARY KEY (\`id_history\`),
  CONSTRAINT \`fk_ah_stage\` FOREIGN KEY (\`id_stage\`) REFERENCES \`Stages\` (\`id_stage\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_ah_vacancy\` FOREIGN KEY (\`id_vacancy\`) REFERENCES \`Vacancies\` (\`id_vacancy\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_ah_candidate\` FOREIGN KEY (\`id_candidate\`) REFERENCES \`Candidates\` (\`id_candidate\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

      // Вставляем историю пачками по 500 штук
      if (historyData.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < historyData.length; i += batchSize) {
          const batch = historyData.slice(i, i + batchSize);
          sql += `INSERT INTO \`Application_History\` (\`id_history\`, \`id_candidate\`, \`id_vacancy\`, \`id_stage\`, \`transition_date\`, \`status\`) VALUES\n`;
          sql += batch.map(h => {
            const dateStr = h.transition_date instanceof Date ? h.transition_date.toISOString().slice(0, 19).replace('T', ' ') : String(h.transition_date);
            return `(${h.id_history}, ${h.id_candidate}, ${h.id_vacancy}, ${h.id_stage}, '${dateStr}', '${(h.status || "В процессе").replace(/'/g, "''")}')`;
          }).join(',\n') + ';\n\n';
        }
      }

      // Отдаем как вложенный файл для скачивания
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="hr_funnel_db_dump.sql"');
      res.send(sql);

    } catch (err: any) {
      res.status(500).json({ error: 'Ошибка генерации SQL дампа: ' + err.message });
    }
  });

  // API Воронки
  app.get('/api/analytics/funnel', async (req, res) => {
    try {
      const vacancyId = Number(req.query.id_vacancy) || 1;
      if (useRealMySQL) {
        const query = `
          SELECT s.sort_order AS sort, s.stage_name AS stage, COUNT(DISTINCT ah.id_candidate) AS count
          FROM Application_History ah
          JOIN Stages s ON ah.id_stage = s.id_stage
          WHERE ah.id_vacancy = ?
          GROUP BY s.sort_order, s.stage_name
          ORDER BY s.sort_order ASC;
        `;
        const [rows] = await pool.execute(query, [vacancyId]);
        res.json(rows);
      } else {
        const counts: Record<number, Set<number>> = {};
        for (const h of appHistoryFallback) {
          if (h.id_vacancy === vacancyId) {
            if (!counts[h.id_stage]) counts[h.id_stage] = new Set();
            counts[h.id_stage].add(h.id_candidate);
          }
        }
        const rows = stages.map(s => ({
          sort: s.order,
          stage: s.name,
          count: counts[s.id] ? counts[s.id].size : 0
        })).filter(r => r.count > 0);
        res.json(rows);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Задержек
  app.get('/api/analytics/delays', async (req, res) => {
    try {
      const vacancyId = Number(req.query.id_vacancy) || 1;
      if (useRealMySQL) {
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
      } else {
        const cHistory: Record<number, any[]> = {};
        for (const h of appHistoryFallback) {
          if (h.id_vacancy === vacancyId) {
            if (!cHistory[h.id_candidate]) cHistory[h.id_candidate] = [];
            cHistory[h.id_candidate].push(h);
          }
        }
        const stageDelays: Record<number, number[]> = {};
        for (const cid in cHistory) {
           const hist = cHistory[cid].sort((a, b) => a.transition_date - b.transition_date);
           for (let i = 0; i < hist.length - 1; i++) {
             const cur = hist[i];
             const next = hist[i + 1];
             const diffDays = (next.transition_date - cur.transition_date) / (24 * 60 * 60 * 1000);
             if (!stageDelays[cur.id_stage]) stageDelays[cur.id_stage] = [];
             stageDelays[cur.id_stage].push(diffDays);
           }
        }
        const rows = stages.map(s => {
          const delays = stageDelays[s.id] || [];
          const avg = delays.length > 0 ? delays.reduce((a,b) => a+b, 0) / delays.length : 0;
          return {
            stage: s.name,
            avg_days: Math.round(avg * 10) / 10
          };
        }).filter(r => r.avg_days > 0);
        res.json(rows);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const distPath = path.join(process.cwd(), 'dist');
  const hasBuild = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV !== "production" || !hasBuild) {
    if (!hasBuild && process.env.NODE_ENV === "production") {
      console.log("⚠️ папка dist/index.html не найдена. Автоматический запуск в режиме динамической компиляции разработчика через Vite...");
    }
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("📦 Сервер запущен в режиме дистрибутива. Раздача статики...");
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  function openBrowser(url: string) {
    // Не запускаем браузер в облачном контейнере (Cloud Run)
    const isCloudRun = process.env.K_SERVICE || process.env.K_REVISION || process.env.K_CONFIGURATION;
    if (isCloudRun) return;

    const startCommand = process.platform === 'darwin' ? `open "${url}"` :
                         process.platform === 'win32' ? `start "" "${url}"` :
                         `xdg-open "${url}" 2>/dev/null || true`;

    setTimeout(() => {
      exec(startCommand, () => {});
    }, 800); // Небольшая пауза для гарантии готовности express
  }

  function tryListen(port: number) {
    const serverInstance = app.listen(port, "0.0.0.0", () => {
      console.log(`\n=======================================================================`);
      console.log(`🚀 АНАЛИЗАТОР ВОРОНКИ НАЙМА УСПЕШНО ЗАПУЩЕН!`);
      console.log(`👉 Локальный адрес дашборда: http://localhost:${port}`);
      console.log(`=======================================================================\n`);
      
      openBrowser(`http://localhost:${port}`);
    });

    serverInstance.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        const isCloudEnv = process.env.PORT && (process.env.K_SERVICE || process.env.K_REVISION);
        if (isCloudEnv) {
          console.error(`❌ Ошибка: В контейнере порт ${port} уже занят! Выход.`);
          process.exit(1);
        }

        console.log(`⚠️ Порт ${port} уже занят другим приложением. Пробую запустить на следующем порту ${port + 1}...`);
        tryListen(port + 1);
      } else {
        console.error("❌ Фатальная ошибка запуска сервера:", err);
      }
    });
  }

  tryListen(PORT);
}

startServer();