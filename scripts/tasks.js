/**
 * Tasks Module
 * Manages user tasks with CRUD operations
 */

import { supabase, checkAuth, showError, showSuccess, showModal, hideModal } from './supabase.js';

// Format date to YYYY-MM-DD
function formatDate(date) {
    return new Date(date).toISOString().split('T')[0];
}

let currentTaskId = null;

document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication
    const user = await checkAuth(true);
    if (!user) return;

    // Initialize tasks components
    initTasksUI();

    // Load user's tasks
    loadUserTasks(user.id);
});

/**
 * Initialize tasks UI components
 */
function initTasksUI() {
    // Add task button
    const addTaskBtn = document.getElementById('add-task-btn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => openTaskModal());
    }

    // Task form submission
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', handleTaskSubmit);
    }

    // Delete task button
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    if (deleteTaskBtn) {
        deleteTaskBtn.addEventListener('click', handleTaskDelete);
    }

    // Close modal buttons
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            hideModal('task-modal');
        });
    });
}

/**
 * Load user's tasks from Supabase
 * @param {string} userId - User ID
 */
async function loadUserTasks(userId) {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .order('due_date', { ascending: true });

        if (error) throw error;

        renderTasks(data || []);
    } catch (error) {
        console.error('Failed to load tasks:', error);
        document.getElementById('tasks-list').innerHTML = '<div class="empty-state">Failed to load tasks. Please refresh the page.</div>';
    }
}

/**
 * Render tasks to the UI
 * @param {Array} tasks - Array of task objects
 */
function renderTasks(tasks) {
    const tasksContainer = document.getElementById('tasks-list');
    if (!tasksContainer) return;

    if (tasks.length === 0) {
        tasksContainer.innerHTML = '<div class="empty-state">No tasks yet. Add your first task!</div>';
        return;
    }

    let tasksList = '';

    tasks.forEach(task => {
        const dueDate = new Date(task.due_date);
        const isOverdue = dueDate < new Date() && !task.completed;
        const dueDateStr = formatDate(task.due_date);

        tasksList += `
            <div class="task-item ${task.completed ? 'task-completed' : ''} ${isOverdue ? 'task-overdue' : ''}">
                <input type="checkbox" class="task-checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                <div class="task-content">
                    <div class="task-title">
                        ${task.title}
                        <span class="task-priority priority-${task.priority}">${task.priority}</span>
                    </div>
                    <div class="task-details">
                        Due: ${dueDateStr}
                    </div>
                </div>
                <div class="task-actions">
                    <button type="button" class="edit-task-btn" data-id="${task.id}">Edit</button>
                </div>
            </div>
        `;
    });

    tasksContainer.innerHTML = tasksList;

    // Add event listeners to checkboxes and edit buttons
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleTaskCompletion);
    });

    document.querySelectorAll('.edit-task-btn').forEach(button => {
        button.addEventListener('click', handleTaskEdit);
    });
}

/**
 * Open task modal for adding or editing
 * @param {Object} task - Task object (null for new tasks)
 */
function openTaskModal(task = null) {
    const modalTitle = document.getElementById('task-modal-title');
    const taskForm = document.getElementById('task-form');
    const deleteBtn = document.getElementById('delete-task-btn');

    // Reset form
    taskForm.reset();

    if (task) {
        // Editing existing task
        modalTitle.textContent = 'Edit Task';
        deleteBtn.style.display = 'block';

        // Format date for input field (YYYY-MM-DD)
        const dueDate = new Date(task.due_date);
        const formattedDate = dueDate.toISOString().split('T')[0];

        // Set form values
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-due-date').value = formattedDate;
        document.getElementById('task-priority').value = task.priority;

        currentTaskId = task.id;
    } else {
        // Adding new task
        modalTitle.textContent = 'Add Task';
        deleteBtn.style.display = 'none';

        // Set default due date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('task-due-date').value = today;
        document.getElementById('task-priority').value = 'medium';

        currentTaskId = null;
    }

    // Show modal
    showModal('task-modal');
}

/**
 * Handle task form submission
 * @param {Event} event - Form submit event
 */
async function handleTaskSubmit(event) {
    event.preventDefault();

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const taskId = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const dueDate = document.getElementById('task-due-date').value;
    const priority = document.getElementById('task-priority').value;

    // Validate form
    if (!title || !dueDate) {
        alert('Please fill in all required fields.');
        return;
    }

    try {
        if (taskId) {
            // Update existing task
            const { error } = await supabase
                .from('tasks')
                .update({
                    title: title,
                    description: description,
                    due_date: dueDate,
                    priority: priority
                })
                .eq('id', taskId);

            if (error) throw error;
        } else {
            // Add new task
            const { error } = await supabase
                .from('tasks')
                .insert([
                    {
                        user_id: user.id,
                        title: title,
                        description: description,
                        due_date: dueDate,
                        priority: priority,
                        completed: false
                    }
                ]);

            if (error) throw error;
        }

        // Reload tasks
        await loadUserTasks(user.id);

        // Hide modal
        hideModal('task-modal');
    } catch (error) {
        console.error('Failed to save task:', error);
        alert('Failed to save task. Please try again.');
    }
}

/**
 * Handle task deletion
 */
async function handleTaskDelete() {
    if (!currentTaskId) return;

    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    try {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;

        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', currentTaskId);

        if (error) throw error;

        // Reload tasks
        await loadUserTasks(user.id);

        // Hide modal
        hideModal('task-modal');
    } catch (error) {
        console.error('Failed to delete task:', error);
        alert('Failed to delete task. Please try again.');
    }
}

/**
 * Handle task completion toggle
 * @param {Event} event - Change event from checkbox
 */
async function handleTaskCompletion(event) {
    const taskId = event.target.getAttribute('data-id');
    const completed = event.target.checked;

    try {
        const { error } = await supabase
            .from('tasks')
            .update({ completed: completed })
            .eq('id', taskId);

        if (error) throw error;

        // Update task item in the UI
        const taskItem = event.target.closest('.task-item');
        if (completed) {
            taskItem.classList.add('task-completed');
        } else {
            taskItem.classList.remove('task-completed');
        }
    } catch (error) {
        console.error('Failed to update task completion:', error);
        // Revert checkbox state
        event.target.checked = !completed;
    }
}

/**
 * Handle task edit button click
 * @param {Event} event - Click event
 */
async function handleTaskEdit(event) {
    const taskId = event.target.getAttribute('data-id');

    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();

        if (error) throw error;

        openTaskModal(data);
    } catch (error) {
        console.error('Failed to get task details:', error);
        alert('Failed to load task details. Please try again.');
    }
} 