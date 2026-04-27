function showToast(message, type) {
  if (window.toast) {
    window.toast(message, type);
  } else {
    alert(message);
  }
}

function markDone(id, btn) {
  console.log('Marking task as done:', id);
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i>';
  
  fetch(`/task/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'completed' })
  }).then(response => {
    if (response.ok) {
      showToast('Task marked as completed', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      showToast('Error updating task', 'error');
    }
  }).catch(error => {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    showToast('An error occurred', 'error');
  });
}

function deleteTask(id, btn) {
  if (confirm('Are you sure you want to delete this task?')) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i>';
    
    fetch(`/task/${id}`, {
      method: 'DELETE'
    }).then(response => {
      if (response.ok) {
        showToast('Task deleted', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        showToast('Error deleting task', 'error');
      }
    }).catch(error => {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
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
  if (confirm('Are you sure you want to delete this budget?')) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i>';
    
    fetch(`/budget/${id}`, {
      method: 'DELETE'
    }).then(response => {
      if (response.ok) {
        showToast('Budget deleted', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        showToast('Error deleting budget', 'error');
      }
    }).catch(error => {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      showToast('An error occurred', 'error');
    });
  }
}

function acceptInvite(id) {
  fetch(`/team/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'accepted' })
  }).then(response => {
    if (response.ok) {
      showToast('Invitation accepted', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showToast('Error accepting invitation', 'error');
    }
  }).catch(error => {
    showToast('An error occurred', 'error');
  });
}

// Sidebar toggle
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobile-overlay');
let sidebarOpen = false;

if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    sidebarOpen = !sidebarOpen;
    if (sidebarOpen) {
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0', 'shadow-2xl');
      mobileOverlay.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      sidebar.classList.remove('translate-x-0', 'shadow-2xl');
      mobileOverlay.classList.add('hidden');
    }
  });
}

if (mobileOverlay) {
  mobileOverlay.addEventListener('click', () => {
    sidebarOpen = false;
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0', 'shadow-2xl');
    mobileOverlay.classList.add('hidden');
  });
}

// Tabs
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
let activeTab = 'dashboard';

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    activeTab = button.dataset.tab;
    updateTabs();
    
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      sidebarOpen = false;
      sidebar.classList.add('-translate-x-full');
      sidebar.classList.remove('translate-x-0');
      mobileOverlay.classList.add('hidden');
    }
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
      button.classList.add('sidebar-link-active');
      button.classList.remove('text-slate-400', 'hover:bg-slate-800');
    } else {
      button.classList.remove('sidebar-link-active');
      button.classList.add('text-slate-400', 'hover:bg-slate-800');
    }
  });
}

// Toggle Helper
function setupToggle(selector, contentSelector, iconSelector) {
  const toggles = document.querySelectorAll(selector);
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const id = toggle.dataset.project;
      const content = document.querySelector(`${contentSelector}[data-project="${id}"]`);
      const icon = toggle.querySelector(iconSelector);
      
      if (content) {
        const isHidden = content.classList.contains('hidden');
        if (isHidden) {
          content.classList.remove('hidden');
          if (icon) icon.classList.add('rotate-180');
        } else {
          content.classList.add('hidden');
          if (icon) icon.classList.remove('rotate-180');
        }
      }
    });
  });
}

// Initialize Toggles
setupToggle('.project-toggle', '.project-tasks', '.project-indicator');
setupToggle('.budget-toggle', '.project-budgets', '.budget-indicator');
setupToggle('.team-by-you-toggle', '.project-teams-by-you', '.team-by-you-indicator');
setupToggle('.team-invited-to-toggle', '.project-teams-invited-to', '.team-invited-to-indicator');

// Sub-tabs for shop orders
function initSubTabs() {
  const subTabButtons = document.querySelectorAll('.sub-tab-button');
  const subTabContents = document.querySelectorAll('.sub-tab-content');
  
  subTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const activeSubTab = button.dataset.subTab;
      
      subTabContents.forEach(content => {
        if (content.id === `sub-tab-${activeSubTab}`) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      });
      
      subTabButtons.forEach(btn => {
        if (btn.dataset.subTab === activeSubTab) {
          btn.classList.add('bg-purple-600', 'text-white');
          btn.classList.remove('text-slate-400', 'hover:bg-slate-700/50');
        } else {
          btn.classList.remove('bg-purple-600', 'text-white');
          btn.classList.add('text-slate-400', 'hover:bg-slate-700/50');
        }
      });
    });
  });
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  updateTabs();
  initSubTabs();
});
