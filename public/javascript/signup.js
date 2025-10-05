/* eslint-disable no-undef */
document.addEventListener('DOMContentLoaded', () => {
  const submitTrigger = document.getElementById('submit');

  // Error containers
  const nameError = document.getElementById('name-error');
  const emailError = document.getElementById('email-error');
  const phoneError = document.getElementById('phone-error');
  const passwordError = document.getElementById('password-error');

  // Password toggle
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('password-toggle');
  const toggleIcon = passwordToggle.querySelector('svg');

  // Regex patterns
  const regexPatterns = {
    name: /^[a-zA-Z\s'-]+$/,
    email: /^[\w\.-]+@[\w\.-]+\.\w+$/,
    phone: /^\+254\s?7\d{8}$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  };

  function clearErrors() {
    [nameError, emailError, phoneError, passwordError].forEach(container => {
      const span = container.querySelector('span');
      if (span) span.innerText = '';
      container.classList.add('hidden');
    });
  }

  // Password toggle
  passwordToggle.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleIcon.innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.223-3.425m1.766-1.766A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.05 10.05 0 01-1.223 2.432M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />`;
    } else {
      passwordInput.type = 'password';
      toggleIcon.innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>`;
    }
  });

  function validateField(value, regex, errorContainer, errorMessage) {
    const errorSpan = errorContainer.querySelector('span');
    if (!value) {
      errorSpan.innerText = 'This field is required.';
      errorContainer.classList.remove('hidden');
      return false;
    }
    if (!regex.test(value)) {
      errorSpan.innerText = errorMessage;
      errorContainer.classList.remove('hidden');
      return false;
    }
    errorSpan.innerText = '';
    errorContainer.classList.add('hidden');
    return true;
  }

  // Submit handler
  submitTrigger.addEventListener('click', async (e) => {
    e.preventDefault();
    clearErrors();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value.trim();

    let valid = true;

    valid = validateField(name, regexPatterns.name, nameError, 'Name can only contain letters, spaces, hyphens, and apostrophes.') && valid;
    valid = validateField(email, regexPatterns.email, emailError, 'Please enter a valid email address.') && valid;
    valid = validateField(phone, regexPatterns.phone, phoneError, 'Phone must be in the format +254 7xxxxxxxx.') && valid;
    valid = validateField(password, regexPatterns.password, passwordError, 'Password must be at least 8 characters, include uppercase, lowercase, number, and special character.') && valid;

    if (!valid) {
      return;
    }

    try {
      const userData = { name, email, phone, password };

      const res = await fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const result = await res.json();

      if (!res.ok) {
        showToast(result.error || 'An error occurred during signup.', 'error');
      } else {
        showToast(result.message || 'Signup successful!', 'success');
        // You can clear form or redirect here
      }
    } catch (error) {
      showToast('Network error. Please try again later.', 'error');
    }
  });
});