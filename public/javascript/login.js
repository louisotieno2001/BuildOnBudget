/* eslint-disable no-undef */
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
      showToast('Please enter both email and password', 'error');
      return;
    }

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await res.json();

      if (!res.ok) {
        showToast(result.error || 'An error occurred during login', 'error');
      } else {
        showToast(result.message || 'Login successful!', 'success');
        // Redirect to dashboard or another page
        window.location.href = '/dashboard';
      }
    } catch (error) {
      showToast('Network error. Please try again later', 'error');
    }
  });
});
