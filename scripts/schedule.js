/**
 * Schedule Module
 * Manages weekly class schedule using FullCalendar library
 */

import { supabase, checkAuth, showError, showSuccess, showModal, hideModal } from './supabase.js';

let calendar;
let currentScheduleId = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = await checkAuth(true);
    if (!user) return;
    
    // Initialize schedule components
    initCalendar();
    initScheduleModal();
    
    // Load user's schedule data
    loadUserSchedule(user.id);
});

/**
 * Initialize the FullCalendar instance
 */
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: '',
            center: 'title',
            right: ''
        },
        allDaySlot: false,
        slotMinTime: '07:00:00',
        slotMaxTime: '22:00:00',
        height: 'auto',
        weekends: true,
        slotLabelFormat: {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        },
        eventClick: function(info) {
            openScheduleModal(info.event);
        }
    });
    
    calendar.render();
}

/**
 * Initialize schedule modal events
 */
function initScheduleModal() {
    // Add button click
    const addScheduleBtn = document.getElementById('add-schedule-btn');
    if (addScheduleBtn) {
        addScheduleBtn.addEventListener('click', () => openScheduleModal());
    }
    
    // Form submission
    const scheduleForm = document.getElementById('schedule-form');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', handleScheduleSubmit);
    }
    
    // Delete button click
    const deleteScheduleBtn = document.getElementById('delete-schedule-btn');
    if (deleteScheduleBtn) {
        deleteScheduleBtn.addEventListener('click', handleScheduleDelete);
    }
    
    // Close modal buttons
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            hideModal('schedule-modal');
        });
    });
}

/**
 * Load user's schedule data from Supabase
 * @param {string} userId - User ID
 */
async function loadUserSchedule(userId) {
    try {
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .eq('user_id', userId);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            // Convert schedule data to FullCalendar events
            const events = data.map(schedule => {
                const dayNumber = parseInt(schedule.day);
                const startDate = getDateForDayOfWeek(dayNumber);
                const endDate = new Date(startDate);
                
                // Set hours from time strings
                const startParts = schedule.start_time.split(':');
                const endParts = schedule.end_time.split(':');
                
                startDate.setHours(parseInt(startParts[0]), parseInt(startParts[1]));
                endDate.setHours(parseInt(endParts[0]), parseInt(endParts[1]));
                
                return {
                    id: schedule.id,
                    title: schedule.class_name,
                    start: startDate,
                    end: endDate,
                    daysOfWeek: [dayNumber],
                    startTime: schedule.start_time,
                    endTime: schedule.end_time,
                    extendedProps: {
                        room: schedule.room,
                        professor: schedule.professor,
                        scheduleId: schedule.id
                    },
                    backgroundColor: '#6f42c1'
                };
            });
            
            // Add events to calendar
            events.forEach(event => {
                calendar.addEvent(event);
            });
        }
    } catch (error) {
        console.error('Failed to load schedule:', error);
    }
}

/**
 * Open schedule modal for adding or editing
 * @param {Object} event - FullCalendar event object (null for new events)
 */
function openScheduleModal(event = null) {
    const modalTitle = document.getElementById('schedule-modal-title');
    const scheduleForm = document.getElementById('schedule-form');
    const deleteBtn = document.getElementById('delete-schedule-btn');
    
    // Reset form
    scheduleForm.reset();
    
    if (event) {
        // Editing existing schedule
        modalTitle.textContent = 'Edit Class';
        deleteBtn.style.display = 'block';
        
        // Set form values
        document.getElementById('schedule-id').value = event.extendedProps.scheduleId;
        document.getElementById('class-name').value = event.title;
        document.getElementById('class-day').value = event.daysOfWeek[0];
        document.getElementById('class-start').value = event.startTime;
        document.getElementById('class-end').value = event.endTime;
        document.getElementById('class-room').value = event.extendedProps.room || '';
        document.getElementById('class-professor').value = event.extendedProps.professor || '';
        
        currentScheduleId = event.extendedProps.scheduleId;
    } else {
        // Adding new schedule
        modalTitle.textContent = 'Add Class';
        deleteBtn.style.display = 'none';
        currentScheduleId = null;
    }
    
    // Show modal
    showModal('schedule-modal');
}

/**
 * Handle schedule form submission
 * @param {Event} event - Form submit event
 */
async function handleScheduleSubmit(event) {
    event.preventDefault();
    
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    
    const scheduleId = document.getElementById('schedule-id').value;
    const className = document.getElementById('class-name').value;
    const day = document.getElementById('class-day').value;
    const startTime = document.getElementById('class-start').value;
    const endTime = document.getElementById('class-end').value;
    const room = document.getElementById('class-room').value;
    const professor = document.getElementById('class-professor').value;
    
    // Validate form
    if (!className || !day || !startTime || !endTime) {
        alert('Please fill in all required fields.');
        return;
    }
    
    try {
        if (scheduleId) {
            // Update existing schedule
            const { error } = await supabase
                .from('schedules')
                .update({
                    class_name: className,
                    day: day,
                    start_time: startTime,
                    end_time: endTime,
                    room: room,
                    professor: professor
                })
                .eq('id', scheduleId);
            
            if (error) throw error;
            
            // Update calendar event
            const existingEvent = calendar.getEventById(scheduleId);
            if (existingEvent) {
                existingEvent.remove();
            }
        } else {
            // Add new schedule
            const { data, error } = await supabase
                .from('schedules')
                .insert([
                    {
                        user_id: user.id,
                        class_name: className,
                        day: day,
                        start_time: startTime,
                        end_time: endTime,
                        room: room,
                        professor: professor
                    }
                ])
                .select();
            
            if (error) throw error;
            
            // Set schedule ID for the new event
            if (data && data.length > 0) {
                currentScheduleId = data[0].id;
            }
        }
        
        // Add/update event on calendar
        const dayNumber = parseInt(day);
        const startDate = getDateForDayOfWeek(dayNumber);
        const endDate = new Date(startDate);
        
        // Set hours from time strings
        const startParts = startTime.split(':');
        const endParts = endTime.split(':');
        
        startDate.setHours(parseInt(startParts[0]), parseInt(startParts[1]));
        endDate.setHours(parseInt(endParts[0]), parseInt(endParts[1]));
        
        calendar.addEvent({
            id: currentScheduleId,
            title: className,
            start: startDate,
            end: endDate,
            daysOfWeek: [dayNumber],
            startTime: startTime,
            endTime: endTime,
            extendedProps: {
                room: room,
                professor: professor,
                scheduleId: currentScheduleId
            },
            backgroundColor: '#6f42c1'
        });
        
        // Hide modal
        hideModal('schedule-modal');
    } catch (error) {
        console.error('Failed to save schedule:', error);
        alert('Failed to save schedule. Please try again.');
    }
}

/**
 * Handle schedule deletion
 */
async function handleScheduleDelete() {
    if (!currentScheduleId) return;
    
    if (!confirm('Are you sure you want to delete this class?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('id', currentScheduleId);
        
        if (error) throw error;
        
        // Remove event from calendar
        const existingEvent = calendar.getEventById(currentScheduleId);
        if (existingEvent) {
            existingEvent.remove();
        }
        
        // Hide modal
        hideModal('schedule-modal');
    } catch (error) {
        console.error('Failed to delete schedule:', error);
        alert('Failed to delete schedule. Please try again.');
    }
}

/**
 * Get a Date object for a specific day of the week
 * @param {number} dayOfWeek - Day of the week (0 = Sunday, 1 = Monday, etc.)
 * @returns {Date} Date object for the specified day of the current week
 */
function getDateForDayOfWeek(dayOfWeek) {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const distance = dayOfWeek - currentDay;
    
    // Clone current date and add/subtract days to get to the desired day
    const date = new Date(now);
    date.setDate(date.getDate() + distance);
    
    // Reset time part
    date.setHours(0, 0, 0, 0);
    
    return date;
} 