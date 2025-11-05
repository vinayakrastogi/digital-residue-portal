const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = '../../';

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
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        )
    `;
    
    db.run(createTableQuery, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Database table initialized');
            // Ensure columns exist (lightweight migration)
            db.all('PRAGMA table_info(uploads)', [], (pragmaErr, columns) => {
                if (pragmaErr) {
                    console.error('Error reading table info:', pragmaErr.message);
                    return;
                }
                const hasSecret = Array.isArray(columns) && columns.some((c) => c.name === 'secret_code');
                const hasExpiresAt = Array.isArray(columns) && columns.some((c) => c.name === 'expires_at');
                if (!hasSecret) {
                    db.run('ALTER TABLE uploads ADD COLUMN secret_code TEXT', (alterErr) => {
                        if (alterErr) {
                            console.error('Error adding secret_code column:', alterErr.message);
                        } else {
                            console.log('secret_code column added to uploads table');
                        }
                    });
                }
                if (!hasExpiresAt) {
                    db.run('ALTER TABLE uploads ADD COLUMN expires_at DATETIME', (alterErr) => {
                        if (alterErr) {
                            console.error('Error adding expires_at column:', alterErr.message);
                        } else {
                            console.log('expires_at column added to uploads table');
                        }
                    });
                }
                // logo removed – no longer supported
            });
        }
    });
}

// Routes

// Get all uploads
app.get('/api/uploads', (req, res) => {
    const query = `SELECT id, title, description, tags, filename, original_name, uploader_name, like_count, download_count, upload_date
                   FROM uploads ORDER BY upload_date DESC`;
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Upload a file
function generateSecretCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return code;
}

function computeExpiryFromSelection(selection) {
    // selection values: '1d', '1w', '2w', '1m', or '' for no auto-delete
    const now = new Date();
    const expiry = new Date(now);
    switch (selection) {
        case '1d':
            expiry.setDate(expiry.getDate() + 1);
            return expiry.toISOString();
        case '1w':
            expiry.setDate(expiry.getDate() + 7);
            return expiry.toISOString();
        case '2w':
            expiry.setDate(expiry.getDate() + 14);
            return expiry.toISOString();
        case '1m':
            expiry.setMonth(expiry.getMonth() + 1);
            return expiry.toISOString();
        default:
            return null;
    }
}

app.post('/api/upload', upload.single('file'), (req, res) => {
    const mainFile = req.file;
    if (!mainFile) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!mainFile.mimetype || !mainFile.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: 'Only image uploads are allowed' });
    }

    const { title, description, tags, uploader_name } = req.body;
    const auto_delete = req.body.auto_delete || '';
    
    if (!title || !uploader_name) {
        return res.status(400).json({ error: 'Title and uploader name are required' });
    }

    const secretCode = generateSecretCode();
    const expiresAt = computeExpiryFromSelection(auto_delete);

    const query = `
        INSERT INTO uploads (title, description, tags, filename, original_name, uploader_name, secret_code, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        title,
        description || '',
        tags || '',
        mainFile.filename,
        mainFile.originalname,
        uploader_name,
        secretCode,
        expiresAt
    ];

    db.run(query, values, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: 'File uploaded successfully',
            id: this.lastID,
            filename: mainFile.filename,
            secret_code: secretCode,
            expires_at: expiresAt
        });
    });
});

// Search uploads
app.get('/api/search', (req, res) => {
    const { q, tag } = req.query;
    let query = 'SELECT id, title, description, tags, filename, original_name, uploader_name, like_count, download_count, upload_date FROM uploads WHERE 1=1';
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
    const query = 'SELECT id, title, description, tags, filename, original_name, uploader_name, like_count, download_count, upload_date FROM uploads WHERE id = ?';
    
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

// Cleanup job: periodically remove expired uploads
setInterval(() => {
    const nowIso = new Date().toISOString();
    const selectSql = 'SELECT id, filename FROM uploads WHERE expires_at IS NOT NULL AND expires_at <= ?';
    db.all(selectSql, [nowIso], (err, rows) => {
        if (err || !rows || rows.length === 0) return;
        rows.forEach((r) => {
            const filePath = path.join(__dirname, 'uploads', r.filename);
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.error('Error deleting expired file:', unlinkErr.message);
                }
                db.run('DELETE FROM uploads WHERE id = ?', [r.id], (delErr) => {
                    if (delErr) console.error('Error deleting expired db row:', delErr.message);
                });
            });
        });
    });
}, 60 * 60 * 1000); // hourly cleanup

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    const { month } = req.query;
    let query = 'SELECT id, title, description, tags, filename, original_name, uploader_name, like_count, download_count, upload_date FROM uploads WHERE 1=1';
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
    const query = 'SELECT id, title, description, tags, filename, original_name, uploader_name, like_count, download_count, upload_date FROM uploads WHERE id = ?';
    
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

// Comments: table and endpoints
db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL,
    name TEXT,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(upload_id) REFERENCES uploads(id) ON DELETE CASCADE
)`);

app.get('/api/uploads/:id/comments', (req, res) => {
    const { id } = req.params;
    db.all('SELECT id, name, comment, created_at FROM comments WHERE upload_id = ? ORDER BY created_at DESC', [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/uploads/:id/comments', (req, res) => {
    const { id } = req.params;
    const { name, comment } = req.body || {};
    if (!comment || !comment.trim()) return res.status(400).json({ error: 'comment is required' });
    const sql = 'INSERT INTO comments (upload_id, name, comment) VALUES (?, ?, ?)';
    db.run(sql, [id, (name || '').toString().slice(0, 120), comment.toString().slice(0, 4000)], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// Update upload metadata (requires secret_code)
app.put('/api/uploads/:id', (req, res) => {
    const { id } = req.params;
    const { secret_code, title, description, tags } = req.body || {};

    if (!secret_code) {
        return res.status(400).json({ error: 'secret_code is required' });
    }

    // Verify secret
    db.get('SELECT secret_code FROM uploads WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'File not found' });
        if (secret_code !== ADMIN_SECRET && row.secret_code !== secret_code) return res.status(403).json({ error: 'Invalid secret code' });

        const fields = [];
        const params = [];
        if (typeof title === 'string' && title.trim() !== '') { fields.push('title = ?'); params.push(title.trim()); }
        if (typeof description === 'string') { fields.push('description = ?'); params.push(description); }
        if (typeof tags === 'string') { fields.push('tags = ?'); params.push(tags); }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const updateSql = `UPDATE uploads SET ${fields.join(', ')} WHERE id = ?`;
        params.push(id);
        db.run(updateSql, params, function(updateErr) {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            return res.json({ message: 'Updated successfully' });
        });
    });
});

// Delete upload (requires secret_code)
app.delete('/api/uploads/:id', (req, res) => {
    const { id } = req.params;
    const { secret_code } = req.body || {};

    if (!secret_code) {
        return res.status(400).json({ error: 'secret_code is required' });
    }

    db.get('SELECT filename, secret_code FROM uploads WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'File not found' });
        if (secret_code !== ADMIN_SECRET && row.secret_code !== secret_code) return res.status(403).json({ error: 'Invalid secret code' });

        // Delete file from disk
        const filePath = path.join(__dirname, 'uploads', row.filename);
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                // If file missing, continue to delete DB row anyway
                console.error('Error deleting file:', unlinkErr.message);
            }
            db.run('DELETE FROM uploads WHERE id = ?', [id], function(delErr) {
                if (delErr) return res.status(500).json({ error: delErr.message });
                return res.json({ message: 'Deleted successfully' });
            });
        });
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
