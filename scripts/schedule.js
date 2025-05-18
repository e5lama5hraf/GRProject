/**
 * Schedule Module - Improved Version
 * Manages weekly class schedule using FullCalendar with better UX
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
    initViewOptions();
    
    // Load user's schedule data
    loadUserSchedule(user.id);
});

/**
 * Initialize the FullCalendar instance with improved configuration
 */
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay,listWeek'
        },
        allDaySlot: false,
        slotMinTime: '07:00:00',
        slotMaxTime: '22:00:00',
        height: 'auto',
        weekends: true,
        editable: true, // Enable drag-and-drop
        selectable: true, // Enable date/time selection
        selectMirror: true,
        dayMaxEvents: true,
        slotLabelFormat: {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        },
        eventClick: function(info) {
            openScheduleModal(info.event);
        },
        eventDidMount: function(info) {
            // Add action buttons to events
            const eventEl = info.el;
            const titleEl = eventEl.querySelector('.fc-event-title');
            
            if (titleEl) {
                titleEl.innerHTML = `
                    ${info.event.title}
                    <div class="fc-event-actions">
                        <button class="fc-event-action edit-event" title="Edit">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="fc-event-action delete-event" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                // Add event listeners to action buttons
                eventEl.querySelector('.edit-event').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openScheduleModal(info.event);
                });
                
                eventEl.querySelector('.delete-event').addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentScheduleId = info.event.extendedProps.scheduleId;
                    handleScheduleDelete();
                });
            }
        },
        select: function(info) {
            // When user selects time slot, open modal to add new event
            currentScheduleId = null;
            document.getElementById('schedule-form').reset();
            document.getElementById('schedule-modal-title').textContent = 'Add Class';
            document.getElementById('delete-schedule-btn').style.display = 'none';
            
            // Set default time values
            document.getElementById('class-start').value = formatTime(info.start);
            document.getElementById('class-end').value = formatTime(info.end);
            
            showModal('schedule-modal');
            calendar.unselect();
        },
        eventDrop: async function(info) {
            // Handle event drag-and-drop
            try {
                const event = info.event;
                const dayOfWeek = event.start.getDay();
                const startTime = formatTime(event.start);
                const endTime = formatTime(event.end);
                
                const { error } = await supabase
                    .from('schedules')
                    .update({
                        day: dayOfWeek,
                        start_time: startTime,
                        end_time: endTime
                    })
                    .eq('id', event.extendedProps.scheduleId);
                
                if (error) throw error;
                
                showSuccess('Schedule updated successfully');
            } catch (error) {
                console.error('Failed to update schedule:', error);
                info.revert();
                showError('Failed to update schedule');
            }
        },
        eventResize: async function(info) {
            // Handle event resizing
            try {
                const event = info.event;
                const endTime = formatTime(event.end);
                
                const { error } = await supabase
                    .from('schedules')
                    .update({
                        end_time: endTime
                    })
                    .eq('id', event.extendedProps.scheduleId);
                
                if (error) throw error;
                
                showSuccess('Schedule updated successfully');
            } catch (error) {
                console.error('Failed to update schedule:', error);
                info.revert();
                showError('Failed to update schedule');
            }
        },

        eventContent: function(arg) {
            return {
                html: `
                    <div class="fc-event-main">
                        <div class="fc-event-title">
                            ${arg.event.title}
                            <div class="fc-event-actions">
                                <button class="fc-event-edit" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="fc-event-delete" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="fc-event-details">
                            ${arg.timeText} • ${arg.event.extendedProps.room || ''}
                        </div>
                    </div>
                `
            };
        },
        
        eventDidMount: function(info) {
            // إضافة حدث النقر لزر التعديل
            info.el.querySelector('.fc-event-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                openScheduleModal(info.event);
            });
            
            // إضافة حدث النقر لزر الحذف
            info.el.querySelector('.fc-event-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                currentScheduleId = info.event.extendedProps.scheduleId;
                if (confirm('Are you sure you want to delete this event?')) {
                    handleScheduleDelete();
                }
            });
        },
    });
    
    calendar.render();
}

/**
 * Initialize view option buttons
 */
function initViewOptions() {
    const viewOptions = document.querySelectorAll('.view-option');
    viewOptions.forEach(option => {
        option.addEventListener('click', () => {
            viewOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            calendar.changeView(option.dataset.view);
        });
    });
}

/**
 * Format time to HH:MM
 */
function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
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
    const deleteBtn = document.getElementById('delete-schedule-btn');
    
    // Reset form
    document.getElementById('schedule-form').reset();
    
    if (event) {
        // Editing existing event
        modalTitle.textContent = "Edit Event";
        deleteBtn.style.display = 'block';
        
        // Fill form with event data
        document.getElementById('schedule-id').value = event.extendedProps.scheduleId;
        document.getElementById('class-name').value = event.title;
        document.getElementById('class-day').value = event.extendedProps.day;
        document.getElementById('class-start').value = event.extendedProps.start_time;
        document.getElementById('class-end').value = event.extendedProps.end_time;
        document.getElementById('class-room').value = event.extendedProps.room || '';
        document.getElementById('class-professor').value = event.extendedProps.professor || '';
        
        currentScheduleId = event.extendedProps.scheduleId;
    } else {
        // Adding new event
        modalTitle.textContent = "Add New Event";
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