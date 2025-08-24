// Coin Quest RPG - Medieval Budget Adventure
class CoinQuestRPG {
  constructor() {
    this.currentUser = null;
    this.authToken = null;
    this.currentTab = 'dashboard';
    this.categories = [];
    this.debts = [];
    this.achievements = [];
    this.characterRewards = [];
    this.userStats = {};
    
    this.init();
  }

  async init() {
    try {
      // Check authentication first
      if (!this.checkAuthentication()) {
        this.redirectToLogin();
        return;
      }

      // Initialize database
      await this.initializeDatabase();
      
      // Load initial data
      await Promise.all([
        this.loadUserStats(),
        this.loadCategories(),
        this.loadDashboardData(),
        this.loadDebts(),
        this.loadAchievements(),
        this.loadCharacterRewards()
      ]);
      
      // Check subscription status
      await this.checkSubscriptionStatus();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set today's date as default in forms
      this.setDefaultDates();
      
      // Hide loading screen and show app
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      
      console.log('🏰 Coin Quest RPG initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      if (error.response?.status === 401 || error.response?.status === 402) {
        this.redirectToLogin();
      } else {
        this.showError('Failed to initialize your medieval adventure. Please refresh the page.');
      }
    }
  }

  checkAuthentication() {
    // Get auth token from localStorage or cookie
    this.authToken = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (!this.authToken || !userData) {
      return false;
    }

    try {
      this.currentUser = JSON.parse(userData);
      return true;
    } catch (error) {
      console.error('Invalid user data in localStorage');
      return false;
    }
  }

  redirectToLogin() {
    // Clear any stored auth data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    // Redirect to login page
    window.location.href = '/';
  }

  async checkSubscriptionStatus() {
    try {
      const response = await this.makeAuthenticatedRequest('/api/subscription/status');
      
      if (response.data.subscription_status === 'expired' || 
          response.data.subscription_status === 'cancelled') {
        this.showSubscriptionExpiredModal();
      } else if (response.data.subscription_status === 'trial') {
        // Show trial status in header
        this.updateTrialStatus(response.data);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  }

  async makeAuthenticatedRequest(url, options = {}) {
    const headers = {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    return await axios({
      url,
      headers,
      ...options
    });
  }

  logout() {
    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    // Call logout endpoint
    this.makeAuthenticatedRequest('/api/auth/logout', { method: 'POST' })
      .catch(console.error);
    
    // Redirect to login
    window.location.href = '/';
  }

  async initializeDatabase() {
    try {
      console.log('⚔️ Initializing medieval database...');
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  async loadUserStats() {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/user/${this.currentUser.id}`);
      this.userStats = response.data;
      this.updateUserDisplay();
      this.updateVideoBackground();
      await this.checkForNewRewards();
    } catch (error) {
      console.error('Error loading user stats:', error);
      if (error.response?.status === 401) {
        this.redirectToLogin();
      }
    }
  }

  async loadCategories() {
    try {
      const response = await this.makeAuthenticatedRequest('/api/categories');
      this.categories = response.data;
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async loadDashboardData() {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/dashboard/${this.currentUser.id}`);
      const data = response.data;
      
      this.updateMonthlyStats(data.monthlyStats || []);
      this.updateRecentTransactions(data.recentTransactions || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  async loadDebts() {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/dashboard/${this.currentUser.id}`);
      this.debts = response.data.debts || [];
      this.updateDebtsDisplay();
      this.updateDebtSelect();
    } catch (error) {
      console.error('Error loading debts:', error);
    }
  }

  async loadAchievements() {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/achievements/${this.currentUser.id}`);
      this.achievements = response.data;
      this.updateAchievementsDisplay();
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  }

  async loadCharacterRewards() {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/character-rewards/${this.currentUser.id}`);
      this.characterRewards = response.data;
      this.updateCharacterDisplay();
      this.updateRewardsDisplay();
    } catch (error) {
      console.error('Error loading character rewards:', error);
    }
  }

  async checkForNewRewards() {
    try {
      const response = await this.makeAuthenticatedRequest('/api/check-rewards', {
        method: 'POST',
        data: { user_id: this.currentUser.id }
      });
      
      if (response.data.newRewards && response.data.newRewards.length > 0) {
        this.showNewRewardsModal(response.data.newRewards);
        await this.loadCharacterRewards(); // Reload rewards
      }
    } catch (error) {
      console.error('Error checking for new rewards:', error);
    }
  }

  updateUserDisplay() {
    if (!this.userStats) return;

    const greeting = document.getElementById('userGreeting');
    const level = document.getElementById('userLevel');
    const xp = document.getElementById('userXP');
    const xpProgress = document.getElementById('xpProgress');
    const xpBar = document.getElementById('xpBar');
    const characterTitle = document.getElementById('characterTitle');
    const characterClass = document.getElementById('characterClass');
    const goldCount = document.getElementById('goldCount');

    if (greeting) greeting.textContent = `Welcome back, ${this.userStats.name}!`;
    if (level) level.textContent = `Level ${this.userStats.current_level}`;
    if (xp) xp.textContent = `${this.userStats.experience_points} XP`;
    if (characterTitle) characterTitle.textContent = this.userStats.character_title || 'Peasant Coin-Counter';
    if (characterClass) characterClass.textContent = this.userStats.character_class || 'Peasant';
    if (goldCount) goldCount.textContent = `${Math.floor(this.userStats.total_saved)} 🪙`;

    // Calculate XP progress to next level
    const nextLevelXP = this.getNextLevelXP(this.userStats.current_level);
    const currentLevelXP = this.getCurrentLevelXP(this.userStats.current_level);
    const progress = ((this.userStats.experience_points - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

    if (xpProgress) xpProgress.textContent = `${this.userStats.experience_points} / ${nextLevelXP} XP to next rank`;
    if (xpBar) xpBar.style.width = `${Math.min(progress, 100)}%`;

    // Update subscription status display
    this.updateSubscriptionDisplay();
  }

  updateSubscriptionDisplay() {
    // Add subscription status to the header
    const header = document.querySelector('header');
    let subscriptionStatus = document.getElementById('subscriptionStatus');
    
    if (!subscriptionStatus && header) {
      subscriptionStatus = document.createElement('div');
      subscriptionStatus.id = 'subscriptionStatus';
      subscriptionStatus.className = 'text-center mt-2';
      header.appendChild(subscriptionStatus);
    }

    if (subscriptionStatus && this.currentUser) {
      const status = this.currentUser.subscription_status;
      const plan = this.currentUser.subscription_plan;
      
      if (status === 'trial') {
        const daysLeft = this.currentUser.trial_days_left || 0;
        subscriptionStatus.innerHTML = `
          <div class="bg-blue-600/30 border border-blue-400 rounded px-3 py-1 text-sm">
            🆓 Free Trial - ${daysLeft} days remaining
            <button onclick="app.showUpgradeModal()" class="ml-2 text-yellow-400 hover:text-yellow-300 underline">
              Upgrade Now
            </button>
          </div>
        `;
      } else if (status === 'active') {
        subscriptionStatus.innerHTML = `
          <div class="bg-green-600/30 border border-green-400 rounded px-3 py-1 text-sm">
            ✅ ${this.getPlanDisplayName(plan)} - Active
            <button onclick="app.showAccountModal()" class="ml-2 text-yellow-400 hover:text-yellow-300 underline">
              Manage
            </button>
          </div>
        `;
      } else if (status === 'expired') {
        subscriptionStatus.innerHTML = `
          <div class="bg-red-600/30 border border-red-400 rounded px-3 py-1 text-sm">
            ⚠️ Subscription Expired
            <button onclick="app.showUpgradeModal()" class="ml-2 text-yellow-400 hover:text-yellow-300 underline">
              Renew Now
            </button>
          </div>
        `;
      }
    }
  }

  getPlanDisplayName(plan) {
    const planNames = {
      'trial': 'Free Trial',
      'basic': 'Adventurer Plan',
      'premium': 'Noble Plan',
      'ultimate': 'Elder Master Plan'
    };
    return planNames[plan] || plan;
  }

  updateTrialStatus(subscriptionData) {
    this.currentUser.trial_days_left = Math.max(0, Math.ceil(
      (new Date(subscriptionData.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24)
    ));
    
    // Update localStorage
    localStorage.setItem('user_data', JSON.stringify(this.currentUser));
    this.updateSubscriptionDisplay();
  }

  updateCharacterDisplay() {
    const characterIcon = document.getElementById('characterIcon');
    const helmetIcon = document.getElementById('helmetIcon');
    const weaponIcon = document.getElementById('weaponIcon');
    const shieldIcon = document.getElementById('shieldIcon');
    const armorIcon = document.getElementById('armorIcon');
    const accessoryIcon = document.getElementById('accessoryIcon');

    // Find equipped items
    const equippedItems = this.characterRewards.filter(reward => reward.equipped);
    
    // Set equipment icons based on equipped items
    equippedItems.forEach(item => {
      const icon = this.getEquipmentIcon(item.name, item.type);
      switch (item.type) {
        case 'helmet':
          if (helmetIcon) helmetIcon.textContent = icon;
          break;
        case 'weapon':
          if (weaponIcon) weaponIcon.textContent = icon;
          break;
        case 'shield':
          if (shieldIcon) shieldIcon.textContent = icon;
          break;
        case 'armor':
          if (armorIcon) armorIcon.textContent = icon;
          break;
        case 'accessory':
          if (accessoryIcon) accessoryIcon.textContent = icon;
          break;
      }
    });

    // Update character background based on level
    if (characterIcon) {
      const levelIcons = ['🏰', '🏛️', '🏯', '🎪', '🏘️', '🏰', '🏯', '🌟', '👑', '⭐'];
      characterIcon.textContent = levelIcons[Math.min(this.userStats.current_level - 1, levelIcons.length - 1)];
    }
  }

  updateRewardsDisplay() {
    const helmetRewards = document.getElementById('helmetRewards');
    const armorRewards = document.getElementById('armorRewards');
    const weaponRewards = document.getElementById('weaponRewards');

    if (!helmetRewards || !armorRewards || !weaponRewards) return;

    // Group rewards by type
    const rewardsByType = {
      helmet: this.characterRewards.filter(r => r.type === 'helmet'),
      armor: this.characterRewards.filter(r => r.type === 'armor'),
      weapon: this.characterRewards.filter(r => r.type === 'weapon')
    };

    // Display helmets
    helmetRewards.innerHTML = rewardsByType.helmet.map(reward => this.createRewardCard(reward)).join('');
    
    // Display armor
    armorRewards.innerHTML = rewardsByType.armor.map(reward => this.createRewardCard(reward)).join('');
    
    // Display weapons
    weaponRewards.innerHTML = rewardsByType.weapon.map(reward => this.createRewardCard(reward)).join('');
  }

  createRewardCard(reward) {
    const icon = this.getEquipmentIcon(reward.name, reward.type);
    const rarityClass = `rarity-${reward.rarity}`;
    const isUnlocked = reward.unlocked;
    const isEquipped = reward.equipped;
    
    return `
      <div class="equipment-slot ${rarityClass} ${isUnlocked ? 'cursor-pointer' : 'opacity-50'} 
                  ${isEquipped ? 'bg-yellow-600' : ''} relative group"
           onclick="${isUnlocked ? `app.equipReward(${reward.id})` : ''}"
           style="width: 60px; height: 60px; font-size: 1.5rem;">
        <span>${isUnlocked ? icon : '🔒'}</span>
        ${isEquipped ? '<div class="absolute -top-1 -right-1 text-yellow-400 text-xs">✅</div>' : ''}
        <div class="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 
                    bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50 -mb-2">
          <div class="font-bold">${reward.display_name}</div>
          <div>${reward.description}</div>
          <div class="text-${this.getRarityColor(reward.rarity)}">${reward.rarity.toUpperCase()}</div>
          ${!isUnlocked ? `<div class="text-red-400">Requires Level ${reward.unlock_level}</div>` : ''}
        </div>
      </div>
    `;
  }

  getEquipmentIcon(itemName, type) {
    const icons = {
      // Helmets
      'leather_cap': '🎩',
      'iron_helm': '⛑️',
      'steel_crown': '👑',
      'dragon_helm': '🐲',
      'elder_circlet': '👑',
      
      // Armor
      'cloth_rags': '👕',
      'leather_vest': '🦺',
      'chainmail': '🔗',
      'plate_armor': '🛡️',
      'dragon_scale': '🐉',
      'elder_robes': '👘',
      
      // Weapons
      'wooden_stick': '🏏',
      'copper_dagger': '🗡️',
      'iron_sword': '⚔️',
      'steel_axe': '🪓',
      'dragon_blade': '🗡️',
      'elder_staff': '🔮',
      
      // Shields
      'wooden_buckler': '🛡️',
      'iron_shield': '🛡️',
      'dragon_shield': '🛡️',
      
      // Accessories
      'coin_pouch': '👛',
      'golden_ring': '💍',
      'elder_amulet': '🔮'
    };
    
    return icons[itemName] || this.getDefaultIcon(type);
  }

  getDefaultIcon(type) {
    const defaults = {
      helmet: '⛑️',
      armor: '👕',
      weapon: '🗡️',
      shield: '🛡️',
      accessory: '💍'
    };
    return defaults[type] || '❓';
  }

  getRarityColor(rarity) {
    const colors = {
      common: 'gray-400',
      rare: 'blue-400',
      epic: 'purple-400',
      legendary: 'yellow-400',
      mythic: 'red-400'
    };
    return colors[rarity] || 'gray-400';
  }

  async equipReward(rewardId) {
    try {
      const response = await this.makeAuthenticatedRequest('/api/equip-reward', {
        method: 'POST',
        data: {
          user_id: this.currentUser.id,
          reward_id: rewardId
        }
      });
      
      if (response.data.success) {
        await this.loadCharacterRewards();
        await this.loadUserStats();
        this.showSuccess('Equipment updated! Your character looks mighty!');
      }
    } catch (error) {
      console.error('Error equipping reward:', error);
      this.showError('Failed to equip item. Make sure you have unlocked it!');
    }
  }

  showUpgradeModal() {
    // Create upgrade modal if it doesn't exist
    let modal = document.getElementById('upgradeModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'upgradeModal';
      modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/80';
      modal.innerHTML = `
        <div class="glass rounded-lg p-8 w-full max-w-4xl mx-4 max-h-screen overflow-y-auto">
          <h2 class="medieval-title text-3xl font-bold gold-text text-center mb-6">⚔️ Choose Your Adventure Plan</h2>
          <div id="subscription-plans" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <!-- Plans will be loaded here -->
          </div>
          <div class="text-center">
            <button onclick="app.closeModal('upgradeModal')" class="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded font-medium transition-all">
              Close
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    this.loadSubscriptionPlans();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  showAccountModal() {
    // Create account management modal
    let modal = document.getElementById('accountModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'accountModal';
      modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/80';
      modal.innerHTML = `
        <div class="glass rounded-lg p-8 w-full max-w-md mx-4">
          <h2 class="medieval-title text-2xl font-bold gold-text text-center mb-6">⚔️ Account Management</h2>
          <div class="space-y-4">
            <div class="text-center">
              <p class="text-yellow-300">Logged in as:</p>
              <p class="text-white font-bold">${this.currentUser.name}</p>
              <p class="text-yellow-400">${this.currentUser.email}</p>
            </div>
            
            <div class="text-center">
              <p class="text-yellow-300">Current Plan:</p>
              <p class="text-white font-bold">${this.getPlanDisplayName(this.currentUser.subscription_plan)}</p>
            </div>
            
            <div class="space-y-2">
              <button onclick="app.showUpgradeModal(); app.closeModal('accountModal')" 
                      class="w-full medieval-btn py-3 rounded font-medium">
                🏰 Change Plan
              </button>
              
              <button onclick="app.logout()" 
                      class="w-full bg-red-600 hover:bg-red-700 py-3 rounded font-medium transition-all text-white">
                🚪 Logout
              </button>
            </div>
            
            <div class="text-center">
              <button onclick="app.closeModal('accountModal')" class="text-yellow-400 hover:text-yellow-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  showSubscriptionExpiredModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/90';
    modal.innerHTML = `
      <div class="glass rounded-lg p-8 w-full max-w-md mx-4 text-center">
        <div class="text-6xl mb-4">⚠️</div>
        <h2 class="medieval-title text-2xl font-bold text-red-400 mb-4">Quest Suspended!</h2>
        <p class="text-yellow-300 mb-6">Your subscription has expired. Renew to continue your financial adventure!</p>
        <div class="space-y-4">
          <button onclick="app.showUpgradeModal(); this.parentElement.parentElement.parentElement.remove()" 
                  class="w-full medieval-btn py-3 rounded font-bold">
            🏰 Renew Subscription
          </button>
          <button onclick="app.logout()" 
                  class="w-full bg-gray-600 hover:bg-gray-700 py-3 rounded font-medium transition-all">
            🚪 Logout
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  async loadSubscriptionPlans() {
    try {
      const response = await this.makeAuthenticatedRequest('/api/subscription/plans');
      const plans = response.data;
      
      const container = document.getElementById('subscription-plans');
      if (!container) return;
      
      container.innerHTML = plans.map(plan => `
        <div class="bg-gray-800/50 rounded-lg p-6 border-2 ${this.getPlanBorderColor(plan.name)} 
             ${plan.name === 'basic' ? 'transform scale-105' : ''}">
          <div class="text-center">
            ${plan.name === 'basic' ? '<div class="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-2">MOST POPULAR</div>' : ''}
            <h3 class="medieval-title text-xl font-bold ${this.getPlanTextColor(plan.name)} mb-2">${plan.display_name}</h3>
            <div class="text-3xl font-bold text-white mb-2">$${plan.price_monthly}</div>
            <div class="text-sm text-gray-400 mb-4">per month</div>
            <div class="text-sm text-gray-300 mb-6">${plan.description}</div>
            ${plan.name === this.currentUser.subscription_plan ? 
              '<button class="w-full bg-green-600 py-3 rounded font-bold text-white" disabled>Current Plan</button>' :
              `<button onclick="app.subscribeToPlan(${plan.id}, '${plan.name}', 'monthly')" 
                       class="w-full medieval-btn py-3 rounded font-bold transition-all hover:scale-105">
                 Choose This Plan
               </button>`
            }
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading subscription plans:', error);
      this.showError('Failed to load subscription plans');
    }
  }

  async subscribeToPlan(planId, planName, billingCycle = 'monthly') {
    try {
      this.showLoading('Redirecting to secure payment...');
      
      // Create Stripe Checkout session
      const response = await this.makeAuthenticatedRequest('/api/create-checkout-session', {
        method: 'POST',
        data: {
          price_id: 'price_1RzjdBR5h825yDltIusGFmm9', // Coin Quest RPG Premium - $4.99/month
          billing_cycle: billingCycle
        }
      });
      
      if (response.data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.checkout_url;
      } else {
        this.hideLoading();
        this.showError('Failed to create payment session. Please try again.');
      }
    } catch (error) {
      this.hideLoading();
      console.error('Error creating checkout session:', error);
      this.showError('Payment setup failed. Please try again.');
    }
  }

  // Handle successful payment return from Stripe
  async handlePaymentSuccess(sessionId) {
    try {
      this.showLoading('Confirming your payment...');
      
      // Wait a moment for webhook processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh user data to get updated subscription status
      await this.loadUserStats();
      
      this.hideLoading();
      this.showSuccess('🎉 Payment successful! Welcome to Coin Quest RPG Premium!');
      
      // Refresh the page to show updated subscription status
      setTimeout(() => {
        window.location.href = '/app';
      }, 2000);
      
    } catch (error) {
      this.hideLoading();
      console.error('Error confirming payment:', error);
      this.showError('Payment may still be processing. Please refresh the page.');
    }
  }

  // Add subscription status checking method
  async checkDetailedSubscriptionStatus() {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/subscription-status/${this.currentUser.id}`);
      
      if (response.data) {
        const status = response.data;
        
        // Update UI based on subscription status
        if (status.subscription_status === 'premium') {
          this.showSuccess('✅ Premium subscription active');
        } else if (status.subscription_status === 'trial') {
          const daysLeft = Math.ceil((new Date(status.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24));
          this.showInfo(`⏰ ${daysLeft} days left in your free trial`);
        } else if (status.subscription_status === 'cancelled_at_period_end') {
          this.showWarning('📋 Subscription will cancel at the end of current period');
        }
        
        return status;
      }
    } catch (error) {
      console.error('Error checking detailed subscription status:', error);
    }
  }

  // Add method to cancel subscription
  async cancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.')) {
      return;
    }

    try {
      this.showLoading('Processing cancellation...');
      
      const response = await this.makeAuthenticatedRequest('/api/cancel-subscription', {
        method: 'POST',
        data: {
          user_id: this.currentUser.id
        }
      });
      
      if (response.data.success) {
        this.hideLoading();
        this.showSuccess('Subscription cancelled. You will have access until the end of your current period.');
        
        // Refresh subscription status
        await this.checkDetailedSubscriptionStatus();
      } else {
        this.hideLoading();
        this.showError('Failed to cancel subscription. Please try again.');
      }
    } catch (error) {
      this.hideLoading();
      console.error('Error cancelling subscription:', error);
      this.showError('Failed to cancel subscription. Please contact support.');
    } catch (error) {
      console.error('Subscription error:', error);
      this.hideLoading();
      this.showError('Subscription failed. Please try again.');
    }
  }

  getPlanBorderColor(planName) {
    const colors = {
      'trial': 'border-gray-600',
      'basic': 'border-blue-400',
      'premium': 'border-purple-400',
      'ultimate': 'border-yellow-400'
    };
    return colors[planName] || 'border-gray-600';
  }

  getPlanTextColor(planName) {
    const colors = {
      'trial': 'text-gray-400',
      'basic': 'text-blue-400',
      'premium': 'text-purple-400',
      'ultimate': 'text-yellow-400'
    };
    return colors[planName] || 'text-gray-400';
  }

  showLoading(message) {
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

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
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

    if (incomeEl) incomeEl.textContent = `${income.toFixed(0)} 🪙`;
    if (expensesEl) expensesEl.textContent = `${expenses.toFixed(0)} 🪙`;
    if (savingsEl) savingsEl.textContent = `${savings.toFixed(0)} 🪙`;
  }

  updateRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');
    if (!container) return;

    if (transactions.length === 0) {
      container.innerHTML = '<p class="text-yellow-400 text-center py-4">No recent quest activity</p>';
      return;
    }

    container.innerHTML = transactions.map(transaction => `
      <div class="flex justify-between items-center p-4 bg-amber-900/30 rounded-lg border border-yellow-600/30">
        <div class="flex items-center space-x-3">
          <div class="text-3xl">${this.getMedievalIcon(transaction.type, transaction.icon)}</div>
          <div>
            <div class="font-medium text-yellow-200">${this.getMedievalAction(transaction.type, transaction.category_name)}</div>
            <div class="text-sm text-yellow-400">${transaction.description || 'No details recorded'}</div>
            <div class="text-xs text-yellow-500">${new Date(transaction.entry_date).toLocaleDateString()}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-bold ${this.getAmountColor(transaction.type)}">
            ${this.formatMedievalAmount(transaction.amount, transaction.type)}
          </div>
          <div class="text-xs text-yellow-500">${this.getMedievalType(transaction.type)}</div>
        </div>
      </div>
    `).join('');
  }

  getMedievalIcon(type, originalIcon) {
    const icons = {
      income: '🪙',
      expense: '🛒',
      savings: '💎',
      debt_payment: '⚔️'
    };
    return icons[type] || originalIcon || '💰';
  }

  getMedievalAction(type, category) {
    const actions = {
      income: `Gold earned from ${category}`,
      expense: `Gold spent on ${category}`,
      savings: `Treasure stored in ${category}`,
      debt_payment: `Dragon slaying: ${category}`
    };
    return actions[type] || category;
  }

  getMedievalType(type) {
    const types = {
      income: 'Gold Earned',
      expense: 'Gold Spent',
      savings: 'Treasure Stored',
      debt_payment: 'Dragon Slain'
    };
    return types[type] || type;
  }

  updateDebtsDisplay() {
    const container = document.getElementById('debtsList');
    if (!container) return;

    if (this.debts.length === 0) {
      container.innerHTML = `
        <div class="glass rounded-lg p-8 text-center">
          <i class="fas fa-dragon-fire text-8xl text-green-400 mb-4"></i>
          <h3 class="medieval-title text-2xl font-bold mb-4 gold-text">All Dragons Slain!</h3>
          <p class="text-yellow-300">You have conquered all debt dragons in the realm!</p>
          <p class="text-yellow-400 text-sm mt-2">Your legend will be sung in taverns across the land!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.debts.map(debt => {
      const progress = ((debt.original_amount - debt.current_amount) / debt.original_amount) * 100;
      const dragonType = this.getDragonType(debt.current_amount);
      
      return `
        <div class="glass rounded-lg p-6 border-2 border-red-600/50">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="medieval-title text-xl font-bold text-red-400">
                ${dragonType.icon} ${debt.name} Dragon
              </h3>
              <p class="text-yellow-400">Minimum tribute: ${debt.minimum_payment.toFixed(0)} 🪙</p>
              ${debt.interest_rate ? `<p class="text-red-300">Dragon's greed: ${debt.interest_rate}% annually</p>` : ''}
              <p class="text-xs text-yellow-500 mt-1">${dragonType.description}</p>
            </div>
            <div class="text-right">
              <div class="text-3xl font-bold text-red-400">${debt.current_amount.toFixed(0)} 🪙</div>
              <div class="text-sm text-yellow-500">of ${debt.original_amount.toFixed(0)} 🪙 total</div>
            </div>
          </div>
          
          <div class="mb-4">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-yellow-300">Dragon's Health</span>
              <span class="text-yellow-400">${(100 - progress).toFixed(1)}% remaining</span>
            </div>
            <div class="w-full bg-red-900 rounded-full h-3 border border-red-600">
              <div class="bg-red-500 h-3 rounded-full transition-all" style="width: ${100 - progress}%"></div>
            </div>
          </div>
          
          <button onclick="app.quickPayDebt(${debt.id}, ${debt.minimum_payment})" 
                  class="w-full medieval-btn py-3 rounded-lg font-medium transition-all">
            ⚔️ Attack for ${debt.minimum_payment.toFixed(0)} 🪙
          </button>
        </div>
      `;
    }).join('');
  }

  getDragonType(amount) {
    if (amount < 500) return { icon: '🐲', description: 'A small but fierce debt dragon' };
    if (amount < 2000) return { icon: '🐉', description: 'A dangerous debt dragon hoarding your gold' };
    if (amount < 10000) return { icon: '🔥', description: 'A mighty debt dragon breathing financial fire' };
    return { icon: '👹', description: 'An ancient debt dragon of legendary power' };
  }

  updateAchievementsDisplay() {
    const container = document.getElementById('achievementsList');
    if (!container) return;

    container.innerHTML = this.achievements.map(achievement => `
      <div class="glass rounded-lg p-6 ${achievement.earned ? 'border-2 border-yellow-400' : 'opacity-75 border border-gray-600'} 
           transition-all hover:scale-105">
        <div class="text-center">
          <div class="text-5xl mb-4">${achievement.icon || '🏆'}</div>
          <h3 class="medieval-title font-bold text-lg mb-2 ${achievement.earned ? 'gold-text' : 'text-gray-400'}">${achievement.name}</h3>
          <p class="text-sm text-yellow-400 mb-4">${achievement.description}</p>
          
          <div class="space-y-2 text-xs text-yellow-500">
            ${achievement.level_requirement > 1 ? `<div>🏰 Rank ${achievement.level_requirement} required</div>` : ''}
            ${achievement.savings_requirement > 0 ? `<div>💎 Save ${achievement.savings_requirement} gold</div>` : ''}
            ${achievement.debt_payment_requirement > 0 ? `<div>⚔️ Slay ${achievement.debt_payment_requirement} gold worth of dragons</div>` : ''}
          </div>
          
          <div class="mt-4">
            ${achievement.earned ? 
              '<span class="bg-yellow-600 px-4 py-2 rounded-full text-sm font-bold text-black">🏆 EARNED</span>' :
              '<span class="bg-gray-600 px-4 py-2 rounded-full text-sm">🔒 Locked</span>'
            }
          </div>
        </div>
      </div>
    `).join('');
  }

  updateDebtSelect() {
    const select = document.getElementById('debtSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select dragon to attack...</option>' +
      this.debts.map(debt => 
        `<option value="${debt.id}">${debt.name} Dragon - ${debt.current_amount.toFixed(0)} 🪙</option>`
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

  formatMedievalAmount(amount, type) {
    const prefix = (type === 'expense' || type === 'debt_payment') ? '-' : '+';
    return prefix + Math.abs(amount).toFixed(0) + ' 🪙';
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
      btn.classList.remove('active');
      btn.style.background = '';
    });

    const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.style.background = 'linear-gradient(145deg, #DAA520, #B8860B)';
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

    // Load tab-specific data
    if (tab === 'character' && !this.rewards) {
      this.loadRewards();
    } else if (tab === 'achievements' && (!this.achievements || this.achievements.length === 0)) {
      this.loadData(); // This will load achievements
    }
  }

  setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('entryDate');
    if (dateInput) dateInput.value = today;
  }

  showAddEntryModal(type) {
    const modal = document.getElementById('addEntryModal');
    const title = document.getElementById('modalTitle');
    const typeInput = document.getElementById('entryType');
    const categorySelect = document.getElementById('entryCategory');

    // Set modal title and type
    const titles = {
      income: '⚔️ Record Gold Earned',
      expense: '🛒 Record Gold Spent', 
      savings: '💎 Store Treasure'
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

      const response = await this.makeAuthenticatedRequest('/api/budget-entry', {
        method: 'POST',
        data: entry
      });
      
      if (response.data.levelUp) {
        this.showLevelUpModal(response.data.newLevel);
      }
      
      // Reload data
      await Promise.all([
        this.loadUserStats(),
        this.loadDashboardData(),
        this.checkForNewRewards()
      ]);
      
      this.closeModal('addEntryModal');
      this.showSuccess('Quest completed successfully! Experience gained! ⚔️');
    } catch (error) {
      console.error('Error adding entry:', error);
      this.showError('Quest failed! Please try again, brave adventurer.');
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

      const response = await this.makeAuthenticatedRequest('/api/pay-debt', {
        method: 'POST',
        data: payment
      });
      
      if (response.data.paidOff) {
        this.showSuccess('🐉 DRAGON SLAIN! The beast has been vanquished! Your legend grows! 🏆');
      } else {
        this.showSuccess('⚔️ You struck a mighty blow against the dragon! Keep fighting!');
      }
      
      // Reload data
      await Promise.all([
        this.loadUserStats(),
        this.loadDashboardData(),
        this.loadDebts(),
        this.checkForNewRewards()
      ]);
      
      this.closeModal('payDebtModal');
    } catch (error) {
      console.error('Error paying debt:', error);
      this.showError('The dragon dodged your attack! Try again, warrior!');
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
        this.showSuccess('🐉 DRAGON SLAIN COMPLETELY! Victory is yours! 🏆');
      } else {
        this.showSuccess('⚔️ Successful dragon attack! The beast weakens!');
      }
      
      // Reload data
      await Promise.all([
        this.loadUserStats(),
        this.loadDashboardData(),
        this.loadDebts(),
        this.checkForNewRewards()
      ]);
    } catch (error) {
      console.error('Error paying debt:', error);
      this.showError('Your attack missed! Try again, brave warrior!');
    }
  }

  showLevelUpModal(newLevel) {
    const modal = document.getElementById('levelUpModal');
    const levelText = document.getElementById('levelUpText');
    const rewardText = document.getElementById('levelUpReward');
    
    levelText.textContent = `You reached Level ${newLevel}!`;
    rewardText.textContent = 'Your reputation grows throughout the realm!';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Update video background for new level
    setTimeout(() => {
      this.updateVideoBackground();
    }, 1000);
  }

  showNewRewardsModal(rewards) {
    // Create a simple notification for new rewards
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 right-4 glass-dark rounded-lg p-4 z-50 shadow-lg max-w-sm';
    toast.innerHTML = `
      <div class="text-center">
        <div class="text-2xl mb-2">🎁</div>
        <h3 class="medieval-title font-bold text-yellow-400">New Rewards Unlocked!</h3>
        <p class="text-yellow-300 text-sm mt-2">Check your Character tab to see your new equipment!</p>
        <div class="mt-3">
          ${rewards.map(reward => `<div class="text-xs text-yellow-500">${reward.display_name}</div>`).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 8000);
  }

  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg z-50 shadow-lg max-w-sm';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 5000);
  }

  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg z-50 shadow-lg max-w-sm';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 6000);
  }

  // ===============================
  // REWARDS SYSTEM METHODS
  // ===============================

  async loadRewards() {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/rewards/${this.currentUser.id}`);
      this.rewards = response.rewards;
      this.rewardStats = response.stats;
      
      this.updateRewardsDisplay();
      this.setupRewardEventListeners();
      
      // Also load collections
      await this.loadCollections();
    } catch (error) {
      console.error('Error loading rewards:', error);
      this.showError('Failed to load rewards');
    }
  }

  async loadCollections() {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/collections/${this.currentUser.id}`);
      this.collections = response.collections;
      this.updateCollectionsDisplay();
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  }

  updateRewardsDisplay() {
    // Update stats
    document.getElementById('totalRewards').textContent = this.rewardStats.total;
    document.getElementById('unlockedRewards').textContent = this.rewardStats.unlocked;
    document.getElementById('equippedRewards').textContent = this.rewardStats.equipped;
    document.getElementById('availableRewards').textContent = this.rewardStats.available;
    document.getElementById('lockedRewards').textContent = this.rewardStats.locked;

    // Update progress display
    document.getElementById('progressLevel').textContent = `Level ${this.currentUser.current_level}`;
    document.getElementById('progressTitle').textContent = this.currentUser.character_title || 'Peasant Coin-Counter';
    document.getElementById('progressSavings').textContent = `${this.currentUser.total_saved || 0} 🪙`;
    document.getElementById('progressDebtPaid').textContent = `${this.currentUser.total_debt_paid || 0} 🪙`;

    // Display rewards based on current filters
    this.filterAndDisplayRewards();
  }

  updateCollectionsDisplay() {
    const container = document.getElementById('collectionsProgress');
    if (!container) return;

    if (!this.collections || this.collections.length === 0) {
      container.innerHTML = '<div class="text-center text-yellow-400 text-sm">No collections available</div>';
      return;
    }

    container.innerHTML = this.collections.map(collection => {
      const progress = collection.total_rewards > 0 ? 
        (collection.unlocked_rewards / collection.total_rewards) * 100 : 0;
      
      return `
        <div class="collection-item p-3 glass-dark rounded cursor-pointer transition-all hover:bg-yellow-600/10" 
             onclick="app.showCollectionDetails(${collection.id})">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-bold text-yellow-400">${collection.display_name}</span>
            <span class="text-xs ${collection.completion_status === 'completed' ? 'text-green-400' : 'text-yellow-500'}">
              ${collection.unlocked_rewards}/${collection.total_rewards}
            </span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-2">
            <div class="bg-gradient-to-r from-yellow-600 to-yellow-400 h-2 rounded-full transition-all" 
                 style="width: ${progress}%"></div>
          </div>
          ${collection.completion_status === 'completed' ? 
            '<div class="text-xs text-green-400 mt-1">✨ Completed!</div>' : ''
          }
        </div>
      `;
    }).join('');
  }

  filterAndDisplayRewards() {
    const activeCategory = document.querySelector('.reward-category-tab.active')?.dataset.category || 'all';
    const activeRarity = document.querySelector('.rarity-filter.active')?.dataset.rarity || 'all';
    
    let filteredRewards = [];

    if (activeCategory === 'all') {
      // Show all rewards from all categories
      Object.keys(this.rewards).forEach(category => {
        Object.keys(this.rewards[category]).forEach(rarity => {
          filteredRewards.push(...this.rewards[category][rarity]);
        });
      });
    } else {
      // Show rewards from specific category
      if (this.rewards[activeCategory]) {
        Object.keys(this.rewards[activeCategory]).forEach(rarity => {
          filteredRewards.push(...this.rewards[activeCategory][rarity]);
        });
      }
    }

    // Filter by rarity
    if (activeRarity !== 'all') {
      filteredRewards = filteredRewards.filter(reward => reward.rarity === activeRarity);
    }

    // Sort by unlock status, then by level, then by rarity
    const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    filteredRewards.sort((a, b) => {
      // First by unlock status (unlocked first)
      if (a.unlock_status !== b.unlock_status) {
        if (a.unlock_status === 'unlocked') return -1;
        if (b.unlock_status === 'unlocked') return 1;
        if (a.unlock_status === 'available') return -1;
        if (b.unlock_status === 'available') return 1;
      }
      
      // Then by level
      if (a.unlock_level !== b.unlock_level) {
        return a.unlock_level - b.unlock_level;
      }
      
      // Then by rarity
      return rarityOrder[a.rarity] - rarityOrder[b.rarity];
    });

    this.displayRewardsGrid(filteredRewards);
  }

  displayRewardsGrid(rewards) {
    const container = document.getElementById('rewardsGrid');
    if (!container) return;

    if (rewards.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center text-yellow-400 py-8">
          <i class="fas fa-search text-2xl mb-2"></i>
          <div>No rewards match your current filters</div>
        </div>
      `;
      return;
    }

    container.innerHTML = rewards.map(reward => {
      const icon = this.getRewardIcon(reward.type, reward.name);
      const rarityClass = this.getRarityClass(reward.rarity);
      const statusClass = this.getStatusClass(reward.unlock_status);
      
      return `
        <div class="reward-item ${rarityClass} ${statusClass} p-3 rounded-lg border-2 cursor-pointer transition-all hover:scale-105"
             onclick="app.showRewardDetails('${reward.id}')">
          <div class="text-center">
            <div class="text-2xl mb-2">${icon}</div>
            <div class="text-xs font-bold truncate" title="${reward.display_name}">${reward.display_name}</div>
            <div class="text-xs text-yellow-500 truncate">${reward.rarity}</div>
            ${reward.unlock_status === 'unlocked' ? 
              `<div class="text-xs mt-1">
                ${reward.is_equipped ? '<span class="text-green-400">✅ Equipped</span>' : '<span class="text-blue-400">📦 Owned</span>'}
              </div>` : 
              `<div class="text-xs mt-1 text-gray-400">
                ${reward.unlock_status === 'available' ? '🔓 Available' : '🔒 Locked'}
              </div>`
            }
            ${reward.unlock_level > 1 ? `<div class="text-xs text-yellow-600">Lv.${reward.unlock_level}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  getRewardIcon(type, name) {
    // Map reward names to emojis - this is a simplified version
    const iconMap = {
      helmet: { 
        leather_cap: '🧢', iron_helm: '⛑️', steel_crown: '👑', dragon_helm: '🐲', 
        elder_circlet: '✨', straw_hat: '👒', cloth_hood: '🎭'
      },
      armor: { 
        cloth_rags: '👔', leather_vest: '🦺', chainmail: '🛡️', plate_armor: '⚔️', 
        dragon_scale: '🐉', elder_robes: '🧙'
      },
      weapon: { 
        wooden_stick: '🏏', copper_dagger: '🗡️', iron_sword: '⚔️', steel_axe: '🪓', 
        dragon_blade: '🐲', elder_staff: '🔮', rusty_spoon: '🥄'
      },
      shield: { 
        wooden_buckler: '🛡️', iron_shield: '🛡️', dragon_shield: '🐲'
      },
      accessory: { 
        coin_pouch: '💰', golden_ring: '💍', elder_amulet: '🔮'
      },
      background: { 
        tavern: '🏠', market: '🏪', castle: '🏰', dragon_lair: '🐉'
      },
      title: '📜'
    };

    if (type === 'title') return iconMap.title;
    return iconMap[type]?.[name] || this.getDefaultIcon(type);
  }

  getDefaultIcon(type) {
    const defaults = {
      helmet: '⛑️', armor: '👕', weapon: '🗡️', shield: '🛡️', 
      accessory: '💍', background: '🏞️', title: '📜'
    };
    return defaults[type] || '🏰';
  }

  getRarityClass(rarity) {
    const classes = {
      common: 'rarity-common border-gray-400',
      rare: 'rarity-rare border-green-400',
      epic: 'rarity-epic border-blue-400', 
      legendary: 'rarity-legendary border-purple-400',
      mythic: 'rarity-mythic border-red-400'
    };
    return classes[rarity] || 'border-gray-400';
  }

  getStatusClass(status) {
    const classes = {
      unlocked: 'bg-green-900/30',
      available: 'bg-blue-900/30', 
      locked: 'bg-gray-900/30 opacity-75'
    };
    return classes[status] || 'bg-gray-900/30';
  }

  setupRewardEventListeners() {
    // Category tab switching
    document.querySelectorAll('.reward-category-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.reward-category-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.filterAndDisplayRewards();
      });
    });

    // Rarity filtering
    document.querySelectorAll('.rarity-filter').forEach(filter => {
      filter.addEventListener('click', (e) => {
        document.querySelectorAll('.rarity-filter').forEach(f => f.classList.remove('active'));
        e.target.classList.add('active');
        this.filterAndDisplayRewards();
      });
    });
  }

  showRewardDetails(rewardId) {
    const reward = this.findRewardById(rewardId);
    if (!reward) return;

    const modal = document.getElementById('rewardModal');
    const title = document.getElementById('rewardModalTitle');
    const rarity = document.getElementById('rewardModalRarity');
    const icon = document.getElementById('rewardModalIcon');
    const description = document.getElementById('rewardModalDescription');
    const requirements = document.getElementById('rewardModalRequirements');
    const button = document.getElementById('rewardModalButton');

    title.textContent = reward.display_name;
    rarity.textContent = reward.rarity.toUpperCase();
    rarity.className = `text-sm ${this.getRarityTextClass(reward.rarity)}`;
    
    icon.textContent = this.getRewardIcon(reward.type, reward.name);
    icon.className = `reward-icon-large mx-auto mb-3 w-16 h-16 flex items-center justify-center text-4xl rounded-lg border-2 ${this.getRarityClass(reward.rarity)}`;
    
    description.textContent = reward.description || 'A legendary item of great power and prestige.';

    // Show requirements
    let requirementsHTML = '';
    if (reward.unlock_level > 1) {
      requirementsHTML += `<div class="flex justify-between"><span>Required Level:</span><span class="text-yellow-400">Level ${reward.unlock_level}</span></div>`;
    }
    if (reward.unlock_savings_requirement > 0) {
      requirementsHTML += `<div class="flex justify-between"><span>Gold Saved:</span><span class="text-green-400">${reward.unlock_savings_requirement} 🪙</span></div>`;
    }
    if (reward.unlock_debt_payment_requirement > 0) {
      requirementsHTML += `<div class="flex justify-between"><span>Debt Slain:</span><span class="text-red-400">${reward.unlock_debt_payment_requirement} 🪙</span></div>`;
    }
    requirements.innerHTML = requirementsHTML;

    // Configure button
    if (reward.unlock_status === 'unlocked') {
      if (reward.is_equipped) {
        button.textContent = '✅ Currently Equipped';
        button.disabled = true;
        button.className = 'bg-green-600 px-6 py-3 rounded-lg font-bold opacity-50 cursor-not-allowed';
      } else {
        button.textContent = '⚔️ Equip Item';
        button.disabled = false;
        button.className = 'medieval-btn px-6 py-3 rounded-lg font-bold transition-all';
        button.onclick = () => this.equipReward(reward.id);
      }
    } else if (reward.unlock_status === 'available') {
      button.textContent = '🔓 Unlock Now';
      button.disabled = false;
      button.className = 'bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold transition-all';
      button.onclick = () => this.unlockReward(reward.id);
    } else {
      button.textContent = '🔒 Requirements Not Met';
      button.disabled = true;
      button.className = 'bg-gray-600 px-6 py-3 rounded-lg font-bold opacity-50 cursor-not-allowed';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  findRewardById(rewardId) {
    for (const category of Object.keys(this.rewards)) {
      for (const rarity of Object.keys(this.rewards[category])) {
        const reward = this.rewards[category][rarity].find(r => r.id == rewardId);
        if (reward) return reward;
      }
    }
    return null;
  }

  getRarityTextClass(rarity) {
    const classes = {
      common: 'text-gray-300',
      rare: 'text-green-400',
      epic: 'text-blue-400', 
      legendary: 'text-purple-400',
      mythic: 'text-red-400'
    };
    return classes[rarity] || 'text-gray-300';
  }

  async equipReward(rewardId) {
    try {
      const response = await this.makeAuthenticatedRequest('/api/equip-reward', {
        method: 'POST',
        body: JSON.stringify({
          user_id: this.currentUser.id,
          reward_id: rewardId
        })
      });

      if (response.success) {
        this.showSuccess('Item equipped successfully! ⚔️');
        await this.loadRewards(); // Reload to update display
        this.closeRewardModal();
      }
    } catch (error) {
      console.error('Error equipping reward:', error);
      this.showError('Failed to equip item');
    }
  }

  async unlockReward(rewardId) {
    try {
      // The reward should auto-unlock when requirements are met
      // This triggers the check-rewards endpoint
      const response = await this.makeAuthenticatedRequest('/api/check-rewards', {
        method: 'POST',
        body: JSON.stringify({
          user_id: this.currentUser.id
        })
      });

      if (response.newRewards && response.newRewards.length > 0) {
        const unlockedReward = response.newRewards.find(r => r.id == rewardId);
        if (unlockedReward) {
          this.showSuccess(`🎉 Unlocked: ${unlockedReward.display_name}!`);
          await this.loadRewards(); // Reload to update display
          this.closeRewardModal();
        }
      }
    } catch (error) {
      console.error('Error unlocking reward:', error);
      this.showError('Failed to unlock reward');
    }
  }

  closeRewardModal() {
    const modal = document.getElementById('rewardModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  showCollectionDetails(collectionId) {
    // This would show a detailed view of the collection
    // For now, we'll just show a simple alert
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection) {
      this.showSuccess(`Collection: ${collection.display_name} - ${collection.unlocked_rewards}/${collection.total_rewards} complete`);
    }
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

function closeRewardModal() {
  app.closeRewardModal();
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new CoinQuestRPG();
});

// Add CSS for active tab styling and rewards system
const style = document.createElement('style');
style.textContent = `
  .tab-button.active {
    background: linear-gradient(145deg, #DAA520, #B8860B) !important;
    color: #000 !important;
    font-weight: bold !important;
  }
  
  .tab-button:not(.active) {
    background: linear-gradient(145deg, #8B4513, #654321) !important;
  }
  
  .tab-button:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6) !important;
  }
  
  /* Rewards System Styles */
  .reward-category-tab.active {
    background: linear-gradient(145deg, #DAA520, #B8860B) !important;
    color: #000 !important;
    font-weight: bold !important;
  }
  
  .reward-category-tab:not(.active) {
    background: rgba(139, 69, 19, 0.5) !important;
    color: #DAA520 !important;
  }
  
  .rarity-filter.active {
    background: rgba(218, 165, 32, 0.3) !important;
    transform: scale(1.05);
  }
  
  .reward-item:hover {
    transform: scale(1.1) !important;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.7) !important;
  }
  
  .rarity-common { 
    border-color: #9CA3AF !important; 
    background: rgba(156, 163, 175, 0.1);
  }
  .rarity-rare { 
    border-color: #10B981 !important; 
    background: rgba(16, 185, 129, 0.1);
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
  }
  .rarity-epic { 
    border-color: #3B82F6 !important; 
    background: rgba(59, 130, 246, 0.1);
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
  }
  .rarity-legendary { 
    border-color: #8B5CF6 !important; 
    background: rgba(139, 92, 246, 0.1);
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
  }
  .rarity-mythic { 
    border-color: #EF4444 !important; 
    background: rgba(239, 68, 68, 0.1);
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.6);
    animation: mythic-glow 2s ease-in-out infinite alternate;
  }
  
  @keyframes mythic-glow {
    from { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
    to { box-shadow: 0 0 30px rgba(239, 68, 68, 0.9); }
  }
  
  .collection-item:hover {
    background: rgba(218, 165, 32, 0.2) !important;
    transform: translateX(5px);
  }
  
  .reward-icon-large {
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
  }
`;
document.head.appendChild(style);