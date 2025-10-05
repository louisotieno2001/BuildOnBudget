document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('new-task-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const projectId = document.getElementById('project_id').value;
        const taskName = document.getElementById('name').value;
        const taskDescription = document.getElementById('description').value;
        const assignedTo = document.getElementById('assigned_to').value;
        const startDate = document.getElementById('start_date').value;
        const endDate = document.getElementById('end_date').value;
        const priority = document.getElementById('priority').value;
        const status = document.getElementById('status').value;

        if (!projectId || !taskName) {
            alert('Please fill in all required fields');
            return;
        }

        const taskData = {
            project_id: projectId,
            name: taskName,
            description: taskDescription,
            assigned_to: assignedTo,
            start_date: startDate,
            end_date: endDate,
            priority: priority,
            status: status,
        };

        try {
            const response = await fetch('/new-task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });

            if (response.ok) {
                const result = await response.json();
                alert('Task created successfully!');
                window.location.href = `/dashboard`; // Redirect to dashboard
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error('Error creating task:', error);
            alert('An error occurred while creating the task. Please try again.');
        }
    });
})
