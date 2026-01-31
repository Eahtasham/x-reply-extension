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
                padding: 12px 16px;
                border-top: 1px solid rgb(47, 51, 54);
                background: rgb(0, 0, 0);
                box-sizing: border-box;
            }
            
            .xreply-top-row {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 8px;
                margin-bottom: 10px;
            }
            
            .xreply-tone-select {
                padding: 6px 12px;
                border-radius: 20px;
                border: 1px solid rgb(83, 100, 113);
                background: transparent;
                color: rgb(231, 233, 234);
                font-size: 14px;
                cursor: pointer;
                min-width: 120px;
            }
            
            .xreply-tone-select:focus {
                outline: none;
                border-color: rgb(29, 155, 240);
            }
            
            .xreply-go-btn {
                padding: 6px 16px;
                border-radius: 20px;
                border: none;
                background: rgb(29, 155, 240);
                color: white;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .xreply-go-btn:hover {
                background: rgb(26, 140, 216);
            }
            
            .xreply-go-btn:disabled {
                background: rgb(83, 100, 113);
                cursor: not-allowed;
            }

            .xreply-close-btn {
                background: transparent;
                border: none;
                color: rgb(113, 118, 123);
                cursor: pointer;
                font-size: 20px;
                padding: 4px 8px;
                line-height: 1;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s, color 0.2s;
                margin-left: 4px;
            }

            .xreply-close-btn:hover {
                background: rgba(239, 243, 244, 0.1);
                color: rgb(239, 243, 244);
            }
            
            .xreply-custom-input {
                width: 100%;
                padding: 10px 12px;
                border-radius: 16px;
                border: 1px solid rgb(83, 100, 113);
                background: transparent;
                color: rgb(231, 233, 234);
                font-size: 14px;
                margin-bottom: 10px;
                box-sizing: border-box;
            }
            
            .xreply-custom-input::placeholder {
                color: rgb(113, 118, 123);
            }
            
            .xreply-custom-input:focus {
                outline: none;
                border-color: rgb(29, 155, 240);
            }
            
            .xreply-types-container {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .xreply-type-btn {
                padding: 6px 12px;
                border-radius: 20px;
                border: 1px solid rgb(83, 100, 113);
                background: transparent;
                color: rgb(231, 233, 234);
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .xreply-type-btn:hover {
                background: rgba(29, 155, 240, 0.1);
                border-color: rgb(29, 155, 240);
            }
            
            .xreply-type-btn.active {
                background: rgba(29, 155, 240, 0.2);
                border-color: rgb(29, 155, 240);
                color: rgb(29, 155, 240);
            }
            
            .xreply-status {
                margin-top: 8px;
                font-size: 12px;
                color: rgb(113, 118, 123);
                text-align: center;
            }
            
            .xreply-status.error {
                color: rgb(244, 33, 46);
            }
            
            .xreply-status.success {
                color: rgb(0, 186, 124);
            }
        </style>
        
        <div class="xreply-container">
            <div class="xreply-top-row">
                <select class="xreply-tone-select" id="xreply-tone">
                    <option value="auto">Auto</option>
                    <option value="condense">Condense</option>
                    <option value="witty">Witty</option>
                    <option value="helpful">Helpful</option>
                    <option value="professional">Professional</option>
                    <option value="funny">Funny</option>
                    <option value="supportive">Supportive</option>
                </select>
                <button class="xreply-go-btn" id="xreply-go">Go</button>
                <button class="xreply-close-btn" id="xreply-close" aria-label="Close widget">×</button>
            </div>
            
            <input type="text" class="xreply-custom-input" id="xreply-custom" placeholder="Custom reply content (optional)">
            
            <div class="xreply-types-container">
                <button class="xreply-type-btn active" data-type="auto">⚡ Auto</button>
                <button class="xreply-type-btn" data-type="support">♥ Support</button>
                <button class="xreply-type-btn" data-type="agree">👍 Agree</button>
                <button class="xreply-type-btn" data-type="disagree">👎 Disagree</button>
                <button class="xreply-type-btn" data-type="congrats">🎉 Congrats</button>
                <button class="xreply-type-btn" data-type="thanks">♥ Thanks</button>
                <button class="xreply-type-btn" data-type="joke">😊 Joke</button>
                <button class="xreply-type-btn" data-type="question">❓ Question</button>
                <button class="xreply-type-btn" data-type="excitement">🎯 Excitement</button>
                <button class="xreply-type-btn" data-type="sarcastic">😏 Sarcastic</button>
                <button class="xreply-type-btn" data-type="insightful">💡 Insightful</button>
                <button class="xreply-type-btn" data-type="building">🔨 Building</button>
            </div>
            
            <div class="xreply-status" id="xreply-status"></div>
        </div>
    `;

    // Setup event listeners using shadow root
    setupWidgetListeners(shadow, postText, composeArea);

    return widgetHost;
}

// Setup event listeners for the widget
function setupWidgetListeners(widget, postText, composeArea) {
    const goBtn = widget.querySelector('#xreply-go');
    const closeBtn = widget.querySelector('#xreply-close');
    const toneSelect = widget.querySelector('#xreply-tone');
    const customInput = widget.querySelector('#xreply-custom');
    const typeBtns = widget.querySelectorAll('.xreply-type-btn');
    const statusDiv = widget.querySelector('#xreply-status');

    let selectedType = 'auto';

    // Type button selection
    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedType = btn.dataset.type;
        });
    });

    // Close button click
    closeBtn.addEventListener('click', () => {
        const widgetHost = document.getElementById('x-reply-widget-host');
        if (widgetHost) {
            widgetHost.remove();
        }

        // Clear injection marker
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
            modal.removeAttribute('data-xreply-injected');
        }
    });

    // Go button click
    goBtn.addEventListener('click', async () => {
        goBtn.disabled = true;
        goBtn.textContent = '...';
        statusDiv.textContent = 'Generating reply...';
        statusDiv.className = 'xreply-status';

        try {
            // Get API key from storage
            const apiKey = await getApiKey();
            if (!apiKey) {
                throw new Error('API key not set. Please set it in the extension popup.');
            }

            const tone = toneSelect.value;
            const customContent = customInput.value.trim();

            // Generate reply
            const reply = await generateReply(postText, apiKey, tone, selectedType, customContent);

            // Insert into compose area - get fresh reference from modal
            const modal = document.querySelector('[role="dialog"]');
            let freshComposeArea = modal?.querySelector('[data-testid="tweetTextarea_0"]')
                || modal?.querySelector('[contenteditable="true"][role="textbox"]')
                || modal?.querySelector('[contenteditable="true"]');

            if (!freshComposeArea) {
                freshComposeArea = composeArea;
            }

            console.log('Generated reply:', reply);
            console.log('Compose area found:', freshComposeArea);

            await insertReplyText(freshComposeArea, reply);

            // SUCCESS: Remove the widget to avoid blocking the view
            const widgetHost = document.getElementById('x-reply-widget-host');
            if (widgetHost) {
                widgetHost.remove();
            }

            // Clear injection marker so widget can be re-injected if user opens modal again
            if (modal) {
                modal.removeAttribute('data-xreply-injected');
            }

            console.log('Reply inserted and widget removed');

        } catch (error) {
            console.error('Error generating reply:', error);
            statusDiv.textContent = error.message;
            statusDiv.className = 'xreply-status error';
            goBtn.disabled = false;
            goBtn.textContent = 'Go';
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
        building: 'relate to their post and naturally mention that you are building OneScript - a SaaS that lets any website owner implement a customer service bot using just one script tag that replies from their provided knowledge base'
    };

    const toneInstruction = toneInstructions[tone] || toneInstructions.auto;
    const typeInstruction = typeInstructions[replyType] || typeInstructions.auto;

    // Special prompt for "building" type
    const isBuildingType = replyType === 'building';

    let prompt = `You are a helpful, practical, founder-minded assistant.
    
CONTEXT:
The user posted this text: "${postText}"
${customContent ? `\nUser's custom direction: "${customContent}"` : ''}

TASK:
Write a reply strictly under 280 characters that directly addresses the specific topic of the post.
The reply should: ${typeInstruction}

GUIDELINES:
1. RELEVANCE FIRST: If it's a meme, be witty/relatable. If it's code, offer feedback/praise. If it's a question, answer it.
2. TONE: ${toneInstruction}
3. VALUE: Add a specific insight, a quick tip, or a validating comment related to their specific struggle or win.
4. FORMAT: Short sentences. No fluff. No hashtags. No emojis unless absolutely necessary.
5. ENDING: Always end with "Let's connect and FB!" (FB means follow back) when it fits naturally.
6. Keep it under 280 characters including the ending.
${isBuildingType ? '7. IMPORTANT: Naturally weave in that you are building OneScript - a SaaS that lets website owners add a customer service bot with just one script tag. Make it relevant to their post.' : ''}
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