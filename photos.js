/* XiaShi browser-local photo journal. No network uploads or external requests. */
function createPhotoJournal(account) {
  'use strict';
  const MAX_BYTES = 10 * 1024 * 1024;
  const MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const DB_NAME = 'xiashi-photo-journal:' + account;
  const STORE = 'photos';
  let config = null, dbPromise = null, db = null;
  let photos = [], loaded = false, loading = false, storageMode = 'persistent';
  let draft = { file: null, description: '', place: '' };
  let screen = 'compose', previewId = null;
  let draftVersion = 0, authVersion = 0, selectionVersion = 0;
  let saving = false, lastAuthenticated = false, notice = '';
  const visibleURLs = new Set(), writeTransactions = new Set();

  const icons = {
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };

  function authenticated() {
    try { return !!(config && config.isLoggedIn()); } catch (_) { return false; }
  }
  function notify(message) {
    notice = message;
    const status = config && config.host.querySelector('.photo-status');
    if (status) status.textContent = message;
    if (config && typeof config.onToast === 'function') config.onToast(message);
  }
  function allowed(prompt) {
    if (authenticated()) return true;
    refresh();
    if (prompt) notify('请先登录，再使用图片功能。');
    return false;
  }
  function stillAllowed(token) { return token === authVersion && authenticated(); }
  function objectURL(blob) {
    const url = URL.createObjectURL(blob);
    visibleURLs.add(url);
    return url;
  }
  function releaseURLs() {
    visibleURLs.forEach(url => URL.revokeObjectURL(url));
    visibleURLs.clear();
  }
  function setText(root, selector, text) { root.querySelector(selector).textContent = text; }
  function newID() {
    if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'photo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  function readableDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '本地照片' : date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  }
  function extension(mime) { return ({'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'})[mime] || 'jpg'; }
  function downloadName(photo) { return '霞时-' + photo.id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48) + '.' + extension(photo.blob.type); }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new Error('storage-unavailable')); return; }
      let request;
      try { request = indexedDB.open(DB_NAME, 1); } catch (error) { reject(error); return; }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error || new Error('storage-unavailable'));
      request.onblocked = () => reject(new Error('storage-blocked'));
      request.onsuccess = () => {
        db = request.result;
        db.onversionchange = () => { db.close(); db = null; dbPromise = null; };
        resolve(db);
      };
    });
    return dbPromise;
  }
  async function readStoredPhotos() {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error || new Error('storage-unavailable'));
    });
  }
  async function mutateStoredPhoto(action, value, token) {
    const database = await openDB();
    if (!stillAllowed(token)) throw new Error('signed-out');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      writeTransactions.add(transaction);
      transaction.oncomplete = () => { writeTransactions.delete(transaction); resolve(); };
      transaction.onerror = () => { writeTransactions.delete(transaction); reject(transaction.error || new Error('storage-error')); };
      transaction.onabort = () => { writeTransactions.delete(transaction); reject(new Error(stillAllowed(token) ? 'storage-error' : 'signed-out')); };
      const store = transaction.objectStore(STORE);
      if (action === 'put') store.put(value); else store.delete(value);
    });
  }
  async function ensureLoaded() {
    if (loaded || loading || !authenticated()) return;
    loading = true;
    try {
      const stored = await readStoredPhotos();
      photos = stored.filter(item => item && typeof item.id === 'string' && item.blob instanceof Blob && MIME.has(item.blob.type));
      loaded = true;
    } catch (_) {
      storageMode = 'memory';
      loaded = true;
      notice = '此浏览器暂时无法保存图片。可以临时使用；刷新或关闭页面后，临时图片会丢失。';
    } finally {
      loading = false;
      if (config && authenticated()) render();
    }
  }
  function checkFile(file) {
    if (!file || !MIME.has(file.type)) return '请选择 JPG、PNG、WebP 或 GIF 格式的图片。';
    if (file.size === 0) return '这张图片是空文件，请重新选择。';
    if (file.size > MAX_BYTES) return '图片不能超过 10 MB，请选择较小的图片。';
    return '';
  }
  function decodeImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      let finished = false;
      const done = valid => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        image.onload = image.onerror = null;
        URL.revokeObjectURL(url);
        valid ? resolve() : reject(new Error('image-invalid'));
      };
      const timer = setTimeout(() => done(false), 15000);
      image.onload = () => done(image.naturalWidth > 0 && image.naturalHeight > 0);
      image.onerror = () => done(false);
      image.src = url;
    });
  }
  async function chooseFile(file) {
    if (!allowed(true) || saving) return;
    const error = checkFile(file);
    if (error) { notify(error); return; }
    const token = authVersion, selection = ++selectionVersion;
    notify('正在读取图片…');
    try {
      await decodeImage(file);
      if (!stillAllowed(token) || selection !== selectionVersion || saving) return;
      draft.file = file;
      draftVersion++;
      notice = '图片已准备好。填写地点和描述后，可以保存到本地图集。';
      render();
    } catch (_) {
      if (stillAllowed(token) && selection === selectionVersion) notify('无法读取这张图片，请重新选择有效的图片文件。');
    }
  }
  async function saveDraft(event) {
    event.preventDefault();
    if (!allowed(true) || saving || loading) return;
    const error = checkFile(draft.file);
    if (error) { notify(draft.file ? error : '请先选择一张晚霞照片。'); return; }
    const token = authVersion, version = draftVersion;
    const record = { id: newID(), blob: draft.file, filename: draft.file.name, description: draft.description.trim(), place: draft.place.trim(), createdAt: Date.now(), temporary: storageMode === 'memory' };
    saving = true;
    notice = '正在保存图片…';
    render();
    try {
      if (!stillAllowed(token)) return;
      if (storageMode === 'persistent') {
        try { await mutateStoredPhoto('put', record, token); }
        catch (error) {
          if (!stillAllowed(token) || error.message === 'signed-out') return;
          record.temporary = true;
          storageMode = 'memory';
        }
      }
      if (!stillAllowed(token)) return;
      photos.unshift(record);
      screen = 'gallery';
      if (draftVersion === version) { draft.file = null; draft.description = ''; draftVersion++; }
      notice = record.temporary ? '图片已临时保存。本地存储不可用或空间不足，刷新页面后会丢失；建议先下载。' : '已保存到此浏览器的本地图集，图片尚未公开发布。';
      notify(notice);
    } finally {
      if (token === authVersion) saving = false;
      if (stillAllowed(token)) render();
    }
  }
  async function deletePhoto(photo) {
    if (!allowed(true) || saving) return;
    const token = authVersion;
    if (!photo.temporary) {
      try { await mutateStoredPhoto('delete', photo.id, token); }
      catch (_) {
        if (stillAllowed(token)) notify('暂时无法删除已保存的图片，请稍后重试。');
        return;
      }
    }
    if (!stillAllowed(token)) return;
    photos = photos.filter(item => item.id !== photo.id);
    notice = '已从本地图集中删除这张图片。';
    render();
    notify(notice);
  }
  function downloadPhoto(photo) {
    if (!allowed(true)) return;
    const url = URL.createObjectURL(photo.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName(photo);
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('已发起图片下载，你可以将下载后的图片分享给朋友。');
  }
  async function sharePhoto(photo) {
    if (!allowed(true)) return;
    const token = authVersion;
    try {
      const file = new File([photo.blob], downloadName(photo), { type: photo.blob.type });
      const data = { files: [file], title: '霞时 · ' + (photo.place || '我的晚霞'), text: photo.description || '分享这一刻的天空。' };
      if (!navigator.share || !navigator.canShare || !navigator.canShare({ files: [file] })) {
        notify('此浏览器不支持系统图片分享，请点击“下载图片”后自行分享。');
        return;
      }
      // Keep this call directly within the user's click activation.
      if (!stillAllowed(token)) return;
      await navigator.share(data);
      if (stillAllowed(token)) notify('系统分享流程已完成。图片没有上传到本站。');
    } catch (error) {
      if (!stillAllowed(token)) return;
      notify(error && error.name === 'AbortError' ? '已取消分享，图片仍保留在本地图集。' : '系统分享暂不可用，请下载图片后自行分享。');
    }
  }

  function galleryCard(photo) {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.innerHTML = '<div class="photo-card-image"><img loading="lazy"/><span class="photo-card-badge"></span></div><div class="photo-card-body"><div class="photo-card-meta"><h3 class="photo-card-place"></h3><time class="photo-card-date"></time></div><p class="photo-card-description"></p><div class="photo-card-actions"><button class="photo-button photo-button-small photo-button-secondary photo-share" type="button">分享预览</button><button class="photo-button photo-button-small photo-button-quiet photo-download" type="button">下载图片</button><button class="photo-button photo-button-small photo-button-quiet photo-delete" type="button">删除</button></div></div>';
    const img = card.querySelector('img');
    img.alt = photo.description || ((photo.place || '我的晚霞') + '的照片');
    img.src = objectURL(photo.blob);
    img.addEventListener('error', () => {
      img.remove();
      const message = document.createElement('p');
      message.className = 'photo-image-error';
      message.textContent = '图片预览暂不可用，仍可尝试下载。';
      card.querySelector('.photo-card-image').appendChild(message);
    }, { once: true });
    setText(card, '.photo-card-badge', photo.temporary ? '仅当前页面' : '仅此浏览器');
    setText(card, '.photo-card-place', photo.place || '未填写地点');
    const date = card.querySelector('time');
    date.textContent = readableDate(photo.createdAt);
    if (Number.isFinite(photo.createdAt)) date.dateTime = new Date(photo.createdAt).toISOString();
    setText(card, '.photo-card-description', photo.description || '留住这一刻的天空。');
    card.querySelector('.photo-share').addEventListener('click', () => { previewId = photo.id; showScreen('preview'); });
    card.querySelector('.photo-download').addEventListener('click', () => downloadPhoto(photo));
    const deleteButton = card.querySelector('.photo-delete');
    deleteButton.setAttribute('aria-label', '删除' + (photo.place || '未填写地点') + '的照片');
    deleteButton.addEventListener('click', () => deletePhoto(photo));
    return card;
  }
  function showScreen(next) {
    if (!allowed(true) || saving) return;
    screen = next;
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function pageHeading(title, description) {
    const heading = config.host.parentElement.querySelector('.page-heading');
    heading.querySelector('h1').textContent = title;
    heading.querySelector('p').textContent = description;
  }
  const privacyBanner = '<div class="photo-privacy-note"><span class="photo-note-dot"></span><p>你的照片保存在此浏览器中。分享时可选择系统分享或下载图片。</p></div>';
  function renderGallery(host) {
    pageHeading('我的晚霞图集', '留住每一次值得等待的天空。');
    host.innerHTML = privacyBanner + '<p class="photo-status" role="status"></p><div class="photo-gallery-heading"><h2>我的照片 <span class="photo-gallery-count"></span></h2><button type="button" class="btn primary">继续选择照片</button></div><div class="photo-collection-layout"><div class="photo-gallery"></div><aside class="frame-note"><h2>属于你的天空记录</h2><p>从图集中选择照片，预览地点与描述后即可分享。</p></aside></div>';
    setText(host, '.photo-status', notice);
    setText(host, '.photo-gallery-count', String(photos.length).padStart(2, '0'));
    host.querySelector('.photo-gallery-heading button').onclick = () => showScreen('compose');
    const gallery = host.querySelector('.photo-gallery');
    if (!photos.length) {
      gallery.innerHTML = '<div class="frame-card"><h2>还没有照片</h2><p>选择一张照片，开始你的天空记录。</p></div>';
      return;
    }
    photos.slice().sort((a, b) => b.createdAt - a.createdAt).forEach(photo => gallery.append(galleryCard(photo)));
  }
  function renderPreview(host, photo) {
    pageHeading('分享预览', '看看这张晚霞照片与文字放在一起的样子。');
    host.innerHTML = '<div class="frame-card photo-share-preview"><figure><img><figcaption>霞时 · 天空记录</figcaption></figure><div><h2></h2><p class="preview-description"></p><p>确认照片与文字后，可以分享或下载。</p><div class="actions"><button class="btn primary photo-share">系统分享</button><button class="btn secondary photo-download">下载图片</button></div></div></div><p class="photo-status" role="status"></p><button class="btn secondary return-gallery">返回我的图集</button>';
    const image = host.querySelector('img');
    image.src = objectURL(photo.blob);
    image.alt = photo.description || '晚霞照片';
    setText(host, 'h2', photo.place || '我的晚霞');
    setText(host, '.preview-description', photo.description);
    host.querySelector('.photo-share').onclick = () => sharePhoto(photo);
    host.querySelector('.photo-download').onclick = () => downloadPhoto(photo);
    host.querySelector('.return-gallery').onclick = () => showScreen('gallery');
  }
  function render() {
    if (!config) return;
    releaseURLs();
    const host = config.host;
    host.classList.add('photo-page');
    if (!authenticated()) {
      pageHeading('分享图片', '收藏这一刻的天空，再把它分享给在意的人。');
      host.innerHTML = '<div class="photo-gate-layout"><div class="photo-gate"><span class="photo-gate-icon">' + icons.lock + '</span><h2 class="photo-gate-title">登录后，记录你的晚霞</h2><p class="photo-gate-copy">选择照片、记录地点，再通过系统分享给朋友。</p><button type="button" class="photo-button photo-button-primary photo-login">登录 / 注册</button><p class="photo-local-note">图片仅保存在此浏览器，不会上传或公开发布。<br>使用 GitHub 账号登录后即可记录。</p></div><figure><img src="assets/sunset-lake.jpg" alt="晚霞映照湖面"><figcaption><b>把这一刻，留给以后</b><br>晚霞摄影 · 样例展示</figcaption></figure></div><p class="photo-status" role="status" aria-live="polite"></p>';
      host.querySelector('.photo-login').addEventListener('click', () => { if (config && typeof config.onLogin === 'function') config.onLogin(); });
      return;
    }
    if (screen === 'preview') {
      const photo = photos.find(item => item.id === previewId);
      if (photo) { renderPreview(host, photo); return; }
      screen = 'gallery';
    }
    if (screen === 'gallery') { renderGallery(host); return; }
    pageHeading('分享图片', draft.file ? '检查照片与描述，再保存这次晚霞记录。' : '一张照片，留下这次晚霞的颜色。');
    host.innerHTML = privacyBanner + '<form class="photo-composer"><div class="photo-upload-area"><input type="file" class="photo-file-input" id="photo-file" accept="image/jpeg,image/png,image/webp,image/gif"/><button type="button" class="photo-upload-button"><span class="photo-upload-icon">' + icons.plus + '</span><strong>选择一张晚霞照片</strong><span>JPG、PNG、WebP、GIF · 最大 10 MB</span></button><div class="photo-preview" hidden><img class="photo-preview-image" alt="待保存照片预览"/><button type="button" class="photo-replace">更换图片</button></div></div><div class="photo-composer-fields"><p class="photo-section-kicker">记录此刻</p><h2 class="photo-composer-title">天空的故事，由你来写</h2><label class="photo-label" for="photo-place">拍摄地点 <span>选填</span></label><input class="photo-text-input" id="photo-place" name="place" type="text" maxlength="80" placeholder="例如：杭州 · 西湖" autocomplete="off"/><label class="photo-label" for="photo-description">照片描述 <span>选填</span></label><textarea class="photo-textarea" id="photo-description" name="description" maxlength="500" rows="3" placeholder="当时的颜色、心情，或想分享的一句话…"></textarea><div class="photo-input-count"><span class="photo-count">0</span> / 500</div><div class="photo-save-row"><button type="submit" class="photo-button photo-button-primary photo-save">保存到本地图集</button><button class="quiet open-gallery" type="button">查看我的图集</button></div></div></form><p class="photo-status" role="status" aria-live="polite"></p>';
    host.querySelector('.open-gallery').onclick = () => showScreen('gallery');
    const input = host.querySelector('.photo-file-input');
    const choose = () => { if (allowed(true) && !saving) input.click(); };
    input.addEventListener('change', () => { const file = input.files && input.files[0]; if (file) chooseFile(file); input.value = ''; });
    host.querySelector('.photo-upload-button').addEventListener('click', choose);
    host.querySelector('.photo-replace').addEventListener('click', choose);
    const placeInput = host.querySelector('#photo-place');
    placeInput.value = draft.place;
    placeInput.addEventListener('input', () => { if (!allowed(false)) return; draft.place = placeInput.value; draftVersion++; });
    const description = host.querySelector('#photo-description');
    description.value = draft.description;
    setText(host, '.photo-count', String(draft.description.length));
    description.addEventListener('input', () => {
      if (!allowed(false)) return;
      draft.description = description.value;
      draftVersion++;
      setText(host, '.photo-count', String(draft.description.length));
    });
    host.querySelector('.photo-composer').addEventListener('submit', saveDraft);
    if (draft.file) {
      host.querySelector('.photo-upload-button').hidden = true;
      host.querySelector('.photo-preview').hidden = false;
      host.querySelector('.photo-preview-image').src = objectURL(draft.file);
    }
    host.querySelectorAll('.photo-composer input, .photo-composer textarea, .photo-composer button').forEach(el => { el.disabled = saving || loading; });
    setText(host, '.photo-save', saving ? '正在保存…' : '保存到本地图集');
    setText(host, '.photo-status', notice);
    host.querySelector('.photo-save').disabled = !draft.file || saving || loading;
  }
  function refresh() {
    if (!config) return;
    const signedIn = authenticated();
    if (!signedIn) {
      authVersion++;
      selectionVersion++;
      writeTransactions.forEach(transaction => { try { transaction.abort(); } catch (_) {} });
      writeTransactions.clear();
      saving = false;
      notice = '';
    }
    if (signedIn && !lastAuthenticated && !draft.place && typeof config.getPlace === 'function') draft.place = String(config.getPlace() || '').slice(0, 80);
    lastAuthenticated = signedIn;
    if (signedIn && !loaded && !loading) { ensureLoaded(); }
    render();
  }
  function destroy() {
    authVersion++;
    selectionVersion++;
    writeTransactions.forEach(transaction => { try { transaction.abort(); } catch (_) {} });
    writeTransactions.clear();
    releaseURLs();
    if (db) db.close();
    if (config) { config.host.replaceChildren(); config.host.classList.remove('photo-page'); }
    config = null;
    lastAuthenticated = false;
    saving = false;
  }
  function mount(options) {
    if (!options || !(options.host instanceof Element) || typeof options.isLoggedIn !== 'function') throw new TypeError('XiaShiPhotos.mount requires host and isLoggedIn.');
    if (config) destroy();
    config = options;
    refresh();
  }
  return { mount, destroy };
}
