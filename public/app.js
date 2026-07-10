// Local state manager
let state = {
    chapters: [],
    selectedChapterIndex: null,
    fontSize: 'md', // sm, md, lg
};

// UI Selectors
const bookTitleInput = document.getElementById('book-title');
const bookAuthorInput = document.getElementById('book-author');
const bookPublisherInput = document.getElementById('book-publisher');
const urlInput = document.getElementById('url-input');
const addUrlBtn = document.getElementById('add-url-btn');
const chapterList = document.getElementById('chapter-list');
const chapterEmptyState = document.getElementById('chapter-empty');
const chapterCountBadge = document.getElementById('chapter-count');
const compileBtn = document.getElementById('compile-btn');
const resetBtn = document.getElementById('reset-btn');
const readerView = document.getElementById('reader-view');
const readerContent = document.getElementById('reader-content');
const previewEmptyState = document.getElementById('preview-empty');
const previewTitle = document.getElementById('preview-title');
const previewSource = document.getElementById('preview-source');
const fontDecreaseBtn = document.getElementById('font-decrease');
const fontIncreaseBtn = document.getElementById('font-increase');
const toastEl = document.getElementById('toast');

// Cover Preview Selectors
const coverTitlePreview = document.getElementById('cover-title-preview');
const coverAuthorPreview = document.getElementById('cover-author-preview');

// Update mockup cover titles on input change
bookTitleInput.addEventListener('input', (e) => {
    coverTitlePreview.innerText = e.target.value || 'Untitled Ebook';
});

bookAuthorInput.addEventListener('input', (e) => {
    coverAuthorPreview.innerText = e.target.value || 'Anonymous';
});

// Toast Notifications Helper
function showToast(message, duration = 3000) {
    toastEl.innerText = message;
    toastEl.classList.remove('hidden');

    // Animate display
    toastEl.style.display = 'block';

    setTimeout(() => {
        toastEl.classList.add('hidden');
    }, duration);
}

// Check Python API ready status
let pythonApi = null;
window.addEventListener('pywebviewready', () => {
    pythonApi = window.pywebview.api;
    showToast('Core desktop bridge ready.');
});

// Add URL / Scrape page handler
addUrlBtn.addEventListener('click', handleAddUrl);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddUrl();
});

async function handleAddUrl() {
    const url = urlInput.value.trim();
    if (!url) return;

    if (!pythonApi) {
        showToast('System backend is loading, please try again.');
        return;
    }

    // Toggle loading states
    setLoadingState(addUrlBtn, true);
    urlInput.disabled = true;

    try {
        const response = await pythonApi.extract_url(url);

        if (response.success) {
            const ch = response.data;
            state.chapters.push(ch);

            showToast(`Extracted: ${ch.title}`);
            urlInput.value = '';

            renderChapterList();
            selectChapter(state.chapters.length - 1);
        } else {
            showToast(`Extraction Error: ${response.error}`);
        }
    } catch (err) {
        showToast(`Extraction Failed: ${err.message}`);
    } finally {
        setLoadingState(addUrlBtn, false);
        urlInput.disabled = false;
        urlInput.focus();
    }
}

// Compile & Compile Button UI helpers
function setLoadingState(button, isLoading) {
    const textSpan = button.querySelector('.btn-text');
    const spinnerSpan = button.querySelector('.spinner');

    if (isLoading) {
        textSpan.classList.add('hidden');
        spinnerSpan.classList.remove('hidden');
        button.disabled = true;
    } else {
        textSpan.classList.remove('hidden');
        spinnerSpan.classList.add('hidden');
        button.disabled = false;
    }
}

// Render Chapter Cards
function renderChapterList() {
    chapterList.innerHTML = '';

    if (state.chapters.length === 0) {
        chapterEmptyState.classList.remove('hidden');
        compileBtn.disabled = true;
        chapterCountBadge.innerText = '0 chapters';
        return;
    }

    chapterEmptyState.classList.add('hidden');
    compileBtn.disabled = false;
    chapterCountBadge.innerText = `${state.chapters.length} chapter${state.chapters.length === 1 ? '' : 's'}`;

    state.chapters.forEach((chapter, index) => {
        const li = document.createElement('li');
        li.className = `chapter-card ${state.selectedChapterIndex === index ? 'active' : ''}`;
        li.setAttribute('draggable', 'true');
        li.setAttribute('data-index', index);

        li.innerHTML = `
            <div class="drag-handle">☰</div>
            <div class="chapter-card-info">
                <div class="chapter-card-title">${escapeHTML(chapter.title)}</div>
                <div class="chapter-card-meta">${chapter.site_name ? escapeHTML(chapter.site_name) : 'Web Article'}</div>
            </div>
            <div class="chapter-card-actions">
                <button class="card-action-btn edit-title-btn" title="Rename Chapter">✏️</button>
                <button class="card-action-btn delete delete-btn" title="Delete Chapter">🗑️</button>
            </div>
        `;

        // Add Event Listeners
        li.addEventListener('click', (e) => {
            // Prevent preview click triggering if deleting/editing
            if (e.target.closest('.card-action-btn')) return;
            selectChapter(index);
        });

        li.querySelector('.edit-title-btn').addEventListener('click', () => renameChapter(index));
        li.querySelector('.delete-btn').addEventListener('click', () => deleteChapter(index));

        // Setup Drag & Drop Event Listeners
        setupDragAndDrop(li);

        chapterList.appendChild(li);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Drag and Drop implementation
let dragSrcEl = null;

function setupDragAndDrop(el) {
    el.addEventListener('dragstart', function (e) {
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.classList.add('dragging');
    });

    el.addEventListener('dragover', function (e) {
        if (e.preventDefault) e.preventDefault();
        return false;
    });

    el.addEventListener('dragenter', function (e) {
        this.classList.add('drag-over');
    });

    el.addEventListener('dragleave', function (e) {
        this.classList.remove('drag-over');
    });

    el.addEventListener('drop', function (e) {
        if (e.stopPropagation) e.stopPropagation();

        if (dragSrcEl !== this) {
            const fromIndex = parseInt(dragSrcEl.getAttribute('data-index'), 10);
            const toIndex = parseInt(this.getAttribute('data-index'), 10);

            // Move item inside state array
            const movedItem = state.chapters.splice(fromIndex, 1)[0];
            state.chapters.splice(toIndex, 0, movedItem);

            // Adjust selected index
            if (state.selectedChapterIndex === fromIndex) {
                state.selectedChapterIndex = toIndex;
            } else if (state.selectedChapterIndex > fromIndex && state.selectedChapterIndex <= toIndex) {
                state.selectedChapterIndex--;
            } else if (state.selectedChapterIndex < fromIndex && state.selectedChapterIndex >= toIndex) {
                state.selectedChapterIndex++;
            }

            renderChapterList();
        }
        return false;
    });

    el.addEventListener('dragend', function () {
        this.classList.remove('dragging');
        const cards = document.querySelectorAll('.chapter-card');
        cards.forEach(card => card.classList.remove('drag-over'));
    });
}

// Edit/Delete list items
function renameChapter(index) {
    const chapter = state.chapters[index];
    const newTitle = prompt('Enter a new title for this chapter:', chapter.title);
    if (newTitle && newTitle.trim()) {
        chapter.title = newTitle.trim();
        renderChapterList();
        if (state.selectedChapterIndex === index) {
            previewTitle.innerText = chapter.title;
            document.querySelector('.reader-content h1').innerText = chapter.title;
        }
    }
}

function deleteChapter(index) {
    state.chapters.splice(index, 1);

    // Adjust selections
    if (state.selectedChapterIndex === index) {
        state.selectedChapterIndex = state.chapters.length > 0 ? 0 : null;
    } else if (state.selectedChapterIndex > index) {
        state.selectedChapterIndex--;
    }

    renderChapterList();
    if (state.selectedChapterIndex !== null) {
        selectChapter(state.selectedChapterIndex);
    } else {
        clearPreview();
    }
}

// Chapter selection / previewing
function selectChapter(index) {
    state.selectedChapterIndex = index;

    // Highlight correct active card
    const cards = document.querySelectorAll('.chapter-card');
    cards.forEach((card, idx) => {
        if (idx === index) card.classList.add('active');
        else card.classList.remove('active');
    });

    const chapter = state.chapters[index];

    // Display reader pane
    previewEmptyState.classList.add('hidden');
    readerView.classList.remove('hidden');

    previewTitle.innerText = chapter.title;
    previewSource.innerText = chapter.site_name ? `Source: ${chapter.site_name}` : 'Source: Web';

    // Inject cleaned content
    readerContent.innerHTML = `<h1>${escapeHTML(chapter.title)}</h1>${chapter.content}`;

    // Make each block deletable
    initEditablePreview(index);

    // Scroll reader view back to top
    document.querySelector('.preview-body-wrapper').scrollTop = 0;
}

function clearPreview() {
    readerView.classList.add('hidden');
    previewEmptyState.classList.remove('hidden');
    previewTitle.innerText = 'No Chapter Selected';
    previewSource.innerText = '';
    readerContent.innerHTML = '';
}

// Wrap each top-level block element in the reader with a deletable container,
// and also wrap any direct <div> children within each block.
function initEditablePreview(chapterIndex) {
    const allChildren = Array.from(readerContent.children);

    allChildren.forEach(el => {
        // Skip the injected chapter title h1
        if (el === readerContent.firstElementChild && el.tagName === 'H1') return;

        // Snapshot direct div/center/p children BEFORE wrapping the parent (avoids mid-mutation confusion)
        const innerDivs = Array.from(el.children).filter(c => ['DIV', 'CENTER', 'P', 'NAV'].includes(c.tagName));

        // Wrap the top-level block element
        wrapAsEditable(el, chapterIndex);

        // Wrap each direct div child inside the block
        innerDivs.forEach(div => wrapAsEditable(div, chapterIndex));
    });
}

// Creates a hover-reveal edit + delete wrapper around a single element
function wrapAsEditable(el, chapterIndex) {
    const wrapper = document.createElement('div');
    wrapper.className = 'editable-block';

    // ── Edit button ────────────────────────────────────────────────
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-block-btn';
    editBtn.setAttribute('title', 'Edit this block');
    editBtn.setAttribute('aria-label', 'Edit element');
    editBtn.textContent = '✎';

    // ── Delete button ──────────────────────────────────────────────
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-block-btn';
    deleteBtn.setAttribute('title', 'Delete this element from chapter');
    deleteBtn.setAttribute('aria-label', 'Delete element');
    deleteBtn.textContent = '\u2715';

    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    wrapper.appendChild(editBtn);
    wrapper.appendChild(deleteBtn);

    // ── Edit mode toggle ───────────────────────────────────────────
    function enterEditMode() {
        el.contentEditable = 'true';
        el.classList.add('editing');
        wrapper.classList.add('is-editing');
        editBtn.textContent = '✔';
        editBtn.setAttribute('title', 'Done editing');
        el.focus();
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function exitEditMode() {
        el.contentEditable = 'false';
        el.classList.remove('editing');
        wrapper.classList.remove('is-editing');
        editBtn.textContent = '✎';
        editBtn.setAttribute('title', 'Edit this block');
        serializeChapterContent(chapterIndex);
    }

    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (wrapper.classList.contains('is-editing')) {
            exitEditMode();
        } else {
            enterEditMode();
        }
    });

    el.addEventListener('blur', (e) => {
        // Small delay so clicking editBtn doesn't double-fire
        setTimeout(() => {
            if (wrapper.classList.contains('is-editing')) {
                exitEditMode();
            }
        }, 120);
    });

    // ── Delete button ──────────────────────────────────────────────
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        wrapper.classList.add('deleting');
        setTimeout(() => {
            wrapper.remove();
            serializeChapterContent(chapterIndex);
        }, 220);
    });
}

// Serialize the current visible DOM state back into state.chapters[chapterIndex].content.
// Uses a clone so the live DOM is never mutated. Unwraps .editable-block divs
// deepest-first so nested wrappers are handled correctly at any depth.
function serializeChapterContent(chapterIndex) {
    const clone = readerContent.cloneNode(true);

    // Strip all injected UI buttons from the clone (edit + delete)
    clone.querySelectorAll('.edit-block-btn, .delete-block-btn').forEach(btn => btn.remove());

    // Unwrap .editable-block divs from deepest to shallowest
    const wrappers = Array.from(clone.querySelectorAll('.editable-block')).reverse();
    wrappers.forEach(wrapper => {
        const parent = wrapper.parentNode;
        while (wrapper.firstChild) {
            parent.insertBefore(wrapper.firstChild, wrapper);
        }
        wrapper.remove();
    });

    // Collect all children except the injected title h1
    let content = '';
    Array.from(clone.children).forEach((child, i) => {
        if (i === 0 && child.tagName === 'H1') return;
        content += child.outerHTML;
    });

    state.chapters[chapterIndex].content = content;
}

// Font styling controls
fontDecreaseBtn.addEventListener('click', () => {
    if (state.fontSize === 'lg') {
        state.fontSize = 'md';
    } else if (state.fontSize === 'md') {
        state.fontSize = 'sm';
    }
    updateFontSizeUI();
});

fontIncreaseBtn.addEventListener('click', () => {
    if (state.fontSize === 'sm') {
        state.fontSize = 'md';
    } else if (state.fontSize === 'md') {
        state.fontSize = 'lg';
    }
    updateFontSizeUI();
});

function updateFontSizeUI() {
    readerView.classList.remove('size-sm', 'size-md', 'size-lg');
    readerView.classList.add(`size-${state.fontSize}`);
    showToast(`Font size set to: ${state.fontSize.toUpperCase()}`);
}

// Ebook compilation trigger
compileBtn.addEventListener('click', async () => {
    if (state.chapters.length === 0) return;

    if (!pythonApi) {
        showToast('Desktop bridge missing. Reconnect client.');
        return;
    }

    const metadata = {
        title: bookTitleInput.value.trim() || 'My Web Collection',
        author: bookAuthorInput.value.trim() || 'Scraped Reader',
        publisher: bookPublisherInput.value.trim() || 'bokasafnari',
    };

    setLoadingState(compileBtn, true);

    try {
        const response = await pythonApi.compile_epub(metadata, state.chapters);

        if (response.success) {
            showToast(`Ebook successfully compiled: ${response.filename}`);
        } else {
            if (response.error !== 'Cancelled') {
                showToast(`Compilation failed: ${response.error}`);
            }
        }
    } catch (err) {
        showToast(`Compilation failed: ${err.message}`);
    } finally {
        setLoadingState(compileBtn, false);
    }
});

// ═══════════════════════════════════════════════════════════════
// FIND / REPLACE
// ═══════════════════════════════════════════════════════════════

const findReplaceBar  = document.getElementById('find-replace-bar');
const findReplaceBtn  = document.getElementById('find-replace-btn');
const frFindInput     = document.getElementById('fr-find');
const frReplaceInput  = document.getElementById('fr-replace');
const frMatchCount    = document.getElementById('fr-match-count');
const frPrevBtn       = document.getElementById('fr-prev');
const frNextBtn       = document.getElementById('fr-next');
const frReplaceOneBtn = document.getElementById('fr-replace-one');
const frReplaceAllBtn = document.getElementById('fr-replace-all');
const frCloseBtn      = document.getElementById('fr-close');

let frMatches     = [];   // Array of <mark> nodes currently highlighted
let frCurrentIdx  = -1;   // Which match is focused

// ── Open / close ───────────────────────────────────────────────
function openFindReplace() {
    findReplaceBar.classList.remove('hidden');
    frFindInput.focus();
    frFindInput.select();
    runFind();
}

function closeFindReplace() {
    findReplaceBar.classList.add('hidden');
    clearHighlights();
    frMatchCount.textContent = '';
    frMatches = [];
    frCurrentIdx = -1;
}

findReplaceBtn.addEventListener('click', () => {
    if (findReplaceBar.classList.contains('hidden')) {
        openFindReplace();
    } else {
        closeFindReplace();
    }
});

// Ctrl+H anywhere to open, Escape to close
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        openFindReplace();
    }
    if (e.key === 'Escape' && !findReplaceBar.classList.contains('hidden')) {
        closeFindReplace();
    }
});

// ── Find input — live highlighting as you type ─────────────────
frFindInput.addEventListener('input', runFind);

frFindInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) stepMatch(-1); else stepMatch(1);
    }
});

// ── Navigation buttons ─────────────────────────────────────────
frPrevBtn.addEventListener('click', () => stepMatch(-1));
frNextBtn.addEventListener('click', () => stepMatch(1));

// ── Replace buttons ────────────────────────────────────────────
frReplaceOneBtn.addEventListener('click', replaceCurrent);
frReplaceAllBtn.addEventListener('click', replaceAll);
frCloseBtn.addEventListener('click', closeFindReplace);

// ── Core: scan readerContent and wrap matches in <mark> ────────
function runFind() {
    clearHighlights();
    frMatches = [];
    frCurrentIdx = -1;

    const needle = frFindInput.value;
    if (!needle || state.selectedChapterIndex === null) {
        updateMatchUI();
        return;
    }

    // Walk every text node inside readerContent, skip UI button nodes
    const walker = document.createTreeWalker(
        readerContent,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                // Skip text inside the injected UI buttons
                if (node.parentElement.closest('.edit-block-btn, .delete-block-btn')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const escapedNeedle = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedNeedle, 'gi');
    const textNodes = [];

    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }

    // Process in reverse so replacements don't invalidate later node references
    for (let i = textNodes.length - 1; i >= 0; i--) {
        const tn = textNodes[i];
        const text = tn.nodeValue;
        let match;
        const localMatches = [];

        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            localMatches.push({ index: match.index, length: match[0].length });
        }

        if (localMatches.length === 0) continue;

        // Split text node into plain text + <mark> fragments
        const frag = document.createDocumentFragment();
        let cursor = 0;
        for (const m of localMatches) {
            if (m.index > cursor) {
                frag.appendChild(document.createTextNode(text.slice(cursor, m.index)));
            }
            const mark = document.createElement('mark');
            mark.className = 'fr-highlight';
            mark.textContent = text.slice(m.index, m.index + m.length);
            frag.appendChild(mark);
            frMatches.unshift(mark); // collecting in reverse = final array is forward order
        }
        if (cursor < text.length || localMatches.length) {
            const last = localMatches[localMatches.length - 1];
            if (last.index + last.length < text.length) {
                frag.appendChild(document.createTextNode(text.slice(last.index + last.length)));
            }
        }
        tn.parentNode.replaceChild(frag, tn);
    }

    // frMatches was built in reverse per node, re-sort by DOM order
    frMatches = Array.from(readerContent.querySelectorAll('mark.fr-highlight'));

    if (frMatches.length > 0) {
        frCurrentIdx = 0;
        highlightCurrent();
    }
    updateMatchUI();
}

function stepMatch(dir) {
    if (frMatches.length === 0) return;
    frMatches[frCurrentIdx]?.classList.remove('fr-current');
    frCurrentIdx = (frCurrentIdx + dir + frMatches.length) % frMatches.length;
    highlightCurrent();
    updateMatchUI();
}

function highlightCurrent() {
    if (frCurrentIdx < 0 || frCurrentIdx >= frMatches.length) return;
    const current = frMatches[frCurrentIdx];
    current.classList.add('fr-current');
    current.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateMatchUI() {
    const n = frMatches.length;
    const needle = frFindInput.value;
    if (!needle) {
        frMatchCount.textContent = '';
    } else if (n === 0) {
        frMatchCount.textContent = 'no match';
    } else {
        frMatchCount.textContent = `${frCurrentIdx + 1}/${n}`;
    }
    const hasMatches = n > 0;
    frPrevBtn.disabled       = !hasMatches;
    frNextBtn.disabled       = !hasMatches;
    frReplaceOneBtn.disabled = !hasMatches;
    frReplaceAllBtn.disabled = !hasMatches;
}

// ── Strip <mark> wrappers from the live DOM ────────────────────
function clearHighlights() {
    readerContent.querySelectorAll('mark.fr-highlight').forEach(mark => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize(); // merge adjacent text nodes
    });
}

// ── Replace helpers ────────────────────────────────────────────
function replaceCurrent() {
    if (frMatches.length === 0 || frCurrentIdx < 0) return;
    const mark = frMatches[frCurrentIdx];
    const replacement = frReplaceInput.value;
    mark.parentNode.replaceChild(document.createTextNode(replacement), mark);
    frMatches.splice(frCurrentIdx, 1);
    if (frCurrentIdx >= frMatches.length) frCurrentIdx = frMatches.length - 1;
    // Save & re-highlight remaining
    serializeChapterContent(state.selectedChapterIndex);
    runFind();
}

function replaceAll() {
    if (frMatches.length === 0) return;
    const replacement = frReplaceInput.value;
    frMatches.forEach(mark => {
        mark.parentNode.replaceChild(document.createTextNode(replacement), mark);
    });
    frMatches = [];
    frCurrentIdx = -1;
    serializeChapterContent(state.selectedChapterIndex);
    runFind();
}

// ═══════════════════════════════════════════════════════════════
// RESET APP
// ═══════════════════════════════════════════════════════════════

resetBtn.addEventListener('click', () => {
    if (state.chapters.length > 0) {
        if (!confirm('Reset the app? This will clear all chapters and the preview.')) return;
    }
    resetApp();
});

function resetApp() {
    // Reset state
    state.chapters = [];
    state.selectedChapterIndex = null;
    state.fontSize = 'md';

    // Reset metadata fields to defaults
    bookTitleInput.value = 'My Web Collection';
    bookAuthorInput.value = 'Scraped Reader';
    bookPublisherInput.value = 'bokasafnari';
    coverTitlePreview.innerText = 'My Web Collection';
    coverAuthorPreview.innerText = 'Scraped Reader';

    // Reset URL input
    urlInput.value = '';

    // Close find/replace bar if open
    if (!findReplaceBar.classList.contains('hidden')) {
        closeFindReplace();
    }

    // Reset font size on reader view
    readerView.classList.remove('size-sm', 'size-md', 'size-lg');

    // Clear preview & chapter list
    renderChapterList();
    clearPreview();

    showToast('App reset to launch state.');
}
