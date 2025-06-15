/**
 * @typedef {object} Memo
 * @property {number} id
 * @property {string} title
 * @property {string} content
 * @property {string} createdAt // Store as ISO string for simplicity with JSON
 */

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

const LOCAL_STORAGE_KEY = 'js-memo-app-memos';

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
        alert("Memo title and content cannot both be empty.");
        throw new Error("Memo title and content cannot both be empty.");
    }
    return {
        id: Date.now(), // Simple unique ID
        title: title.trim(),
        content: content.trim(),
        createdAt: new Date().toISOString()
    };
}

/**
 * Adds a memo to the global state and sorts memos.
 * @param {Memo} memo
 */
function addMemoToState(memo) {
    memos.push(memo);
    sortMemos();
}

/**
 * Sorts memos by creation date (newest first).
 */
function sortMemos() {
    memos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Finds a memo by its ID.
 * @param {number} id
 * @returns {Memo|undefined}
 */
function findMemoById(id) {
    return memos.find(memo => memo.id === id);
}

/**
 * Updates an existing memo in the state.
 * @param {number} id
 * @param {string} title
 * @param {string} content
 * @returns {boolean} True if updated, false otherwise.
 */
function updateStateMemo(id, title, content) {
    const memoIndex = memos.findIndex(memo => memo.id === id);
    if (memoIndex > -1) {
        memos[memoIndex].title = title.trim();
        memos[memoIndex].content = content.trim();
        // createdAt is not updated
        return true;
    }
    return false;
}

/**
 * Deletes a memo from the state.
 * @param {number} id
 * @returns {boolean} True if deleted, false otherwise.
 */
function deleteMemoFromState(id) {
    const initialLength = memos.length;
    memos = memos.filter(memo => memo.id !== id);
    return memos.length < initialLength;
}

// --- Local Storage Persistence ---

function loadMemosFromLocalStorage() {
    const storedMemos = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedMemos) {
        try {
            memos = JSON.parse(storedMemos);
            sortMemos(); // Ensure they are sorted after loading
        } catch (e) {
            console.error("Error parsing memos from localStorage:", e);
            memos = []; // Reset to empty if parsing fails
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

    memosListDiv.innerHTML = ''; // Clear existing memos

    if (memos.length === 0) {
        memosListDiv.innerHTML = '<p>No memos yet. Create one!</p>';
        return;
    }

    const ul = document.createElement('ul');
    memos.forEach(memo => {
        const li = document.createElement('li');
        const date = new Date(memo.createdAt);
        // Display only a snippet of content
        const contentSnippet = memo.content.substring(0, 30) + (memo.content.length > 30 ? '...' : '');
        li.innerHTML = `<strong>${memo.title || 'Untitled'}</strong> - <span class="memo-date">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span><br><span class="memo-snippet">${contentSnippet}</span>`;
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
        if (createBtn) createBtn.textContent = 'New Memo';
        displayMemos(); // Re-render to highlight selected memo
    }
}

function deselectMemo() {
    selectedMemoId = null;
    clearInputFields();
    if (saveBtn) saveBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (createBtn) createBtn.textContent = 'Create Memo';
    displayMemos(); // Re-render to remove highlight
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
        const newMemo = createNewMemo(title, content);
        addMemoToState(newMemo);
        saveMemosToLocalStorage();
        displayMemos();
        selectMemoForEditing(newMemo.id); // Select the newly created memo
    } catch (error) {
        console.error("Error creating memo:", error);
        // Alert was handled in createNewMemo
    }
}

function handleSaveMemo() {
    if (selectedMemoId === null) return;

    const title = memoTitleInput.value;
    const content = memoContentTextarea.value;

    if (!title.trim() && !content.trim()) {
        alert("Memo title and content cannot both be empty for an update.");
        return;
    }

    const updated = updateStateMemo(selectedMemoId, title, content);
    if (updated) {
        saveMemosToLocalStorage();
        displayMemos(); // Re-render to show updated title/snippet and selection
        alert("Memo saved successfully!");
    } else {
        alert("Error saving memo. It might have been deleted.");
        deselectMemo();
        displayMemos();
    }
}

function handleDeleteMemo() {
    if (selectedMemoId === null) return;

    if (confirm("Are you sure you want to delete this memo?")) {
        const deleted = deleteMemoFromState(selectedMemoId);
        if (deleted) {
            saveMemosToLocalStorage();
            deselectMemo();
            displayMemos();
            alert("Memo deleted successfully.");
        } else {
            alert("Error deleting memo.");
        }
    }
}

// --- Application Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign HTML elements
    memoTitleInput = document.getElementById('memo-title');
    memoContentTextarea = document.getElementById('memo-content');
    createBtn = document.getElementById('create-btn');
    saveBtn = document.getElementById('save-btn');
    deleteBtn = document.getElementById('delete-btn');
    memosListDiv = document.getElementById('memos-list');

    if (!memoTitleInput || !memoContentTextarea || !createBtn || !saveBtn || !deleteBtn || !memosListDiv) {
        console.error("One or more HTML elements not found. Check IDs.");
        return;
    }

    // Attach event listeners
    createBtn.addEventListener('click', handleCreateMemo);
    saveBtn.addEventListener('click', handleSaveMemo);
    deleteBtn.addEventListener('click', handleDeleteMemo);

    loadMemosFromLocalStorage();
    displayMemos();
});
