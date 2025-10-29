// Digital Residue Exchange Portal - Frontend JavaScript

// API Base URL
const API_BASE = '/api';

// Utility Functions
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

function showMessage(message, type = 'success', elementId = 'uploadMessage') {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 5000);
    }
}

function hideMessage(elementId) {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.style.display = 'none';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// File Card Creation
function createFileCard(file) {
    const tags = file.tags ? file.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    
    return `
        <div class="file-card" data-id="${file.id}" data-title="${escapeHtml(file.title)}" data-description="${escapeHtml(file.description || '')}" data-tags="${escapeHtml(file.tags || '')}">
            <div class="mini-actions">
                <a class="mini-btn" title="Update" href="manage.html?action=update&id=${file.id}">✏️</a>
                <a class="mini-btn danger" title="Delete" href="manage.html?action=delete&id=${file.id}">🗑️</a>
            </div>
            <h4>${escapeHtml(file.title)}</h4>
            ${file.description ? `<p class="file-description">${escapeHtml(file.description)}</p>` : ''}
            
            ${tags.length > 0 ? `
                <div class="file-tags">
                    ${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            
            <div class="file-meta">
                <div class="file-stats">
                    <div class="stat">
                        <span>❤️</span>
                        <span>${file.like_count}</span>
                    </div>
                    <div class="stat">
                        <span>📥</span>
                        <span>${file.download_count}</span>
                    </div>
                </div>
                <div class="file-uploader">
                    by ${escapeHtml(file.uploader_name)}
                </div>
            </div>
            
            <div class="file-actions">
                <button class="btn btn-outline like-btn" onclick="likeFile(${file.id})">
                    ❤️ Like
                </button>
                <a href="${API_BASE}/download/${file.id}" class="btn btn-primary download-btn" download>
                    📥 Download
                </a>
            </div>
            
            <div class="file-date">
                Uploaded on ${formatDate(file.upload_date)}
            </div>
        </div>
    `;
}

// HTML Escaping for Security
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API Functions
async function fetchUploads() {
    try {
        const response = await fetch(`${API_BASE}/uploads`);
        if (!response.ok) throw new Error('Failed to fetch uploads');
        return await response.json();
    } catch (error) {
        console.error('Error fetching uploads:', error);
        showMessage('Failed to load uploads', 'error');
        return [];
    }
}

async function searchFiles(query, tag) {
    try {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (tag) params.append('tag', tag);
        
        const response = await fetch(`${API_BASE}/search?${params}`);
        if (!response.ok) throw new Error('Failed to search files');
        return await response.json();
    } catch (error) {
        console.error('Error searching files:', error);
        showMessage('Failed to search files', 'error');
        return [];
    }
}

async function likeFile(fileId) {
    try {
        const response = await fetch(`${API_BASE}/like/${fileId}`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to like file');
        
        // Update the like count in the UI
        const fileCard = document.querySelector(`[data-id="${fileId}"]`);
        if (fileCard) {
            const likeBtn = fileCard.querySelector('.like-btn');
            const likeCount = fileCard.querySelector('.stat span:last-child');
            
            if (likeBtn && likeCount) {
                likeBtn.textContent = '❤️ Liked!';
                likeBtn.disabled = true;
                likeBtn.style.background = '#28a745';
                likeBtn.style.color = 'white';
                
                const currentCount = parseInt(likeCount.textContent);
                likeCount.textContent = currentCount + 1;
            }
        }
        
        showMessage('File liked successfully!', 'success');
    } catch (error) {
        console.error('Error liking file:', error);
        showMessage('Failed to like file', 'error');
    }
}

async function fetchLeaderboard(month = null) {
    try {
        const params = month ? `?month=${month}` : '';
        const response = await fetch(`${API_BASE}/leaderboard${params}`);
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        return await response.json();
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        showMessage('Failed to load leaderboard', 'error');
        return [];
    }
}

// Page-specific Functions
function loadHomePage() {
    const uploadsGrid = document.getElementById('uploadsGrid');
    if (!uploadsGrid) return;
    
    showLoading('loading');
    
    fetchUploads().then(uploads => {
        hideLoading('loading');
        // Update statistics with real data
        updateStatistics(uploads);

        if (uploads.length === 0) {
            uploadsGrid.innerHTML = '<p class="no-results">No files uploaded yet. Be the first to upload!</p>';
            return;
        }
        
        uploadsGrid.innerHTML = uploads.map(createFileCard).join('');
    });
}

function updateStatistics(uploads) {
    // Calculate real statistics from uploads data
    const filesCount = uploads.length;
    const totalDownloads = uploads.reduce((sum, file) => sum + (file.download_count || 0), 0);
    const totalLikes = uploads.reduce((sum, file) => sum + (file.like_count || 0), 0);
    
    // Update the statistics display with animation
    const filesCountElement = document.getElementById('filesCount');
    const downloadsCountElement = document.getElementById('downloadsCount');
    const likesCountElement = document.getElementById('likesCount');
    
    // Animate the numbers counting up
    if (filesCountElement) {
        animateNumber(filesCountElement, 0, filesCount, 1000);
    }
    if (downloadsCountElement) {
        animateNumber(downloadsCountElement, 0, totalDownloads, 1200);
    }
    if (likesCountElement) {
        animateNumber(likesCountElement, 0, totalLikes, 1400);
    }
}

function animateNumber(element, start, end, duration) {
    const startTime = performance.now();
    const range = end - start;
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (range * easeOutCubic));
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = end;
        }
    }
    
    requestAnimationFrame(updateNumber);
}

function loadSearchPage() {
    const searchForm = document.getElementById('searchForm');
    const searchResults = document.getElementById('searchResults');
    const noResults = document.getElementById('noResults');
    
    if (!searchForm || !searchResults) return;
    
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(searchForm);
        const query = formData.get('q');
        const tag = formData.get('tag');
        
        showLoading('searchLoading');
        hideMessage('noResults');
        
        const results = await searchFiles(query, tag);
        hideLoading('searchLoading');
        
        if (results.length === 0) {
            noResults.style.display = 'block';
            searchResults.innerHTML = '';
        } else {
            noResults.style.display = 'none';
            searchResults.innerHTML = results.map(createFileCard).join('');
        }
    });
}

function loadLeaderboardPage() {
    const leaderboardResults = document.getElementById('leaderboardResults');
    const monthFilter = document.getElementById('monthFilter');
    const applyFilter = document.getElementById('applyFilter');
    
    if (!leaderboardResults) return;
    
    function loadLeaderboardData(month = null) {
        showLoading('leaderboardLoading');
        
        fetchLeaderboard(month).then(files => {
            hideLoading('leaderboardLoading');
            
            if (files.length === 0) {
                leaderboardResults.innerHTML = '<p class="no-results">No files found for the selected period.</p>';
                return;
            }
            
            leaderboardResults.innerHTML = files.map(createFileCard).join('');
        });
    }
    
    // Load initial data
    loadLeaderboardData();
    
    // Handle filter changes
    if (applyFilter) {
        applyFilter.addEventListener('click', () => {
            const selectedMonth = monthFilter ? monthFilter.value : null;
            loadLeaderboardData(selectedMonth);
        });
    }
}

function loadUploadPage() {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('file');
    const fileInfo = document.getElementById('fileInfo');
    const uploadBtn = document.getElementById('uploadBtn');
    
    if (!uploadForm) return;
    
    // Show file info when file is selected
    if (fileInput && fileInfo) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileInfo.innerHTML = `
                    <strong>Selected:</strong> ${file.name}<br>
                    <strong>Size:</strong> ${formatFileSize(file.size)}<br>
                    <strong>Type:</strong> ${file.type || 'Unknown'}
                `;
            } else {
                fileInfo.innerHTML = '';
            }
        });
    }
    
    // Handle form submission
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(uploadForm);
        const file = formData.get('file');
        
        if (!file || file.size === 0) {
            showMessage('Please select a file to upload', 'error');
            return;
        }
        
        // Show loading state
        uploadBtn.classList.add('loading');
        uploadBtn.disabled = true;
        
        try {
            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }
            
            // Show custom modal with secret code
            if (result && result.secret_code) {
                showSecretCodeModal(result.secret_code);
            } else {
                showMessage('File uploaded successfully!', 'success');
            }
            uploadForm.reset();
            fileInfo.innerHTML = '';
            
        } catch (error) {
            console.error('Upload error:', error);
            showMessage(error.message || 'Upload failed', 'error');
        } finally {
            uploadBtn.classList.remove('loading');
            uploadBtn.disabled = false;
        }
    });
}

// Secret Code Modal helpers
function showSecretCodeModal(code) {
    const overlay = document.getElementById('secretModalOverlay');
    const codeEl = document.getElementById('secretCodeValue');
    const closeBtn = document.getElementById('secretModalClose');
    const okBtn = document.getElementById('secretModalOk');
    const copyBtn = document.getElementById('copySecretBtn');

    if (!overlay || !codeEl) return;
    codeEl.textContent = code;
    overlay.style.display = 'flex';

    function close() { overlay.style.display = 'none'; }

    if (closeBtn) closeBtn.onclick = close;
    if (okBtn) okBtn.onclick = close;
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    if (copyBtn) {
        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(code);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
            } catch (_) {
                // Fallback
                const tmp = document.createElement('input');
                tmp.value = code;
                document.body.appendChild(tmp);
                tmp.select();
                document.execCommand('copy');
                document.body.removeChild(tmp);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
            }
        };
    }
}
// Initialize page based on current location
function initializePage() {
    const path = window.location.pathname;
    
    if (path.includes('upload.html')) {
        loadUploadPage();
    } else if (path.includes('search.html')) {
        loadSearchPage();
    } else if (path.includes('leaderboard.html')) {
        loadLeaderboardPage();
    } else {
        loadHomePage();
    }
}

// Global functions for HTML onclick handlers
window.likeFile = likeFile;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);

// Handle download clicks to track downloads
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('download-btn')) {
        // The download will be handled by the browser
        // The server will increment the download count
        console.log('Download initiated');
    }
});
