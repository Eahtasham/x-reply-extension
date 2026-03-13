// content.js - Runs on X.com pages
console.log('X AI Reply Bot content script loaded');

// Track injected modals to avoid duplicate injections
let currentInjectedModal = null;

// Initialize MutationObserver for comment modal detection
function initModalObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if a dialog was added
                        const dialog = node.matches('[role="dialog"]')
                            ? node
                            : node.querySelector?.('[role="dialog"]');

                        if (dialog && !dialog.hasAttribute('data-xreply-injected')) {
                            // Small delay to ensure modal content is fully loaded
                            setTimeout(() => injectReplyWidget(dialog), 300);
                        }
                    }
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Modal observer initialized');
}

// Create and inject the reply widget into the modal
function injectReplyWidget(modal) {
    // Check if already injected
    if (modal.hasAttribute('data-xreply-injected')) {
        return;
    }

    // Find the compose area in the modal
    const composeArea = modal.querySelector('[data-testid="tweetTextarea_0"]')
        || modal.querySelector('[contenteditable="true"][role="textbox"]');

    if (!composeArea) {
        console.log('Compose area not found in modal');
        return;
    }

    // Mark as injected
    modal.setAttribute('data-xreply-injected', 'true');
    currentInjectedModal = modal;

    // Get the post text from the modal (the tweet being replied to)
    const postText = extractPostTextFromModal(modal);

    // Create the widget container
    const widget = createReplyWidget(postText, composeArea);

    // Find the right place to insert - look for the toolbar area
    const toolbarArea = modal.querySelector('[data-testid="toolBar"]')
        || modal.querySelector('[role="group"]');

    // Find a suitable insertion point - before the toolbar or after the compose area
    const composeContainer = composeArea.closest('[data-testid="tweetTextarea_0_label"]')
        || composeArea.parentElement?.parentElement?.parentElement;

    if (composeContainer && composeContainer.parentElement) {
        composeContainer.parentElement.insertBefore(widget, composeContainer.nextSibling);
    } else if (toolbarArea && toolbarArea.parentElement) {
        toolbarArea.parentElement.insertBefore(widget, toolbarArea);
    } else {
        // Fallback: append to modal
        modal.appendChild(widget);
    }

    console.log('Reply widget injected successfully');
}

// Extract the original post text from the reply modal
function extractPostTextFromModal(modal) {
    // The modal typically shows the tweet being replied to
    // Look for the tweet content in the modal
    const tweetTexts = modal.querySelectorAll('[data-testid="tweetText"]');
    if (tweetTexts.length > 0) {
        // Get the first tweet text (the one being replied to)
        return tweetTexts[0].textContent || '';
    }

    // Fallback: try to get any text content from the modal header area
    const replyingTo = modal.querySelector('[class*="r-1471scf"]'); // "Replying to" section
    if (replyingTo) {
        const parent = replyingTo.closest('div[class*="r-"]');
        if (parent) {
            return parent.textContent || '';
        }
    }

    return '';
}

// Create the reply widget UI with Shadow DOM for style isolation
function createReplyWidget(postText, composeArea) {
    const widgetHost = document.createElement('div');
    widgetHost.id = 'x-reply-widget-host';

    // Create shadow root for style encapsulation
    const shadow = widgetHost.attachShadow({ mode: 'open' });

    // Create the widget content
    shadow.innerHTML = `
        <style>
            :host {
                display: block;
                all: initial;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            
            .xreply-container {
                padding: 16px;
                border-radius: 16px;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-sizing: border-box;
                color: white;
                max-width: 600px;
            }
            
            .xreply-top-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
                gap: 12px;
                position: relative; /* For dropdown positioning */
            }

            /* Custom Dropdown Styling */
            .xreply-dropdown {
                position: relative;
                min-width: 140px;
            }

            .xreply-dropdown-trigger {
                padding: 8px 16px;
                border-radius: 20px;
                background: rgba(255, 255, 255, 0.1);
                color: rgb(231, 233, 234);
                font-size: 14px;
                cursor: pointer;
                border: 1px solid transparent;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: all 0.2s;
            }

            .xreply-dropdown-trigger:hover {
                background: rgba(255, 255, 255, 0.15);
            }

            .xreply-dropdown-trigger.active {
                border-color: rgb(29, 155, 240);
                background: rgba(29, 155, 240, 0.1);
            }

            .xreply-dropdown-menu {
                position: absolute;
                top: 100%;
                left: 0;
                margin-top: 8px;
                background: rgb(22, 24, 28); /* X dark bg */
                border: 1px solid rgb(47, 51, 54);
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                z-index: 1000;
                display: none;
                flex-direction: column;
                min-width: 160px;
                overflow: hidden;
            }

            .xreply-dropdown-menu.show {
                display: flex;
            }

            .xreply-dropdown-item {
                padding: 10px 16px;
                font-size: 14px;
                color: rgb(231, 233, 234);
                cursor: pointer;
                transition: background 0.2s;
                text-align: left;
                background: none;
                border: none;
                width: 100%;
            }

            .xreply-dropdown-item:hover {
                background: rgba(255, 255, 255, 0.05);
            }

            .xreply-dropdown-item.selected {
                color: rgb(29, 155, 240);
                font-weight: bold;
                background: rgba(29, 155, 240, 0.05);
            }
            
            .xreply-actions {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .xreply-go-btn {
                padding: 8px 20px;
                border-radius: 20px;
                border: none;
                background: rgb(29, 155, 240);
                color: white;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 8px rgba(29, 155, 240, 0.3);
            }
            
            .xreply-go-btn:hover {
                background: rgb(26, 140, 216);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(29, 155, 240, 0.4);
            }
            
            .xreply-go-btn:disabled {
                background: rgb(83, 100, 113);
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            .xreply-close-btn {
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: rgb(113, 118, 123);
                cursor: pointer;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                transition: all 0.2s;
            }

            .xreply-close-btn:hover {
                background: rgba(244, 33, 46, 0.1);
                color: rgb(244, 33, 46);
            }
            
            /* Enhanced Input */
            .xreply-custom-input {
                width: 100%;
                padding: 12px 16px;
                border-radius: 12px;
                border: 1px solid rgba(83, 100, 113, 0.5);
                background: rgba(0, 0, 0, 0.3);
                color: rgb(231, 233, 234);
                font-size: 15px;
                margin-bottom: 16px;
                box-sizing: border-box;
                transition: all 0.2s;
            }
            
            .xreply-custom-input::placeholder {
                color: rgba(113, 118, 123, 0.8);
            }
            
            .xreply-custom-input:focus {
                outline: none;
                border-color: rgb(29, 155, 240);
                background: rgba(0, 0, 0, 0.6);
                box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);
            }
            
            .xreply-types-container {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .xreply-type-btn {
                padding: 8px 14px;
                border-radius: 18px;
                border: 1px solid rgba(83, 100, 113, 0.4);
                background: transparent;
                color: rgb(231, 233, 234);
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
                font-weight: 500;
            }
            
            .xreply-type-btn:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }
            
            .xreply-type-btn.active {
                background: rgba(29, 155, 240, 0.15);
                border-color: rgb(29, 155, 240);
                color: rgb(29, 155, 240);
            }
            
            .xreply-status {
                margin-top: 12px;
                font-size: 13px;
                color: rgb(113, 118, 123);
                text-align: center;
                min-height: 20px;
                transition: color 0.3s;
            }
            
            .xreply-status.error {
                color: rgb(244, 33, 46);
            }
            
            .xreply-status.success {
                color: rgb(0, 186, 124);
            }

            /* Animations */
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .xreply-container {
                animation: fadeIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
        </style>
        
        <div class="xreply-container">
            <div class="xreply-top-row">
                <!-- Custom Dropdown -->
                <div class="xreply-dropdown" id="xreply-tone-dropdown">
                    <div class="xreply-dropdown-trigger" id="xreply-tone-trigger">
                        <span id="xreply-tone-label">Auto</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-left: 8px; opacity: 0.7;">
                            <path d="M12 15.4L6 9.4L7.4 8L12 12.6L16.6 8L18 9.4L12 15.4Z"></path>
                        </svg>
                    </div>
                    <div class="xreply-dropdown-menu" id="xreply-tone-menu">
                        <button class="xreply-dropdown-item selected" data-value="auto">Auto</button>
                        <button class="xreply-dropdown-item" data-value="condense">Condense</button>
                        <button class="xreply-dropdown-item" data-value="witty">Witty</button>
                        <button class="xreply-dropdown-item" data-value="helpful">Helpful</button>
                        <button class="xreply-dropdown-item" data-value="professional">Professional</button>
                        <button class="xreply-dropdown-item" data-value="funny">Funny</button>
                        <button class="xreply-dropdown-item" data-value="supportive">Supportive</button>
                    </div>
                </div>

                <div class="xreply-actions">
                    <button class="xreply-go-btn" id="xreply-go">Generate Reply</button>
                    <button class="xreply-close-btn" id="xreply-close" aria-label="Close widget">×</button>
                </div>
            </div>
            
            <input type="text" class="xreply-custom-input" id="xreply-custom" placeholder="Add custom instructions... (e.g. 'be sarcastic')">
            
            <div class="xreply-types-container">
                <button class="xreply-type-btn active" data-type="auto">⚡ Auto</button>
                <button class="xreply-type-btn" data-type="support">♥ Support</button>
                <button class="xreply-type-btn" data-type="agree">👍 Agree</button>
                <button class="xreply-type-btn" data-type="disagree">👎 Disagree</button>
                <button class="xreply-type-btn" data-type="congrats">🎉 Congrats</button>
                <button class="xreply-type-btn" data-type="thanks">♥ Thanks</button>
                <button class="xreply-type-btn" data-type="joke">😊 Joke</button>
                <button class="xreply-type-btn" data-type="question">❓ Ask</button>
                <button class="xreply-type-btn" data-type="excitement">🎯 Hype</button>
                <button class="xreply-type-btn" data-type="sarcastic">😏 Snark</button>
                <button class="xreply-type-btn" data-type="insightful">💡 Smart</button>
                <button class="xreply-type-btn" data-type="building">🔨 Building</button>
            </div>
            
            <div class="xreply-status" id="xreply-status"></div>
        </div>
    `;

    // Setup event listeners using shadow root
    setupWidgetListeners(shadow, postText, composeArea);

    // Stop propagation of events to prevent X's global handlers from interfering
    // This fixes the issue where clicking the dropdown or input closes the widget or loses focus
    ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'focus', 'blur'].forEach(eventType => {
        widgetHost.addEventListener(eventType, (e) => {
            e.stopPropagation();
        });
    });

    return widgetHost;
}

// Setup event listeners for the widget
function setupWidgetListeners(widget, postText, composeArea) {
    const goBtn = widget.querySelector('#xreply-go');
    const closeBtn = widget.querySelector('#xreply-close');
    const customInput = widget.querySelector('#xreply-custom');
    const typeBtns = widget.querySelectorAll('.xreply-type-btn');
    const statusDiv = widget.querySelector('#xreply-status');

    // Custom Dropdown Elements
    const toneDropdown = widget.querySelector('#xreply-tone-dropdown');
    const toneTrigger = widget.querySelector('#xreply-tone-trigger');
    const toneMenu = widget.querySelector('#xreply-tone-menu');
    const toneLabel = widget.querySelector('#xreply-tone-label');
    const toneItems = widget.querySelectorAll('.xreply-dropdown-item');

    let selectedType = 'auto';
    let selectedTone = 'auto';

    // --- Custom Dropdown Logic ---
    toneTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toneMenu.classList.toggle('show');
        toneTrigger.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    // We attach this to the *widget root* because we stopped propagation to the document.
    widget.addEventListener('click', (e) => {
        if (!toneDropdown.contains(e.target)) {
            toneMenu.classList.remove('show');
            toneTrigger.classList.remove('active');
        }
    });

    toneItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent closing widget if we had global listeners
            selectedTone = item.dataset.value;
            toneLabel.textContent = item.textContent;

            // UI Update
            toneItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');

            // Close menu
            toneMenu.classList.remove('show');
            toneTrigger.classList.remove('active');
        });
    });

    // --- Type Buttons ---
    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedType = btn.dataset.type;
        });
    });

    // --- Close Button ---
    closeBtn.addEventListener('click', () => {
        const widgetHost = document.getElementById('x-reply-widget-host');
        if (widgetHost) {
            widgetHost.remove();
        }

        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
            modal.removeAttribute('data-xreply-injected');
        }
    });

    // --- Go Button ---
    goBtn.addEventListener('click', async () => {
        goBtn.disabled = true;
        goBtn.textContent = 'Generating...';
        statusDiv.textContent = 'Thinking...';
        statusDiv.className = 'xreply-status';

        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                throw new Error('API key not set. Please set it in the extension popup.');
            }

            const customContent = customInput.value.trim();

            const reply = await generateReply(postText, apiKey, selectedTone, selectedType, customContent);

            const modal = document.querySelector('[role="dialog"]');
            let freshComposeArea = modal?.querySelector('[data-testid="tweetTextarea_0"]')
                || modal?.querySelector('[contenteditable="true"][role="textbox"]')
                || modal?.querySelector('[contenteditable="true"]');

            if (!freshComposeArea) {
                freshComposeArea = composeArea;
            }

            console.log('Generated reply:', reply);

            await insertReplyText(freshComposeArea, reply);

            const widgetHost = document.getElementById('x-reply-widget-host');
            if (widgetHost) {
                widgetHost.remove();
            }

            if (modal) {
                modal.removeAttribute('data-xreply-injected');
            }

        } catch (error) {
            console.error('Error generating reply:', error);
            statusDiv.textContent = error.message;
            statusDiv.className = 'xreply-status error';
            goBtn.disabled = false;
            goBtn.textContent = 'Generate Reply';
        }
    });
}

// Get API key from chrome storage
function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['geminiApiKey'], (result) => {
            resolve(result.geminiApiKey || null);
        });
    });
}

// Generate reply using Gemini API
async function generateReply(postText, apiKey, tone, replyType, customContent) {
    const toneInstructions = {
        auto: 'natural and contextually appropriate',
        condense: 'brief and concise, getting straight to the point',
        witty: 'witty and engaging',
        helpful: 'helpful and informative',
        professional: 'professional and respectful',
        funny: 'humorous and entertaining',
        supportive: 'supportive and encouraging'
    };

    const typeInstructions = {
        auto: 'respond naturally based on the content',
        support: 'show support and encouragement',
        agree: 'express agreement with the post',
        disagree: 'respectfully disagree or offer a different perspective',
        congrats: 'congratulate them on their achievement',
        thanks: 'express gratitude',
        joke: 'make a relevant joke or humorous comment',
        question: 'ask an interesting follow-up question',
        excitement: 'show enthusiasm and excitement',
        sarcastic: 'be playfully sarcastic (but not mean)',
        insightful: 'add an insightful observation or perspective',
        building: 'relate to their post and naturally mention that you are building OneScript - a simple tool that lets businesses add chat, support, lead capture, and automation to their website with just one script. Must mention onescript.xyz and invite them to try it out'
    };

    const toneInstruction = toneInstructions[tone] || toneInstructions.auto;
    const typeInstruction = typeInstructions[replyType] || typeInstructions.auto;

    // Special prompt for "building" type
    const isBuildingType = replyType === 'building';

    let prompt = `You are replying to a tweet as a real person. READ THE TWEET CAREFULLY.

TWEET: "${postText}"
${customContent ? `\nUser's direction: "${customContent}"` : ''}

CRITICAL - Understand the tweet first:
- If they're sharing a PROBLEM/frustration → empathize or relate (NEVER say "congrats" or "awesome")
- If they're celebrating success → congratulate genuinely
- If they're asking a question → engage with the question
- If they're venting/complaining → show understanding, don't be dismissive
- If it's a joke → laugh along

TASK:
Write a reply under 280 characters.
Reply style: ${typeInstruction}

GUIDELINES:
1. IMPERFECTION IS GOOD: Start with lowercase sometimes. Sound like a busy human on their phone.
2. TONE: ${toneInstruction}. No bot-like transition words.
3. RELEVANCE: Directly address what they said. Match the mood - don't give mismatched responses!
4. VALUE: Add insight that makes sense for their message.
5. FORMAT: Short sentences. No hashtags. Max 1 emoji.
6. ENDING: End with "Let's connect and FB!" when it fits naturally.
7. LENGTH: Under 280 chars. 
${isBuildingType ? '8. IMPORTANT: Naturally mention you are building OneScript - a simple tool for website automation (chat, support, leads) with just one script. Try it at onescript.xyz' : ''}
`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                maxOutputTokens: 100,
                temperature: 0.7
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error('API error: ' + (error.error?.message || 'Unknown error'));
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text.trim();
    } else {
        throw new Error('Invalid API response');
    }
}

// Insert reply text into the compose area
async function insertReplyText(composeArea, text) {
    console.log('Attempting to insert text into:', composeArea);

    // Scroll the compose area into view
    composeArea.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(100);

    // Focus the element
    composeArea.focus();
    await sleep(100);

    // Clear any existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composeArea);
    selection.removeAllRanges();
    selection.addRange(range);

    await sleep(50);

    // Try multiple methods to insert text

    // Method 1: Use DataTransfer (simulates paste)
    try {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer
        });

        composeArea.dispatchEvent(pasteEvent);
        await sleep(100);

        if (composeArea.textContent.includes(text.substring(0, 20))) {
            console.log('Paste method succeeded');
            dispatchReactEvents(composeArea, text);
            return;
        }
    } catch (e) {
        console.log('Paste method failed:', e);
    }

    // Method 2: execCommand insertText
    try {
        composeArea.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(50);

        const success = document.execCommand('insertText', false, text);
        if (success && composeArea.textContent.trim().length > 0) {
            console.log('execCommand method succeeded');
            dispatchReactEvents(composeArea, text);
            return;
        }
    } catch (e) {
        console.log('execCommand method failed:', e);
    }

    // Method 3: Direct innerHTML manipulation with span (mimics X's structure)
    try {
        // X uses spans inside the contenteditable
        const span = document.createElement('span');
        span.setAttribute('data-text', 'true');
        span.textContent = text;

        composeArea.innerHTML = '';
        composeArea.appendChild(span);

        console.log('Direct manipulation method used');
        dispatchReactEvents(composeArea, text);
        return;
    } catch (e) {
        console.log('Direct manipulation failed:', e);
    }

    // Method 4: Last resort - set textContent
    composeArea.textContent = text;
    dispatchReactEvents(composeArea, text);
    console.log('Fallback textContent method used');
}

// Dispatch events to trigger React state update
function dispatchReactEvents(element, text) {
    // Input event
    element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
    }));

    // beforeinput event
    element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
    }));

    // textInput event (legacy)
    const textInputEvent = new Event('textInput', { bubbles: true });
    textInputEvent.data = text;
    element.dispatchEvent(textInputEvent);

    // change event
    element.dispatchEvent(new Event('change', { bubbles: true }));

    // Key events
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Unidentified' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize on page load
initModalObserver();

// ============================================
// Original popup-based functionality (kept for backward compatibility)
// ============================================

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request.action);

    if (request.action === 'getPosts') {
        try {
            const posts = extractPosts();
            console.log('Posts extracted:', posts.length);
            sendResponse({ posts: posts });
        } catch (error) {
            console.error('Error extracting posts:', error);
            sendResponse({ posts: [] });
        }
    }

    if (request.action === 'generateAndReply') {
        console.log('Starting generateAndReply for post:', request.postId);
        generateAndReplyToPost(request.postId, request.postText, request.geminiApiKey, sendResponse);
        return true;
    }
});

function extractPosts() {
    const posts = [];

    let postElements = document.querySelectorAll('article[data-testid="tweet"]');

    if (postElements.length === 0) {
        postElements = document.querySelectorAll('article');
    }

    console.log('Post elements found:', postElements.length);

    postElements.forEach((element, index) => {
        try {
            const textContent = element.innerText || element.textContent;

            if (!textContent || textContent.trim().length === 0) {
                return;
            }

            const userLink = element.querySelector('a[href*="/"]');
            let username = 'unknown';

            if (userLink) {
                const href = userLink.getAttribute('href');
                if (href) {
                    const parts = href.split('/').filter(x => x.length > 0);
                    username = parts[parts.length - 1];
                }
            }

            const postId = `post-${Date.now()}-${index}`;
            element.setAttribute('data-x-reply-id', postId);

            const postText = textContent.substring(0, 500).trim();

            posts.push({
                id: postId,
                text: postText,
                username: username
            });
        } catch (error) {
            console.error('Error processing post:', error);
        }
    });

    return posts.slice(0, 10);
}

async function generateAndReplyToPost(postId, postText, geminiApiKey, sendResponse) {
    try {
        console.log('Step 1: Finding target post');

        const postElement = document.querySelector(`article[data-x-reply-id="${postId}"]`);

        if (!postElement) {
            throw new Error('Could not find the original post. Please refresh the posts list.');
        }

        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);

        console.log('Step 2: Getting settings');

        const settings = await getSettings();
        const tone = settings.tone || 'witty';
        console.log('Tone:', tone);

        console.log('Step 3: Calling Gemini API');
        const aiReply = await callGeminiAPI(postText, geminiApiKey, tone);
        console.log('Reply generated:', aiReply);

        console.log('Step 4: Clicking reply button');

        const replyButton = postElement.querySelector('[data-testid="reply"]');

        if (!replyButton) {
            throw new Error('Reply button not found on this post.');
        }

        replyButton.click();

        await sleep(1000);

        console.log('Step 5: Finding reply modal textarea');

        let replyBox = document.querySelector('[data-testid="tweetTextarea_0"]');

        if (!replyBox) {
            replyBox = document.querySelector('[contenteditable="true"][role="textbox"]');
        }

        if (!replyBox) {
            const modal = document.querySelector('[role="dialog"]');
            if (modal) {
                replyBox = modal.querySelector('[contenteditable="true"]');
            }
        }

        if (!replyBox) {
            throw new Error('Reply modal did not open or textarea not found.');
        }

        console.log('Step 6: Inserting reply text');
        replyBox.focus();

        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);

        await sleep(100);

        const success = document.execCommand('insertText', false, aiReply);

        if (!success || replyBox.textContent.trim() === '') {
            console.log('execCommand failed, trying fallback method');
            replyBox.textContent = aiReply;
        }

        const textInputEvent = new InputEvent('textInput', {
            bubbles: true,
            cancelable: true,
            data: aiReply,
            inputType: 'insertText'
        });
        replyBox.dispatchEvent(textInputEvent);

        const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: aiReply
        });
        replyBox.dispatchEvent(inputEvent);

        replyBox.dispatchEvent(new Event('change', { bubbles: true }));

        replyBox.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
        replyBox.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'a' }));
        replyBox.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));

        await sleep(800);

        console.log('Step 7: Finding send button');
        const sendButton = findSendButton();

        if (!sendButton) {
            throw new Error('Send button not found in modal.');
        }

        console.log('Step 8: Clicking send button');
        sendButton.click();

        await sleep(2000);

        console.log('Step 9: Success! Reply posted');

        sendResponse({
            success: true,
            reply: aiReply
        });

    } catch (error) {
        console.error('Error in generateAndReplyToPost:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

function findSendButton() {
    const modal = document.querySelector('[role="dialog"]');
    let context = modal || document;

    let button = context.querySelector('button[data-testid="tweetButton"]');
    if (button && isVisible(button)) return button;

    button = context.querySelector('button[aria-label="Post"]');
    if (button && isVisible(button)) return button;

    button = context.querySelector('button[aria-label="Reply"]');
    if (button && isVisible(button)) return button;

    button = context.querySelector('button[aria-label="post"]');
    if (button && isVisible(button)) return button;

    const allButtons = context.querySelectorAll('button');
    for (let btn of allButtons) {
        const text = btn.textContent.toLowerCase();
        if ((text.includes('post') || text.includes('reply')) && isVisible(btn) && btn.offsetHeight > 20) {
            return btn;
        }
    }

    return null;
}

function isVisible(element) {
    return element.offsetParent !== null && element.offsetHeight > 0;
}

async function callGeminiAPI(postText, apiKey, tone = 'witty') {
    const toneInstructions = {
        witty: 'witty and engaging',
        helpful: 'helpful and informative',
        professional: 'professional and respectful',
        funny: 'humorous and entertaining',
        supportive: 'supportive and encouraging'
    };

    const instruction = toneInstructions[tone] || 'witty and engaging';

    console.log('Calling Gemini API with tone:', instruction);

    const prompt = `You are a helpful, practical, founder-minded assistant.
    
    CONTEXT:
    The user posted this text: "${postText}"
    
    TASK:
    Write a reply strictly under 280 characters that directly addresses the specific topic of the post.
    
    GUIDELINES:
    1. RELEVANCE FIRST: If it's a meme, be witty/relatable. If it's code, offer feedback/praise. If it's a question, answer it. Do NOT force "build in public" advice if it doesn't fit the topic.
    2. TONE: ${instruction} (but keep it grounded and realistic).
    3. VALUE: Add a specific insight, a quick tip, or a validating comment related to their specific struggle or win.
    4. FORMAT: Short sentences. No fluff. No hashtags.
    5. Add "Let's Connect" keyword whenever possible.
    
    Example of good behavior:
    - Input: "My database is down again."
    - Output: "Ouch. The Friday deploy curse? Check your connection pool limits, that's usually the silent killer. Good luck fixing it! Let's Connect"
    `;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                maxOutputTokens: 100,
                temperature: 0.7
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error('Gemini API error: ' + (error.error?.message || 'Unknown error'));
    }

    const data = await response.json();
    console.log('Gemini API response:', data);

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('Invalid Gemini API response: ' + JSON.stringify(data));
    }
}

function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['replySettings'], (result) => {
            resolve(result.replySettings || { tone: 'witty' });
        });
    });
}