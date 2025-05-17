/**
 * Settings Module
 * Handles user profile and account settings
 */

import { supabase, checkAuth, showError, showSuccess } from './supabase.js';

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is authenticated
    const user = await checkAuth(true);
    if (user) {
        await loadUserProfile(user);
        initSettingsHandlers();
    }
});

/**
 * Load user profile data
 * @param {Object} user - Current user object
 */
async function loadUserProfile(user) {
    try {
        // Check if profile exists
        const { data: profile, error: fetchError } = await supabase
            .from('students')
            .select('*')
            .eq('user_id', user.id)
            .single();
            
        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 is "no rows found" error, which is expected if profile doesn't exist
            console.error('Error fetching profile:', fetchError);
            throw fetchError;
        }
        
        // If profile doesn't exist, create an empty one
        if (!profile) {
            const { data: newProfile, error: insertError } = await supabase
                .from('students')
                .insert([
                    {
                        user_id: user.id,
                        email: user.email,
                        full_name: '',
                        faculty: '',
                        academic_year: 1
                    }
                ])
                .select()
                .single();
                
            if (insertError) {
                console.error('Error creating profile:', insertError);
                throw insertError;
            }
            
            // Use the newly created profile
            populateProfileForm(newProfile);
        } else {
            // Use existing profile
            populateProfileForm(profile);
        }
    } catch (error) {
        console.error('Profile loading error:', error);
        showError('settings-error', `Failed to load profile: ${error.message}`);
    }
}

/**
 * Populate profile form with user data
 * @param {Object} profile - User profile data
 */
function populateProfileForm(profile) {
    const fullNameInput = document.getElementById('profile-fullname');
    const emailInput = document.getElementById('profile-email');
    const facultyInput = document.getElementById('profile-faculty');
    const academicYearInput = document.getElementById('profile-year');
    
    if (fullNameInput) fullNameInput.value = profile.full_name || '';
    if (emailInput) emailInput.value = profile.email || '';
    if (facultyInput) facultyInput.value = profile.faculty || '';
    if (academicYearInput) academicYearInput.value = profile.academic_year || '1';
}

/**
 * Initialize settings form handlers
 */
function initSettingsHandlers() {
    // Profile update form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    // Password update form
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordUpdate);
    }
}

/**
 * Handle profile update form submission
 * @param {Event} e - Form submit event
 */
async function handleProfileUpdate(e) {
    e.preventDefault();
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');
        
        const fullName = document.getElementById('profile-fullname').value;
        const faculty = document.getElementById('profile-faculty').value;
        const academicYear = document.getElementById('profile-year').value;
        
        // Update profile in database
        const { error } = await supabase
            .from('students')
            .update({
                full_name: fullName,
                faculty: faculty,
                academic_year: parseInt(academicYear)
            })
            .eq('user_id', user.id);
            
        if (error) throw error;
        
        showSuccess('profile-error', 'Profile updated successfully');
    } catch (error) {
        console.error('Profile update error:', error);
        showError('profile-error', `Failed to update profile: ${error.message}`);
    }
}

/**
 * Handle password update form submission
 * @param {Event} e - Form submit event
 */
async function handlePasswordUpdate(e) {
    e.preventDefault();
    
    try {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Validate new passwords match
        if (newPassword !== confirmPassword) {
            showError('password-error', 'New passwords do not match');
            return;
        }
        
        // Update password
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        // Clear form
        e.target.reset();
        
        showSuccess('password-error', 'Password updated successfully');
    } catch (error) {
        console.error('Password update error:', error);
        showError('password-error', `Failed to update password: ${error.message}`);
    }
} 

