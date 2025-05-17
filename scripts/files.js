/**
 * Files Module
 * Handles file upload, download, and management with Supabase Storage
 */

import { supabase, checkAuth, showError, showSuccess , hideModal} from './supabase.js';

let currentFileId = null;
let currentFilePath = null;

// Format date to YYYY-MM-DD
function formatDate(date) {
    return new Date(date).toISOString().split('T')[0];
}

// Format file size to human readable format
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Return an icon HTML string based on file extension
function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'svg':
            return '🖼️'; // Image icon
        case 'pdf':
            return '📄'; // PDF icon
        case 'doc':
        case 'docx':
            return '📝'; // Word icon
        case 'xls':
        case 'xlsx':
            return '📊'; // Excel icon
        case 'ppt':
        case 'pptx':
            return '📈'; // PowerPoint icon
        case 'zip':
        case 'rar':
        case '7z':
            return '🗜️'; // Archive icon
        case 'mp3':
        case 'wav':
            return '🎵'; // Audio icon
        case 'mp4':
        case 'mov':
        case 'avi':
            return '🎬'; // Video icon
        case 'txt':
            return '📄'; // Text icon
        default:
            return '📁'; // Default file icon
    }
}

// Display a modal by ID
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = await checkAuth();
    if (!user) return;
    
    // Initialize file components
    initFileUpload(user.id);
    initFileActions();
    
    // Load user's files
    loadUserFiles(user.id);
});

/**
 * Initialize file upload functionality
 * @param {string} userId - User ID
 */
function initFileUpload(userId) {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-file-btn');
    
    if (!dropzone || !fileInput || !uploadBtn) return;
    
    // Handle upload button click
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFiles(e.target.files, userId);
        }
    });
    
    // Handle drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files, userId);
        }
    });
    
    // Handle click on dropzone
    dropzone.addEventListener('click', () => {
        if (dropzone === e.target || dropzone.contains(e.target)) {
            fileInput.click();
        }
    });
}

/**
 * Initialize file actions (preview, download, delete)
 */
function initFileActions() {
    // Close modal
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            hideModal('file-preview-modal');
        });
    });
    
    // Delete file button
    const deleteFileBtn = document.getElementById('delete-file-btn');
    if (deleteFileBtn) {
        deleteFileBtn.addEventListener('click', handleFileDelete);
    }
}

/**
 * Upload files to Supabase Storage
 * @param {FileList} files - Files to upload
 * @param {string} userId - User ID
 */
async function uploadFiles(files, userId) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const uploadProgress = document.getElementById('upload-progress');
    
    // Show progress container
    uploadProgress.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = 'Uploading...';
    
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = file.name;
            const filePath = `${userId}/${Date.now()}_${fileName}`;
            
            // Update progress text
            progressText.textContent = `Uploading ${i + 1} of ${files.length}: ${fileName}`;
            
            // Upload file to Supabase Storage
            const { error } = await supabase.storage
                .from('student-files')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (error) throw error;
            
            // Update progress bar
            const progress = ((i + 1) / files.length) * 100;
            progressBar.style.width = `${progress}%`;
            
            // Save file metadata to database
            await saveFileMetadata(userId, fileName, filePath, file.type, file.size);
        }
        
        // Hide progress after successful upload
        setTimeout(() => {
            uploadProgress.style.display = 'none';
        }, 1000);
        
        // Reload files list
        loadUserFiles(userId);
    } catch (error) {
        console.error('File upload error:', error);
        progressText.textContent = 'Upload failed. Please try again.';
        setTimeout(() => {
            uploadProgress.style.display = 'none';
        }, 3000);
    }
}

/**
 * Save file metadata to Supabase database
 * @param {string} userId - User ID
 * @param {string} fileName - Original file name
 * @param {string} filePath - Path in Supabase Storage
 * @param {string} fileType - MIME type of the file
 * @param {number} fileSize - Size of the file in bytes
 */
async function saveFileMetadata(userId, fileName, filePath, fileType, fileSize) {
    try {
        const { error } = await supabase
            .from('files')
            .insert([
                {
                    user_id: userId,
                    file_name: fileName,
                    file_path: filePath,
                    file_type: fileType,
                    file_size: fileSize,
                    uploaded_at: new Date().toISOString()
                }
            ]);
        
        if (error) throw error;
    } catch (error) {
        console.error('Error saving file metadata:', error);
    }
}

/**
 * Load user's files from Supabase
 * @param {string} userId - User ID
 */
async function loadUserFiles(userId) {
    try {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', userId)
            .order('uploaded_at', { ascending: false });
        
        if (error) throw error;
        
        renderFiles(data || []);
    } catch (error) {
        console.error('Failed to load files:', error);
        document.getElementById('files-list').innerHTML = '<div class="empty-state">Failed to load files. Please refresh the page.</div>';
    }
}

/**
 * Render files to the UI
 * @param {Array} files - Array of file objects
 */
function renderFiles(files) {
    const filesContainer = document.getElementById('files-list');
    if (!filesContainer) return;
    
    if (files.length === 0) {
        filesContainer.innerHTML = '<div class="empty-state">No files uploaded yet. Upload your first file!</div>';
        return;
    }
    
    let filesList = '';
    
    files.forEach(file => {
        const fileTypeDisplay = file.file_type.split('/')[1] ? file.file_type.split('/')[1].toUpperCase() : 'FILE';
        const fileSizeDisplay = formatFileSize(file.file_size);
        const uploadedAt = formatDate(file.uploaded_at);
        
        filesList += `
            <div class="file-item">
                <div class="file-name">
                    ${getFileIcon(file.file_name)}
                    ${file.file_name}
                </div>
                <div class="file-type">${fileTypeDisplay}</div>
                <div class="file-size">${fileSizeDisplay}</div>
                <div class="file-date">${uploadedAt}</div>
                <div class="file-actions">
                    <button type="button" class="preview-file-btn" data-id="${file.id}" data-path="${file.file_path}" data-name="${file.file_name}">View</button>
                </div>
            </div>
        `;
    });
    
    filesContainer.innerHTML = filesList;
    
    // Add event listeners to preview buttons
    document.querySelectorAll('.preview-file-btn').forEach(button => {
        button.addEventListener('click', handleFilePreview);
    });
}

/**
 * Handle file preview
 * @param {Event} event - Click event
 */
async function handleFilePreview(event) {
    const fileId = event.target.getAttribute('data-id');
    const filePath = event.target.getAttribute('data-path');
    const fileName = event.target.getAttribute('data-name');
    
    currentFileId = fileId;
    currentFilePath = filePath;
    
    // Update modal title
    document.getElementById('file-preview-name').textContent = fileName;
    
    // Set download link
    const downloadBtn = document.getElementById('download-file-btn');
    const { data: { publicUrl } } = supabase.storage
        .from('student-files')
        .getPublicUrl(filePath);
    
    downloadBtn.href = publicUrl;
    downloadBtn.setAttribute('download', fileName);
    
    // Load preview content
    const previewContainer = document.getElementById('file-preview-container');
    previewContainer.innerHTML = '<div class="loading">Loading preview...</div>';
    
    try {
        const fileExt = fileName.split('.').pop().toLowerCase();
        
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileExt)) {
            // Image preview
            previewContainer.innerHTML = `<img src="${publicUrl}" alt="${fileName}">`;
        } else if (['pdf'].includes(fileExt)) {
            // PDF preview
            previewContainer.innerHTML = `<iframe src="${publicUrl}" width="100%" height="500px"></iframe>`;
        } else {
            // No preview available
            previewContainer.innerHTML = '<div class="no-preview">No preview available for this file type. Click the Download button to view the file.</div>';
        }
    } catch (error) {
        console.error('Failed to generate preview:', error);
        previewContainer.innerHTML = '<div class="error">Failed to load preview. Please try downloading the file instead.</div>';
    }
    
    // Show modal
    showModal('file-preview-modal');
}

/**
 * Handle file deletion
 */
async function handleFileDelete() {
    if (!currentFileId || !currentFilePath) return;
    
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
        return;
    }
    
    try {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;
        
        // Delete file from storage
        const { error: storageError } = await supabase.storage
            .from('student-files')
            .remove([currentFilePath]);
        
        if (storageError) throw storageError;
        
        // Delete metadata from database
        const { error: dbError } = await supabase
            .from('files')
            .delete()
            .eq('id', currentFileId);
        
        if (dbError) throw dbError;
        
        // Reload files
        await loadUserFiles(user.id);
        
        // Hide modal
        hideModal('file-preview-modal');
    } catch (error) {
        console.error('Failed to delete file:', error);
        alert('Failed to delete file. Please try again.');
    }
} 