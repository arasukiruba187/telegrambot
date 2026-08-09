/**
 * ✦ TELEGRAM DOCUMENT VAULT - INSTANT RENDER FRONTEND ENGINE
 */

document.addEventListener('DOMContentLoaded', () => {
  // Telegram WebApp SDK Initialization
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#07090e');
  }

  // Application State
  const state = {
    user: {
      id: tg?.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : 'arasu_default',
      first_name: tg?.initDataUnsafe?.user?.first_name || 'Arasu',
      username: tg?.initDataUnsafe?.user?.username || 'arasu'
    },
    currentTab: 'home',
    currentFolderId: null,
    selectedCategory: 'all',
    dateFilter: 'all',
    sortBy: 'newest',
    selectedFile: null
  };

  // DOM Elements Selector Map
  const elements = {
    userDisplayName: document.getElementById('user-display-name'),
    greetingTime: document.getElementById('greeting-time'),
    userAvatarInitials: document.getElementById('user-avatar-initials'),
    btnOpenSettings: document.getElementById('btn-open-settings'),

    storagePercentLabel: document.getElementById('storage-percent-label'),
    storageProgressFill: document.getElementById('storage-progress-fill'),
    storageUsedLabel: document.getElementById('storage-used-label'),

    recentFilesList: document.getElementById('recent-files-list'),
    breadcrumbsBar: document.getElementById('breadcrumbs-bar'),
    explorerFoldersContainer: document.getElementById('explorer-folders-container'),
    explorerFilesContainer: document.getElementById('explorer-files-container'),
    explorerItemCount: document.getElementById('explorer-item-count'),
    starredFilesList: document.getElementById('starred-files-list'),
    searchResultsList: document.getElementById('search-results-list'),
    resultsCountBadge: document.getElementById('results-count-badge'),

    homeSearchTrigger: document.getElementById('home-search-trigger'),
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    filterTypePills: document.getElementById('filter-type-pills'),
    selectDateFilter: document.getElementById('select-date-filter'),
    selectSortBy: document.getElementById('select-sort-by'),

    btnFabAdd: document.getElementById('btn-fab-add'),
    btnNewFolderHeader: document.getElementById('btn-new-folder-header'),
    btnViewAllFiles: document.getElementById('btn-view-all-files'),

    sheetCreateOptions: document.getElementById('sheet-create-options'),
    optionNewFolder: document.getElementById('option-new-folder'),
    optionUploadFile: document.getElementById('option-upload-file'),
    optionUploadPhoto: document.getElementById('option-upload-photo'),
    optionUploadVideo: document.getElementById('option-upload-video'),
    hiddenFileInput: document.getElementById('hidden-file-input'),

    modalNewFolder: document.getElementById('modal-new-folder'),
    inputFolderName: document.getElementById('input-folder-name'),
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
    btnShareFile: document.getElementById('btn-share-file'),
    btnDeleteFile: document.getElementById('btn-delete-file'),

    modalSettings: document.getElementById('modal-settings'),
    settingAppName: document.getElementById('setting-app-name'),
    settingStorageLimit: document.getElementById('setting-storage-limit'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings')
  };

  // Helper: Haptic Vibration Trigger
  function triggerHaptic(type = 'light') {
    if (tg?.HapticFeedback) {
      if (type === 'impact') tg.HapticFeedback.impactOccurred('medium');
      else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
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

  // Helper: Inline SVG Icon Resolver (Instant 0ms render)
  function getFileIconInfo(mimeType, category, name) {
    if (category === 'excel' || name.endsWith('.xlsx') || name.endsWith('.csv')) {
      return {
        svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="8 13 16 13"/><polyline points="8 17 16 17"/></svg>`,
        class: 'excel'
      };
    }
    if (category === 'photo' || mimeType.startsWith('image/')) {
      return {
        svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
        class: 'photo'
      };
    }
    if (category === 'video' || mimeType.startsWith('video/')) {
      return {
        svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
        class: 'video'
      };
    }
    if (category === 'archive' || name.endsWith('.zip') || name.endsWith('.rar')) {
      return {
        svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
        class: 'archive'
      };
    }
    return {
      svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
      class: 'pdf'
    };
  }

  // Initialize Header Greeting
  function initHeader() {
    elements.userDisplayName.textContent = `${state.user.first_name} 👋`;
    elements.userAvatarInitials.textContent = state.user.first_name.charAt(0).toUpperCase();

    const hour = new Date().getHours();
    let timeGreeting = 'Good morning,';
    if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon,';
    else if (hour >= 17) timeGreeting = 'Good evening,';
    elements.greetingTime.textContent = timeGreeting;
  }

  // Switch View Tab
  function switchTab(tabName) {
    triggerHaptic();
    state.currentTab = tabName;
    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(item => item.classList.remove('active'));

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) activeView.classList.add('active');

    const activeNavBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    if (tabName === 'home') loadVaultOverview();
    else if (tabName === 'files') loadFolderContents(state.currentFolderId);
    else if (tabName === 'starred') loadStarredFiles();
    else if (tabName === 'search') {
      elements.searchInput.focus();
      triggerSearch();
    }
  }

  // API Call: Load Vault Stats & Recent Items
  async function loadVaultOverview() {
    try {
      const res = await fetch(`/api/vault?user_id=${state.user.id}&first_name=${encodeURIComponent(state.user.first_name)}`);
      const data = await res.json();

      if (data.success) {
        const pct = data.stats.used_percentage;
        elements.storagePercentLabel.textContent = `${pct}%`;
        elements.storageProgressFill.style.width = `${pct}%`;
        elements.storageUsedLabel.textContent = `${formatBytes(data.stats.used_bytes)} of ${formatBytes(data.stats.limit_bytes)} used`;

        renderRecentFiles(data.recent_files);
      }
    } catch (err) {
      console.error('Failed to load vault stats:', err);
    }
  }

  // Render Recent Files List with Inline SVGs
  function renderRecentFiles(files) {
    elements.recentFilesList.innerHTML = '';
    if (!files || files.length === 0) {
      elements.recentFilesList.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No files in your vault yet.</div>';
      return;
    }

    files.forEach(file => {
      const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
      const card = document.createElement('div');
      card.className = 'file-item-card';
      card.innerHTML = `
        <div class="file-icon-box ${iconInfo.class}">
          ${iconInfo.svg}
        </div>
        <div class="file-details-col">
          <div class="file-title-text">${escapeHtml(file.name)}</div>
          <div class="file-sub-text">
            <span>${formatBytes(file.size)} • ${formatDate(file.created_at)}</span>
            ${file.folder_name ? `<span class="folder-badge-tag">${escapeHtml(file.folder_name)}</span>` : ''}
          </div>
        </div>
        <button class="btn-star-icon ${file.is_starred ? 'starred' : ''}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="${file.is_starred ? '#fbbf24' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-star-icon')) {
          e.stopPropagation();
          toggleStarFile(file.id);
        } else {
          openFileDetailsSheet(file);
        }
      });

      elements.recentFilesList.appendChild(card);
    });
  }

  // API Call: Fetch Folder Contents
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

  // Render Breadcrumb Pills with SVG
  function renderBreadcrumbs(crumbs) {
    elements.breadcrumbsBar.innerHTML = '';
    crumbs.forEach((crumb, idx) => {
      const pill = document.createElement('span');
      pill.className = `crumb-pill ${idx === crumbs.length - 1 ? 'active' : ''}`;
      pill.innerHTML = idx === 0 ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> ${crumb.name}` : crumb.name;
      pill.addEventListener('click', () => loadFolderContents(crumb.id));

      elements.breadcrumbsBar.appendChild(pill);

      if (idx < crumbs.length - 1) {
        const sep = document.createElement('span');
        sep.style.color = 'var(--text-muted)';
        sep.style.fontSize = '12px';
        sep.textContent = '>';
        elements.breadcrumbsBar.appendChild(sep);
      }
    });
  }

  // Render Explorer Folders & Files (Instant SVG Icons)
  function renderFolderExplorer(folders, files) {
    elements.explorerFoldersContainer.innerHTML = '';
    elements.explorerFilesContainer.innerHTML = '';

    // Folders Grid
    folders.forEach(folder => {
      const fCard = document.createElement('div');
      fCard.className = 'folder-card-item';
      fCard.innerHTML = `
        <div class="folder-card-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="folder-card-name">${escapeHtml(folder.name)}</div>
        <div class="folder-card-meta">${folder.file_count || 0} files</div>
      `;

      fCard.addEventListener('click', () => {
        loadFolderContents(folder.id);
      });

      elements.explorerFoldersContainer.appendChild(fCard);
    });

    // Files List
    files.forEach(file => {
      const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
      const fCard = document.createElement('div');
      fCard.className = 'file-item-card';
      fCard.innerHTML = `
        <div class="file-icon-box ${iconInfo.class}">
          ${iconInfo.svg}
        </div>
        <div class="file-details-col">
          <div class="file-title-text">${escapeHtml(file.name)}</div>
          <div class="file-sub-text">${formatBytes(file.size)} • ${formatDate(file.created_at)}</div>
        </div>
        <button class="btn-star-icon ${file.is_starred ? 'starred' : ''}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="${file.is_starred ? '#fbbf24' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      `;

      fCard.addEventListener('click', (e) => {
        if (e.target.closest('.btn-star-icon')) {
          e.stopPropagation();
          toggleStarFile(file.id);
        } else {
          openFileDetailsSheet(file);
        }
      });

      elements.explorerFilesContainer.appendChild(fCard);
    });
  }

  // API Call: Fetch Starred Items
  async function loadStarredFiles() {
    try {
      const res = await fetch(`/api/files?user_id=${state.user.id}&starred=1`);
      const data = await res.json();

      elements.starredFilesList.innerHTML = '';
      if (!data.files || data.files.length === 0) {
        elements.starredFilesList.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted);">No favorite files pinned yet.</div>';
        return;
      }

      data.files.forEach(file => {
        const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
        const card = document.createElement('div');
        card.className = 'file-item-card';
        card.innerHTML = `
          <div class="file-icon-box ${iconInfo.class}">
            ${iconInfo.svg}
          </div>
          <div class="file-details-col">
            <div class="file-title-text">${escapeHtml(file.name)}</div>
            <div class="file-sub-text">${formatBytes(file.size)} • ${file.folder_name ? escapeHtml(file.folder_name) : 'Vault Root'}</div>
          </div>
          <button class="btn-star-icon starred">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#fbbf24" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        `;
        card.addEventListener('click', () => openFileDetailsSheet(file));
        elements.starredFilesList.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to load starred files:', err);
    }
  }

  // API Call: Search Vault
  async function triggerSearch() {
    try {
      const query = elements.searchInput.value.trim();
      const category = state.selectedCategory;
      const dateFilter = elements.selectDateFilter.value;
      const sortBy = elements.selectSortBy.value;

      const url = `/api/files?user_id=${state.user.id}&query=${encodeURIComponent(query)}&category=${category}&date_filter=${dateFilter}&sort_by=${sortBy}`;
      const res = await fetch(url);
      const data = await res.json();

      elements.resultsCountBadge.textContent = `${data.total} items`;
      elements.searchResultsList.innerHTML = '';

      if (!data.files || data.files.length === 0) {
        elements.searchResultsList.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted);">No matching files found.</div>';
        return;
      }

      data.files.forEach(file => {
        const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
        const card = document.createElement('div');
        card.className = 'file-item-card';
        card.innerHTML = `
          <div class="file-icon-box ${iconInfo.class}">
            ${iconInfo.svg}
          </div>
          <div class="file-details-col">
            <div class="file-title-text">${escapeHtml(file.name)}</div>
            <div class="file-sub-text">
              <span>${formatBytes(file.size)}</span>
              ${file.folder_name ? `<span class="folder-badge-tag">${escapeHtml(file.folder_name)}</span>` : ''}
            </div>
          </div>
        `;
        card.addEventListener('click', () => openFileDetailsSheet(file));
        elements.searchResultsList.appendChild(card);
      });
    } catch (err) {
      console.error('Search error:', err);
    }
  }

  // Open Preview Bottom Sheet
  function openFileDetailsSheet(file) {
    triggerHaptic();
    state.selectedFile = file;
    const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);

    elements.previewFileIcon.className = `file-hero-icon ${iconInfo.class}`;
    elements.previewFileIcon.innerHTML = iconInfo.svg;
    elements.previewFileName.textContent = file.name;
    elements.previewFileMeta.textContent = `${file.category.toUpperCase()} • ${formatBytes(file.size)}`;
    elements.previewFileDate.textContent = `Uploaded ${formatDate(file.created_at)}`;

    elements.sheetFileDetails.classList.add('active');
  }

  // Download File to Telegram Chat
  async function downloadFileToTelegram() {
    if (!state.selectedFile) return;
    triggerHaptic('impact');
    showToast('⏳ Sending document to your Telegram chat...', 'info');

    try {
      const res = await fetch(`/api/files/${state.selectedFile.id}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: state.user.id, chat_id: state.user.id })
      });
      const data = await res.json();

      if (data.success) {
        triggerHaptic('success');
        showToast('✓ Document delivered to Telegram chat!', 'success');
        elements.sheetFileDetails.classList.remove('active');
      } else {
        showToast(`❌ ${data.message}`, 'error');
      }
    } catch (err) {
      showToast('❌ Network error requesting download', 'error');
    }
  }

  // Toggle Favorite Star
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
    if (!confirm(`Delete "${state.selectedFile.name}" permanently?`)) return;

    triggerHaptic();
    try {
      const res = await fetch(`/api/files/${state.selectedFile.id}?user_id=${state.user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('🗑 File deleted', 'success');
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

  // Create Folder
  async function createFolder() {
    const name = elements.inputFolderName.value.trim();
    if (!name) {
      showToast('Folder name cannot be empty', 'error');
      return;
    }

    triggerHaptic('impact');
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: state.user.id,
          parent_id: state.currentFolderId,
          name,
          icon: 'folder'
        })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`📁 Folder "${name}" created`, 'success');
        elements.modalNewFolder.classList.remove('active');
        elements.inputFolderName.value = '';
        if (state.currentTab === 'files') loadFolderContents(state.currentFolderId);
        else loadVaultOverview();
      }
    } catch (err) {
      showToast('Error creating folder', 'error');
    }
  }

  // File Upload
  function handleFileUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    elements.sheetCreateOptions.classList.remove('active');

    elements.modalUploadProgress.classList.add('active');
    elements.uploadFilenameText.textContent = file.name;
    elements.uploadBytesText.textContent = `0 MB / ${formatBytes(file.size)}`;
    elements.uploadPercentText.textContent = '0%';

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 12;
      if (progress > 100) progress = 100;

      const offset = 226 - (226 * progress) / 100;
      elements.progressRingCircle.style.strokeDashoffset = offset;
      elements.uploadPercentText.textContent = `${progress}%`;
      elements.uploadBytesText.textContent = `${formatBytes((file.size * progress) / 100)} / ${formatBytes(file.size)}`;

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(async () => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('user_id', state.user.id);
          formData.append('folder_id', state.currentFolderId || 'null');

          try {
            await fetch('/api/files/upload', { method: 'POST', body: formData });
            triggerHaptic('success');
            showToast(`✓ "${file.name}" uploaded!`, 'success');
            elements.modalUploadProgress.classList.remove('active');

            if (state.currentTab === 'files') loadFolderContents(state.currentFolderId);
            else loadVaultOverview();
          } catch (err) {
            showToast('Upload failed', 'error');
            elements.modalUploadProgress.classList.remove('active');
          }
        }, 300);
      }
    }, 120);
  }

  // Event Bindings
  function bindEvents() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    elements.homeSearchTrigger.addEventListener('click', () => switchTab('search'));

    elements.btnFabAdd.addEventListener('click', () => {
      triggerHaptic('impact');
      elements.sheetCreateOptions.classList.add('active');
    });

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

    elements.optionUploadFile.addEventListener('click', () => elements.hiddenFileInput.click());
    elements.optionUploadPhoto.addEventListener('click', () => elements.hiddenFileInput.click());
    elements.optionUploadVideo.addEventListener('click', () => elements.hiddenFileInput.click());

    elements.hiddenFileInput.addEventListener('change', (e) => handleFileUpload(e.target.files));

    elements.btnDownloadTelegram.addEventListener('click', downloadFileToTelegram);
    elements.btnToggleFavorite.addEventListener('click', () => {
      if (state.selectedFile) toggleStarFile(state.selectedFile.id);
    });
    elements.btnDeleteFile.addEventListener('click', deleteSelectedFile);
    elements.btnShareFile.addEventListener('click', () => showToast('🔗 Direct vault link copied!'));

    document.querySelectorAll('.sheet-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('active');
      });
    });

    document.querySelectorAll('.sheet-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sheet-backdrop').forEach(s => s.classList.remove('active'));
      });
    });

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

    document.querySelectorAll('.cat-chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.cat-chip-btn').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.selectedCategory = chip.getAttribute('data-cat');
        switchTab('search');
      });
    });

    elements.selectDateFilter.addEventListener('change', triggerSearch);
    elements.selectSortBy.addEventListener('change', triggerSearch);

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
      showToast('✓ Preferences saved', 'success');
      elements.modalSettings.classList.remove('active');
      loadVaultOverview();
    });

    elements.btnViewAllFiles.addEventListener('click', () => switchTab('files'));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function boot() {
    initHeader();
    bindEvents();
    loadVaultOverview();
  }

  boot();
});
