# Digital Residue Exchange Portal

A simple web application for sharing and exchanging digital files, built with Node.js, Express, SQLite, and vanilla HTML/CSS/JavaScript.

## Features

- **Upload Files**: Share your unused digital files with the community
- **Browse Files**: View all uploaded files in a clean, card-based layout
- **Search & Filter**: Find files by title, description, or tags
- **Like System**: Like files you find useful
- **Download Tracking**: Track download counts for each file
- **Leaderboard**: View top files sorted by likes and downloads
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite (no installation required)
- **File Storage**: Local file system (`/uploads` folder)
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **File Upload**: Multer middleware

## Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

## Installation & Setup

1. **Clone or download the project**
   ```bash
   cd Digital_Residual_Portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## Development Mode

For development with auto-restart on file changes:
```bash
npm run dev
```

## Project Structure

```
Digital_Residual_Portal/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── digital_residue.db     # SQLite database (created automatically)
├── uploads/               # Directory for uploaded files
├── public/                # Static files
│   ├── index.html         # Home page
│   ├── upload.html        # Upload page
│   ├── search.html        # Search page
│   ├── leaderboard.html   # Leaderboard page
│   ├── styles.css         # CSS styles
│   └── script.js          # Frontend JavaScript
└── README.md              # This file
```

## API Endpoints

### GET /api/uploads
Get all uploaded files
- **Response**: Array of file objects

### POST /api/upload
Upload a new file
- **Body**: FormData with fields: title, description, tags, uploader_name, file
- **Response**: Success message with file ID

### GET /api/search
Search files
- **Query Parameters**: 
  - `q`: Search term for title/description
  - `tag`: Filter by tag
- **Response**: Array of matching files

### POST /api/like/:id
Like a file
- **Response**: Success message

### GET /api/download/:id
Download a file
- **Response**: File download

### GET /api/leaderboard
Get leaderboard
- **Query Parameters**: 
  - `month`: Filter by month (1-12)
- **Response**: Array of files sorted by likes

## Database Schema

The SQLite database contains one table `uploads` with the following columns:

- `id`: Primary key (auto-increment)
- `title`: File title (required)
- `description`: File description (optional)
- `tags`: Comma-separated tags (optional)
- `filename`: Stored filename (generated)
- `original_name`: Original filename
- `uploader_name`: Name of uploader (required)
- `like_count`: Number of likes (default: 0)
- `download_count`: Number of downloads (default: 0)
- `upload_date`: Upload timestamp (auto-generated)

## Usage Instructions

### For Students/Demo:

1. **Upload a File**:
   - Go to the Upload page
   - Fill in the required fields (title, your name)
   - Optionally add description and tags
   - Select a file to upload
   - Click "Upload File"

2. **Browse Files**:
   - The home page shows all uploaded files
   - Each file card displays title, description, tags, stats, and actions

3. **Search Files**:
   - Go to the Search page
   - Enter search terms or tags
   - Click "Search" to find matching files

4. **View Leaderboard**:
   - Go to the Leaderboard page
   - View files sorted by likes and downloads
   - Optionally filter by month

5. **Interact with Files**:
   - Click "Like" to like a file
   - Click "Download" to download a file
   - Both actions update the respective counters

## Key Features Explained

### File Upload Process:
1. User selects file and fills form
2. File is uploaded to `/uploads` directory with unique filename
3. File metadata is stored in SQLite database
4. User receives confirmation

### Like System:
1. User clicks "Like" button
2. AJAX request sent to `/api/like/:id`
3. Database updates like count
4. UI updates to show new count and "Liked" state

### Download Tracking:
1. User clicks "Download" button
2. Browser requests file from `/api/download/:id`
3. Server increments download count in database
4. File is served to user

### Search Functionality:
1. User enters search terms
2. Frontend sends request to `/api/search`
3. Server queries database with LIKE conditions
4. Results are returned and displayed

## Customization

### Adding New File Types:
The app accepts all file types. To restrict file types, modify the `accept` attribute in `upload.html`:
```html
<input type="file" accept=".pdf,.doc,.docx,.txt">
```

### Changing File Size Limit:
Modify the `limits.fileSize` in `server.js`:
```javascript
limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
}
```

### Styling:
All styles are in `public/styles.css`. The design uses:
- CSS Grid for responsive layouts
- Flexbox for component alignment
- CSS custom properties for consistent colors
- Media queries for mobile responsiveness

## Troubleshooting

### Common Issues:

1. **Port already in use**:
   - Change the PORT in `server.js` or kill the process using port 3000

2. **File upload fails**:
   - Check that the `uploads` directory exists
   - Verify file size is under the limit
   - Check server console for error messages

3. **Database errors**:
   - Delete `digital_residue.db` to reset the database
   - Restart the server

4. **Files not displaying**:
   - Check that files are in the `uploads` directory
   - Verify database has correct file records
   - Check browser console for JavaScript errors

## Educational Value

This project demonstrates:
- **Server-side development** with Node.js and Express
- **Database operations** with SQLite
- **File handling** with Multer
- **RESTful API design**
- **Frontend-backend communication** with AJAX
- **Responsive web design** with CSS Grid/Flexbox
- **CRUD operations** (Create, Read, Update, Delete)
- **File upload and download** functionality

## License

MIT License - Feel free to use this project for educational purposes.
