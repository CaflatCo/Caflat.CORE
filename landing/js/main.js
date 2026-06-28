/* ─── Nav scroll state ──────────────────────────────────────── */
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ─── Scroll reveal ─────────────────────────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
  revealObserver.observe(el);
});

/* ─── Stagger grid children ─────────────────────────────────── */
// .stagger containers: each child gets .reveal + a staggered delay
document.querySelectorAll('.stagger').forEach(parent => {
  const cols = window.innerWidth > 1000 ? 3 : window.innerWidth > 720 ? 2 : 1;
  Array.from(parent.children).forEach((child, i) => {
    const colIndex = i % cols;
    child.style.transitionDelay = `${colIndex * 60}ms`;
    child.classList.add('reveal');
    revealObserver.observe(child);
  });
});

/* ─── Counter animation ─────────────────────────────────────── */
function animateCount(el, target, suffix = '') {
  let start = 0;
  const duration = 1400;
  const step = timestamp => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(ease * target) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target;
      const target = parseInt(el.dataset.target, 10);
      const suffix = el.dataset.suffix || '';
      animateCount(el, target, suffix);
      statsObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-target]').forEach(el => statsObserver.observe(el));

/* ─── Request Access form ───────────────────────────────────── */
const SUPABASE_URL    = 'https://tkrsebalgonimmozbgqc.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcnNlYmFsZ29uaW1tb3piZ3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNDgzNjUsImV4cCI6MjA2NTcyNDM2NX0.s5Jb0VEp1FPR10lVqBBODf93OIFczHGJXnpODWWCbf8';
const WEB3FORMS_KEY   = 'PASTE_YOUR_WEB3FORMS_KEY_HERE'; // web3forms.com → enter caflatcore@gmail.com → copy key

const form  = document.getElementById('accessForm');
const toast = document.getElementById('toast');

function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.classList.remove('show'); }, 4000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = form.querySelector('.form-submit');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  const data = {
    cafe_name:    form.cafe_name.value.trim(),
    contact_name: form.contact_name.value.trim(),
    email:        form.email.value.trim(),
    phone:        form.phone.value.trim(),
    tier:         form.tier.value,
    message:      form.message.value.trim(),
    requested_at: new Date().toISOString(),
  };

  try {
    // Save to Supabase + email notification fire in parallel
    const [dbRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/access_requests`, {
        method: 'POST',
        headers: {
          'apikey':        SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify(data),
      }),
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject:    `New Access Request — ${data.cafe_name || 'Unknown Café'}`,
          from_name:  'Caflat.CORE Landing',
          cafe_name:    data.cafe_name,
          contact_name: data.contact_name,
          email:        data.email,
          phone:        data.phone,
          tier:         data.tier,
          message:      data.message || '—',
        }),
      }).catch(err => console.warn('Email notification failed:', err)), // non-fatal
    ]);

    if (!dbRes.ok) throw new Error(await dbRes.text());

    showToast('Request sent! We\'ll reach out within 24–48 hours.', 'success');
    form.reset();
  } catch (err) {
    console.error('Access request error:', err);
    showToast('Something went wrong. Email us at caflatcore@gmail.com', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Application';
  }
});

/* ─── Smooth scroll for anchor links ───────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
