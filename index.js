const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// মিডলওয়্যার
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB সংযোগ
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Error:', err));

// ভিডিও ডেটা মডেল
const VideoSchema = new mongoose.Schema({
  filename: String,
  videoUrl: String,
  timestamp: { type: Date, default: Date.now },
  ip: String,
  userAgent: String
});

const Video = mongoose.model('Video', VideoSchema);

// Multer সেটআপ - ভিডিও সেভ করার জন্য
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB লিমিট
});

// পাবলিক ফোল্ডার তৈরি
const fs = require('fs');
if (!fs.existsSync('./public/uploads')) {
  fs.mkdirSync('./public/uploads', { recursive: true });
}

// === API রাউট ===

// 1. ভিডিও আপলোড করার এন্ডপয়েন্ট
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }

    const videoUrl = `/uploads/${req.file.filename}`;
    
    // ডেটাবেসে সেভ
    const newVideo = new Video({
      filename: req.file.filename,
      videoUrl: videoUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    await newVideo.save();

    res.json({ 
      success: true, 
      message: 'Video saved successfully!',
      videoUrl: videoUrl 
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. সব ভিডিও দেখার এন্ডপয়েন্ট (অ্যাডমিনের জন্য)
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await Video.find().sort({ timestamp: -1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. ভিডিও ডিলিট করার এন্ডপয়েন্ট
app.delete('/api/video/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // ফাইল ডিলিট
    const filePath = path.join(__dirname, 'public', video.videoUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // ডেটাবেস থেকে ডিলিট
    await Video.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Video deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// সার্ভার চালু
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📸 Main page: http://localhost:${PORT}`);
  console.log(`🔒 Admin: http://localhost:${PORT}/admin.html`);
});
