/**
 * Auth Module
 * Handles user authentication using Supabase Auth
 */

import { supabase, showError, showSuccess } from './supabase.js';

// Handle tab switching
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const authForms = document.querySelectorAll('.auth-form');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Update active tab button
            tabBtns.forEach(btn => btn.classList.remove('active'));
            btn.classList.add('active');
            
            // Show selected form
            authForms.forEach(form => {
                if (form.id === `${tabId}-form`) {
                    form.classList.add('active');
                } else {
                    form.classList.remove('active');
                }
            });
        });
    });
    
    // Initialize login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Initialize registration form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Initialize logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});

/**
 * Handle login form submission
 * @param {Event} e - Form submit event
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    
    if (!emailInput || !passwordInput) {
        console.error('Login form elements not found');
        return;
    }
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        // Redirect to Home on successful login
        window.location.href = 'home.html';
    } catch (error) {
        console.error('Login error:', error);
        showError('login-error', `Login failed: ${error.message}`);
    }
}

/**
 * Handle registration form submission
 * @param {Event} e - Form submit event
 */
async function handleRegister(e) {
    e.preventDefault();
    
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    const confirmPasswordInput = document.getElementById('register-confirm-password');
    
    if (!emailInput || !passwordInput || !confirmPasswordInput) {
        console.error('Registration form elements not found');
        return;
    }
    
    const email = emailInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showError('register-error', 'Passwords do not match');
        return;
    }
    
    try {
        // Register user with Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });
        
        if (authError) {
            console.error('Auth error:', authError);
            throw new Error(`Authentication failed: ${authError.message}`);
        }
        
        showSuccess('register-error', 'Registration successful! Please check your email for verification.');
        e.target.reset();
        
        // Switch to login tab
        document.querySelector('[data-tab="login"]').click();
        
    } catch (error) {
        console.error('Registration error:', error);
        showError('register-error', `Registration failed: ${error.message}`);
    }
}

/**
 * Logs out the current user
 */
export async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // Redirect to login page
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert(`Failed to log out: ${error.message}`);
    }
} 


async function displayUserName() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabase
            .from('students')
            .select('full_name')
            .eq('user_id', user.id)
            .single();

        if (error) throw error;

        const userName = document.getElementById('user-name');
        if (userName) {
            userName.textContent = profile.full_name || user.email;
        }
    } catch (error) {
        console.error('Error fetching user name:', error);
    }
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', displayUserName);