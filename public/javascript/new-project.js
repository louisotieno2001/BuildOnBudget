document.addEventListener('DOMContentLoaded', async () => {
    const authFetch = (window.utils && window.utils.authFetch) ? window.utils.authFetch : fetch;
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
            showToast('Please fill in all required fields', 'error');
            return;
        }

        const payload = {
            name: projectName,
            type: projectType,
            client_name: clientName,
            client_contact: clientContact,
            location: projectLocation,
            description: projectDescription,
            budget: projectBudget,
            start_date: projectStartDate,
            end_date: projectEndDate,
            materials,
            contractors,
            permits,
            safety,
            attachment_name: null,
            attachment_type: null,
            attachment_base64: null
        };

        const attachment = document.getElementById('attachments').files[0];
        if (attachment) {
            payload.attachment_name = attachment.name;
            payload.attachment_type = attachment.type || 'application/octet-stream';
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('Failed to read attachment'));
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(attachment);
            });
            payload.attachment_base64 = typeof dataUrl === 'string' ? dataUrl.split(',')[1] : null;
        }

        // Loading state during submit
        const submitButton = document.getElementById('create-project-button');
        const originalText = window.utils.showLoading(submitButton);

        try {
            const response = await authFetch('/new-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            window.utils.hideLoading(submitButton, originalText);

            if (response.ok) {
                const result = await response.json();
                showToast('Project created successfully!', 'success');
                window.location.href = `/dashboard`; // Redirect to dashboard or project page
            } else {
                const error = await response.json();
                showToast(`Error: ${error.message}`, 'error');
                window.utils.hideLoading(submitButton, originalText);
            }
        } catch (error) {
            console.error('Error creating project:', error);
            showToast('An error occurred while creating the project. Please try again.', 'error');
            window.utils.hideLoading(submitButton, originalText);
        }
    });

    // No loading state outside submit
})
