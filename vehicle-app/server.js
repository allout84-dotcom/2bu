const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const VIOLATIONS_FILE = path.join(DATA_DIR, 'violations.json');
const VEHICLES_FILE = path.join(DATA_DIR, 'vehicles.json');

// 데이터 디렉토리 및 파일 초기화
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(VIOLATIONS_FILE)) fs.writeFileSync(VIOLATIONS_FILE, JSON.stringify([]));
if (!fs.existsSync(VEHICLES_FILE)) fs.writeFileSync(VEHICLES_FILE, JSON.stringify([]));

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 위반차량 API ──────────────────────────────────────────
// 전체 조회
app.get('/api/violations', (req, res) => {
  res.json(readJSON(VIOLATIONS_FILE));
});

// 등록
app.post('/api/violations', (req, res) => {
  const violations = readJSON(VIOLATIONS_FILE);
  const newEntry = {
    id: Date.now(),
    date: req.body.date,
    floor: req.body.floor,
    plateNumber: req.body.plateNumber,
    createdAt: new Date().toISOString()
  };
  violations.push(newEntry);
  writeJSON(VIOLATIONS_FILE, violations);
  res.json({ success: true, data: newEntry });
});

// 일괄 등록 (배열)
app.post('/api/violations/batch', (req, res) => {
  const violations = readJSON(VIOLATIONS_FILE);
  const entries = req.body.entries || [];
  const saved = [];
  entries.forEach(e => {
    const newEntry = {
      id: Date.now() + Math.random(),
      date: e.date,
      floor: e.floor,
      plateNumber: e.plateNumber,
      createdAt: new Date().toISOString()
    };
    violations.push(newEntry);
    saved.push(newEntry);
  });
  writeJSON(VIOLATIONS_FILE, violations);
  res.json({ success: true, count: saved.length, data: saved });
});

// 삭제
app.delete('/api/violations/:id', (req, res) => {
  let violations = readJSON(VIOLATIONS_FILE);
  violations = violations.filter(v => String(v.id) !== String(req.params.id));
  writeJSON(VIOLATIONS_FILE, violations);
  res.json({ success: true });
});

// 통계
app.get('/api/stats', (req, res) => {
  const violations = readJSON(VIOLATIONS_FILE);
  const vehicles = readJSON(VEHICLES_FILE);

  // 차량 정보 맵
  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.plateNumber] = v; });

  // 날짜별 통계
  const byDate = {};
  violations.forEach(v => {
    if (!byDate[v.date]) byDate[v.date] = [];
    const vehInfo = vehicleMap[v.plateNumber] || {};
    byDate[v.date].push({
      plateNumber: v.plateNumber,
      floor: v.floor,
      owner: vehInfo.owner || '-',
      note: vehInfo.note || '-'
    });
  });

  // 차량별 위반 횟수 (내림차순)
  const countMap = {};
  violations.forEach(v => {
    if (!countMap[v.plateNumber]) countMap[v.plateNumber] = 0;
    countMap[v.plateNumber]++;
  });
  const byCount = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .map(([plateNumber, count]) => {
      const vehInfo = vehicleMap[plateNumber] || {};
      return { plateNumber, count, owner: vehInfo.owner || '-', note: vehInfo.note || '-' };
    });

  res.json({ byDate, byCount });
});

// ── 차량 DB API ───────────────────────────────────────────
app.get('/api/vehicles', (req, res) => {
  res.json(readJSON(VEHICLES_FILE));
});

app.post('/api/vehicles', (req, res) => {
  const vehicles = readJSON(VEHICLES_FILE);
  const existing = vehicles.find(v => v.plateNumber === req.body.plateNumber);
  if (existing) {
    return res.status(400).json({ success: false, message: '이미 등록된 차량번호입니다.' });
  }
  const newVehicle = {
    id: Date.now(),
    plateNumber: req.body.plateNumber,
    owner: req.body.owner || '',
    note: req.body.note || '',
    createdAt: new Date().toISOString()
  };
  vehicles.push(newVehicle);
  writeJSON(VEHICLES_FILE, vehicles);
  res.json({ success: true, data: newVehicle });
});

app.put('/api/vehicles/:id', (req, res) => {
  const vehicles = readJSON(VEHICLES_FILE);
  const idx = vehicles.findIndex(v => String(v.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: '차량을 찾을 수 없습니다.' });
  vehicles[idx] = { ...vehicles[idx], ...req.body };
  writeJSON(VEHICLES_FILE, vehicles);
  res.json({ success: true, data: vehicles[idx] });
});

app.delete('/api/vehicles/:id', (req, res) => {
  let vehicles = readJSON(VEHICLES_FILE);
  vehicles = vehicles.filter(v => String(v.id) !== String(req.params.id));
  writeJSON(VEHICLES_FILE, vehicles);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`\n✅ 차량 2부제 단속 서버 실행중`);
  console.log(`📱 브라우저에서 열기: http://localhost:${PORT}\n`);
});
