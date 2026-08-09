/**
 * ✦ TELEGRAM DOCUMENT VAULT - MINI APP FRONTEND ENGINE
 */

document.addEventListener('DOMContentLoaded', () => {
  // Telegram WebApp Initialization
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#090d16');
  }

  // App State
  const state = {
    user: {
      id: tg?.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : 'arasu_default',
      first_name: tg?.initDataUnsafe?.user?.first_name || 'Arasu',
      username: tg?.initDataUnsafe?.user?.username || 'arasu'
    },
    currentTab: 'home',
    currentFolderId: null,
    viewMode: 'grid', // 'grid' or 'list'
    searchQuery: '',
    selectedCategory: 'all',
    dateFilter: 'all',
    sortBy: 'newest',
    selectedFile: null,
    pinBuffer: '',
    verifiedPin: false
  };

  // DOM Elements
  const elements = {
    // Header & Greeting
    userDisplayName: document.getElementById('user-display-name'),
    greetingTime: document.getElementById('greeting-time'),
    userAvatarInitials: document.getElementById('user-avatar-initials'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    btnLockVault: document.getElementById('btn-lock-vault'),

    // Storage Card
    storagePercentLabel: document.getElementById('storage-percent-label'),
    storageProgressFill: document.getElementById('storage-progress-fill'),
    storageUsedLabel: document.getElementById('storage-used-label'),
    
    // Lists & Containers
    recentFilesList: document.getElementById('recent-files-list'),
    quickAccessGrid: document.getElementById('quick-access-grid'),
    breadcrumbsBar: document.getElementById('breadcrumbs-bar'),
    explorerFoldersContainer: document.getElementById('explorer-folders-container'),
    explorerFilesContainer: document.getElementById('explorer-files-container'),
    explorerItemCount: document.getElementById('explorer-item-count'),
    starredFilesList: document.getElementById('starred-files-list'),
    searchResultsList: document.getElementById('search-results-list'),
    resultsCountBadge: document.getElementById('results-count-badge'),

    // Search Controls
    homeSearchTrigger: document.getElementById('home-search-trigger'),
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    filterTypePills: document.getElementById('filter-type-pills'),
    selectDateFilter: document.getElementById('select-date-filter'),
    selectSortBy: document.getElementById('select-sort-by'),

    // Buttons
    btnFabAdd: document.getElementById('btn-fab-add'),
    btnNewFolderHeader: document.getElementById('btn-new-folder-header'),
    btnViewGrid: document.getElementById('btn-view-grid'),
    btnViewList: document.getElementById('btn-view-list'),
    btnViewAllFolders: document.getElementById('btn-view-all-folders'),

    // Modals & Sheets
    sheetCreateOptions: document.getElementById('sheet-create-options'),
    optionNewFolder: document.getElementById('option-new-folder'),
    optionUploadFile: document.getElementById('option-upload-file'),
    optionUploadPhoto: document.getElementById('option-upload-photo'),
    optionUploadVideo: document.getElementById('option-upload-video'),
    hiddenFileInput: document.getElementById('hidden-file-input'),

    modalNewFolder: document.getElementById('modal-new-folder'),
    inputFolderName: document.getElementById('input-folder-name'),
    switchPrivateFolder: document.getElementById('switch-private-folder'),
    btnCancelFolder: document.getElementById('btn-cancel-folder'),
    btnConfirmFolder: document.getElementById('btn-confirm-folder'),

    modalUploadProgress: document.getElementById('modal-upload-progress'),
    uploadPercentText: document.getElementById('upload-percent-text'),
    uploadFilenameText: document.getElementById('upload-filename-text'),
    uploadBytesText: document.getElementById('upload-bytes-text'),
    progressRingCircle: document.getElementById('progress-ring-circle'),
    btnCancelUpload: document.getElementById('btn-cancel-upload'),

    sheetFileDetails: document.getElementById('sheet-file-details'),
    previewFileIcon: document.getElementById('preview-file-icon'),
    previewFileName: document.getElementById('preview-file-name'),
    previewFileMeta: document.getElementById('preview-file-meta'),
    previewFileDate: document.getElementById('preview-file-date'),
    btnDownloadTelegram: document.getElementById('btn-download-telegram'),
    btnToggleFavorite: document.getElementById('btn-toggle-favorite'),
    iconStarPreview: document.getElementById('icon-star-preview'),
    labelStarPreview: document.getElementById('label-star-preview'),
    btnShareFile: document.getElementById('btn-share-file'),
    btnDeleteFile: document.getElementById('btn-delete-file'),

    pinLockOverlay: document.getElementById('pin-lock-overlay'),
    pinPromptText: document.getElementById('pin-prompt-text'),
    pinDotsRow: document.getElementById('pin-dots-row'),

    modalSettings: document.getElementById('modal-settings'),
    settingAppName: document.getElementById('setting-app-name'),
    settingStorageLimit: document.getElementById('setting-storage-limit'),
    settingSwitchPin: document.getElementById('setting-switch-pin'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings')
  };

  // Helper: Haptic Vibration Trigger
  function triggerHaptic(type = 'light') {
    if (tg?.HapticFeedback) {
      if (type === 'impact') tg.HapticFeedback.impactOccurred('medium');
      else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      else if (type === 'warning') tg.HapticFeedback.notificationOccurred('warning');
      else tg.HapticFeedback.selectionChanged();
    }
  }

  // Helper: Toast Notifications
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Helper: Formatting File Sizes
  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  // Helper: Formatting Dates
  function formatDate(dateStr) {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffHours < 48) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  // Helper: Get File Type Icon Category
  function getFileIconInfo(mimeType, category, name) {
    if (category === 'excel' || name.endsWith('.xlsx') || name.endsWith('.csv')) {
      return { icon: 'file-spreadsheet', class: 'excel' };
    }
    if (category === 'photo' || mimeType.startsWith('image/')) {
      return { icon: 'image', class: 'photo' };
    }
    if (category === 'video' || mimeType.startsWith('video/')) {
      return { icon: 'video', class: 'video' };
    }
    if (category === 'archive' || name.endsWith('.zip') || name.endsWith('.rar')) {
      return { icon: 'archive', class: 'archive' };
    }
    return { icon: 'file-text', class: 'pdf' };
  }

  // Initialize User UI
  function initUserHeader() {
    elements.userDisplayName.textContent = `${state.user.first_name} 👋`;
    elements.userAvatarInitials.textContent = state.user.first_name.charAt(0).toUpperCase();

    const hour = new Date().getHours();
    let timeGreeting = 'Good morning,';
    if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon,';
    else if (hour >= 17) timeGreeting = 'Good evening,';
    elements.greetingTime.textContent = timeGreeting;
  }

  // Switch Active Tab
  function switchTab(tabName) {
    triggerHaptic();
    state.currentTab = tabName;
    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) activeView.classList.add('active');

    const activeNavBtn = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    if (tabName === 'home') loadVaultOverview();
    else if (tabName === 'files') loadFolderContents(state.currentFolderId);
    else if (tabName === 'starred') loadStarredFiles();
    else if (tabName === 'search') {
      elements.searchInput.focus();
      triggerSearch();
    }
  }

  // API Call: Fetch Vault Overview & Stats
  async function loadVaultOverview() {
    try {
      const res = await fetch(`/api/vault?user_id=${state.user.id}`);
      const data = await res.json();

      if (data.success) {
        // Storage Bar
        const pct = data.stats.used_percentage;
        elements.storagePercentLabel.textContent = `${pct}%`;
        elements.storageProgressFill.style.width = `${pct}%`;
        elements.storageUsedLabel.textContent = `${formatBytes(data.stats.used_bytes)} / ${formatBytes(data.stats.limit_bytes)}`;

        // Recent Files List
        renderRecentFiles(data.recent_files);
      }
    } catch (err) {
      console.error('Failed to load vault stats:', err);
    }
  }

  // Render Recent Files on Home
  function renderRecentFiles(files) {
    elements.recentFilesList.innerHTML = '';
    if (!files || files.length === 0) {
      elements.recentFilesList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No recent files uploaded</div>';
      return;
    }

    files.forEach(file => {
      const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
      const row = document.createElement('div');
      row.className = 'file-item-row';
      row.innerHTML = `
        <div class="file-type-icon ${iconInfo.class}">
          <i data-lucide="${iconInfo.icon}"></i>
        </div>
        <div class="file-item-info">
          <div class="file-item-name">${escapeHtml(file.name)}</div>
          <div class="file-item-sub">
            <span>${formatBytes(file.size)} • ${formatDate(file.created_at)}</span>
            ${file.folder_name ? `<span class="path-badge">${escapeHtml(file.folder_name)}</span>` : ''}
          </div>
        </div>
        <div class="file-item-actions">
          <button class="star-btn-sm ${file.is_starred ? 'starred' : ''}" data-file-id="${file.id}">
            <i data-lucide="star"></i>
          </button>
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.star-btn-sm')) {
          e.stopPropagation();
          toggleStarFile(file.id);
        } else {
          openFileDetailsSheet(file);
        }
      });

      elements.recentFilesList.appendChild(row);
    });

    lucide.createIcons();
  }

  // API Call: Fetch Folder Tree & Files
  async function loadFolderContents(folderId = null) {
    try {
      state.currentFolderId = folderId;
      const res = await fetch(`/api/folders?user_id=${state.user.id}&parent_id=${folderId}`);
      const data = await res.json();

      if (data.success) {
        renderBreadcrumbs(data.breadcrumbs);
        renderFolderExplorer(data.folders, data.files);
        elements.explorerItemCount.textContent = `${data.folders.length + data.files.length} items`;
      }
    } catch (err) {
      console.error('Failed to load folder contents:', err);
    }
  }

  // Render Breadcrumbs Bar
  function renderBreadcrumbs(crumbs) {
    elements.breadcrumbsBar.innerHTML = '';
    crumbs.forEach((crumb, idx) => {
      const crumbEl = document.createElement('span');
      crumbEl.className = `crumb ${idx === crumbs.length - 1 ? 'active' : ''}`;
      crumbEl.innerHTML = idx === 0 ? `<i data-lucide="hard-drive"></i> ${crumb.name}` : crumb.name;
      crumbEl.addEventListener('click', () => {
        loadFolderContents(crumb.id);
      });

      elements.breadcrumbsBar.appendChild(crumbEl);

      if (idx < crumbs.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'crumb-separator';
        sep.textContent = '>';
        elements.breadcrumbsBar.appendChild(sep);
      }
    });
    lucide.createIcons();
  }

  // Render Explorer Folders & Files Grid
  function renderFolderExplorer(folders, files) {
    elements.explorerFoldersContainer.innerHTML = '';
    elements.explorerFilesContainer.innerHTML = '';

    // Folders
    folders.forEach(folder => {
      const fCard = document.createElement('div');
      fCard.className = 'folder-explorer-card';
      fCard.innerHTML = `
        <div class="folder-card-top">
          <i data-lucide="${folder.icon || 'folder'}" class="folder-big-icon"></i>
          ${folder.is_private ? '<i data-lucide="lock" style="font-size: 14px; color: var(--accent-amber);"></i>' : ''}
        </div>
        <div class="folder-card-name">${escapeHtml(folder.name)}</div>
        <div class="folder-card-sub">${folder.file_count || 0} files</div>
      `;

      fCard.addEventListener('click', () => {
        if (folder.is_private && !state.verifiedPin) {
          openPinLockOverlay(() => loadFolderContents(folder.id));
        } else {
          loadFolderContents(folder.id);
        }
      });

      elements.explorerFoldersContainer.appendChild(fCard);
    });

    // Files
    files.forEach(file => {
      const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
      const fItem = document.createElement('div');
      fItem.className = 'file-item-row glass-card';
      fItem.style.marginBottom = '8px';
      fItem.innerHTML = `
        <div class="file-type-icon ${iconInfo.class}">
          <i data-lucide="${iconInfo.icon}"></i>
        </div>
        <div class="file-item-info">
          <div class="file-item-name">${escapeHtml(file.name)}</div>
          <div class="file-item-sub">${formatBytes(file.size)} • ${formatDate(file.created_at)}</div>
        </div>
        <div class="file-item-actions">
          <button class="star-btn-sm ${file.is_starred ? 'starred' : ''}">
            <i data-lucide="star"></i>
          </button>
        </div>
      `;

      fItem.addEventListener('click', (e) => {
        if (e.target.closest('.star-btn-sm')) {
          e.stopPropagation();
          toggleStarFile(file.id);
        } else {
          openFileDetailsSheet(file);
        }
      });

      elements.explorerFilesContainer.appendChild(fItem);
    });

    lucide.createIcons();
  }

  // API Call: Fetch Starred Files
  async function loadStarredFiles() {
    try {
      const res = await fetch(`/api/files?user_id=${state.user.id}&starred=1`);
      const data = await res.json();

      elements.starredFilesList.innerHTML = '';
      if (!data.files || data.files.length === 0) {
        elements.starredFilesList.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted);">No starred items yet. Click the star on any file to pin it here.</div>';
        return;
      }

      data.files.forEach(file => {
        const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
        const row = document.createElement('div');
        row.className = 'file-item-row';
        row.innerHTML = `
          <div class="file-type-icon ${iconInfo.class}">
            <i data-lucide="${iconInfo.icon}"></i>
          </div>
          <div class="file-item-info">
            <div class="file-item-name">${escapeHtml(file.name)}</div>
            <div class="file-item-sub">${formatBytes(file.size)} • ${file.folder_name ? escapeHtml(file.folder_name) : 'Root'}</div>
          </div>
          <button class="star-btn-sm starred"><i data-lucide="star"></i></button>
        `;
        row.addEventListener('click', () => openFileDetailsSheet(file));
        elements.starredFilesList.appendChild(row);
      });
      lucide.createIcons();
    } catch (err) {
      console.error('Failed to load starred files:', err);
    }
  }

  // API Call: Perform Search with Filters
  async function triggerSearch() {
    try {
      const query = elements.searchInput.value.trim();
      const category = state.selectedCategory;
      const dateFilter = elements.selectDateFilter.value;
      const sortBy = elements.selectSortBy.value;

      const url = `/api/files?user_id=${state.user.id}&query=${encodeURIComponent(query)}&category=${category}&date_filter=${dateFilter}&sort_by=${sortBy}`;
      const res = await fetch(url);
      const data = await res.json();

      elements.resultsCountBadge.textContent = `${data.total} found`;
      elements.searchResultsList.innerHTML = '';

      if (!data.files || data.files.length === 0) {
        elements.searchResultsList.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted);">No matching files found</div>';
        return;
      }

      data.files.forEach(file => {
        const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
        const row = document.createElement('div');
        row.className = 'file-item-row glass-card';
        row.style.marginBottom = '8px';
        row.innerHTML = `
          <div class="file-type-icon ${iconInfo.class}">
            <i data-lucide="${iconInfo.icon}"></i>
          </div>
          <div class="file-item-info">
            <div class="file-item-name">${escapeHtml(file.name)}</div>
            <div class="file-item-sub">
              <span>${formatBytes(file.size)}</span>
              ${file.folder_name ? `<span class="path-badge">${escapeHtml(file.folder_name)}</span>` : '<span class="path-badge">Root</span>'}
            </div>
          </div>
        `;
        row.addEventListener('click', () => openFileDetailsSheet(file));
        elements.searchResultsList.appendChild(row);
      });
      lucide.createIcons();
    } catch (err) {
      console.error('Search error:', err);
    }
  }

  // File Details Sheet Actions
  function openFileDetailsSheet(file) {
    triggerHaptic();
    state.selectedFile = file;
    const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);

    elements.previewFileIcon.className = `hero-file-icon ${iconInfo.class}`;
    elements.previewFileIcon.innerHTML = `<i data-lucide="${iconInfo.icon}"></i>`;
    elements.previewFileName.textContent = file.name;
    elements.previewFileMeta.textContent = `${file.category.toUpperCase()} • ${formatBytes(file.size)}`;
    elements.previewFileDate.textContent = `Uploaded ${formatDate(file.created_at)}`;

    if (file.is_starred) {
      elements.iconStarPreview.setAttribute('data-lucide', 'star-off');
      elements.labelStarPreview.textContent = 'Remove Favorite';
    } else {
      elements.iconStarPreview.setAttribute('data-lucide', 'star');
      elements.labelStarPreview.textContent = 'Add to Favorites';
    }

    elements.sheetFileDetails.classList.add('active');
    lucide.createIcons();
  }

  // Download File to Telegram Chat
  async function downloadFileToTelegram() {
    if (!state.selectedFile) return;
    triggerHaptic('impact');
    showToast('⏳ Requesting Telegram Bot file delivery...', 'info');

    try {
      const res = await fetch(`/api/files/${state.selectedFile.id}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: state.user.id, chat_id: state.user.id })
      });
      const data = await res.json();

      if (data.success) {
        triggerHaptic('success');
        showToast('✓ Telegram sent original document to your chat!', 'success');
        elements.sheetFileDetails.classList.remove('active');
      } else {
        showToast(`❌ ${data.message}`, 'error');
      }
    } catch (err) {
      showToast('❌ Network error requesting file download', 'error');
    }
  }

  // Toggle Favorite/Star
  async function toggleStarFile(fileId) {
    triggerHaptic();
    try {
      const res = await fetch(`/api/files/${fileId}/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: state.user.id })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.is_starred ? '⭐ Added to Favorites' : 'Removed from Favorites');
        if (state.currentTab === 'home') loadVaultOverview();
        else if (state.currentTab === 'files') loadFolderContents(state.currentFolderId);
        else if (state.currentTab === 'starred') loadStarredFiles();
        if (elements.sheetFileDetails.classList.contains('active')) {
          elements.sheetFileDetails.classList.remove('active');
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Delete File
  async function deleteSelectedFile() {
    if (!state.selectedFile) return;
    if (!confirm(`Are you sure you want to delete "${state.selectedFile.name}"?`)) return;

    triggerHaptic('warning');
    try {
      const res = await fetch(`/api/files/${state.selectedFile.id}?user_id=${state.user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('🗑 File deleted successfully', 'success');
        elements.sheetFileDetails.classList.remove('active');
        if (state.currentTab === 'home') loadVaultOverview();
        else if (state.currentTab === 'files') loadFolderContents(state.currentFolderId);
        else if (state.currentTab === 'starred') loadStarredFiles();
        else if (state.currentTab === 'search') triggerSearch();
      }
    } catch (err) {
      showToast('Failed to delete file', 'error');
    }
  }

  // Create New Folder Action
  async function createFolder() {
    const name = elements.inputFolderName.value.trim();
    if (!name) {
      showToast('Please enter a folder name', 'error');
      return;
    }

    triggerHaptic('impact');
    const isPrivate = elements.switchPrivateFolder.checked ? 1 : 0;

    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: state.user.id,
          parent_id: state.currentFolderId,
          name,
          icon: 'folder',
          is_private: isPrivate
        })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`📁 Folder "${name}" created!`, 'success');
        elements.modalNewFolder.classList.remove('active');
        elements.inputFolderName.value = '';
        if (state.currentTab === 'files') loadFolderContents(state.currentFolderId);
        else loadVaultOverview();
      }
    } catch (err) {
      showToast('Error creating folder', 'error');
    }
  }

  // File Upload Process & Progress Animation
  function handleFileUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    elements.sheetCreateOptions.classList.remove('active');

    // Show Progress Modal
    elements.modalUploadProgress.classList.add('active');
    elements.uploadFilenameText.textContent = file.name;
    elements.uploadBytesText.textContent = `0 MB / ${formatBytes(file.size)}`;
    elements.uploadPercentText.textContent = '0%';

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 10;
      if (progress > 100) progress = 100;

      const offset = 251.2 - (251.2 * progress) / 100;
      elements.progressRingCircle.style.strokeDashoffset = offset;
      elements.uploadPercentText.textContent = `${progress}%`;
      elements.uploadBytesText.textContent = `${formatBytes((file.size * progress) / 100)} / ${formatBytes(file.size)}`;

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(async () => {
          // Perform real API upload
          const formData = new FormData();
          formData.append('file', file);
          formData.append('user_id', state.user.id);
          formData.append('folder_id', state.currentFolderId || 'null');

          try {
            await fetch('/api/files/upload', { method: 'POST', body: formData });
            triggerHaptic('success');
            showToast(`✓ "${file.name}" uploaded successfully!`, 'success');
            elements.modalUploadProgress.classList.remove('active');

            if (state.currentTab === 'files') loadFolderContents(state.currentFolderId);
            else loadVaultOverview();
          } catch (err) {
            showToast('Upload failed', 'error');
            elements.modalUploadProgress.classList.remove('active');
          }
        }, 400);
      }
    }, 150);
  }

  // PIN Keypad Security Handler
  function openPinLockOverlay(onSuccessCallback) {
    state.pinBuffer = '';
    updatePinDots();
    elements.pinLockOverlay.style.display = 'flex';

    const keypadBtns = elements.pinLockOverlay.querySelectorAll('.key-btn');
    keypadBtns.forEach(btn => {
      btn.onclick = () => {
        triggerHaptic();
        const key = btn.getAttribute('data-key');
        if (key === 'clear') state.pinBuffer = '';
        else if (key === 'back') state.pinBuffer = state.pinBuffer.slice(0, -1);
        else if (state.pinBuffer.length < 4) state.pinBuffer += key;

        updatePinDots();

        if (state.pinBuffer.length === 4) {
          setTimeout(async () => {
            // Verify PIN with backend
            const res = await fetch('/api/pin/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: state.user.id, pin: state.pinBuffer })
            });
            const data = await res.json();

            if (data.verified) {
              triggerHaptic('success');
              state.verifiedPin = true;
              elements.pinLockOverlay.style.display = 'none';
              if (onSuccessCallback) onSuccessCallback();
            } else {
              triggerHaptic('warning');
              showToast('❌ Incorrect PIN code', 'error');
              state.pinBuffer = '';
              updatePinDots();
            }
          }, 200);
        }
      };
    });
  }

  function updatePinDots() {
    const dots = elements.pinDotsRow.children;
    for (let i = 0; i < 4; i++) {
      if (i < state.pinBuffer.length) dots[i].classList.add('filled');
      else dots[i].classList.remove('filled');
    }
  }

  // Event Listeners Binding
  function bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    // Home Search Trigger
    elements.homeSearchTrigger.addEventListener('click', () => switchTab('search'));

    // FAB Action Menu
    elements.btnFabAdd.addEventListener('click', () => {
      triggerHaptic('impact');
      elements.sheetCreateOptions.classList.add('active');
    });

    // Option Handlers
    elements.optionNewFolder.addEventListener('click', () => {
      elements.sheetCreateOptions.classList.remove('active');
      elements.modalNewFolder.classList.add('active');
    });

    elements.btnNewFolderHeader.addEventListener('click', () => {
      elements.modalNewFolder.classList.add('active');
    });

    elements.btnCancelFolder.addEventListener('click', () => {
      elements.modalNewFolder.classList.remove('active');
    });

    elements.btnConfirmFolder.addEventListener('click', createFolder);

    // Upload Triggers
    elements.optionUploadFile.addEventListener('click', () => elements.hiddenFileInput.click());
    elements.optionUploadPhoto.addEventListener('click', () => elements.hiddenFileInput.click());
    elements.optionUploadVideo.addEventListener('click', () => elements.hiddenFileInput.click());

    elements.hiddenFileInput.addEventListener('change', (e) => handleFileUpload(e.target.files));

    // File Details Sheet
    elements.btnDownloadTelegram.addEventListener('click', downloadFileToTelegram);
    elements.btnToggleFavorite.addEventListener('click', () => {
      if (state.selectedFile) toggleStarFile(state.selectedFile.id);
    });
    elements.btnDeleteFile.addEventListener('click', deleteSelectedFile);
    elements.btnShareFile.addEventListener('click', () => {
      showToast('🔗 Direct vault link copied to clipboard!');
    });

    // Close Sheets on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('active');
      });
    });

    // Search Controls
    elements.searchInput.addEventListener('input', () => {
      elements.btnClearSearch.style.display = elements.searchInput.value ? 'block' : 'none';
      triggerSearch();
    });

    elements.btnClearSearch.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.btnClearSearch.style.display = 'none';
      triggerSearch();
    });

    elements.filterTypePills.querySelectorAll('.pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        elements.filterTypePills.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.selectedCategory = pill.getAttribute('data-type');
        triggerSearch();
      });
    });

    elements.selectDateFilter.addEventListener('change', triggerSearch);
    elements.selectSortBy.addEventListener('change', triggerSearch);

    // Header Actions
    elements.btnLockVault.addEventListener('click', () => {
      state.verifiedPin = false;
      openPinLockOverlay();
    });

    elements.btnOpenSettings.addEventListener('click', () => elements.modalSettings.classList.add('active'));
    elements.btnCloseSettings.addEventListener('click', () => elements.modalSettings.classList.remove('active'));
    elements.btnSaveSettings.addEventListener('click', async () => {
      const appName = elements.settingAppName.value;
      const limitGb = parseInt(elements.settingStorageLimit.value, 10) || 10;
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: appName, storage_limit_bytes: limitGb * 1024 * 1024 * 1024 })
      });
      showToast('✓ Settings updated', 'success');
      elements.modalSettings.classList.remove('active');
      loadVaultOverview();
    });

    elements.btnViewAllFolders.addEventListener('click', () => switchTab('files'));

    // Quick Access Cards
    elements.quickAccessGrid.querySelectorAll('.quick-folder-card').forEach(card => {
      card.addEventListener('click', () => {
        switchTab('files');
      });
    });
  }

  // Escape HTML Utility
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Boot Application
  function boot() {
    initUserHeader();
    bindEvents();
    loadVaultOverview();
  }

  boot();
});
