const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Initialize SQLite database
const db = new sqlite3.Database('digital_residue.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Create tables if they don't exist
function initializeDatabase() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            tags TEXT,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            uploader_name TEXT NOT NULL,
            like_count INTEGER DEFAULT 0,
            download_count INTEGER DEFAULT 0,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    db.run(createTableQuery, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Database table initialized');
        }
    });
}

// Routes

// Get all uploads
app.get('/api/uploads', (req, res) => {
    const query = 'SELECT * FROM uploads ORDER BY upload_date DESC';
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Upload a file
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description, tags, uploader_name } = req.body;
    
    if (!title || !uploader_name) {
        return res.status(400).json({ error: 'Title and uploader name are required' });
    }

    const query = `
        INSERT INTO uploads (title, description, tags, filename, original_name, uploader_name)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        title,
        description || '',
        tags || '',
        req.file.filename,
        req.file.originalname,
        uploader_name
    ];

    db.run(query, values, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ 
            message: 'File uploaded successfully',
            id: this.lastID,
            filename: req.file.filename
        });
    });
});

// Search uploads
app.get('/api/search', (req, res) => {
    const { q, tag } = req.query;
    let query = 'SELECT * FROM uploads WHERE 1=1';
    const params = [];

    if (q) {
        query += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
    }

    if (tag) {
        query += ' AND tags LIKE ?';
        params.push(`%${tag}%`);
    }

    query += ' ORDER BY upload_date DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Like a file
app.post('/api/like/:id', (req, res) => {
    const { id } = req.params;
    const query = 'UPDATE uploads SET like_count = like_count + 1 WHERE id = ?';
    
    db.run(query, [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        res.json({ message: 'File liked successfully' });
    });
});

// Download a file
app.get('/api/download/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM uploads WHERE id = ?';
    
    db.get(query, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'File not found' });
            return;
        }

        // Increment download count
        const updateQuery = 'UPDATE uploads SET download_count = download_count + 1 WHERE id = ?';
        db.run(updateQuery, [id], (err) => {
            if (err) {
                console.error('Error updating download count:', err.message);
            }
        });

        // Send file
        const filePath = path.join(__dirname, 'uploads', row.filename);
        res.download(filePath, row.original_name);
    });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    const { month } = req.query;
    let query = 'SELECT * FROM uploads WHERE 1=1';
    const params = [];

    if (month) {
        query += ' AND strftime("%m", upload_date) = ?';
        params.push(month.padStart(2, '0'));
    }

    query += ' ORDER BY like_count DESC, download_count DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get file info by ID
app.get('/api/uploads/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM uploads WHERE id = ?';
    
    db.get(query, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        res.json(row);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed');
        process.exit(0);
    });
});
