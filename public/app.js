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

// Creates a hover-reveal delete wrapper around a single element
function wrapAsEditable(el, chapterIndex) {
    const wrapper = document.createElement('div');
    wrapper.className = 'editable-block';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-block-btn';
    deleteBtn.setAttribute('title', 'Delete this element from chapter');
    deleteBtn.setAttribute('aria-label', 'Delete element');
    deleteBtn.textContent = '\u2715';

    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    wrapper.appendChild(deleteBtn);

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

    // Strip all injected delete buttons from the clone
    clone.querySelectorAll('.delete-block-btn').forEach(btn => btn.remove());

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
