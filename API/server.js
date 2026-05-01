const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { initDb, queryAll, queryOne, runSql, saveDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 5018;

const ADMIN_USER = 'Admin';
const ADMIN_PASS = 'Admin@123';
const imagesDir = path.join(__dirname, '..', 'UI', 'public', 'assets', 'designs');

app.use(cors());
app.use(express.json());
app.use('/assets/designs', express.static(imagesDir));
app.use('/images', express.static(imagesDir));

// Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `design_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (/\.(jpeg|jpg|png|gif|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Health Check
app.get('/', (req, res) => {
  res.send('🚀 ExpliFit Clothing API is running!');
});

// =============================================
//  ADMIN ENDPOINTS
// =============================================

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`Admin login attempt: user="${username}", pass="${password}"`);
  if (username?.toLowerCase() === ADMIN_USER.toLowerCase() && password === ADMIN_PASS) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.get('/api/admin/designs', (req, res) => {
  const designs = queryAll(`
    SELECT d.*,
      COALESCE(SUM(CASE WHEN i.action = 'like' THEN 1 ELSE 0 END), 0) as likes,
      COALESCE(SUM(CASE WHEN i.action = 'dislike' THEN 1 ELSE 0 END), 0) as dislikes,
      COALESCE(SUM(CASE WHEN i.action = 'notify' THEN 1 ELSE 0 END), 0) as notifies,
      COUNT(i.id) as total_interactions
    FROM designs d
    LEFT JOIN interactions i ON d.id = i.design_id
    GROUP BY d.id
    ORDER BY d.priority ASC
  `);
  res.json({ designs });
});

app.post('/api/admin/designs', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const row = queryOne('SELECT MAX(priority) as mp FROM designs');
  const maxPriority = (row && row.mp) || 0;
  const id = `design_${Date.now()}`;
  const name = req.body.name || `Design #${maxPriority + 1}`;
  const url = `/images/${encodeURIComponent(req.file.filename)}`;
  runSql('INSERT INTO designs (id, filename, name, url, active, priority) VALUES (?, ?, ?, ?, 1, ?)',
    [id, req.file.filename, name, url, maxPriority + 1]);
  res.json({ success: true, design: { id, filename: req.file.filename, name, url, active: 1, priority: maxPriority + 1 } });
});

app.put('/api/admin/designs/:id', (req, res) => {
  const design = queryOne('SELECT * FROM designs WHERE id = ?', [req.params.id]);
  if (!design) return res.status(404).json({ error: 'Design not found' });
  const { name, active, priority } = req.body;
  runSql('UPDATE designs SET name = ?, active = ?, priority = ? WHERE id = ?', [
    name !== undefined ? name : design.name,
    active !== undefined ? (active ? 1 : 0) : design.active,
    priority !== undefined ? priority : design.priority,
    req.params.id
  ]);
  res.json({ success: true });
});

// Delete design - DISABLED BY USER REQUEST
app.delete('/api/admin/designs/:id', (req, res) => {
  res.status(403).json({ error: 'Deletion is disabled for safety. Please deactivate the design instead.' });
});

app.put('/api/admin/designs-order', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
  order.forEach(item => {
    runSql('UPDATE designs SET priority = ? WHERE id = ?', [item.priority, item.id]);
  });
  res.json({ success: true });
});

app.get('/api/admin/analytics', (req, res) => {
  const s = (sql) => { const r = queryOne(sql); return r ? Object.values(r)[0] : 0; };
  const topNotify = queryAll(`
    SELECT d.id, d.name, d.filename, d.url,
      COALESCE(SUM(CASE WHEN i.action = 'notify' THEN 1 ELSE 0 END), 0) as notifies,
      COALESCE(SUM(CASE WHEN i.action = 'like' THEN 1 ELSE 0 END), 0) as likes,
      COALESCE(SUM(CASE WHEN i.action = 'dislike' THEN 1 ELSE 0 END), 0) as dislikes
    FROM designs d JOIN interactions i ON d.id = i.design_id
    GROUP BY d.id ORDER BY notifies DESC, likes DESC LIMIT 10
  `);
  const ageGroups = queryAll('SELECT age_group, COUNT(*) as count FROM customers GROUP BY age_group ORDER BY count DESC');
  res.json({
    totalDesigns: s('SELECT COUNT(*) FROM designs'),
    activeDesigns: s('SELECT COUNT(*) FROM designs WHERE active = 1'),
    totalCustomers: s('SELECT COUNT(*) FROM customers'),
    completedCustomers: s('SELECT COUNT(*) FROM customers WHERE completed = 1'),
    totalInteractions: s('SELECT COUNT(*) FROM interactions'),
    totalLikes: s("SELECT COUNT(*) FROM interactions WHERE action = 'like'"),
    totalDislikes: s("SELECT COUNT(*) FROM interactions WHERE action = 'dislike'"),
    totalNotifies: s("SELECT COUNT(*) FROM interactions WHERE action = 'notify'"),
    topNotify, ageGroups
  });
});

app.get('/api/admin/responses', (req, res) => {
  const customers = queryAll(`
    SELECT c.*,
      (SELECT COUNT(*) FROM interactions WHERE customer_id = c.id) as interaction_count,
      (SELECT COUNT(*) FROM interactions WHERE customer_id = c.id AND action = 'like') as likes,
      (SELECT COUNT(*) FROM interactions WHERE customer_id = c.id AND action = 'dislike') as dislikes,
      (SELECT COUNT(*) FROM interactions WHERE customer_id = c.id AND action = 'notify') as notifies
    FROM customers c ORDER BY c.created_at DESC
  `);
  res.json({ customers });
});

// =============================================
//  CUSTOMER ENDPOINTS
// =============================================

app.post('/api/customers', (req, res) => {
  const { name, ageGroup } = req.body;
  if (!name || !ageGroup) return res.status(400).json({ error: 'Name and age group required' });
  const id = uuidv4();
  runSql('INSERT INTO customers (id, name, age_group) VALUES (?, ?, ?)', [id, name.trim(), ageGroup]);
  res.json({ success: true, customerId: id });
});

app.get('/api/designs/active', (req, res) => {
  const designs = queryAll('SELECT id, name, url FROM designs WHERE active = 1 ORDER BY priority ASC');
  res.json({ total: designs.length, designs });
});

app.post('/api/interactions', (req, res) => {
  const { customerId, designId, action } = req.body;
  if (!customerId || !designId || !action) return res.status(400).json({ error: 'Missing fields' });
  if (!['like', 'dislike', 'notify'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  runSql('INSERT INTO interactions (customer_id, design_id, action) VALUES (?, ?, ?)', [customerId, designId, action]);
  const count = queryOne('SELECT COUNT(*) as c FROM interactions WHERE customer_id = ?', [customerId]).c;
  const hasNotified = queryOne("SELECT COUNT(*) as c FROM interactions WHERE customer_id = ? AND action = 'notify'", [customerId]).c > 0;
  res.json({ success: true, interactionCount: count, hasNotified });
});

// Undo last interaction
app.delete('/api/interactions/undo/:customerId', (req, res) => {
  const last = queryOne(
    'SELECT id, * FROM interactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
    [req.params.customerId]
  );
  if (!last) return res.status(404).json({ error: 'Nothing to undo' });
  runSql('DELETE FROM interactions WHERE id = ?', [last.id]);
  res.json({ success: true, undoneAction: last.action, undoneDesignId: last.design_id });
});

app.put('/api/customers/:id/contact', (req, res) => {
  const { contactType, contactValue } = req.body;
  if (!contactType || !contactValue) return res.status(400).json({ error: 'Missing contact info' });
  runSql('UPDATE customers SET contact_type = ?, contact_value = ? WHERE id = ?', [contactType, contactValue.trim(), req.params.id]);
  res.json({ success: true });
});

app.post('/api/customers/:id/complete', (req, res) => {
  runSql('UPDATE customers SET completed = 1 WHERE id = ?', [req.params.id]);
  const stats = queryOne(`
    SELECT
      COALESCE(SUM(CASE WHEN action = 'like' THEN 1 ELSE 0 END), 0) as likes,
      COALESCE(SUM(CASE WHEN action = 'dislike' THEN 1 ELSE 0 END), 0) as dislikes,
      COALESCE(SUM(CASE WHEN action = 'notify' THEN 1 ELSE 0 END), 0) as notifies,
      COUNT(*) as total
    FROM interactions WHERE customer_id = ?
  `, [req.params.id]);
  res.json({ success: true, stats });
});

// =============================================
//  START
// =============================================

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`✅ Cloth Survey API running on http://localhost:${PORT}`);
    console.log(`📁 Serving images from: ${imagesDir}`);
  });
}

start();
