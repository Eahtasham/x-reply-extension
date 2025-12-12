let currentTab = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup loaded');

    // Get current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        currentTab = tabs[0];
        console.log('Current tab:', currentTab.url);

        loadSavedApiKey();
        loadSavedSettings();

        // Only load posts if on X.com or twitter.com
        if (currentTab.url.includes('x.com') || currentTab.url.includes('twitter.com')) {
            loadPosts();
        } else {
            document.getElementById('postsList').innerHTML = '<p class="loading-text">⚠️ Please open this extension on X.com or Twitter.com</p>';
        }
    });

    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('saveKey').addEventListener('click', saveApiKey);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);

    document.getElementById('filterKeywords').addEventListener('change', (e) => {
        document.getElementById('keywords').classList.toggle('hidden-input', !e.target.checked);
    });

    document.getElementById('filterAccounts').addEventListener('change', (e) => {
        document.getElementById('accounts').classList.toggle('hidden-input', !e.target.checked);
    });
}

function saveApiKey() {
    const apiKey = document.getElementById('geminiKey').value;
    if (apiKey.trim()) {
        chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
            showStatus('✓ API Key saved!', 'success');
        });
    } else {
        showStatus('⚠️ Please enter an API key', 'error');
    }
}

function loadSavedApiKey() {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            document.getElementById('geminiKey').value = result.geminiApiKey;
        }
    });
}

function loadSavedSettings() {
    chrome.storage.sync.get(['replySettings'], (result) => {
        if (result.replySettings) {
            const settings = result.replySettings;
            document.getElementById('autoReply').checked = settings.autoReply || false;
            document.getElementById('filterKeywords').checked = settings.filterKeywords || false;
            document.getElementById('keywords').value = settings.keywords || '';
            document.getElementById('filterAccounts').checked = settings.filterAccounts || false;
            document.getElementById('accounts').value = settings.accounts || '';
            document.getElementById('tone').value = settings.tone || 'witty';

            document.getElementById('keywords').classList.toggle('hidden-input', !settings.filterKeywords);
            document.getElementById('accounts').classList.toggle('hidden-input', !settings.filterAccounts);
        }
    });
}

function saveSettings() {
    const settings = {
        autoReply: document.getElementById('autoReply').checked,
        filterKeywords: document.getElementById('filterKeywords').checked,
        keywords: document.getElementById('keywords').value,
        filterAccounts: document.getElementById('filterAccounts').checked,
        accounts: document.getElementById('accounts').value,
        tone: document.getElementById('tone').value
    };

    chrome.storage.sync.set({ replySettings: settings }, () => {
        showStatus('✓ Settings saved!', 'success');
    });
}

function loadPosts() {
    const postsList = document.getElementById('postsList');
    postsList.innerHTML = '<p class="loading-text">Loading posts...</p>';

    if (!currentTab) {
        postsList.innerHTML = '<p class="loading-text">Error: No active tab</p>';
        return;
    }

    console.log('Sending getPosts message to tab:', currentTab.id);

    chrome.tabs.sendMessage(currentTab.id, { action: 'getPosts' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            postsList.innerHTML = '<p class="loading-text">⚠️ Error loading posts. Make sure you\'re on X.com and try refreshing the page.</p>';
        } else if (response && response.posts && response.posts.length > 0) {
            console.log('Posts received:', response.posts.length);
            displayPosts(response.posts);
        } else {
            postsList.innerHTML = '<p class="loading-text">No posts found. Try scrolling down the feed.</p>';
        }
    });
}

function displayPosts(posts) {
    const postsList = document.getElementById('postsList');
    postsList.innerHTML = '';

    if (posts.length === 0) {
        postsList.innerHTML = '<p class="loading-text">No posts found</p>';
        return;
    }

    posts.forEach((post, index) => {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-item';

        const usernameDiv = document.createElement('div');
        usernameDiv.className = 'post-username';
        usernameDiv.textContent = '@' + (post.username || 'unknown');

        const textDiv = document.createElement('div');
        textDiv.className = 'post-text';
        textDiv.textContent = post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '');

        const button = document.createElement('button');
        button.className = 'post-reply-btn';
        button.textContent = 'Generate Reply';
        button.dataset.postId = post.id;
        button.dataset.postText = post.text;
        button.dataset.index = index;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleReply(button, post.id, post.text);
        });

        postDiv.appendChild(usernameDiv);
        postDiv.appendChild(textDiv);
        postDiv.appendChild(button);
        postsList.appendChild(postDiv);
    });
}

function handleReply(button, postId, postText) {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
        if (!result.geminiApiKey) {
            showStatus('⚠️ Please set your Gemini API key first', 'error');
            return;
        }

        button.disabled = true;
        button.textContent = 'Posting...';
        showStatus('⏳ Generating and posting reply...', 'success');

        console.log('Sending generateAndReply message');

        chrome.tabs.sendMessage(currentTab.id, {
            action: 'generateAndReply',
            postId: postId,
            postText: postText,
            geminiApiKey: result.geminiApiKey
        }, (response) => {
            button.disabled = false;
            button.textContent = 'Generate Reply';

            if (chrome.runtime.lastError) {
                console.error('Send message error:', chrome.runtime.lastError);
                showStatus('✗ Error: ' + chrome.runtime.lastError.message, 'error');
            } else if (response && response.success) {
                showStatus('✓ Reply posted successfully!', 'success');
            } else {
                showStatus('✗ Error: ' + (response ? response.error : 'Unknown error'), 'error');
            }
        });
    });
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = 'status show ' + type;

    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
    }, 5000);
}