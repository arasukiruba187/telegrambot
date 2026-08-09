/**
 * ✦ TELEGRAM FILE MANAGER - PROFESSIONAL ENGINE
 */

document.addEventListener('DOMContentLoaded', () => {
  // Telegram WebApp SDK Initialization
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#0b0f19');
  }

  // Application State
  const state = {
    user: {
      id: tg?.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : 'arasu_default',
      first_name: tg?.initDataUnsafe?.user?.first_name || 'Arasu',
      username: tg?.initDataUnsafe?.user?.username || 'arasu'
    },
    currentTab: 'files',
    currentFolderId: null,
    selectedCategory: 'all',
    dateFilter: 'all',
    sortBy: 'name', // Default sort: Ascending Name (A-Z)
    selectedFile: null,
    contextTarget: null
  };

  // DOM Elements Map
  const elements = {
    userDisplayName: document.getElementById('user-display-name'),

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
    btnNewFolderExplorer: document.getElementById('btn-new-folder-explorer'),

    sheetCreateOptions: document.getElementById('sheet-create-options'),
    optionNewFolder: document.getElementById('option-new-folder'),
    optionUploadFile: document.getElementById('option-upload-file'),
    optionUploadFolder: document.getElementById('option-upload-folder'),
    hiddenFileInput: document.getElementById('hidden-file-input'),
    hiddenFolderInput: document.getElementById('hidden-folder-input'),

    sheetItemContext: document.getElementById('sheet-item-context'),
    contextItemTitle: document.getElementById('context-item-title'),
    contextItemSubtitle: document.getElementById('context-item-subtitle'),
    contextOptionRename: document.getElementById('context-option-rename'),
    contextOptionDelete: document.getElementById('context-option-delete'),

    modalRenameItem: document.getElementById('modal-rename-item'),
    inputRenameName: document.getElementById('input-rename-name'),
    btnCancelRename: document.getElementById('btn-cancel-rename'),
    btnConfirmRename: document.getElementById('btn-confirm-rename'),

    modalNewFolder: document.getElementById('modal-new-folder'),
    inputFolderName: document.getElementById('input-folder-name'),
    btnCancelFolder: document.getElementById('btn-cancel-folder'),
    btnConfirmFolder: document.getElementById('btn-confirm-folder'),

    modalUploadProgress: document.getElementById('modal-upload-progress'),
    uploadStatusTitle: document.getElementById('upload-status-title'),
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
    labelStarPreview: document.getElementById('label-star-preview'),
    btnShareFile: document.getElementById('btn-share-file'),
    btnDeleteFile: document.getElementById('btn-delete-file'),

    dragDropOverlay: document.getElementById('drag-drop-overlay')
  };

  // Helper: Haptic Vibration
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

  // Helper: Inline SVG Icons
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

  // Helper: Touch Scroll & Long Press Detector
  function addLongPressListener(element, onClickCallback, onLongPressCallback) {
    let pressTimer = null;
    let isLongPress = false;
    let isScrolling = false;
    let startX = 0;
    let startY = 0;

    const startTouch = (e) => {
      if (e.touches && e.touches.length > 1) return;
      const touch = e.touches ? e.touches[0] : e;
      startX = touch.clientX;
      startY = touch.clientY;
      isLongPress = false;
      isScrolling = false;

      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        if (!isScrolling) {
          isLongPress = true;
          triggerHaptic('impact');
          onLongPressCallback(e);
        }
      }, 500);
    };

    const moveTouch = (e) => {
      if (!e.touches) return;
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - startX);
      const deltaY = Math.abs(touch.clientY - startY);

      if (deltaX > 8 || deltaY > 8) {
        isScrolling = true;
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      }
    };

    const endTouch = (e) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }

      if (!isScrolling && !isLongPress && onClickCallback) {
        onClickCallback(e);
      }
    };

    element.addEventListener('touchstart', startTouch, { passive: true });
    element.addEventListener('touchmove', moveTouch, { passive: true });
    element.addEventListener('touchend', endTouch);

    element.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      isLongPress = false;
      isScrolling = false;
      pressTimer = setTimeout(() => {
        if (!isScrolling) {
          isLongPress = true;
          triggerHaptic('impact');
          onLongPressCallback(e);
        }
      }, 500);
    });

    element.addEventListener('mouseup', (e) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      if (!isScrolling && !isLongPress && onClickCallback) {
        onClickCallback(e);
      }
    });
  }

  // Open Item Context Menu Sheet
  function openContextMenu(type, item) {
    state.contextTarget = { type, item };
    elements.contextItemTitle.textContent = item.name;
    elements.contextItemSubtitle.textContent = type === 'folder' ? 'Folder' : `${fileTypeLabel(item.mime_type, item.category)} • ${formatBytes(item.size)}`;

    elements.sheetItemContext.classList.add('active');
  }

  function fileTypeLabel(mime, category) {
    if (category === 'photo') return 'Photo';
    if (category === 'video') return 'Video';
    if (category === 'excel') return 'Spreadsheet';
    return 'Document';
  }

  // Switch View Tab (With Reset Folder Option)
  function switchTab(tabName, resetFolder = false) {
    triggerHaptic();
    state.currentTab = tabName;
    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(item => item.classList.remove('active'));

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) activeView.classList.add('active');

    const activeNavBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    if (tabName === 'files') {
      if (resetFolder) state.currentFolderId = null;
      loadFolderContents(state.currentFolderId);
    } else if (tabName === 'starred') {
      loadStarredFiles();
    } else if (tabName === 'search') {
      elements.searchInput.focus();
      triggerSearch();
    }
  }

  // API Call: Fetch Folder Contents (Always Sorted Ascending A-Z)
  async function loadFolderContents(folderId = null) {
    try {
      elements.userDisplayName.textContent = state.user.first_name;
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

  // Render Breadcrumb Pills
  function renderBreadcrumbs(crumbs) {
    elements.breadcrumbsBar.innerHTML = '';
    crumbs.forEach((crumb, idx) => {
      const item = document.createElement('span');
      item.className = `crumb-item ${idx === crumbs.length - 1 ? 'active' : ''}`;
      item.innerHTML = idx === 0 ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 2-2 2v13c0 1.1.9 2 2 2z"/></svg> ${crumb.name}` : crumb.name;
      item.addEventListener('click', () => loadFolderContents(crumb.id));

      elements.breadcrumbsBar.appendChild(item);

      if (idx < crumbs.length - 1) {
        const sep = document.createElement('span');
        sep.style.color = 'var(--text-muted)';
        sep.style.fontSize = '12px';
        sep.textContent = '>';
        elements.breadcrumbsBar.appendChild(sep);
      }
    });
  }

  // Render Explorer Folders & Files
  function renderFolderExplorer(folders, files) {
    elements.explorerFoldersContainer.innerHTML = '';
    elements.explorerFilesContainer.innerHTML = '';

    if ((!folders || folders.length === 0) && (!files || files.length === 0)) {
      elements.explorerFilesContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px;">Your vault is empty.<br>Tap + or drag & drop files/folders here.</div>';
      return;
    }

    folders.forEach(folder => {
      const card = document.createElement('div');
      card.className = 'folder-card-pro';
      card.innerHTML = `
        <svg viewBox="0 0 24 24" class="folder-icon-svg" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <div class="folder-pro-name">${escapeHtml(folder.name)}</div>
        <div class="folder-pro-count">${folder.file_count || 0} files</div>
      `;

      addLongPressListener(
        card,
        () => loadFolderContents(folder.id),
        () => openContextMenu('folder', folder)
      );

      elements.explorerFoldersContainer.appendChild(card);
    });

    files.forEach(file => {
      const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
      const row = document.createElement('div');
      row.className = 'file-row-pro';
      row.innerHTML = `
        <div class="file-type-badge ${iconInfo.class}">
          ${iconInfo.svg}
        </div>
        <div class="file-info-col">
          <div class="file-name-text">${escapeHtml(file.name)}</div>
          <div class="file-sub-info">${formatBytes(file.size)} • ${formatDate(file.created_at)}</div>
        </div>
        <button class="btn-star ${file.is_starred ? 'starred' : ''}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="${file.is_starred ? '#fbbf24' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      `;

      addLongPressListener(
        row,
        (e) => {
          if (e.target && e.target.closest('.btn-star')) {
            e.stopPropagation();
            toggleStarFile(file.id);
          } else {
            openFileDetailsSheet(file);
          }
        },
        () => openContextMenu('file', file)
      );

      elements.explorerFilesContainer.appendChild(row);
    });
  }

  // API Call: Fetch Starred Items
  async function loadStarredFiles() {
    try {
      const res = await fetch(`/api/files?user_id=${state.user.id}&starred=1`);
      const data = await res.json();

      elements.starredFilesList.innerHTML = '';
      if (!data.files || data.files.length === 0) {
        elements.starredFilesList.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted);">No favorite documents pinned yet.</div>';
        return;
      }

      data.files.forEach(file => {
        const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
        const row = document.createElement('div');
        row.className = 'file-row-pro';
        row.innerHTML = `
          <div class="file-type-badge ${iconInfo.class}">
            ${iconInfo.svg}
          </div>
          <div class="file-info-col">
            <div class="file-name-text">${escapeHtml(file.name)}</div>
            <div class="file-sub-info">${formatBytes(file.size)} • ${file.folder_name ? escapeHtml(file.folder_name) : 'Root'}</div>
          </div>
          <button class="btn-star starred">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#fbbf24" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        `;
        addLongPressListener(
          row,
          () => openFileDetailsSheet(file),
          () => openContextMenu('file', file)
        );
        elements.starredFilesList.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to load starred files:', err);
    }
  }

  // API Call: Search Engine (Folders + Files)
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

      const hasFolders = data.folders && data.folders.length > 0;
      const hasFiles = data.files && data.files.length > 0;

      if (!hasFolders && !hasFiles) {
        elements.searchResultsList.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted);">No matching folders or files found.</div>';
        return;
      }

      // Render Matching Folders
      if (hasFolders) {
        const folderHeader = document.createElement('div');
        folderHeader.className = 'section-label-text';
        folderHeader.style.margin = '8px 0';
        folderHeader.textContent = 'MATCHING FOLDERS';
        elements.searchResultsList.appendChild(folderHeader);

        const folderGrid = document.createElement('div');
        folderGrid.className = 'folders-grid';
        folderGrid.style.marginBottom = '16px';

        data.folders.forEach(folder => {
          const card = document.createElement('div');
          card.className = 'folder-card-pro';
          card.innerHTML = `
            <svg viewBox="0 0 24 24" class="folder-icon-svg" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <div class="folder-pro-name">${escapeHtml(folder.name)}</div>
            <div class="folder-pro-count">${folder.file_count || 0} files</div>
          `;

          addLongPressListener(
            card,
            () => {
              switchTab('files');
              loadFolderContents(folder.id);
            },
            () => openContextMenu('folder', folder)
          );

          folderGrid.appendChild(card);
        });

        elements.searchResultsList.appendChild(folderGrid);
      }

      // Render Matching Files
      if (hasFiles) {
        if (hasFolders) {
          const fileHeader = document.createElement('div');
          fileHeader.className = 'section-label-text';
          fileHeader.style.margin = '8px 0';
          fileHeader.textContent = 'MATCHING DOCUMENTS';
          elements.searchResultsList.appendChild(fileHeader);
        }

        data.files.forEach(file => {
          const iconInfo = getFileIconInfo(file.mime_type, file.category, file.name);
          const row = document.createElement('div');
          row.className = 'file-row-pro';
          row.innerHTML = `
            <div class="file-type-badge ${iconInfo.class}">
              ${iconInfo.svg}
            </div>
            <div class="file-info-col">
              <div class="file-name-text">${escapeHtml(file.name)}</div>
              <div class="file-sub-info">
                <span>${formatBytes(file.size)}</span>
                ${file.folder_name ? `<span class="path-tag">${escapeHtml(file.folder_name)}</span>` : ''}
              </div>
            </div>
          `;
          addLongPressListener(
            row,
            () => openFileDetailsSheet(file),
            () => openContextMenu('file', file)
          );
          elements.searchResultsList.appendChild(row);
        });
      }
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

  // Rename Item Handler (Folder or File)
  async function performRenameItem() {
    if (!state.contextTarget) return;
    const { type, item } = state.contextTarget;
    const newName = elements.inputRenameName.value.trim();

    if (!newName) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    triggerHaptic('impact');
    const endpoint = type === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`;

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: state.user.id, name: newName })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`✓ Renamed to "${newName}"`, 'success');
        elements.modalRenameItem.classList.remove('active');
        refreshCurrentView();
      }
    } catch (err) {
      showToast('Error renaming item', 'error');
    }
  }

  // Delete Item Handler (Folder or File)
  async function performDeleteItem() {
    if (!state.contextTarget) return;
    const { type, item } = state.contextTarget;

    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    triggerHaptic('impact');
    const endpoint = type === 'folder' ? `/api/folders/${item.id}?user_id=${state.user.id}` : `/api/files/${item.id}?user_id=${state.user.id}`;

    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        showToast(`🗑 ${type === 'folder' ? 'Folder' : 'File'} deleted`, 'success');
        elements.sheetItemContext.classList.remove('active');
        refreshCurrentView();
      }
    } catch (err) {
      showToast('Error deleting item', 'error');
    }
  }

  function refreshCurrentView() {
    if (state.currentTab === 'files') loadFolderContents(state.currentFolderId);
    else if (state.currentTab === 'starred') loadStarredFiles();
    else if (state.currentTab === 'search') triggerSearch();
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
        refreshCurrentView();
        if (elements.sheetFileDetails.classList.contains('active')) {
          elements.sheetFileDetails.classList.remove('active');
        }
      }
    } catch (err) {
      console.error(err);
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
        refreshCurrentView();
      }
    } catch (err) {
      showToast('Error creating folder', 'error');
    }
  }

  // Bulk File & Folder Upload Handler
  async function handleBulkUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    elements.sheetCreateOptions.classList.remove('active');

    elements.modalUploadProgress.classList.add('active');
    const totalFiles = filesArray.length;
    let totalBytes = filesArray.reduce((acc, f) => acc + f.size, 0);

    elements.uploadStatusTitle.textContent = `Uploading ${totalFiles} item${totalFiles > 1 ? 's' : ''}...`;
    elements.uploadFilenameText.textContent = filesArray[0].webkitRelativePath || filesArray[0].name;
    elements.uploadBytesText.textContent = `0 MB / ${formatBytes(totalBytes)}`;
    elements.uploadPercentText.textContent = '0%';

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 10;
      if (progress > 95) progress = 95;

      const offset = 226 - (226 * progress) / 100;
      elements.progressRingCircle.style.strokeDashoffset = offset;
      elements.uploadPercentText.textContent = `${progress}%`;
      elements.uploadBytesText.textContent = `${formatBytes((totalBytes * progress) / 100)} / ${formatBytes(totalBytes)}`;
    }, 150);

    try {
      const formData = new FormData();
      formData.append('user_id', state.user.id);
      formData.append('folder_id', state.currentFolderId || 'null');

      const relativePaths = [];
      filesArray.forEach((file) => {
        formData.append('files', file);
        relativePaths.push(file.webkitRelativePath || file.name);
      });
      formData.append('relative_paths', JSON.stringify(relativePaths));

      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      const data = await res.json();

      clearInterval(interval);
      elements.progressRingCircle.style.strokeDashoffset = 0;
      elements.uploadPercentText.textContent = '100%';

      setTimeout(() => {
        elements.modalUploadProgress.classList.remove('active');
        if (data.success) {
          triggerHaptic('success');
          showToast(`✓ Uploaded ${data.count} items successfully!`, 'success');
          refreshCurrentView();
        } else {
          showToast(`❌ ${data.error || 'Upload failed'}`, 'error');
        }
      }, 300);
    } catch (err) {
      clearInterval(interval);
      elements.modalUploadProgress.classList.remove('active');
      showToast('Upload network error', 'error');
    }
  }

  // Recursive Drag & Drop Directory Traversal Engine
  async function traverseFileTree(entry, pathStr = '') {
    const collectedFiles = [];
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          const fullRelPath = pathStr ? `${pathStr}/${file.name}` : file.name;
          try {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: fullRelPath,
              writable: true
            });
          } catch (e) {}
          collectedFiles.push(file);
          resolve(collectedFiles);
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const dirPath = pathStr ? `${pathStr}/${entry.name}` : entry.name;
      return new Promise((resolve) => {
        const readEntries = () => {
          dirReader.readEntries(async (entries) => {
            if (!entries.length) {
              resolve(collectedFiles);
            } else {
              for (const childEntry of entries) {
                const childFiles = await traverseFileTree(childEntry, dirPath);
                collectedFiles.push(...childFiles);
              }
              readEntries();
            }
          });
        };
        readEntries();
      });
    }
    return collectedFiles;
  }

  // Setup Laptop Drag & Drop Handlers
  function setupLaptopDragAndDrop() {
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (elements.dragDropOverlay) {
        elements.dragDropOverlay.classList.add('active');
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0 && elements.dragDropOverlay) {
        dragCounter = 0;
        elements.dragDropOverlay.classList.remove('active');
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (elements.dragDropOverlay) {
        elements.dragDropOverlay.classList.remove('active');
      }

      const items = e.dataTransfer?.items;
      if (!items || items.length === 0) return;

      const allFiles = [];
      const promises = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            promises.push(traverseFileTree(entry));
          }
        } else if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) allFiles.push(file);
        }
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);
        results.forEach(fileGroup => allFiles.push(...fileGroup));
      }

      if (allFiles.length > 0) {
        handleBulkUpload(allFiles);
      }
    });
  }

  // Event Bindings
  function bindEvents() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === 'files') {
          switchTab('files', true);
        } else {
          switchTab(tab);
        }
      });
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

    if (elements.btnNewFolderHeader) {
      elements.btnNewFolderHeader.addEventListener('click', () => {
        elements.modalNewFolder.classList.add('active');
      });
    }

    if (elements.btnNewFolderExplorer) {
      elements.btnNewFolderExplorer.addEventListener('click', () => {
        elements.modalNewFolder.classList.add('active');
      });
    }

    elements.btnCancelFolder.addEventListener('click', () => {
      elements.modalNewFolder.classList.remove('active');
    });

    elements.btnConfirmFolder.addEventListener('click', createFolder);

    // Context Menu Handlers
    elements.contextOptionRename.addEventListener('click', () => {
      elements.sheetItemContext.classList.remove('active');
      if (state.contextTarget) {
        elements.inputRenameName.value = state.contextTarget.item.name;
        elements.modalRenameItem.classList.add('active');
        elements.inputRenameName.focus();
      }
    });

    elements.contextOptionDelete.addEventListener('click', performDeleteItem);

    elements.btnCancelRename.addEventListener('click', () => {
      elements.modalRenameItem.classList.remove('active');
    });

    elements.btnConfirmRename.addEventListener('click', performRenameItem);

    elements.optionUploadFile.addEventListener('click', () => elements.hiddenFileInput.click());
    elements.optionUploadFolder.addEventListener('click', () => elements.hiddenFolderInput.click());

    elements.hiddenFileInput.addEventListener('change', (e) => handleBulkUpload(e.target.files));
    elements.hiddenFolderInput.addEventListener('change', (e) => handleBulkUpload(e.target.files));

    elements.btnDownloadTelegram.addEventListener('click', downloadFileToTelegram);
    elements.btnToggleFavorite.addEventListener('click', () => {
      if (state.selectedFile) toggleStarFile(state.selectedFile.id);
    });
    elements.btnDeleteFile.addEventListener('click', () => {
      if (state.selectedFile) {
        state.contextTarget = { type: 'file', item: state.selectedFile };
        performDeleteItem();
      }
    });
    elements.btnShareFile.addEventListener('click', () => showToast('🔗 Direct link copied!'));

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

    elements.filterTypePills.querySelectorAll('.pill-chip').forEach(pill => {
      pill.addEventListener('click', () => {
        elements.filterTypePills.querySelectorAll('.pill-chip').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.selectedCategory = pill.getAttribute('data-type');
        triggerSearch();
      });
    });

    elements.selectDateFilter.addEventListener('change', triggerSearch);
    elements.selectSortBy.addEventListener('change', triggerSearch);

    setupLaptopDragAndDrop();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function boot() {
    bindEvents();
    loadFolderContents(null);
  }

  boot();
});
