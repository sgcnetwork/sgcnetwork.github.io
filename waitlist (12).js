(() => {
  const form = document.getElementById('waitlistForm');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const message = document.getElementById('formMessage');
  const button = document.getElementById('submitBtn');

  function show(text, type='') {
    message.textContent = text;
    message.className = 'message ' + type;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    show('');
    if (!window.sgcSupabase) {
      show('SGC connection is unavailable. Please try again shortly.', 'error');
      return;
    }
    button.disabled = true;
    button.textContent = 'JOINING...';

    const { data, error } = await window.sgcSupabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: {
        emailRedirectTo: 'https://sgcnetwork.co.za/login.html',
        data: { source: 'academy_waitlist' }
      }
    });

    if (error) {
      show(error.message, 'error');
    } else {
      form.reset();
      show('You’re on the SGC Academy waitlist. Check your email to confirm your account.', 'success');
    }
    button.disabled = false;
    button.textContent = 'JOIN ACADEMY WAITLIST →';
  });
})();