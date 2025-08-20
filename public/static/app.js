// Budget Level Up App JavaScript
class BudgetApp {
  constructor() {
    this.currentUser = { id: 1, name: 'Demo User' }; // Demo user
    this.currentTab = 'dashboard';
    this.categories = [];
    this.debts = [];
    this.achievements = [];
    this.userStats = {};
    
    this.init();
  }

  async init() {
    try {
      // Initialize database
      await this.initializeDatabase();
      
      // Load initial data
      await Promise.all([
        this.loadUserStats(),
        this.loadCategories(),
        this.loadDashboardData(),
        this.loadDebts(),
        this.loadAchievements()
      ]);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set today's date as default in forms
      this.setDefaultDates();
      
      // Hide loading screen and show app
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      
      console.log('Budget Level Up App initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      this.showError('Failed to initialize app. Please refresh the page.');
    }
  }

  async initializeDatabase() {
    try {
      // This will be handled by the migration system
      console.log('Database initialization handled by migrations');
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  async loadUserStats() {
    try {
      const response = await axios.get(`/api/user/${this.currentUser.id}`);
      this.userStats = response.data;
      this.updateUserDisplay();
      this.updateVideoBackground();
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  }

  async loadCategories() {
    try {
      const response = await axios.get('/api/categories');
      this.categories = response.data;
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async loadDashboardData() {
    try {
      const response = await axios.get(`/api/dashboard/${this.currentUser.id}`);
      const data = response.data;
      
      this.updateMonthlyStats(data.monthlyStats || []);
      this.updateRecentTransactions(data.recentTransactions || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  async loadDebts() {
    try {
      const response = await axios.get(`/api/dashboard/${this.currentUser.id}`);
      this.debts = response.data.debts || [];
      this.updateDebtsDisplay();
      this.updateDebtSelect();
    } catch (error) {
      console.error('Error loading debts:', error);
    }
  }

  async loadAchievements() {
    try {
      const response = await axios.get(`/api/achievements/${this.currentUser.id}`);
      this.achievements = response.data;
      this.updateAchievementsDisplay();
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  }

  updateUserDisplay() {
    if (!this.userStats) return;

    const greeting = document.getElementById('userGreeting');
    const level = document.getElementById('userLevel');
    const xp = document.getElementById('userXP');
    const xpProgress = document.getElementById('xpProgress');
    const xpBar = document.getElementById('xpBar');

    if (greeting) greeting.textContent = `Welcome back, ${this.userStats.name}!`;
    if (level) level.textContent = `Level ${this.userStats.current_level}`;
    if (xp) xp.textContent = `${this.userStats.experience_points} XP`;

    // Calculate XP progress to next level
    const nextLevelXP = this.getNextLevelXP(this.userStats.current_level);
    const currentLevelXP = this.getCurrentLevelXP(this.userStats.current_level);
    const progress = ((this.userStats.experience_points - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

    if (xpProgress) xpProgress.textContent = `${this.userStats.experience_points} / ${nextLevelXP} XP`;
    if (xpBar) xpBar.style.width = `${Math.min(progress, 100)}%`;
  }

  getNextLevelXP(currentLevel) {
    const xpRequirements = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
    return xpRequirements[currentLevel] || xpRequirements[xpRequirements.length - 1] + 1000;
  }

  getCurrentLevelXP(currentLevel) {
    const xpRequirements = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
    return xpRequirements[currentLevel - 1] || 0;
  }

  updateVideoBackground() {
    const video = document.getElementById('videoBackground');
    if (this.userStats && this.userStats.video_background_url) {
      video.src = this.userStats.video_background_url;
      video.load();
    }
  }

  updateMonthlyStats(stats) {
    const incomeEl = document.getElementById('monthlyIncome');
    const expensesEl = document.getElementById('monthlyExpenses');
    const savingsEl = document.getElementById('monthlySavings');

    let income = 0, expenses = 0, savings = 0;

    stats.forEach(stat => {
      switch (stat.type) {
        case 'income':
          income = stat.total;
          break;
        case 'expense':
          expenses = Math.abs(stat.total);
          break;
        case 'savings':
          savings = stat.total;
          break;
      }
    });

    if (incomeEl) incomeEl.textContent = `$${income.toFixed(2)}`;
    if (expensesEl) expensesEl.textContent = `$${expenses.toFixed(2)}`;
    if (savingsEl) savingsEl.textContent = `$${savings.toFixed(2)}`;
  }

  updateRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');
    if (!container) return;

    if (transactions.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-center py-4">No recent transactions</p>';
      return;
    }

    container.innerHTML = transactions.map(transaction => `
      <div class="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
        <div class="flex items-center space-x-3">
          <div class="text-2xl">${transaction.icon || '💰'}</div>
          <div>
            <div class="font-medium">${transaction.category_name}</div>
            <div class="text-sm opacity-70">${transaction.description || 'No description'}</div>
            <div class="text-xs opacity-50">${new Date(transaction.entry_date).toLocaleDateString()}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-bold ${this.getAmountColor(transaction.type)}">
            ${this.formatAmount(transaction.amount, transaction.type)}
          </div>
          <div class="text-xs opacity-70">${transaction.type}</div>
        </div>
      </div>
    `).join('');
  }

  updateDebtsDisplay() {
    const container = document.getElementById('debtsList');
    if (!container) return;

    if (this.debts.length === 0) {
      container.innerHTML = `
        <div class="glass rounded-lg p-6 text-center">
          <i class="fas fa-check-circle text-6xl text-green-400 mb-4"></i>
          <h3 class="text-xl font-bold mb-2">Debt Free!</h3>
          <p class="text-gray-300">You have no active debts. Congratulations!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.debts.map(debt => {
      const progress = ((debt.original_amount - debt.current_amount) / debt.original_amount) * 100;
      return `
        <div class="glass rounded-lg p-6">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-xl font-bold">${debt.name}</h3>
              <p class="text-sm opacity-70">Min. payment: $${debt.minimum_payment.toFixed(2)}</p>
              ${debt.interest_rate ? `<p class="text-sm opacity-70">Interest rate: ${debt.interest_rate}%</p>` : ''}
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold text-red-400">$${debt.current_amount.toFixed(2)}</div>
              <div class="text-sm opacity-70">of $${debt.original_amount.toFixed(2)}</div>
            </div>
          </div>
          
          <div class="mb-4">
            <div class="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>${progress.toFixed(1)}% paid off</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2">
              <div class="bg-red-500 h-2 rounded-full transition-all" style="width: ${progress}%"></div>
            </div>
          </div>
          
          <button onclick="app.quickPayDebt(${debt.id}, ${debt.minimum_payment})" 
                  class="w-full bg-red-600 hover:bg-red-700 py-2 rounded font-medium transition-all">
            Pay $${debt.minimum_payment.toFixed(2)}
          </button>
        </div>
      `;
    }).join('');
  }

  updateAchievementsDisplay() {
    const container = document.getElementById('achievementsList');
    if (!container) return;

    container.innerHTML = this.achievements.map(achievement => `
      <div class="glass rounded-lg p-6 ${achievement.earned ? 'border-yellow-400' : 'opacity-75'}">
        <div class="text-center">
          <div class="text-4xl mb-3">${achievement.icon || '🏆'}</div>
          <h3 class="font-bold text-lg mb-2">${achievement.name}</h3>
          <p class="text-sm opacity-80 mb-4">${achievement.description}</p>
          
          <div class="space-y-2 text-xs">
            ${achievement.level_requirement > 1 ? `<div>Level ${achievement.level_requirement} required</div>` : ''}
            ${achievement.savings_requirement > 0 ? `<div>Save $${achievement.savings_requirement}</div>` : ''}
            ${achievement.debt_payment_requirement > 0 ? `<div>Pay $${achievement.debt_payment_requirement} debt</div>` : ''}
          </div>
          
          <div class="mt-4">
            ${achievement.earned ? 
              '<span class="bg-yellow-600 px-3 py-1 rounded-full text-xs font-bold">EARNED</span>' :
              '<span class="bg-gray-600 px-3 py-1 rounded-full text-xs">Locked</span>'
            }
          </div>
        </div>
      </div>
    `).join('');
  }

  updateDebtSelect() {
    const select = document.getElementById('debtSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select debt to pay...</option>' +
      this.debts.map(debt => 
        `<option value="${debt.id}">${debt.name} - $${debt.current_amount.toFixed(2)}</option>`
      ).join('');
  }

  getAmountColor(type) {
    switch (type) {
      case 'income': return 'text-green-400';
      case 'savings': return 'text-blue-400';
      case 'debt_payment': return 'text-purple-400';
      default: return 'text-red-400';
    }
  }

  formatAmount(amount, type) {
    const prefix = (type === 'expense' || type === 'debt_payment') ? '-$' : '+$';
    return prefix + Math.abs(amount).toFixed(2);
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Form submissions
    document.getElementById('addEntryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddEntry();
    });

    document.getElementById('payDebtForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePayDebt();
    });

    // Close modals on outside click
    document.querySelectorAll('[id$="Modal"]').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });
  }

  switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active', 'bg-blue-600');
      btn.classList.add('bg-transparent', 'opacity-70');
    });

    const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active', 'bg-blue-600');
      activeBtn.classList.remove('bg-transparent', 'opacity-70');
    }

    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });

    const activeContent = document.getElementById(tab);
    if (activeContent) {
      activeContent.classList.remove('hidden');
    }

    this.currentTab = tab;
  }

  setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entryDate').value = today;
  }

  showAddEntryModal(type) {
    const modal = document.getElementById('addEntryModal');
    const title = document.getElementById('modalTitle');
    const typeInput = document.getElementById('entryType');
    const categorySelect = document.getElementById('entryCategory');

    // Set modal title and type
    const titles = {
      income: 'Add Income',
      expense: 'Add Expense', 
      savings: 'Add Savings'
    };
    
    title.textContent = titles[type] || 'Add Entry';
    typeInput.value = type;

    // Filter categories by type
    const filteredCategories = this.categories.filter(cat => cat.type === type);
    categorySelect.innerHTML = '<option value="">Select category...</option>' +
      filteredCategories.map(cat => 
        `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
      ).join('');

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Focus on amount input
    setTimeout(() => document.getElementById('entryAmount').focus(), 100);
  }

  showPayDebtModal() {
    const modal = document.getElementById('payDebtModal');
    this.updateDebtSelect();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    
    // Reset forms
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => form.reset());
  }

  async handleAddEntry() {
    try {
      const form = document.getElementById('addEntryForm');
      const formData = new FormData(form);
      
      const entry = {
        user_id: this.currentUser.id,
        category_id: parseInt(formData.get('category_id')),
        amount: parseFloat(formData.get('amount')),
        description: formData.get('description'),
        entry_date: formData.get('entry_date'),
        type: formData.get('type')
      };

      const response = await axios.post('/api/budget-entry', entry);
      
      if (response.data.levelUp) {
        this.showLevelUpModal(response.data.newLevel);
      }
      
      // Reload data
      await Promise.all([
        this.loadUserStats(),
        this.loadDashboardData()
      ]);
      
      this.closeModal('addEntryModal');
      this.showSuccess('Entry added successfully!');
    } catch (error) {
      console.error('Error adding entry:', error);
      this.showError('Failed to add entry. Please try again.');
    }
  }

  async handlePayDebt() {
    try {
      const form = document.getElementById('payDebtForm');
      const formData = new FormData(form);
      
      const payment = {
        user_id: this.currentUser.id,
        debt_id: parseInt(formData.get('debt_id')),
        amount: parseFloat(formData.get('amount'))
      };

      const response = await axios.post('/api/pay-debt', payment);
      
      if (response.data.paidOff) {
        this.showSuccess('Congratulations! Debt paid off completely! 🎉');
      } else {
        this.showSuccess('Payment recorded successfully!');
      }
      
      // Reload data
      await Promise.all([
        this.loadUserStats(),
        this.loadDashboardData(),
        this.loadDebts()
      ]);
      
      this.closeModal('payDebtModal');
    } catch (error) {
      console.error('Error paying debt:', error);
      this.showError('Failed to process payment. Please try again.');
    }
  }

  async quickPayDebt(debtId, amount) {
    try {
      const payment = {
        user_id: this.currentUser.id,
        debt_id: debtId,
        amount: amount
      };

      const response = await axios.post('/api/pay-debt', payment);
      
      if (response.data.paidOff) {
        this.showSuccess('Congratulations! Debt paid off completely! 🎉');
      } else {
        this.showSuccess('Payment recorded successfully!');
      }
      
      // Reload data
      await Promise.all([
        this.loadUserStats(),
        this.loadDashboardData(),
        this.loadDebts()
      ]);
    } catch (error) {
      console.error('Error paying debt:', error);
      this.showError('Failed to process payment. Please try again.');
    }
  }

  showLevelUpModal(newLevel) {
    const modal = document.getElementById('levelUpModal');
    const levelText = document.getElementById('levelUpText');
    const rewardText = document.getElementById('levelUpReward');
    
    levelText.textContent = `You reached Level ${newLevel}!`;
    rewardText.textContent = 'Your financial discipline is paying off!';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Update video background for new level
    setTimeout(() => {
      this.updateVideoBackground();
    }, 1000);
  }

  showSuccess(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg z-50 shadow-lg';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
  }

  showError(message) {
    // Simple error toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg z-50 shadow-lg';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 5000);
  }
}

// Global functions for button clicks
function showAddEntryModal(type) {
  app.showAddEntryModal(type);
}

function showPayDebtModal() {
  app.showPayDebtModal();
}

function closeModal(modalId) {
  app.closeModal(modalId);
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new BudgetApp();
});

// Add CSS for active tab styling
const style = document.createElement('style');
style.textContent = `
  .tab-button.active {
    background-color: rgb(37 99 235) !important;
    opacity: 1 !important;
  }
  
  .tab-button:not(.active) {
    background-color: transparent !important;
    opacity: 0.7 !important;
  }
  
  .tab-button:hover {
    opacity: 1 !important;
  }
`;
document.head.appendChild(style);