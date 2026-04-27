/* eslint-disable no-undef */
document.addEventListener('DOMContentLoaded', () => {
  const authFetch = (window.utils && window.utils.authFetch) ? window.utils.authFetch : fetch;
  const setAuthToken = (window.utils && window.utils.setAuthToken) ? window.utils.setAuthToken : () => {};
  const loginForm = document.getElementById('login-form');

  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('password-toggle');

  passwordToggle.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    passwordToggle.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
  });

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
      showToast('Please enter both email and password', 'error');
      return;
    }

    try {
      const res = await authFetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await res.json();

      if (!res.ok) {
        showToast(result.error || 'An error occurred during login', 'error');
      } else {
        showToast(result.message || 'Login successful!', 'success');
        setAuthToken(result.token);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      showToast('Network error. Please try again later', 'error');
    }
  });
});