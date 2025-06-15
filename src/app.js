/**
 * @typedef {object} Memo
 * @property {number} id
 * @property {string} title
 * @property {string} content
 * @property {string} createdAt // Store as ISO string for simplicity with JSON
 */

// --- START I18N ---
/** @type {Record<string, string>} */
let currentTranslations = {};
let currentLang = 'ja'; // Default language
const supportedLangs = ['ja', 'en'];
// --- END I18N ---

// Global state
/** @type {Memo[]} */
let memos = [];
let selectedMemoId = null;

// HTML Element References
let memoTitleInput;
let memoContentTextarea;
let createBtn;
let saveBtn;
let deleteBtn;
let memosListDiv;
let appTitleH1; // For app title translation

// AI Chat Elements
let aiChatTitleH2;
let aiQuestionInput;
let aiAskBtn;
let aiResponseArea;
let aiResponsePlaceholderP; // Reference to the placeholder <p>

const LOCAL_STORAGE_KEY = 'js-memo-app-memos';
const LANG_STORAGE_KEY = 'js-memo-app-lang';


// --- I18N Functions ---
async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load ${lang}.json`);
        }
        currentTranslations = await response.json();
        currentLang = lang;
        localStorage.setItem(LANG_STORAGE_KEY, lang);
        console.log(`Translations loaded for ${lang}:`, currentTranslations);
        applyTranslationsToStaticElements();
        displayMemos(); // Re-render memos in case "No memos" text needs update or future per-memo translations
    } catch (error) {
        console.error("Error loading translations:", error);
        if (lang !== 'ja') { // Fallback to Japanese if selected lang fails, unless 'ja' itself failed
            console.warn("Falling back to Japanese translations.");
            await loadTranslations('ja');
        } else {
            // If Japanese fails, use hardcoded English as a last resort (or just parts of it)
            currentTranslations = { // Basic fallback
                "appTitle": "Memo Pad (Error)",
                "memoTitlePlaceholder": "Memo Title",
                "memoContentPlaceholder": "Memo Content",
                "createMemoButton": "Create Memo",
                "noMemos": "No memos yet. Create one!",
                "untitledMemoFallback": "Untitled"
                // Add other critical keys if needed
            };
            currentLang = 'en'; // Indicate that we fell back to a form of English
            applyTranslationsToStaticElements();
            displayMemos();
        }
    }
}

function getLocalizedString(key, ...args) {
    let str = currentTranslations[key] || key; // Return key if string not found
    if (args.length > 0) {
        // Basic placeholder replacement, e.g., "Hello {0}"
        args.forEach((arg, index) => {
            str = str.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
        });
    }
    return str;
}

function applyTranslationsToStaticElements() {
    if (appTitleH1) appTitleH1.textContent = getLocalizedString('appTitle');
    if (memoTitleInput) memoTitleInput.placeholder = getLocalizedString('memoTitlePlaceholder');
    if (memoContentTextarea) memoContentTextarea.placeholder = getLocalizedString('memoContentPlaceholder');

    // Update button texts based on current state
    if (createBtn) {
        if (selectedMemoId !== null) {
            createBtn.textContent = getLocalizedString('newMemoButton');
        } else {
            createBtn.textContent = getLocalizedString('createMemoButton');
        }
    }
    if (saveBtn) saveBtn.textContent = getLocalizedString('saveMemoButton');
    if (deleteBtn) deleteBtn.textContent = getLocalizedString('deleteMemoButton');

    // Add translations for AI section
    if (aiChatTitleH2) aiChatTitleH2.textContent = getLocalizedString('aiChatTitle');
    if (aiQuestionInput) aiQuestionInput.placeholder = getLocalizedString('aiQuestionPlaceholder');
    if (aiAskBtn) aiAskBtn.textContent = getLocalizedString('aiAskButton');

    // Only set the placeholder text if no actual AI response has been rendered yet.
    // We can check if aiResponseArea only contains the placeholder paragraph.
    if (aiResponsePlaceholderP && aiResponseArea.contains(aiResponsePlaceholderP) && aiResponseArea.children.length === 1) {
         aiResponsePlaceholderP.textContent = getLocalizedString('aiResponsePlaceholder');
    }
}

function determineInitialLanguage() {
    const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
    if (savedLang && supportedLangs.includes(savedLang)) {
        return savedLang;
    }

    const browserLang = navigator.language.split('-')[0];
    if (supportedLangs.includes(browserLang)) {
        return browserLang;
    }

    return 'ja'; // Default
}

// --- Dummy AI Service ---
/**
 * Simulates an AI response based on memos and a question.
 * @param {string} question The user's question.
 * @param {Memo[]} currentMemos An array of current memo objects.
 * @returns {string} A simulated AI response.
 */
function getAIDummyResponse(question, currentMemos) {
    const genericIntro = getLocalizedString('aiDummyIntro', "This is a DUMMY AI response."); // New localization key
    const questionLower = question.toLowerCase().trim();

    if (!questionLower) {
        return `${genericIntro} ${getLocalizedString('aiDummyEmptyQuestion', "You didn't ask anything!")}`; // New localization key
    }

    // Simple keyword extraction (words longer than 3 chars)
    const keywords = questionLower.split(' ').filter(word => word.length > 3);

    if (keywords.length === 0 && questionLower.length > 0) {
         // If question is short and has no real keywords (e.g. "hi", "test")
        return `${genericIntro} ${getLocalizedString('aiDummyShortQuestion', "Your question is a bit short. Try asking something more specific about your memos.")} Your question was: "${question}"`; // New localization key
    }

    for (const memo of currentMemos) {
        const memoTitleLower = memo.title.toLowerCase();
        const memoContentLower = memo.content.toLowerCase();

        for (const keyword of keywords) {
            if (memoTitleLower.includes(keyword) || memoContentLower.includes(keyword)) {
                const snippet = memo.content.substring(0, 100) + (memo.content.length > 100 ? '...' : '');
                // Using string templates for easier construction here, will need localization keys for the template parts.
                // For now, let's make the response template simpler and add more keys.
                // "Based on your memo titled '{0}', I can share this snippet: '{1}'."
                const responseTemplate = getLocalizedString('aiDummyFoundResponse', "Based on your memo titled '{0}', I can share this snippet: '{1}'. Remember, I'm just a dummy AI for now!");
                return `${genericIntro} ${responseTemplate.replace('{0}', memo.title || getLocalizedString('untitledMemoFallback', 'Untitled')).replace('{1}', snippet)}`;
            }
        }
    }

    // If no keywords matched or no memos searched
    const notFoundTemplate = getLocalizedString('aiDummyNotFoundResponse', "I've scanned your memos but couldn't find specific information related to your question: '{0}'. Please try rephrasing. Remember, I'm a dummy AI.");
    return `${genericIntro} ${notFoundTemplate.replace('{0}', question)}`;
}

// --- Core Memo Logic ---

/**
 * Creates a new memo object.
 * @param {string} title
 * @param {string} content
 * @returns {Memo}
 * @throws {Error} if title and content are empty.
 */
function createNewMemo(title, content) {
    if (!title.trim() && !content.trim()) {
        alert(getLocalizedString('errorEmptyMemo')); // MODIFIED
        throw new Error("Memo title and content cannot both be empty.");
    }
    return {
        id: Date.now(),
        title: title.trim(),
        content: content.trim(),
        createdAt: new Date().toISOString()
    };
}

// --- Local Storage Persistence ---

function loadMemosFromLocalStorage() {
    const storedMemos = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedMemos) {
        try {
            memos = JSON.parse(storedMemos);
            sortMemos();
        } catch (e) {
            console.error("Error parsing memos from localStorage:", e);
            memos = [];
        }
    } else {
        memos = [];
    }
}

function saveMemosToLocalStorage() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(memos));
}

// --- DOM Manipulation & UI Rendering ---

function displayMemos() {
    if (!memosListDiv) return;
    memosListDiv.innerHTML = '';

    if (memos.length === 0) {
        memosListDiv.innerHTML = `<p>${getLocalizedString('noMemos')}</p>`; // MODIFIED
        return;
    }

    const ul = document.createElement('ul');
    memos.forEach(memo => {
        const li = document.createElement('li');
        const date = new Date(memo.createdAt);
        const contentSnippet = memo.content.substring(0, 30) + (memo.content.length > 30 ? '...' : '');
        li.innerHTML = `<strong>${memo.title || getLocalizedString('untitledMemoFallback', 'Untitled')}</strong> - <span class="memo-date">${date.toLocaleDateString(currentLang)} ${date.toLocaleTimeString(currentLang)}</span><br><span class="memo-snippet">${contentSnippet}</span>`;
        li.dataset.id = memo.id.toString();
        li.addEventListener('click', () => selectMemoForEditing(memo.id));

        if (selectedMemoId === memo.id) {
            li.classList.add('selected');
        }
        ul.appendChild(li);
    });
    memosListDiv.appendChild(ul);
}

function clearInputFields() {
    if (memoTitleInput) memoTitleInput.value = '';
    if (memoContentTextarea) memoContentTextarea.value = '';
}

function populateInputFields(memo) {
    if (memoTitleInput) memoTitleInput.value = memo.title;
    if (memoContentTextarea) memoContentTextarea.value = memo.content;
}

function selectMemoForEditing(id) {
    const memo = findMemoById(id);
    if (memo) {
        selectedMemoId = id;
        populateInputFields(memo);
        if (saveBtn) saveBtn.style.display = 'inline-block';
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        if (createBtn) createBtn.textContent = getLocalizedString('newMemoButton'); // MODIFIED
        displayMemos();
    }
}

function deselectMemo() {
    selectedMemoId = null;
    clearInputFields();
    if (saveBtn) saveBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (createBtn) createBtn.textContent = getLocalizedString('createMemoButton'); // MODIFIED
    displayMemos();
}

// --- Event Handlers ---

function handleCreateMemo() {
    if (selectedMemoId !== null) {
        deselectMemo();
        return;
    }

    const title = memoTitleInput.value;
    const content = memoContentTextarea.value;
    try {
        const newMemo = createNewMemo(title, content); // Error alert is now translated
        addMemoToState(newMemo);
        saveMemosToLocalStorage();
        displayMemos();
        selectMemoForEditing(newMemo.id);
    } catch (error) {
        console.error("Error creating memo:", error);
    }
}

function handleSaveMemo() {
    if (selectedMemoId === null) return;

    const title = memoTitleInput.value;
    const content = memoContentTextarea.value;

    if (!title.trim() && !content.trim()) {
        alert(getLocalizedString('errorEmptyMemo')); // MODIFIED
        return;
    }

    const updated = updateStateMemo(selectedMemoId, title, content);
    if (updated) {
        saveMemosToLocalStorage();
        displayMemos();
        alert(getLocalizedString('alertMemoSaved')); // MODIFIED
    } else {
        alert(getLocalizedString('alertErrorSaving')); // MODIFIED
        deselectMemo();
        displayMemos();
    }
}

function handleDeleteMemo() {
    if (selectedMemoId === null) return;

    if (confirm(getLocalizedString('confirmDeleteMemo'))) { // MODIFIED
        const deleted = deleteMemoFromState(selectedMemoId);
        if (deleted) {
            saveMemosToLocalStorage();
            deselectMemo();
            displayMemos();
            alert(getLocalizedString('alertMemoDeleted')); // MODIFIED
        } else {
            alert(getLocalizedString('alertErrorDeleting')); // MODIFIED
        }
    }
}

async function handleAskAI() { // Make it async if AI service might become async
    if (!aiQuestionInput || !aiResponseArea) return;

    const question = aiQuestionInput.value.trim();
    // getAIDummyResponse will handle empty question, providing a translated message.

    // Display the response
    aiResponseArea.innerHTML = ''; // Clear previous content, including the placeholder
    const responseParagraph = document.createElement('p');
    // The dummy response already includes "This is a dummy AI..." or similar from its own localization.
    responseParagraph.textContent = getAIDummyResponse(question, memos); // memos is the global array
    aiResponseArea.appendChild(responseParagraph);

    // Optional: Clear the question input
    // aiQuestionInput.value = '';
}

// --- Application Initialization ---
document.addEventListener('DOMContentLoaded', async () => { // MODIFIED to be async
    // Assign HTML elements
    appTitleH1 = document.querySelector('#app-container h1'); // Assign app title
    memoTitleInput = document.getElementById('memo-title');
    memoContentTextarea = document.getElementById('memo-content');
    createBtn = document.getElementById('create-btn');
    saveBtn = document.getElementById('save-btn');
    deleteBtn = document.getElementById('delete-btn');
    memosListDiv = document.getElementById('memos-list');

    // Assign AI Chat Elements
    aiChatTitleH2 = document.getElementById('ai-chat-title');
    aiQuestionInput = document.getElementById('ai-question-input');
    aiAskBtn = document.getElementById('ai-ask-btn');
    aiResponseArea = document.getElementById('ai-response-area');
    aiResponsePlaceholderP = document.getElementById('ai-response-placeholder');


    if (!memoTitleInput || !memoContentTextarea || !createBtn || !saveBtn || !deleteBtn || !memosListDiv || !appTitleH1 ||
        !aiChatTitleH2 || !aiQuestionInput || !aiAskBtn || !aiResponseArea || !aiResponsePlaceholderP) { // Added AI elements to check
        console.error("One or more HTML elements not found. Check IDs/selectors.");
        document.body.innerHTML = "Error: Could not initialize application. Critical HTML elements missing.";
        return;
    }

    // Attach event listeners
    createBtn.addEventListener('click', handleCreateMemo);
    saveBtn.addEventListener('click', handleSaveMemo);
    deleteBtn.addEventListener('click', handleDeleteMemo);
    aiAskBtn.addEventListener('click', handleAskAI); // Attach AI Ask button listener

    // Initial language load
    const initialLang = determineInitialLanguage();
    await loadTranslations(initialLang);

    loadMemosFromLocalStorage();
    // displayMemos() is called within loadTranslations, but calling again here ensures
    // memos are displayed even if translations somehow failed but memos loaded.
    // It's also called after applyTranslationsToStaticElements inside loadTranslations.
    // If loadTranslations handles all necessary UI updates including memos, this specific call might be redundant.
    // However, for robustness, ensuring displayMemos is called after initial setup is fine.
    displayMemos();
});

// Functions from original app.js that are mostly unchanged but included for completeness
function addMemoToState(memo) {
    memos.push(memo);
    sortMemos();
}

function sortMemos() {
    memos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function findMemoById(id) {
    return memos.find(memo => memo.id === id);
}

function updateStateMemo(id, title, content) {
    const memoIndex = memos.findIndex(memo => memo.id === id);
    if (memoIndex > -1) {
        memos[memoIndex].title = title.trim();
        memos[memoIndex].content = content.trim();
        return true;
    }
    return false;
}

function deleteMemoFromState(id) {
    const initialLength = memos.length;
    memos = memos.filter(memo => memo.id !== id);
    return memos.length < initialLength;
}
