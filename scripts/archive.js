/**
 * Archive Module
 * Handles shared files archive for students in same university and academic year
 */

import { supabase, checkAuth, showError, showSuccess, showModal, hideModal } from './supabase.js';

let currentUser = null;
let currentUserFaculty = '';
let currentUserYear = 0;

// Initialize archive page
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    currentUser = await checkAuth(true);
    if (!currentUser) return;
    
    // Load user profile to get faculty and year
    await loadUserProfile();
    
    // Initialize UI components
    initArchiveUI();
    
    // Load shared files
    loadSharedFiles();
});

/**
 * Load user profile to get faculty and academic year
 */
async function loadUserProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('students')
            .select('faculty, academic_year')
            .eq('user_id', currentUser.id)
            .single();
            
        if (error) throw error;
        
        currentUserFaculty = profile.faculty;
        currentUserYear = profile.academic_year;
        
        // Populate faculty filter dropdown
        populateFacultyFilter();
    } catch (error) {
        console.error('Failed to load user profile:', error);
    }
}

/**
 * Populate faculty filter dropdown with available faculties
 */
async function populateFacultyFilter() {
    try {
        const { data: faculties, error } = await supabase
            .from('students')
            .select('faculty')
            .neq('faculty', '')
            .not('faculty', 'is', null)
            .order('faculty', { ascending: true });
            
        if (error) throw error;
        
        // Get unique faculties
        const uniqueFaculties = [...new Set(faculties.map(item => item.faculty))];
        
        const facultySelect = document.getElementById('filter-faculty');
        uniqueFaculties.forEach(faculty => {
            const option = document.createElement('option');
            option.value = faculty;
            option.textContent = faculty;
            facultySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load faculties:', error);
    }
}

/**
 * Initialize archive UI components
 */
function initArchiveUI() {
    // Upload button
    const uploadBtn = document.getElementById('upload-archive-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            document.getElementById('archive-dropzone').style.display = 'block';
            document.getElementById('archive-file-input').click();
        });
    }
    
    // File input change
    const fileInput = document.getElementById('archive-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                uploadArchiveFiles(e.target.files);
            }
        });
    }
    
    // Drag and drop
    const dropzone = document.getElementById('archive-dropzone');
    if (dropzone) {
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
                uploadArchiveFiles(e.dataTransfer.files);
            }
        });
    }
    
    // Apply filters button
    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            loadSharedFiles();
        });
    }
    
    // Close modal buttons
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            hideModal('archive-preview-modal');
        });
    });
}

/**
 * Upload files to the shared archive
 * @param {FileList} files - Files to upload
 */
async function uploadArchiveFiles(files) {
    const progressBar = document.getElementById('archive-progress-bar');
    const progressText = document.getElementById('archive-progress-text');
    const uploadProgress = document.getElementById('archive-upload-progress');
    
    // Show progress container
    uploadProgress.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = 'Uploading...';
    
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = file.name;
            const filePath = `archive/${currentUserFaculty}/${currentUserYear}/${Date.now()}_${fileName}`;
            
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
            await saveArchiveMetadata(fileName, filePath, file.type, file.size);
        }
        
        // Hide progress after successful upload
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            document.getElementById('archive-dropzone').style.display = 'none';
        }, 1000);
        
        // Reload files list
        loadSharedFiles();
    } catch (error) {
        console.error('File upload error:', error);
        progressText.textContent = 'Upload failed. Please try again.';
        setTimeout(() => {
            uploadProgress.style.display = 'none';
        }, 3000);
    }
}

/**
 * Save archive file metadata to Supabase database
 * @param {string} fileName - Original file name
 * @param {string} filePath - Path in Supabase Storage
 * @param {string} fileType - MIME type of the file
 * @param {number} fileSize - Size of the file in bytes
 */
async function saveArchiveMetadata(fileName, filePath, fileType, fileSize) {
    try {
        // Get user's full name from profile
        const { data: profile, error: profileError } = await supabase
            .from('students')
            .select('full_name, faculty, academic_year')
            .eq('user_id', currentUser.id)
            .single();
            
        if (profileError) throw profileError;
        
        // Insert archive record
        const { error } = await supabase
            .from('archive')
            .insert([
                {
                    user_id: currentUser.id,
                    user_name: profile.full_name || currentUser.email,
                    faculty: profile.faculty,
                    academic_year: profile.academic_year,
                    file_name: fileName,
                    file_path: filePath,
                    file_type: fileType,
                    file_size: fileSize,
                    uploaded_at: new Date().toISOString()
                }
            ]);
        
        if (error) throw error;
    } catch (error) {
        console.error('Error saving archive metadata:', error);
    }
}

/**
 * Load shared files based on filters
 */
async function loadSharedFiles() {
    try {
        const facultyFilter = document.getElementById('filter-faculty').value;
        const yearFilter = document.getElementById('filter-year').value;
        
        let query = supabase
            .from('archive')
            .select('*')
            .or(`faculty.eq.${currentUserFaculty},academic_year.eq.${currentUserYear}`)
            .order('uploaded_at', { ascending: false });
        
        // Apply additional filters if selected
        if (facultyFilter) {
            query = query.eq('faculty', facultyFilter);
        }
        
        if (yearFilter) {
            query = query.eq('academic_year', parseInt(yearFilter));
        }
        
        const { data: files, error } = await query;
        
        if (error) throw error;
        
        renderArchiveFiles(files || []);
    } catch (error) {
        console.error('Failed to load shared files:', error);
        document.getElementById('archive-files-list').innerHTML = '<div class="empty-state">Failed to load shared files. Please refresh the page.</div>';
    }
}

/**
 * Render archive files to the UI
 * @param {Array} files - Array of file objects
 */
function renderArchiveFiles(files) {
    const filesContainer = document.getElementById('archive-files-list');
    if (!filesContainer) return;
    
    if (files.length === 0) {
        filesContainer.innerHTML = '<div class="empty-state">No shared files found matching your criteria.</div>';
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
                <div class="file-owner">${file.user_name}</div>
                <div class="file-type">${fileTypeDisplay}</div>
                <div class="file-size">${fileSizeDisplay}</div>
                <div class="file-date">${uploadedAt}</div>
                <div class="file-actions">
                    <button type="button" class="preview-file-btn" 
                        data-id="${file.id}" 
                        data-path="${file.file_path}" 
                        data-name="${file.file_name}">
                        View
                    </button>
                </div>
            </div>
        `;
    });
    
    filesContainer.innerHTML = filesList;
    
    // Add event listeners to preview buttons
    document.querySelectorAll('.preview-file-btn').forEach(button => {
        button.addEventListener('click', handleArchiveFilePreview);
    });
}

/**
 * Handle archive file preview
 * @param {Event} event - Click event
 */
async function handleArchiveFilePreview(event) {
    const filePath = event.target.getAttribute('data-path');
    const fileName = event.target.getAttribute('data-name');
    
    // Update modal title
    document.getElementById('archive-file-preview-name').textContent = fileName;
    
    // Set download link
    const downloadBtn = document.getElementById('archive-download-file-btn');
    const { data: { publicUrl } } = supabase.storage
        .from('student-files')
        .getPublicUrl(filePath);
    
    downloadBtn.href = publicUrl;
    downloadBtn.setAttribute('download', fileName);
    
    // Load preview content
    const previewContainer = document.getElementById('archive-file-preview-container');
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
    showModal('archive-preview-modal');
}

/**
 * Format date to human readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format file size to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file icon based on file extension
 * @param {string} fileName - File name
 * @returns {string} Icon HTML
 */
function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
        case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg':
            return '🖼️';
        case 'pdf':
            return '📄';
        case 'doc': case 'docx':
            return '📝';
        case 'xls': case 'xlsx':
            return '📊';
        case 'ppt': case 'pptx':
            return '📈';
        case 'zip': case 'rar': case '7z':
            return '🗜️';
        case 'mp3': case 'wav':
            return '🎵';
        case 'mp4': case 'mov': case 'avi':
            return '🎬';
        case 'txt':
            return '📄';
        default:
            return '📁';
    }
}