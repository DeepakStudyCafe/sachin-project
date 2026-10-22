const { MongoClient, ObjectId } = require('mongodb');

let cached = global._hisabClient;
async function col() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI set nahi hai');
  if (!cached) {
    cached = global._hisabClient = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 }).connect();
  }
  const client = await cached;
  return client.db().collection('office_boy_hisab');
}

module.exports = async (req, res) => {
  try {
    const pin = process.env.APP_PIN;
    if (pin && req.headers['x-pin'] !== pin) return res.status(401).json({ error: 'PIN galat hai' });

    const c = await col();

    if (req.method === 'GET') {
      const month = String(req.query.month || '');
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month galat hai' });
      const rows = await c.find({ month }).sort({ day: 1, createdAt: 1 }).toArray();
      return res.json({ items: rows.map(r => ({ id: String(r._id), d: r.day, a: r.amount, n: r.note || '' })) });
    }

    if (req.method === 'POST') {
      const { month, day, amount, note } = req.body || {};
      const a = parseInt(amount, 10), d = parseInt(day, 10);
      if (!/^\d{4}-\d{2}$/.test(String(month)) || !(d >= 1 && d <= 31) || !(a >= 1 && a <= 1000000))
        return res.status(400).json({ error: 'Data galat hai' });
      const r = await c.insertOne({ month, day: d, amount: a, note: String(note || '').slice(0, 60), createdAt: new Date() });
      return res.json({ id: String(r.insertedId) });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'id galat hai' });
      await c.deleteOne({ _id: new ObjectId(id) });
      return res.json({ ok: true });
    }

    res.status(405).json({ error: 'Method allowed nahi' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error: database se connect nahi hua' });
  }
};
