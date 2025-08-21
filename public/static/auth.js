// Authentication and Landing Page JavaScript

class AuthManager {
  constructor() {
    this.setupEventListeners();
    this.checkExistingAuth();
  }

  checkExistingAuth() {
    // Check if user is already logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Verify token and redirect to app
      this.verifyTokenAndRedirect(token);
    }
  }

  async verifyTokenAndRedirect(token) {
    try {
      const response = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        window.location.href = '/app';
      }
    } catch (error) {
      // Token invalid, remove it
      localStorage.removeItem('auth_token');
    }
  }

  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSignup();
      });
    }
  }

  async handleLogin() {
    const form = document.getElementById('loginForm');
    const formData = new FormData(form);
    
    const email = formData.get('email');
    const password = formData.get('password');

    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    try {
      this.showLoading('Entering the realm...');
      
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });

      if (response.data.success) {
        // Store token
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user_data', JSON.stringify(response.data.user));
        
        this.showSuccess('Welcome back, brave adventurer!');
        
        setTimeout(() => {
          window.location.href = '/app';
        }, 1500);
      }
    } catch (error) {
      console.error('Login error:', error);
      const message = error.response?.data?.error || 'Login failed. Please try again.';
      this.showError(message);
    } finally {
      this.hideLoading();
    }
  }

  async handleSignup() {
    const form = document.getElementById('signupForm');
    const formData = new FormData(form);
    
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const character_name = formData.get('character_name') || 'Coin Seeker';

    if (!name || !email || !password) {
      this.showError('Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters');
      return;
    }

    try {
      this.showLoading('Creating your character...');
      
      const response = await axios.post('/api/auth/register', {
        name,
        email,
        password,
        character_name
      });

      if (response.data.success) {
        // Store token
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user_data', JSON.stringify(response.data.user));
        
        this.showSuccess('🏰 Your quest begins! Welcome to Coin Quest RPG!');
        
        setTimeout(() => {
          window.location.href = '/app';
        }, 2000);
      }
    } catch (error) {
      console.error('Signup error:', error);
      const message = error.response?.data?.error || 'Registration failed. Please try again.';
      this.showError(message);
    } finally {
      this.hideLoading();
    }
  }

  showLoading(message) {
    // Create loading overlay
    const loading = document.createElement('div');
    loading.id = 'loading-overlay';
    loading.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80';
    loading.innerHTML = `
      <div class="glass rounded-lg p-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
        <p class="text-yellow-200 text-lg">${message}</p>
      </div>
    `;
    document.body.appendChild(loading);
  }

  hideLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
      loading.remove();
    }
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg z-50 max-w-sm ${
      type === 'success' 
        ? 'bg-green-600 text-white' 
        : 'bg-red-600 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, type === 'success' ? 3000 : 5000);
  }
}

// Global functions for modal management
function showLoginModal() {
  const modal = document.getElementById('loginModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  // Focus on email input
  setTimeout(() => {
    const emailInput = modal.querySelector('input[name="email"]');
    if (emailInput) emailInput.focus();
  }, 100);
}

function showSignupModal() {
  const modal = document.getElementById('signupModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  // Focus on name input
  setTimeout(() => {
    const nameInput = modal.querySelector('input[name="name"]');
    if (nameInput) nameInput.focus();
  }, 100);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  
  // Reset form
  const form = modal.querySelector('form');
  if (form) form.reset();
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('fixed') && e.target.classList.contains('inset-0')) {
    const modals = document.querySelectorAll('[id$="Modal"]');
    modals.forEach(modal => {
      if (!modal.classList.contains('hidden')) {
        closeModal(modal.id);
      }
    });
  }
});

// Initialize auth manager when page loads
document.addEventListener('DOMContentLoaded', () => {
  new AuthManager();
});

// Add some medieval flair with particle effects (optional)
function createMedievalParticles() {
  const particles = ['⚔️', '🛡️', '👑', '🪙', '💎', '🏰'];
  
  setInterval(() => {
    if (Math.random() < 0.1) { // 10% chance every interval
      const particle = document.createElement('div');
      particle.textContent = particles[Math.floor(Math.random() * particles.length)];
      particle.style.position = 'fixed';
      particle.style.left = Math.random() * window.innerWidth + 'px';
      particle.style.top = '-20px';
      particle.style.fontSize = '20px';
      particle.style.pointerEvents = 'none';
      particle.style.zIndex = '1';
      particle.style.opacity = '0.6';
      
      document.body.appendChild(particle);
      
      // Animate particle falling
      let position = -20;
      const animation = setInterval(() => {
        position += 2;
        particle.style.top = position + 'px';
        
        if (position > window.innerHeight) {
          clearInterval(animation);
          particle.remove();
        }
      }, 50);
    }
  }, 500);
}

// Start particle effects
createMedievalParticles();