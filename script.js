/* ==========================================================================
   4th Semester QA — Advanced Script v2.0
   Features: Search, Bookmarks, Progress Tracking, Toast, Theme, URL Routing,
             MCQ Score, Reveal All, Charts, Animations, FAB
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. Global State
// --------------------------------------------------------------------------
let allData = {};
let topicChart;
let searchIndex = []; // For full-text search
let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');

let currentState = {
    subject: null, year: null, type: null,
    noteCategory: null, noteSubject: null, view: 'home'
};

// --------------------------------------------------------------------------
// 2. App Lifecycle
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();

    // Show skeleton while loading
    showLoadingSkeleton();

    fetch('4sem.json')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
            allData = data;
            buildSearchIndex();
            initializeApp();
        })
        .catch(err => {
            console.error('Data load error:', err);
            document.getElementById('content-area').innerHTML = `
                <div class="no-results card p-8 mx-4 my-8">
                    <div class="nr-icon">⚠️</div>
                    <p>দুঃখিত, ডেটা লোড করা যায়নি।<br><small>JSON ফাইলটি একই ফোল্ডারে আছে কিনা যাচাই করুন।</small></p>
                </div>`;
        });
});

function showLoadingSkeleton() {
    const area = document.getElementById('content-area');
    // Just leave home page visible — skeleton shown in stats/nav
}

function initializeApp() {
    renderNav();
    renderHomeStats();
    setupSearch();
    setupThemeToggle();
    setupFAB();
    setupBookmarksPage();
    updateBookmarkBadge();
    initFontSize();
    initContextMenu();
    initScrollProgressBar();
    initStudyTimer();
    initKeyboardShortcuts();
    addRippleToButtons();

    document.getElementById('home-button').onclick = showHomePage;
    document.getElementById('year-filter').onchange = handleYearChange;

    const syllabusBtn = document.getElementById('syllabus-button');
    const syllabusBtnMobile = document.getElementById('syllabus-button-mobile');
    if (syllabusBtn) syllabusBtn.onclick = showSyllabus;
    if (syllabusBtnMobile) syllabusBtnMobile.onclick = showSyllabus;

    document.getElementById('bookmarks-nav-btn').onclick = showBookmarks;

    // Home feature card click handlers
    initFeatureCardHandlers();

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    // Reveal intro section
    requestAnimationFrame(() => {
        document.getElementById('intro-section').classList.add('is-visible');
    });
}

// --------------------------------------------------------------------------
// 2b. Feature Card Handlers (Home Page)
// --------------------------------------------------------------------------
function initFeatureCardHandlers() {
    document.querySelectorAll('.feature-card-linked').forEach(card => {
        const action = card.dataset.action;
        card.addEventListener('click', () => handleFeatureCardClick(action));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFeatureCardClick(action);
            }
        });
    });

    // Subject picker close
    const overlay = document.getElementById('subject-picker-overlay');
    document.getElementById('subject-picker-close').onclick = () => closeSubjectPicker();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSubjectPicker(); });
}

function handleFeatureCardClick(action) {
    switch (action) {
        case 'bookmarks':
            showBookmarks();
            break;
        case 'search':
            document.getElementById('global-search')?.focus();
            break;
        case 'mcq':
            showSubjectPicker('MCQ অনুশীলন', 'বিষয় বেছে নিন, তারপর সাল ও MCQ অনুশীলনে যান', 'mcq');
            break;
        case 'chart':
            showSubjectPicker('টপিক চার্ট', 'বিষয় নির্বাচন করুন টপিক বিশ্লেষণ দেখতে', 'chart');
            break;
    }
}

function showSubjectPicker(title, subtitle, mode) {
    const overlay = document.getElementById('subject-picker-overlay');
    const list = document.getElementById('subject-picker-list');
    document.getElementById('subject-picker-title').textContent = title;
    document.getElementById('subject-picker-subtitle').textContent = subtitle;

    list.innerHTML = '';

    // Filter subjects that have MCQ/questions
    const subjects = Object.keys(allData).filter(k => k !== 'syllabus' && !allData[k].isNoteCategory && allData[k].questions);

    if (subjects.length === 0) {
        list.innerHTML = '<p class="text-center text-gray-400 py-4">কোনো বিষয় পাওয়া যায়নি।</p>';
    }

    subjects.forEach(key => {
        const subj = allData[key];
        const btn = document.createElement('button');
        btn.className = 'subject-picker-btn';

        // Count MCQs
        const totalMCQ = Object.keys(subj.questions || {}).reduce((acc, yr) => {
            return acc + (subj.questions[yr]?.mcq?.length || 0);
        }, 0);
        const years = subj.years || [];

        btn.innerHTML = `
            <span class="picker-icon">${subj.icon || '📘'}</span>
            <div class="picker-info">
                <span class="picker-name">${subj.name}</span>
                <span class="picker-meta">${years.length > 0 ? years[0] + '–' + years[years.length-1] : ''} · ${totalMCQ > 0 ? totalMCQ + ' MCQ' : 'লিখিত'}</span>
            </div>
            <svg class="picker-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        `;

        btn.onclick = () => {
            if (mode === 'chart') {
                closeSubjectPicker();
                selectSubject(key);
                setTimeout(() => {
                    const chartSection = document.getElementById('chart-section');
                    if (chartSection && !chartSection.classList.contains('hidden')) {
                        chartSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 350);
            } else if (mode === 'mcq') {
                // Show year selection step inside the picker
                showYearPicker(key, years, subj);
            }
        };

        list.appendChild(btn);
    });

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('open'));
}

function closeSubjectPicker() {
    const overlay = document.getElementById('subject-picker-overlay');
    overlay.classList.remove('open');
    setTimeout(() => overlay.classList.add('hidden'), 300);
}

function showYearPicker(subjectKey, years, subjData) {
    const list = document.getElementById('subject-picker-list');
    document.getElementById('subject-picker-title').textContent = subjData.name;
    document.getElementById('subject-picker-subtitle').textContent = 'সাল নির্বাচন করুন — MCQ অনুশীলনে যান';

    list.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'year-picker-wrap';

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'year-picker-back';
    backBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
        বিষয় পরিবর্তন করুন
    `;
    backBtn.onclick = () => showSubjectPicker('MCQ অনুশীলন', 'বিষয় বেছে নিন, তারপর সালে MCQ অনুশীলনে যান', 'mcq');
    wrap.appendChild(backBtn);

    // Year buttons — only show years that have MCQ
    const mcqYears = years.filter(yr => (allData[subjectKey]?.questions?.[yr]?.mcq?.length || 0) > 0);
    
    if (mcqYears.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'text-align:center;color:var(--text-3);padding:1.5rem 0;font-size:0.9rem;';
        msg.textContent = 'এই বিষয়ে MCQ প্রশ্ন পাওয়া যায়নি।';
        wrap.appendChild(msg);
    } else {
        mcqYears.forEach(yr => {
            const count = allData[subjectKey]?.questions?.[yr]?.mcq?.length || 0;
            const btn = document.createElement('button');
            btn.className = 'year-btn';
            btn.innerHTML = `
                <span>${yr} সাল</span>
                <span class="year-btn-badge">${count} MCQ</span>
            `;
            btn.onclick = () => {
                closeSubjectPicker();
                selectSubjectAndType(subjectKey, String(yr), 'mcq');
            };
            wrap.appendChild(btn);
        });
    }

    list.appendChild(wrap);
}

function selectSubjectAndType(key, year, type) {
    if (!allData[key]) return;
    document.querySelectorAll('#subject-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subject === key);
    });
    hideAllSections();
    document.getElementById('filter-section').classList.remove('hidden');
    currentState.subject = key;
    currentState.year = year;
    currentState.type = type;
    const subjectData = allData[key];
    if (subjectData.analysis?.data?.length > 0) {
        document.getElementById('chart-section').classList.remove('hidden');
        renderChart();
    }
    renderFilters();
    renderQuestions();
    updateHashFromState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


function buildSearchIndex() {
    searchIndex = [];
    Object.keys(allData).forEach(subjectKey => {
        if (subjectKey === 'syllabus') return;
        const subjectData = allData[subjectKey];
        if (!subjectData.questions) return;

        Object.keys(subjectData.questions).forEach(year => {
            const yearData = subjectData.questions[year];
            ['written', 'mcq'].forEach(type => {
                (yearData[type] || []).forEach((item, idx) => {
                    const qText = (item.q || '').replace(/<[^>]*>/g, '');
                    searchIndex.push({
                        subjectKey,
                        subjectName: subjectData.name,
                        subjectIcon: subjectData.icon || '📘',
                        year,
                        type,
                        idx,
                        q: qText
                    });
                });
            });
        });
    });
}

function setupSearch() {
    const input = document.getElementById('global-search');
    const dropdown = document.getElementById('search-results-dropdown');
    let debounceTimer;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = input.value.trim();
            if (query.length < 2) { closeSearch(); return; }
            performSearch(query);
        }, 220);
    });

    input.addEventListener('focus', () => {
        const query = input.value.trim();
        if (query.length >= 2) performSearch(query);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            closeSearch();
        }
    });
}

function performSearch(query) {
    const dropdown = document.getElementById('search-results-dropdown');
    const lower = query.toLowerCase();
    const results = searchIndex.filter(item =>
        item.q.toLowerCase().includes(lower)
    ).slice(0, 12);

    dropdown.innerHTML = '';
    dropdown.classList.remove('hidden');

    if (results.length === 0) {
        dropdown.innerHTML = `<div class="search-empty">❌ কোনো ফলাফল পাওয়া যায়নি</div>`;
        return;
    }

    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.setAttribute('role', 'option');

        const highlighted = item.q.replace(
            new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
            '<mark>$1</mark>'
        );

        div.innerHTML = `
            <div class="sr-meta">
                <span class="sr-tag">${item.subjectIcon} ${item.subjectName}</span>
                ${item.year} · ${item.type === 'mcq' ? 'MCQ' : 'লিখিত'}
            </div>
            <div class="sr-q">${highlighted.substring(0, 160)}...</div>
        `;

        div.onclick = () => {
            closeSearch();
            document.getElementById('global-search').value = '';
            // Navigate to the question
            selectSubject(item.subjectKey);
            setTimeout(() => {
                currentState.year = item.year;
                currentState.type = item.type;
                renderFilters();
                renderQuestions(() => {
                    // Try to open/highlight the matching accordion
                    setTimeout(() => {
                        const cards = document.querySelectorAll('#question-display .q-accordion');
                        if (cards[item.idx]) {
                            cards[item.idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const header = cards[item.idx].querySelector('.q-header');
                            if (header) header.click();
                        }
                    }, 400);
                });
            }, 100);
        };

        dropdown.appendChild(div);
    });
}

function closeSearch() {
    document.getElementById('search-results-dropdown').classList.add('hidden');
}

// --------------------------------------------------------------------------
// 4. Navigation & Subject Selection
// --------------------------------------------------------------------------
function renderNav() {
    const nav = document.getElementById('subject-nav');
    nav.innerHTML = '';
    Object.keys(allData).forEach(key => {
        if (key === 'syllabus') return;
        const subject = allData[key];
        const btn = document.createElement('button');
        btn.className = 'neu-btn';
        btn.innerHTML = `<span>${subject.icon || '📘'}</span><span>${subject.name}</span>`;
        btn.dataset.subject = key;
        btn.onclick = () => selectSubject(key);
        nav.appendChild(btn);
    });
}

function selectSubject(key) {
    if (!allData[key]) return;
    const subjectData = allData[key];

    // Update nav active state
    document.querySelectorAll('#subject-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subject === key);
    });

    hideAllSections();
    document.getElementById('filter-section').classList.remove('hidden');

    currentState.subject = key;

    // Handle class notes category
    if (subjectData.isNoteCategory) {
        renderClassNoteFilters(subjectData);
        return;
    }

    currentState.year = currentState.year || String(subjectData.years[0]);
    const availableTypes = subjectData.questions[currentState.year] || {};
    currentState.type = currentState.type ||
        ((availableTypes.written?.length ? 'written' : 'mcq'));

    // Chart
    if (subjectData.analysis?.data?.length > 0) {
        document.getElementById('chart-section').classList.remove('hidden');
        renderChart();
    }

    renderFilters();
    renderQuestions();
    updateHashFromState();
}

function renderClassNoteFilters(subjectData) {
    const filterSection = document.getElementById('filter-section');
    filterSection.classList.remove('hidden');

    const regularFilters = document.getElementById('regular-filters-wrap');
    const notesFilter = document.getElementById('classnotes-filters');
    if (regularFilters) regularFilters.style.display = 'none';
    if (notesFilter) {
        notesFilter.classList.remove('hidden');
        notesFilter.innerHTML = '';
        Object.keys(subjectData.subjects || {}).forEach(sk => {
            const subj = allData[sk] || { name: sk };
            const btn = document.createElement('button');
            btn.className = 'neu-btn text-sm';
            btn.textContent = subj.name || sk;
            btn.dataset.key = sk;
            btn.onclick = () => selectNoteSubject(sk);
            notesFilter.appendChild(btn);
        });
    }
}

function showHomePage() {
    hideAllSections();
    document.getElementById('intro-section').classList.remove('hidden');
    document.getElementById('intro-section').classList.add('is-visible');
    document.getElementById('stats-bar').classList.add('hidden');
    document.querySelectorAll('#subject-nav button').forEach(btn => btn.classList.remove('active'));
    currentState = { subject: null, year: null, type: null, noteCategory: null, noteSubject: null, view: 'home' };
    updateHashFromState();
}

// --------------------------------------------------------------------------
// 5. Render Filters
// --------------------------------------------------------------------------
function renderFilters() {
    const subjectData = allData[currentState.subject];
    if (!subjectData || subjectData.isNoteCategory) return;

    // Show regular filters, hide notes
    const classnoteFilters = document.getElementById('classnotes-filters');
    if (classnoteFilters) classnoteFilters.classList.add('hidden');

    const yearFilter = document.getElementById('year-filter');
    yearFilter.innerHTML = '';
    subjectData.years.forEach(yr => {
        const opt = document.createElement('option');
        opt.value = yr;
        opt.textContent = yr;
        yearFilter.appendChild(opt);
    });
    yearFilter.value = currentState.year;

    const typeFilter = document.getElementById('type-filter');
    typeFilter.innerHTML = '';
    const available = subjectData.questions[currentState.year] || {};

    if (available.written?.length) {
        const btn = createTypeBtn('written', '📝 লিখিত', currentState.type === 'written');
        typeFilter.appendChild(btn);
    }
    if (available.mcq?.length) {
        const btn = createTypeBtn('mcq', '☑ MCQ', currentState.type === 'mcq');
        typeFilter.appendChild(btn);
    }
}

function createTypeBtn(type, label, isActive) {
    const btn = document.createElement('button');
    btn.className = `neu-btn text-sm ${isActive ? 'active' : ''}`;
    btn.innerHTML = label;
    btn.onclick = () => handleTypeChange(type);
    return btn;
}

function handleYearChange() {
    currentState.year = document.getElementById('year-filter').value;
    // Reset type
    const available = allData[currentState.subject]?.questions[currentState.year] || {};
    currentState.type = available.written?.length ? 'written' : 'mcq';
    renderFilters();
    renderQuestions();
    updateHashFromState();
}

function handleTypeChange(type) {
    currentState.type = type;
    document.querySelectorAll('#type-filter button').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(type === 'mcq' ? 'MCQ' : 'লিখিত'));
    });
    renderQuestions();
    updateHashFromState();
}

// --------------------------------------------------------------------------
// 6. Render Questions
// --------------------------------------------------------------------------
function renderQuestions(callback) {
    const display = document.getElementById('question-display');
    display.innerHTML = '';

    const { subject, year, type } = currentState;
    if (!subject || !year || !type) return;

    const questions = allData[subject]?.questions?.[year]?.[type] || [];

    if (questions.length === 0) {
        display.innerHTML = `<div class="no-results card p-8"><div class="nr-icon">🔍</div><p>এই সালে এই ধরনের প্রশ্ন পাওয়া যায়নি।</p></div>`;
        hideMCQScoreUI();
        return;
    }

    if (type === 'mcq') {
        renderMCQQuestions(questions, display);
    } else {
        renderWrittenQuestions(questions, display);
    }

    setTimeout(() => {
        applyScrollAnimation('#question-display .q-accordion, #question-display .mcq-card');
        if (callback) callback();
    }, 50);
}

function renderWrittenQuestions(questions, container) {
    hideMCQScoreUI();
    // Add reading progress bar
    const progressBar = renderReadingProgressBar();
    container.appendChild(progressBar);
    questions.forEach((item, idx) => {
        const el = createWrittenAccordion(item, idx);
        container.appendChild(el);
    });
}

function createWrittenAccordion(item, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'q-accordion mb-3 reveal-on-scroll';

    const shareTarget = {
        subject: currentState.subject,
        year: currentState.year,
        type: 'written',
        idx,
        qText: (item.q || '').replace(/<[^>]*>/g, '')
    };

    const header = document.createElement('button');
    header.className = 'q-header';
    header.innerHTML = `
        <span class="q-num-badge">${idx + 1}</span>
        <span class="flex-1 text-left">${formatQuestionText(item.q)}</span>
        <div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0">
            <button class="bookmark-btn" data-qid="${btoa(encodeURIComponent(item.q.substring(0,80))).substring(0,20)}" onclick="toggleBookmark(event, '${currentState.subject}', '${currentState.year}', 'written', ${idx})" aria-label="বুকমার্ক">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
            </button>
            <div class="q-chevron">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
        </div>
    `;

    const body = document.createElement('div');
    body.className = 'q-body';

    const content = document.createElement('div');
    content.className = 'answer-content';
    content.innerHTML = item.a || '<p>উত্তর পাওয়া যায়নি।</p>';
    sanitizeContent(content);

    // Share hint + read done + print buttons at bottom of answer
    const actionsRow = createAnswerActions(shareTarget, idx);
    content.appendChild(actionsRow);

    body.appendChild(content);
    wrap.appendChild(header);
    wrap.appendChild(body);

    header.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-btn')) return;
        toggleAccordion(header, body);
    });

    // Attach long-press / right-click share on header
    attachShareHandlers(header, shareTarget);

    // Update bookmark icon
    updateBookmarkIcon(header.querySelector('.bookmark-btn'), currentState.subject, currentState.year, 'written', idx);

    return wrap;
}

function toggleAccordion(header, body) {
    const isOpen = body.classList.contains('open');
    const accordion = header.closest('.q-accordion');

    // Close all others first
    document.querySelectorAll('#question-display .q-body.open').forEach(b => {
        b.classList.remove('open');
        b.previousElementSibling?.classList.remove('active');
        b.closest('.q-accordion')?.classList.remove('is-open');
    });

    if (!isOpen) {
        body.classList.add('open');
        header.classList.add('active');
        accordion?.classList.add('is-open');

        // Smart scroll: after content expands, ensure the header stays in view
        // We wait for the CSS transition to complete (max-height animates)
        const stickyBarH = (document.getElementById('top-sticky-bar')?.offsetHeight || 60) + 12;

        // Immediate check: if header is above viewport, scroll to it
        const scrollToHeader = () => {
            const rect = header.getBoundingClientRect();
            const viewH = window.innerHeight;

            // If header is above sticky bar, bring it into view
            if (rect.top < stickyBarH) {
                window.scrollTo({
                    top: header.getBoundingClientRect().top + window.scrollY - stickyBarH,
                    behavior: 'smooth'
                });
                return;
            }

            // If header is in view but the answer body will push it off screen,
            // scroll just enough so header stays at top with padding
            if (rect.top > stickyBarH + 8) {
                // It's visible — check if after expansion it stays visible
                // Scroll header to near top so user can read both Q and A
                const targetTop = header.getBoundingClientRect().top + window.scrollY - stickyBarH - 8;
                const currentTop = window.scrollY;
                if (targetTop < currentTop) {
                    window.scrollTo({ top: targetTop, behavior: 'smooth' });
                }
                // else: already in good position, don't scroll
            }
        };

        // Run immediately and after transition for mobile
        requestAnimationFrame(scrollToHeader);
        setTimeout(scrollToHeader, 50);
        setTimeout(scrollToHeader, 350);
    }
}

function renderMCQQuestions(questions, container) {
    showMCQScoreUI(questions.length);

    const wrap = document.createElement('div');
    wrap.className = 'mcq-wrap';

    questions.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'mcq-card reveal-on-scroll';

        const shareTarget = {
            subject: currentState.subject,
            year: currentState.year,
            type: 'mcq',
            idx,
            qText: (item.q || '').replace(/<[^>]*>/g, '')
        };

        const letters = ['ক', 'খ', 'গ', 'ঘ'];

        card.dataset.correctIdx = item.a; // Store correct answer index for revealAllAnswers
        card.innerHTML = `
            <p class="mcq-q-text">${idx + 1}। ${item.q}</p>
            <div class="mcq-options">
                ${(item.o || []).map((opt, oi) => `
                    <div class="mcq-option" data-opt="${oi}" tabindex="0" role="button" aria-label="${letters[oi]}: ${opt}">
                        <span class="opt-letter">${letters[oi]}</span>
                        <span class="opt-text">${opt}</span>
                        <span class="option-icon" aria-hidden="true"></span>
                    </div>
                `).join('')}
            </div>
        `;

        card.querySelectorAll('.mcq-option').forEach(optEl => {
            optEl.addEventListener('click', () => handleMCQOptionClick(optEl, item, card));
            optEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleMCQOptionClick(optEl, item, card);
                }
            });
        });

        // Long-press / right-click share on MCQ question text
        attachShareHandlers(card.querySelector('.mcq-q-text'), shareTarget);

        wrap.appendChild(card);
    });

    container.appendChild(wrap);
}

function handleMCQOptionClick(optionEl, item, card) {
    if (card.dataset.answered) return;
    card.dataset.answered = 'true';
    card.querySelectorAll('.mcq-option').forEach(el => {
        el.style.pointerEvents = 'none';
        el.removeAttribute('tabindex');
    });

    const correctIdx = item.a;
    const selectedIdx = Array.from(card.querySelectorAll('.mcq-option')).indexOf(optionEl);
    const correctEl = card.querySelectorAll('.mcq-option')[correctIdx];

    correctEl.classList.add('correct');
    correctEl.querySelector('.option-icon').textContent = '✔';

    if (selectedIdx !== correctIdx) {
        optionEl.classList.add('incorrect');
        optionEl.querySelector('.option-icon').textContent = '✖';
    }

    updateMCQScore();
}

function showMCQScoreUI(total) {
    document.getElementById('mcq-score-wrap').classList.remove('hidden');
    const mcqControls = document.getElementById('mcq-controls');
    mcqControls.classList.remove('hidden');
    mcqControls.style.display = 'flex';
    document.getElementById('mcq-progress-bar-wrap').classList.remove('hidden');
    document.getElementById('mcq-score').textContent = '0';
    document.getElementById('mcq-total').textContent = total;
    document.getElementById('mcq-progress-bar').style.width = '0%';
}

function hideMCQScoreUI() {
    document.getElementById('mcq-score-wrap').classList.add('hidden');
    const mcqControls = document.getElementById('mcq-controls');
    mcqControls.classList.add('hidden');
    mcqControls.style.display = 'none';
    document.getElementById('mcq-progress-bar-wrap').classList.add('hidden');
}

function updateMCQScore() {
    const total = parseInt(document.getElementById('mcq-total').textContent || '0');
    const answered = document.querySelectorAll('.mcq-card[data-answered]').length;
    const incorrect = document.querySelectorAll('.mcq-option.incorrect').length;
    const score = answered - incorrect;
    document.getElementById('mcq-score').textContent = score;

    // Update progress bar
    const pct = total > 0 ? (answered / total) * 100 : 0;
    document.getElementById('mcq-progress-bar').style.width = pct + '%';

    // Completion toast
    if (answered === total && total > 0) {
        const pct = Math.round((score / total) * 100);
        showToast(`🎉 সম্পন্ন! স্কোর: ${score}/${total} (${pct}%)`, pct >= 70 ? 'success' : 'info');
    }
}

function resetMCQAnswers() {
    document.querySelectorAll('.mcq-card[data-answered]').forEach(card => {
        card.removeAttribute('data-answered');
        card.querySelectorAll('.mcq-option').forEach(el => {
            el.style.pointerEvents = 'auto';
            el.setAttribute('tabindex', '0');
            el.classList.remove('correct', 'incorrect');
            el.querySelector('.option-icon').textContent = '';
        });
    });
    document.getElementById('mcq-score').textContent = '0';
    document.getElementById('mcq-progress-bar').style.width = '0%';
    showToast('✅ রিসেট হয়েছে', 'info');
}

function revealAllAnswers() {
    // Reveal MCQ answers for unanswered cards
    let mcqRevealed = 0;
    document.querySelectorAll('.mcq-card:not([data-answered])').forEach(card => {
        const correctIdx = parseInt(card.dataset.correctIdx);
        if (isNaN(correctIdx)) return;

        card.dataset.answered = 'true';
        card.dataset.revealed = 'true';
        card.querySelectorAll('.mcq-option').forEach((el, i) => {
            el.style.pointerEvents = 'none';
            el.removeAttribute('tabindex');
            if (i === correctIdx) {
                el.classList.add('correct');
                el.querySelector('.option-icon').textContent = '✔';
            }
        });
        mcqRevealed++;
    });

    // For written: open all accordions
    let writtenOpened = 0;
    document.querySelectorAll('#question-display .q-header:not(.active)').forEach(h => {
        const accordion = h.closest('.q-accordion');
        const body = h.nextElementSibling;
        if (body) {
            body.classList.add('open');
            h.classList.add('active');
            accordion?.classList.add('is-open');
            writtenOpened++;
        }
    });

    // Update MCQ score after reveal
    if (mcqRevealed > 0) updateMCQScore();

    if (mcqRevealed > 0 || writtenOpened > 0) {
        showToast('📖 সব উত্তর দেখানো হয়েছে', 'success');
    } else {
        showToast('✅ সব প্রশ্নের উত্তর ইতোমধ্যে দেখা হয়েছে', 'info');
    }
}

// --------------------------------------------------------------------------
// 7. Chart
// --------------------------------------------------------------------------
function renderChart() {
    const subjectData = allData[currentState.subject];
    if (!subjectData?.analysis) return;

    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#6b7280';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    const ctx = document.getElementById('topicChart').getContext('2d');
    if (topicChart) topicChart.destroy();

    topicChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: subjectData.analysis.labels,
            datasets: [{
                label: 'প্রশ্নের সংখ্যা',
                data: subjectData.analysis.data,
                backgroundColor: subjectData.analysis.data.map((_, i) =>
                    `hsla(${(i * 37 + 240) % 360}, 70%, 60%, 0.8)`
                ),
                borderColor: subjectData.analysis.data.map((_, i) =>
                    `hsla(${(i * 37 + 240) % 360}, 70%, 50%, 1)`
                ),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? '#1e2235' : '#fff',
                    titleColor: isDark ? '#e2e8f0' : '#3d4466',
                    bodyColor: isDark ? '#94a3b8' : '#6b7280',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 10,
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor, font: { family: "'Hind Siliguri', sans-serif", size: 11 }, maxRotation: 45 },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { color: textColor, font: { size: 11 }, stepSize: 2 },
                    grid: { color: gridColor }
                }
            },
            animation: { duration: 800, easing: 'easeInOutQuart' }
        }
    });
}

// --------------------------------------------------------------------------
// 8. Syllabus
// --------------------------------------------------------------------------
function showSyllabus() {
    hideAllSections();
    document.getElementById('syllabus-section').classList.remove('hidden');
    document.querySelectorAll('#subject-nav button').forEach(btn => btn.classList.remove('active'));
    currentState = { ...currentState, view: 'syllabus' };

    const grid = document.getElementById('syllabus-grid');
    grid.innerHTML = '';

    const customNames = {
        bangla: "বাংলা পেপার-১", english: "ইংরেজি পেপার-১",
        ict: "আইসিটি শিক্ষা পেপার-১", shikkhaMonobiggan: "শিক্ষা মনোবিজ্ঞান ও নির্দেশনা",
        ict_in_edu: "শিক্ষায় আইসিটি", bangla_paper_2: "বাংলা পেপার-২",
        english_paper_2: "ইংরেজি পেপার-২", ict_education_2: "আইসিটি শিক্ষা পেপার-২",
        genderEducation: "Gender Education", organizationManagement: "Organization & Management"
    };

    Object.keys(allData.syllabus || {}).forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'syl-btn';
        btn.textContent = customNames[key] || (allData[key]?.name) || key;
        btn.onclick = () => {
            grid.querySelectorAll('.syl-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderSyllabusContent(key);
        };
        grid.appendChild(btn);
    });

    document.getElementById('syllabus-content-box').classList.add('hidden');
    document.getElementById('syllabus-content').innerHTML = '';
}

function renderSyllabusContent(key, showTranslated = false) {
    const box = document.getElementById('syllabus-content-box');
    const content = document.getElementById('syllabus-content');
    const sylData = allData.syllabus?.[key];

    if (!sylData) {
        box.classList.remove('hidden');
        content.innerHTML = '<p class="text-center text-gray-400">এই বিষয়ের সিলেবাস পাওয়া যায়নি।</p>';
        return;
    }

    box.classList.remove('hidden');
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (showTranslated && sylData.translated) {
        content.innerHTML = sylData.translated;
        appendSylToggleBtn(content, key, false, 'মূল সিলেবাস দেখুন');
    } else {
        content.innerHTML = sylData.content;
        if (sylData.translated) {
            appendSylToggleBtn(content, key, true, '🔤 অনুবাদ দেখুন');
        }
    }

    // Wrap tables
    content.querySelectorAll('table').forEach(table => {
        if (!table.parentNode.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

function appendSylToggleBtn(container, key, showTranslated, label) {
    const btn = document.createElement('button');
    btn.className = 'syl-toggle-btn';
    btn.innerHTML = `${label}`;
    btn.onclick = () => renderSyllabusContent(key, showTranslated);
    container.appendChild(btn);
}

// --------------------------------------------------------------------------
// 9. Bookmarks Feature
// --------------------------------------------------------------------------
function toggleBookmark(event, subject, year, type, idx) {
    event.stopPropagation();
    const id = `${subject}_${year}_${type}_${idx}`;
    const bookmarkIdx = bookmarks.findIndex(b => b.id === id);

    if (bookmarkIdx > -1) {
        bookmarks.splice(bookmarkIdx, 1);
        showToast('🗑 বুকমার্ক সরানো হয়েছে', 'info');
    } else {
        const item = allData[subject]?.questions?.[year]?.[type]?.[idx];
        if (item) {
            bookmarks.push({
                id, subject, year, type, idx,
                q: item.q,
                subjectName: allData[subject]?.name,
                subjectIcon: allData[subject]?.icon || '📘'
            });
            showToast('⭐ বুকমার্ক যুক্ত হয়েছে', 'success');
        }
    }

    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    updateBookmarkBadge();

    // Update all bookmark icons on page
    document.querySelectorAll(`.bookmark-btn`).forEach(btn => {
        if (btn.onclick?.toString().includes(`'${subject}', '${year}', '${type}', ${idx}`)) {
            updateBookmarkIcon(btn, subject, year, type, idx);
        }
    });

    // If bookmarks page is open, re-render
    if (!document.getElementById('bookmarks-section').classList.contains('hidden')) {
        renderBookmarksList();
    }
}

function updateBookmarkIcon(btn, subject, year, type, idx) {
    if (!btn) return;
    const id = `${subject}_${year}_${type}_${idx}`;
    const isBookmarked = bookmarks.some(b => b.id === id);
    btn.classList.toggle('bookmarked', isBookmarked);
    const svgPath = btn.querySelector('path');
    if (svgPath) {
        svgPath.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
    }
}

function updateBookmarkBadge() {
    const badge = document.getElementById('bookmark-count-badge');
    if (bookmarks.length > 0) {
        badge.textContent = bookmarks.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function showBookmarks() {
    hideAllSections();
    document.getElementById('bookmarks-section').classList.remove('hidden');
    document.querySelectorAll('#subject-nav button').forEach(btn => btn.classList.remove('active'));
    renderBookmarksList();
}

function renderBookmarksList() {
    const list = document.getElementById('bookmarks-list');

    if (bookmarks.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
                <p>এখনো কোনো প্রশ্ন সংরক্ষণ করা হয়নি।<br><small>প্রশ্নের পাশের বুকমার্ক আইকনে ক্লিক করুন।</small></p>
            </div>`;
        return;
    }

    list.innerHTML = '';
    bookmarks.forEach(b => {
        const wrap = document.createElement('div');
        wrap.className = 'q-accordion mb-3';

        const header = document.createElement('button');
        header.className = 'q-header';
        header.innerHTML = `
            <span class="q-num-badge" style="background:linear-gradient(135deg,#f59e0b,#fbbf24)">${b.subjectIcon}</span>
            <div class="flex-1 text-left">
                <div class="text-xs text-gray-400 mb-1">${b.subjectName} · ${b.year} · ${b.type === 'mcq' ? 'MCQ' : 'লিখিত'}</div>
                <div>${formatQuestionText(b.q)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.4rem">
                <button class="bookmark-btn bookmarked" onclick="removeBookmark(event,'${b.id}')" title="বুকমার্ক সরান">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
                </button>
                <div class="q-chevron">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            </div>
        `;

        const body = document.createElement('div');
        body.className = 'q-body';

        // Get actual answer
        const item = allData[b.subject]?.questions?.[b.year]?.[b.type]?.[b.idx];
        if (item) {
            if (b.type === 'written') {
                const content = document.createElement('div');
                content.className = 'answer-content';
                content.innerHTML = item.a || 'উত্তর পাওয়া যায়নি।';
                sanitizeContent(content);
                body.appendChild(content);
            } else {
                const letters = ['ক', 'খ', 'গ', 'ঘ'];
                body.innerHTML = `<div class="answer-content">
                    <p><strong>সঠিক উত্তর:</strong> ${letters[item.a]} — ${item.o?.[item.a] || ''}</p>
                    <div class="mcq-options mt-2">
                        ${(item.o || []).map((o, i) => `<div class="mcq-option ${i === item.a ? 'correct' : ''}" style="pointer-events:none">
                            <span class="opt-letter">${letters[i]}</span><span>${o}</span>
                            ${i === item.a ? '<span class="option-icon">✔</span>' : ''}
                        </div>`).join('')}
                    </div>
                </div>`;
            }
        }

        wrap.appendChild(header);
        wrap.appendChild(body);
        header.addEventListener('click', (e) => {
            if (e.target.closest('.bookmark-btn')) return;
            toggleAccordion(header, body);
        });

        list.appendChild(wrap);
    });
}

function removeBookmark(event, id) {
    event.stopPropagation();
    const idx = bookmarks.findIndex(b => b.id === id);
    if (idx > -1) {
        bookmarks.splice(idx, 1);
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        updateBookmarkBadge();
        renderBookmarksList();
        showToast('🗑 বুকমার্ক সরানো হয়েছে', 'info');
    }
}

function setupBookmarksPage() {
    document.getElementById('clear-bookmarks-btn').onclick = () => {
        if (bookmarks.length === 0) { showToast('কোনো বুকমার্ক নেই', 'info'); return; }
        if (confirm('সব বুকমার্ক মুছে ফেলবেন?')) {
            bookmarks.length = 0;
            localStorage.removeItem('bookmarks');
            updateBookmarkBadge();
            renderBookmarksList();
            showToast('🗑 সব বুকমার্ক মুছে ফেলা হয়েছে', 'info');
        }
    };
}

// --------------------------------------------------------------------------
// 10. Home Stats
// --------------------------------------------------------------------------
function renderHomeStats() {
    const container = document.getElementById('home-stats');
    if (!container) return;

    let totalSubjects = 0, totalWritten = 0, totalMCQ = 0;

    Object.keys(allData).forEach(key => {
        if (key === 'syllabus') return;
        const subj = allData[key];
        if (!subj.questions) return;
        totalSubjects++;
        Object.keys(subj.questions).forEach(year => {
            totalWritten += (subj.questions[year].written || []).length;
            totalMCQ += (subj.questions[year].mcq || []).length;
        });
    });

    const stats = [
        { num: totalSubjects, label: 'মোট বিষয়', icon: '📚' },
        { num: totalWritten, label: 'লিখিত প্রশ্ন', icon: '📝' },
        { num: totalMCQ, label: 'MCQ প্রশ্ন', icon: '☑️' },
    ];

    container.innerHTML = stats.map(s => `
        <div class="stat-item card">
            <div class="s-icon">${s.icon}</div>
            <div class="s-num" data-target="${s.num}">0</div>
            <div class="s-label">${s.label}</div>
        </div>
    `).join('');

    // Count-up animation
    container.querySelectorAll('.s-num').forEach(el => {
        const target = parseInt(el.dataset.target);
        const duration = 900;
        const start = performance.now();
        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(ease * target);
            if (progress < 1) requestAnimationFrame(update);
        }
        setTimeout(() => requestAnimationFrame(update), 200);
    });
}

// --------------------------------------------------------------------------
// 11. Utility Functions
// --------------------------------------------------------------------------
function hideAllSections() {
    ['intro-section', 'bookmarks-section', 'syllabus-section', 'chart-section',
     'filter-section', 'question-display', 'progress-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const display = document.getElementById('question-display');
    if (display) { display.classList.remove('hidden'); display.innerHTML = ''; }
    hideMCQScoreUI();
}

function formatQuestionText(text) {
    if (!text) return '';
    return text.replace(
        /(^(\d+|[০-৯]+)[\.।]\s*(?:\([a-zA-Zক-ৎivx]+\))?|^\([a-zA-Zক-ৎivx]+\)|^টীকা:|^(?:Or|অথবা),?:?|^Short Note:\s*\([ivx]+\)|Explain:|Marks:\s*\d+)/gm,
        '<strong>$&</strong>'
    );
}

function sanitizeContent(element) {
    element.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    element.querySelectorAll('table').forEach(table => {
        if (!table.parentNode.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

// --------------------------------------------------------------------------
// 12. Theme
// --------------------------------------------------------------------------
function setupThemeToggle() {
    const track = document.getElementById('theme-toggle-track');
    const thumb = document.getElementById('theme-toggle-thumb');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const meta = document.getElementById('theme-color-meta');

    function updateToggleUI() {
        const isDark = document.body.classList.contains('dark');
        track.classList.toggle('dark-mode', isDark);
        track.setAttribute('aria-checked', isDark ? 'true' : 'false');
        sunIcon.style.display = isDark ? 'none' : 'block';
        moonIcon.style.display = isDark ? 'block' : 'none';
        if (meta) meta.content = isDark ? '#13151f' : '#eef1f7';
    }

    track.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('dark');
        document.body.classList.toggle('dark', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateToggleUI();
        if (topicChart) setTimeout(renderChart, 50);
    });

    track.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); track.click(); }
    });

    updateToggleUI();
}

function applyTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    document.body.classList.toggle('dark', isDark);
}

// --------------------------------------------------------------------------
// 13. FAB (Back to Top)
// --------------------------------------------------------------------------
function setupFAB() {
    const fab = document.getElementById('fab');
    window.addEventListener('scroll', () => {
        fab.style.display = window.scrollY > 400 ? 'flex' : 'none';
    }, { passive: true });
}

// --------------------------------------------------------------------------
// 14. Toast Notifications
// --------------------------------------------------------------------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// --------------------------------------------------------------------------
// 15. Animations
// --------------------------------------------------------------------------
const animObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.07 });

function applyScrollAnimation(selector) {
    const els = typeof selector === 'string' ? document.querySelectorAll(selector) : [selector];
    els.forEach((el, i) => {
        el.classList.add('reveal-on-scroll');
        el.style.transitionDelay = `${i * 0.04}s`;
        animObserver.observe(el);
    });
}

// --------------------------------------------------------------------------
// 18. Font Size System
// --------------------------------------------------------------------------
const FS_PRESETS = ['fs-normal', 'fs-large', 'fs-xlarge'];
const FS_LABELS  = ['A', 'A+', 'A++'];
let fsIndex = 0;

function initFontSize() {
    const saved = localStorage.getItem('fontSize') || 'fs-normal';
    fsIndex = FS_PRESETS.indexOf(saved);
    if (fsIndex < 0) fsIndex = 0;
    applyFontSize();

    document.getElementById('font-size-btn').addEventListener('click', () => {
        fsIndex = (fsIndex + 1) % FS_PRESETS.length;
        applyFontSize();
        localStorage.setItem('fontSize', FS_PRESETS[fsIndex]);
        showToast(`ফন্ট সাইজ: <strong>${FS_LABELS[fsIndex]}</strong>`);
    });
}

function applyFontSize() {
    FS_PRESETS.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(FS_PRESETS[fsIndex]);
    document.getElementById('fs-label').textContent = FS_LABELS[fsIndex];
}

// --------------------------------------------------------------------------
// 19. Context Menu Share System
// --------------------------------------------------------------------------
let ctxMenu, ctxTarget = null;

function initContextMenu() {
    ctxMenu = document.getElementById('ctx-menu');

    // Show native share button if supported
    if (navigator.share) {
        document.getElementById('ctx-native-share').style.display = 'flex';
        document.getElementById('ctx-whatsapp').style.display = 'none';
    }

    // Close on outside click / scroll
    document.addEventListener('click', closeCtxMenu);
    document.addEventListener('scroll', closeCtxMenu, { passive: true });
    window.addEventListener('resize', closeCtxMenu);

    // Menu actions
    document.getElementById('ctx-copy-link').addEventListener('click', () => {
        if (!ctxTarget) return;
        const url = buildShareURL(ctxTarget);
        navigator.clipboard.writeText(url).then(() => showToast('✅ লিংক কপি হয়েছে!'));
        closeCtxMenu();
    });

    document.getElementById('ctx-copy-text').addEventListener('click', () => {
        if (!ctxTarget) return;
        const text = ctxTarget.qText;
        navigator.clipboard.writeText(text).then(() => showToast('✅ প্রশ্ন কপি হয়েছে!'));
        closeCtxMenu();
    });

    document.getElementById('ctx-whatsapp').addEventListener('click', () => {
        if (!ctxTarget) return;
        const url = buildShareURL(ctxTarget);
        const msg = encodeURIComponent(`${ctxTarget.qText.substring(0, 100)}...\n\n${url}`);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
        closeCtxMenu();
    });

    document.getElementById('ctx-native-share').addEventListener('click', () => {
        if (!ctxTarget) return;
        const url = buildShareURL(ctxTarget);
        navigator.share({
            title: '৪র্থ সেমিস্টার প্রশ্ন',
            text: ctxTarget.qText.substring(0, 100) + '...',
            url
        }).catch(() => {});
        closeCtxMenu();
    });
}

function buildShareURL(target) {
    const base = window.location.href.split('#')[0];
    const params = new URLSearchParams();
    params.set('subject', target.subject);
    params.set('year', target.year);
    params.set('type', target.type);
    return `${base}#${params.toString()}`;
}

function openCtxMenu(e, target) {
    e.preventDefault();
    e.stopPropagation();
    ctxTarget = target;

    // Clamp position within viewport
    const menuW = 210, menuH = 200;
    let x = e.clientX || (e.touches?.[0]?.clientX ?? 0);
    let y = e.clientY || (e.touches?.[0]?.clientY ?? 0);
    x = Math.min(x, window.innerWidth - menuW - 8);
    y = Math.min(y, window.innerHeight - menuH - 8);

    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top  = y + 'px';

    // Truncate label
    const label = target.qText.substring(0, 32) + (target.qText.length > 32 ? '…' : '');
    document.getElementById('ctx-q-label').textContent = label;

    ctxMenu.classList.add('open');
}

function closeCtxMenu() {
    ctxMenu?.classList.remove('open');
}

// Attach long-press / contextmenu on question headers
function attachShareHandlers(el, target) {
    let pressTimer;

    // Desktop: right-click
    el.addEventListener('contextmenu', (e) => {
        openCtxMenu(e, target);
    });

    // Mobile: long press (500ms)
    el.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => openCtxMenu(e, target), 500);
    }, { passive: true });
    el.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
    el.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
}

// Create rich answer action row (share + read done + print)
function createAnswerActions(target, idx) {
    const row = document.createElement('div');
    row.className = 'answer-actions';

    // Read done toggle
    const readId = `read_${target.subject}_${target.year}_${target.type}_${idx}`;
    const isRead = localStorage.getItem(readId) === '1';

    const readBtn = document.createElement('button');
    readBtn.className = `action-btn${isRead ? ' read-done' : ''}`;
    readBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ${isRead ? 'পড়া হয়েছে ✓' : 'পড়া হয়েছে'}
    `;
    readBtn.onclick = (e) => {
        e.stopPropagation();
        const done = localStorage.getItem(readId) === '1';
        if (done) {
            localStorage.removeItem(readId);
            readBtn.classList.remove('read-done');
            readBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> পড়া হয়েছে`;
        } else {
            localStorage.setItem(readId, '1');
            readBtn.classList.add('read-done');
            readBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> পড়া হয়েছে ✓`;
            showToast('✅ পড়া হিসেবে চিহ্নিত হয়েছে!');
        }
        updateReadingProgress();
    };

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn';
    shareBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
        শেয়ার
    `;
    shareBtn.onclick = (e) => {
        e.stopPropagation();
        const rect = shareBtn.getBoundingClientRect();
        openCtxMenu({ clientX: rect.left, clientY: rect.top - 10 }, target);
    };

    // Print button
    const printBtn = document.createElement('button');
    printBtn.className = 'action-btn';
    printBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect width="12" height="8" x="6" y="14"></rect></svg>
        প্রিন্ট
    `;
    printBtn.onclick = (e) => {
        e.stopPropagation();
        printQuestion(target);
    };

    row.appendChild(readBtn);
    row.appendChild(shareBtn);
    row.appendChild(printBtn);
    return row;
}

// Print a single question
function printQuestion(target) {
    const subjectData = allData[target.subject];
    const item = subjectData?.questions?.[target.year]?.[target.type]?.[target.idx];
    if (!item) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>প্রশ্ন</title>
    <style>body{font-family:sans-serif;max-width:720px;margin:2rem auto;padding:1rem;color:#333;line-height:1.8}
    h2{font-size:1.1rem;border-bottom:2px solid #6366f1;padding-bottom:.5rem;color:#6366f1}
    .q{font-weight:700;font-size:1rem;margin-bottom:1rem;padding:.75rem;background:#f0f0ff;border-radius:8px}
    .a{font-size:.95rem}strong{color:#6366f1}table{border-collapse:collapse;width:100%}th{background:#6366f1;color:#fff;padding:.5rem}td{padding:.4rem;border:1px solid #ccc}
    footer{margin-top:2rem;font-size:.75rem;color:#999;border-top:1px solid #eee;padding-top:.5rem}</style></head><body>
    <h2>${subjectData.icon || ''} ${subjectData.name} — ${target.year}</h2>
    <div class="q">${item.q}</div>
    <div class="a">${item.a || 'উত্তর পাওয়া যায়নি।'}</div>
    <footer>৪র্থ সেমিস্টার প্রশ্নোত্তর সংকলন — Govt. Teachers' Training College, Faridpur</footer>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
}

// --------------------------------------------------------------------------
// 20. Scroll Progress Bar
// --------------------------------------------------------------------------
function initScrollProgressBar() {
    const bar = document.getElementById('scroll-progress-bar');
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (scrolled / max) * 100 : 0;
        bar.style.width = pct + '%';
    }, { passive: true });
}

// --------------------------------------------------------------------------
// 21. Study Timer
// --------------------------------------------------------------------------
let timerInterval = null, timerSeconds = 0, timerPaused = false;

function initStudyTimer() {
    const timerEl = document.getElementById('study-timer');
    const display = document.getElementById('timer-display');

    // Start counting
    timerInterval = setInterval(() => {
        if (!timerPaused) {
            timerSeconds++;
            display.textContent = formatTime(timerSeconds);
        }
    }, 1000);

    // Click to pause/resume
    timerEl.addEventListener('click', () => {
        timerPaused = !timerPaused;
        timerEl.classList.toggle('paused', timerPaused);
        showToast(timerPaused ? '⏸ টাইমার থামানো হয়েছে' : '▶ টাইমার চলছে');
    });
}

function formatTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// --------------------------------------------------------------------------
// 22. Keyboard Shortcuts
// --------------------------------------------------------------------------
function initKeyboardShortcuts() {
    const panel = document.getElementById('shortcut-panel');
    const closeBtn = document.getElementById('close-shortcut-panel');
    const helpBtn = document.getElementById('shortcut-help-btn');

    if (helpBtn) helpBtn.onclick = () => panel.classList.add('open');
    if (closeBtn) closeBtn.onclick = () => panel.classList.remove('open');
    panel?.addEventListener('click', (e) => { if (e.target === panel) panel.classList.remove('open'); });

    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.matches('input, textarea, select')) {
            if (e.key === 'Escape') e.target.blur();
            return;
        }

        if (e.key === '?' || (e.key === '/' && !e.ctrlKey)) {
            e.preventDefault();
            panel.classList.toggle('open');
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('global-search')?.focus();
        } else if (e.key === 'Escape') {
            if (panel.classList.contains('open')) { panel.classList.remove('open'); return; }
            if (document.getElementById('ctx-menu')?.classList.contains('open')) { closeCtxMenu(); return; }
            showHomePage();
        } else if (e.key === 'd' || e.key === 'D') {
            document.getElementById('theme-toggle-track')?.click();
        } else if (e.key === 'f' || e.key === 'F') {
            document.getElementById('font-size-btn')?.click();
        } else if (e.key === 'ArrowRight' || e.key === 'j') {
            navigateQuestion(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'k') {
            navigateQuestion(-1);
        }
    });
}

function navigateQuestion(dir) {
    const accordions = Array.from(document.querySelectorAll('#question-display .q-accordion'));
    if (accordions.length === 0) return;
    const activeIdx = accordions.findIndex(a => a.querySelector('.q-header.active'));
    let nextIdx = activeIdx + dir;
    if (nextIdx < 0) nextIdx = accordions.length - 1;
    if (nextIdx >= accordions.length) nextIdx = 0;

    // Close current
    if (activeIdx >= 0) {
        const activeHeader = accordions[activeIdx].querySelector('.q-header');
        const activeBody = accordions[activeIdx].querySelector('.q-body');
        activeBody?.classList.remove('open');
        activeHeader?.classList.remove('active');
        accordions[activeIdx].classList.remove('is-open');
    }

    // Open next
    const nextHeader = accordions[nextIdx].querySelector('.q-header');
    const nextBody = accordions[nextIdx].querySelector('.q-body');
    if (nextHeader && nextBody) {
        nextBody.classList.add('open');
        nextHeader.classList.add('active');
        accordions[nextIdx].classList.add('is-open');
        const stickyBarH = (document.getElementById('top-sticky-bar')?.offsetHeight || 60) + 12;
        const doScroll = () => {
            const top = nextHeader.getBoundingClientRect().top + window.scrollY - stickyBarH;
            window.scrollTo({ top, behavior: 'smooth' });
        };
        requestAnimationFrame(doScroll);
        setTimeout(doScroll, 50);
    }
}

// --------------------------------------------------------------------------
// 23. Reading Progress Tracker
// --------------------------------------------------------------------------
function updateReadingProgress() {
    const { subject, year, type } = currentState;
    if (!subject || !year || !type) return;

    const questions = allData[subject]?.questions?.[year]?.[type] || [];
    if (questions.length === 0) return;

    const readCount = questions.filter((_, i) => {
        return localStorage.getItem(`read_${subject}_${year}_${type}_${i}`) === '1';
    }).length;

    const bar = document.querySelector('.read-progress-bar-fill');
    const label = document.querySelector('.read-progress-label');
    if (bar) bar.style.width = `${(readCount / questions.length) * 100}%`;
    if (label) label.textContent = `${readCount}/${questions.length} পড়া হয়েছে`;
}

function renderReadingProgressBar() {
    const { subject, year, type } = currentState;
    const questions = allData[subject]?.questions?.[year]?.[type] || [];
    const readCount = questions.filter((_, i) =>
        localStorage.getItem(`read_${subject}_${year}_${type}_${i}`) === '1'
    ).length;

    const wrap = document.createElement('div');
    wrap.className = 'read-progress-wrap mb-3';
    wrap.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-4);flex-shrink:0"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <div class="read-progress-bar-track"><div class="read-progress-bar-fill" style="width:${questions.length > 0 ? (readCount/questions.length*100) : 0}%"></div></div>
        <span class="read-progress-label">${readCount}/${questions.length} পড়া হয়েছে</span>
    `;
    return wrap;
}

// --------------------------------------------------------------------------
// 24. Ripple Effect on Buttons
// --------------------------------------------------------------------------
function addRippleToButtons() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.neu-btn');
        if (!btn || btn.classList.contains('active')) return;
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        const rect = btn.getBoundingClientRect();
        ripple.style.left = (e.clientX - rect.left) + 'px';
        ripple.style.top = (e.clientY - rect.top) + 'px';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    });
}
function selectNoteSubject(noteSubjectKey) {
    currentState.noteSubject = noteSubjectKey;
    document.querySelectorAll('#classnotes-filters button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.key === noteSubjectKey);
    });
    renderNotes();
}

function renderNotes() {
    const display = document.getElementById('question-display');
    display.innerHTML = '';
    const { subject, noteSubject } = currentState;
    if (!subject || !noteSubject) return;

    const notes = allData[subject].subjects?.[noteSubject] || [];
    if (notes.length === 0) {
        display.innerHTML = `<div class="no-results card p-8"><div class="nr-icon">📓</div><p>এই বিষয়ের নোট পাওয়া যায়নি।</p></div>`;
        return;
    }

    notes.forEach((note, idx) => {
        const wrap = document.createElement('div');
        wrap.className = 'q-accordion mb-3 reveal-on-scroll';

        const header = document.createElement('button');
        header.className = 'q-header';
        header.innerHTML = `
            <span class="q-num-badge">${idx + 1}</span>
            <div class="flex-1 text-left">
                <div>${note.title}</div>
                ${note.date ? `<div class="text-xs text-gray-400 mt-0.5">${note.date}</div>` : ''}
            </div>
            <div class="q-chevron">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
        `;

        const body = document.createElement('div');
        body.className = 'q-body';
        const content = document.createElement('div');
        content.className = 'answer-content';
        content.innerHTML = note.content;
        sanitizeContent(content);
        body.appendChild(content);

        wrap.appendChild(header);
        wrap.appendChild(body);
        header.addEventListener('click', () => toggleAccordion(header, body));

        display.appendChild(wrap);
    });

    setTimeout(() => applyScrollAnimation('#question-display .q-accordion'), 50);
}

// --------------------------------------------------------------------------
// 17. URL Routing
// --------------------------------------------------------------------------
function updateHashFromState() {
    const { subject, year, type } = currentState;
    const params = new URLSearchParams();
    if (subject) {
        params.append('subject', subject);
        if (year) params.append('year', year);
        if (type) params.append('type', type);
    }
    window.removeEventListener('hashchange', handleHashChange);
    window.location.hash = params.toString();
    window.addEventListener('hashchange', handleHashChange);
}

function handleHashChange() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const subject = params.get('subject');
    const year = params.get('year');
    const type = params.get('type');

    if (subject && allData[subject]) {
        const subjectData = allData[subject];

        if (subjectData.isNoteCategory) {
            selectSubject(subject);
            const ns = params.get('noteSubject');
            if (ns) selectNoteSubject(ns);
            return;
        }

        currentState.subject = subject;
        currentState.year = year || String(subjectData.years[0]);
        const available = subjectData.questions?.[currentState.year] || {};
        const defaultType = available.written?.length ? 'written' : 'mcq';
        currentState.type = type || defaultType;

        hideAllSections();
        document.getElementById('filter-section').classList.remove('hidden');
        document.querySelectorAll('#subject-nav button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subject === subject);
        });

        if (subjectData.analysis?.data?.length > 0) {
            document.getElementById('chart-section').classList.remove('hidden');
            renderChart();
        }

        renderFilters();
        renderQuestions();
    } else {
        showHomePage();
    }
}
