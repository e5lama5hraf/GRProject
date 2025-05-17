/**
 * Supabase Configuration
 * This file initializes the Supabase client and exports it for use across the app.
 */

// Import the createClient function from Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Replace with your Supabase URL and anon key
const SUPABASE_URL = 'https://ndidfnjsazqnoyfrdwxu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaWRmbmpzYXpxbm95ZnJkd3h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MzY1NjUsImV4cCI6MjA2MzAxMjU2NX0.XAdttpwLnoz9loSjWAOsDf3e9PtiqRO32A-hprF9qRo';
// Initialize the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test the connection
supabase.auth.getSession().then(
    ({ data, error }) => {
        if (error) {
            console.error('Supabase connection error:', error);
        } else {
            console.log('Supabase connected successfully');
        }
    }
);

/**
 * Checks if user is authenticated and redirects accordingly
 * @param {boolean} requireAuth - Whether authentication is required for the current page
 */
export async function checkAuth(requireAuth = true) {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        const authPages = ['index.html'];
        const protectedPages = ['home.html', 'settings.html', 'files.html'];
        
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        if (!session && requireAuth) {
            // Not authenticated but trying to access protected page
            if (protectedPages.includes(currentPage)) {
                window.location.href = 'index.html';
                return false;
            }
        } else if (session && authPages.includes(currentPage)) {
            // Already authenticated but trying to access auth page
            window.location.href = 'home.html';
            return false;
        }
        
        return session?.user || null;
    } catch (error) {
        console.error('Auth check error:', error);
        if (requireAuth) {
            window.location.href = 'index.html';
        }
        return null;
    }
}

/**
 * Displays error message
 * @param {string} elementId - ID of the error message element
 * @param {string} message - Error message to display
 */
export function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}

/**
 * Displays success message
 * @param {string} elementId - ID of the success message element
 * @param {string} message - Success message to display
 */
export function showSuccess(elementId, message) {
    const successElement = document.getElementById(elementId);
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 5000);
    }
}

/**
 * Converts file size to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Human-readable file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file icon based on file type
 * @param {string} filename - Name of the file
 * @returns {string} HTML for the file icon
 */
function getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    let icon = '';
    
    switch(extension) {
        case 'pdf':
            icon = '<span class="file-icon">PDF</span>';
            break;
        case 'doc':
        case 'docx':
            icon = '<span class="file-icon">DOC</span>';
            break;
        case 'xls':
        case 'xlsx':
            icon = '<span class="file-icon">XLS</span>';
            break;
        case 'ppt':
        case 'pptx':
            icon = '<span class="file-icon">PPT</span>';
            break;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
            icon = '<span class="file-icon">IMG</span>';
            break;
        default:
            icon = '<span class="file-icon">FILE</span>';
    }
    
    return icon;
}

/**
 * Format date to human-readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Show a modal
 * @param {string} modalId - ID of the modal element
 */
export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

/**
 * Hide a modal
 * @param {string} modalId - ID of the modal element
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
} 

async function initializeDatabase() {
    try {
        const { error: archiveError } = await supabase.rpc('create_archive_table_if_not_exists');
        if (archiveError) throw archiveError;
        
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

initializeDatabase();