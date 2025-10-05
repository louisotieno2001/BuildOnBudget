document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('new-project-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const projectName = document.getElementById('name').value;
        const projectType = document.getElementById('type').value;
        const clientName = document.getElementById('client_name').value;
        const clientContact = document.getElementById('client_contact').value;
        const projectLocation = document.getElementById('location').value;
        const projectDescription = document.getElementById('description').value;
        const projectBudget = document.getElementById('budget').value;
        const projectStartDate = document.getElementById('start_date').value;
        const projectEndDate = document.getElementById('end_date').value;
        const materials = document.getElementById('materials').value;
        const contractors = document.getElementById('contractors').value;
        const permits = document.getElementById('permits').value;
        const safety = document.getElementById('safety').value;
        const attachments = document.getElementById('attachments').files;

        if (!projectName || !projectType || !projectLocation || !projectBudget || !projectStartDate) {
            alert('Please fill in all required fields');
            return;
        }

        const formData = new FormData();
        formData.append('name', projectName);
        formData.append('type', projectType);
        formData.append('client_name', clientName);
        formData.append('client_contact', clientContact);
        formData.append('location', projectLocation);
        formData.append('description', projectDescription);
        formData.append('budget', projectBudget);
        formData.append('start_date', projectStartDate);
        formData.append('end_date', projectEndDate);
        formData.append('materials', materials);
        formData.append('contractors', contractors);
        formData.append('permits', permits);
        formData.append('safety', safety);
        for (let file of attachments) {
            formData.append('attachments', file);
        }

        try {
            const response = await fetch('/new-project', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                alert('Project created successfully!');
                window.location.href = `/dashboard`; // Redirect to dashboard or project page
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error('Error creating project:', error);
            alert('An error occurred while creating the project. Please try again.');
        }
    });
})
