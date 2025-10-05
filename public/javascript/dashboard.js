function markDone(id, btn) {
  console.log('Marking task as done:', id);
  btn.disabled = true;
  btn.textContent = 'Updating...';
  fetch(`/task/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'completed' })
  }).then(response => {
    console.log('Response status:', response.status);
    if (response.ok) {
      showToast('Task marked as completed', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      console.error('Error response:', response);
      btn.disabled = false;
      btn.textContent = 'Done';
      showToast('Error updating task', 'error');
    }
  }).catch(error => {
    console.error('Error marking task as done:', error);
    btn.disabled = false;
    btn.textContent = 'Done';
    showToast('An error occurred', 'error');
  });
}

function deleteTask(id, btn) {
  console.log('Deleting task:', id);
  if (confirm('Are you sure you want to delete this task?')) {
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    fetch(`/task/${id}`, {
      method: 'DELETE'
    }).then(response => {
      console.log('Response status:', response.status);
      if (response.ok) {
        showToast('Task deleted', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        console.error('Error response:', response);
        btn.disabled = false;
        btn.textContent = 'Delete';
        showToast('Error deleting task', 'error');
      }
    }).catch(error => {
      console.error('Error deleting task:', error);
      btn.disabled = false;
      btn.textContent = 'Delete';
      showToast('An error occurred', 'error');
    });
  }
}

function editTask(id) {
  window.location.href = `/edit-task/${id}`;
}

function editBudget(id) {
  window.location.href = `/edit-budget/${id}`;
}

function deleteBudget(id, btn) {
  console.log('Deleting budget:', id);
  if (confirm('Are you sure you want to delete this budget?')) {
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    fetch(`/budget/${id}`, {
      method: 'DELETE'
    }).then(response => {
      console.log('Response status:', response.status);
      if (response.ok) {
        showToast('Budget deleted', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        console.error('Error response:', response);
        btn.disabled = false;
        btn.textContent = 'Delete';
        showToast('Error deleting budget', 'error');
      }
    }).catch(error => {
      console.error('Error deleting budget:', error);
      btn.disabled = false;
      btn.textContent = 'Delete';
      showToast('An error occurred', 'error');
    });
  }
}

function acceptInvite(id) {
  console.log('Accepting invite:', id);
  fetch(`/team/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'accepted' })
  }).then(response => {
    console.log('Response status:', response.status);
    if (response.ok) {
      showToast('Invitation accepted', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      console.error('Error response:', response);
      showToast('Error accepting invitation', 'error');
    }
  }).catch(error => {
    console.error('Error accepting invite:', error);
    showToast('An error occurred', 'error');
  });
}

// Sidebar toggle
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobile-overlay');
let sidebarOpen = false;

sidebarToggle.addEventListener('click', () => {
  sidebarOpen = !sidebarOpen;
  if (sidebarOpen) {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    mobileOverlay.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
    mobileOverlay.classList.add('hidden');
  }
});

mobileOverlay.addEventListener('click', () => {
  sidebarOpen = false;
  sidebar.classList.add('-translate-x-full');
  sidebar.classList.remove('translate-x-0');
  mobileOverlay.classList.add('hidden');
});

// Profile dropdown toggle
const profileToggle = document.getElementById('profile-toggle');
const profileDropdown = document.getElementById('profile-dropdown');
let profileOpen = false;

profileToggle.addEventListener('click', () => {
  profileOpen = !profileOpen;
  if (profileOpen) {
    profileDropdown.classList.remove('hidden');
  } else {
    profileDropdown.classList.add('hidden');
  }
});

document.addEventListener('click', (e) => {
  if (!profileToggle.contains(e.target) && !profileDropdown.contains(e.target)) {
    profileOpen = false;
    profileDropdown.classList.add('hidden');
  }
});

// Tabs
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
let activeTab = 'dashboard';

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    activeTab = button.dataset.tab;
    updateTabs();
    sidebarOpen = false;
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
    mobileOverlay.classList.add('hidden');
  });
});

function updateTabs() {
  tabContents.forEach(content => {
    if (content.id === `tab-${activeTab}`) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });
  tabButtons.forEach(button => {
    if (button.dataset.tab === activeTab) {
      button.classList.add('bg-accent', 'text-text-primary');
      button.classList.remove('hover:bg-bg-primary');
    } else {
      button.classList.remove('bg-accent', 'text-text-primary');
      button.classList.add('hover:bg-bg-primary');
    }
  });
}

// Project toggles
const projectToggles = document.querySelectorAll('.project-toggle');
const projectTasks = document.querySelectorAll('.project-tasks');
let openProjects = {};

projectToggles.forEach(toggle => {
  toggle.addEventListener('click', () => {
    const projectId = toggle.dataset.project;
    openProjects[projectId] = !openProjects[projectId];
    updateProjects();
  });
});

function updateProjects() {
  projectTasks.forEach(tasks => {
    const projectId = tasks.dataset.project;
    const indicator = document.querySelector(`.project-indicator[data-project="${projectId}"]`);
    if (openProjects[projectId]) {
      tasks.classList.remove('hidden');
      if (indicator) indicator.textContent = '-';
    } else {
      tasks.classList.add('hidden');
      if (indicator) indicator.textContent = '+';
    }
  });
}

// Budget toggles
const budgetToggles = document.querySelectorAll('.budget-toggle');
const projectBudgets = document.querySelectorAll('.project-budgets');
let openBudgets = {};

budgetToggles.forEach(toggle => {
  toggle.addEventListener('click', () => {
    const projectId = toggle.dataset.project;
    openBudgets[projectId] = !openBudgets[projectId];
    updateBudgets();
  });
});

function updateBudgets() {
  projectBudgets.forEach(budgets => {
    const projectId = budgets.dataset.project;
    const indicator = document.querySelector(`.budget-indicator[data-project="${projectId}"]`);
    if (openBudgets[projectId]) {
      budgets.classList.remove('hidden');
      if (indicator) indicator.textContent = '-';
    } else {
      budgets.classList.add('hidden');
      if (indicator) indicator.textContent = '+';
    }
  });
}

// Team by you toggles
const teamByYouToggles = document.querySelectorAll('.team-by-you-toggle');
const projectTeamsByYou = document.querySelectorAll('.project-teams-by-you');
let openTeamsByYou = {};

teamByYouToggles.forEach(toggle => {
  toggle.addEventListener('click', () => {
    const projectId = toggle.dataset.project;
    openTeamsByYou[projectId] = !openTeamsByYou[projectId];
    updateTeamsByYou();
  });
});

function updateTeamsByYou() {
  projectTeamsByYou.forEach(teams => {
    const projectId = teams.dataset.project;
    const indicator = document.querySelector(`.team-by-you-indicator[data-project="${projectId}"]`);
    if (openTeamsByYou[projectId]) {
      teams.classList.remove('hidden');
      if (indicator) indicator.textContent = '-';
    } else {
      teams.classList.add('hidden');
      if (indicator) indicator.textContent = '+';
    }
  });
}

// Team invited to toggles
const teamInvitedToToggles = document.querySelectorAll('.team-invited-to-toggle');
const projectTeamsInvitedTo = document.querySelectorAll('.project-teams-invited-to');
let openTeamsInvitedTo = {};

teamInvitedToToggles.forEach(toggle => {
  toggle.addEventListener('click', () => {
    const projectId = toggle.dataset.project;
    openTeamsInvitedTo[projectId] = !openTeamsInvitedTo[projectId];
    updateTeamsInvitedTo();
  });
});

function updateTeamsInvitedTo() {
  projectTeamsInvitedTo.forEach(teams => {
    const projectId = teams.dataset.project;
    const indicator = document.querySelector(`.team-invited-to-indicator[data-project="${projectId}"]`);
    if (openTeamsInvitedTo[projectId]) {
      teams.classList.remove('hidden');
      if (indicator) indicator.textContent = '-';
    } else {
      teams.classList.add('hidden');
      if (indicator) indicator.textContent = '+';
    }
  });
}

// Initial setup
updateTabs();