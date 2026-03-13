// linkedin-content.js - Runs on LinkedIn.com pages
console.log('AI Reply Bot: LinkedIn content script loaded');

// Track injected widgets to avoid duplicate injections
const injectedCommentBoxes = new WeakSet();

// Initialize MutationObserver for comment box detection
function initLinkedInObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Look for TipTap/ProseMirror comment editors
                        const editors = node.querySelectorAll
                            ? node.querySelectorAll('.tiptap.ProseMirror[contenteditable="true"]')
                            : [];
                        const selfMatch = node.matches?.('.tiptap.ProseMirror[contenteditable="true"]')
                            ? [node]
                            : [];

                        [...selfMatch, ...editors].forEach(editor => {
                            if (!injectedCommentBoxes.has(editor)) {
                                setTimeout(() => injectLinkedInWidget(editor), 400);
                            }
                        });
                    }
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('LinkedIn comment observer initialized');
}

// Find the feed post container that holds both the post content and the comment box
function findPostContainer(commentEditor) {
    // Walk up from the comment editor to find the feed post wrapper
    // LinkedIn wraps each post in a div with componentkey attribute
    let el = commentEditor;
    for (let i = 0; i < 25; i++) {
        el = el.parentElement;
        if (!el) return null;
        // Feed post containers typically have the "Feed post" heading or are top-level feed items
        const heading = el.querySelector('h2 span');
        if (heading && heading.textContent.includes('Feed post')) {
            return el;
        }
    }
    // Fallback: go up until we find a very high-level container
    el = commentEditor;
    for (let i = 0; i < 20; i++) {
        el = el.parentElement;
        if (!el) return null;
        // Check if this container has both the post text and the comment area
        const hasPostText = el.querySelector('[data-testid="expandable-text-box"]')
            || el.querySelector('[tabindex="-1"][class*="break-words"]');
        const hasCommentArea = el.querySelector('.tiptap.ProseMirror');
        if (hasPostText && hasCommentArea) {
            return el;
        }
    }
    return null;
}

// Extract the original post text from the LinkedIn post
function extractLinkedInPostText(commentEditor) {
    const container = findPostContainer(commentEditor);
    if (!container) {
        console.log('Could not find post container');
        return '';
    }

    // Try the expandable-text-box first (common in feed posts)
    const expandableText = container.querySelector('[data-testid="expandable-text-box"]');
    if (expandableText) {
        return expandableText.textContent.trim();
    }

    // Fallback: look for the post body text in span elements within the post
    // LinkedIn post text is usually in a <p> or <span> with specific classes
    const postTextElements = container.querySelectorAll('span[tabindex="-1"], span.break-words');
    for (const el of postTextElements) {
        const text = el.textContent.trim();
        if (text.length > 20) {
            return text;
        }
    }

    // Last resort: find any substantial text block above the comment area
    const allParagraphs = container.querySelectorAll('p');
    for (const p of allParagraphs) {
        const text = p.textContent.trim();
        if (text.length > 30 && !text.includes('Add a comment')) {
            return text;
        }
    }

    return '';
}

// Extract post author name
function extractPostAuthor(commentEditor) {
    const container = findPostContainer(commentEditor);
    if (!container) return '';

    // Author name is typically in a strong tag inside a link
    const authorLink = container.querySelector('a strong');
    if (authorLink) {
        return authorLink.textContent.trim();
    }
    return '';
}

// Inject the AI widget near the comment box
function injectLinkedInWidget(commentEditor) {
    if (injectedCommentBoxes.has(commentEditor)) return;
    injectedCommentBoxes.add(commentEditor);

    const postText = extractLinkedInPostText(commentEditor);
    const postAuthor = extractPostAuthor(commentEditor);

    console.log('LinkedIn post text extracted:', postText.substring(0, 100));
    console.log('LinkedIn post author:', postAuthor);

    const widget = createLinkedInWidget(postText, postAuthor, commentEditor);

    // Insert the widget before the comment editor's outer container
    // The comment box is inside a bordered div — insert above it
    const editorOuterContainer = commentEditor.closest('[style*="border-color"]')
        || commentEditor.closest('[class*="d9e92732"]')
        || commentEditor.parentElement?.parentElement?.parentElement;

    if (editorOuterContainer && editorOuterContainer.parentElement) {
        editorOuterContainer.parentElement.insertBefore(widget, editorOuterContainer);
    } else {
        // Fallback: insert before the editor itself
        commentEditor.parentElement.insertBefore(widget, commentEditor);
    }

    console.log('LinkedIn reply widget injected successfully');
}

// Create the LinkedIn reply widget UI with Shadow DOM
function createLinkedInWidget(postText, postAuthor, commentEditor) {
    const widgetHost = document.createElement('div');
    widgetHost.id = 'linkedin-reply-widget-host';

    const shadow = widgetHost.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
        <style>
            :host {
                display: block;
                all: initial;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            
            .li-reply-container {
                padding: 14px;
                border-radius: 12px;
                background: rgba(0, 0, 0, 0.88);
                backdrop-filter: blur(12px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-sizing: border-box;
                color: white;
                margin-bottom: 10px;
                max-width: 100%;
                animation: fadeIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            
            .li-reply-top-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
                gap: 10px;
                position: relative;
            }

            /* Custom Dropdown */
            .li-reply-dropdown {
                position: relative;
                min-width: 130px;
            }

            .li-reply-dropdown-trigger {
                padding: 7px 14px;
                border-radius: 20px;
                background: rgba(255, 255, 255, 0.1);
                color: rgb(231, 233, 234);
                font-size: 13px;
                cursor: pointer;
                border: 1px solid transparent;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: all 0.2s;
            }

            .li-reply-dropdown-trigger:hover {
                background: rgba(255, 255, 255, 0.15);
            }

            .li-reply-dropdown-trigger.active {
                border-color: #0a66c2;
                background: rgba(10, 102, 194, 0.15);
            }

            .li-reply-dropdown-menu {
                position: absolute;
                top: 100%;
                left: 0;
                margin-top: 6px;
                background: rgb(22, 24, 28);
                border: 1px solid rgb(47, 51, 54);
                border-radius: 10px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                z-index: 1000;
                display: none;
                flex-direction: column;
                min-width: 150px;
                overflow: hidden;
            }

            .li-reply-dropdown-menu.show {
                display: flex;
            }

            .li-reply-dropdown-item {
                padding: 9px 14px;
                font-size: 13px;
                color: rgb(231, 233, 234);
                cursor: pointer;
                transition: background 0.2s;
                text-align: left;
                background: none;
                border: none;
                width: 100%;
            }

            .li-reply-dropdown-item:hover {
                background: rgba(255, 255, 255, 0.05);
            }

            .li-reply-dropdown-item.selected {
                color: #0a66c2;
                font-weight: bold;
                background: rgba(10, 102, 194, 0.08);
            }
            
            .li-reply-actions {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .li-reply-go-btn {
                padding: 7px 18px;
                border-radius: 20px;
                border: none;
                background: #0a66c2;
                color: white;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 8px rgba(10, 102, 194, 0.3);
            }
            
            .li-reply-go-btn:hover {
                background: #004182;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(10, 102, 194, 0.4);
            }
            
            .li-reply-go-btn:disabled {
                background: rgb(83, 100, 113);
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            .li-reply-close-btn {
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: rgb(113, 118, 123);
                cursor: pointer;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                transition: all 0.2s;
            }

            .li-reply-close-btn:hover {
                background: rgba(244, 33, 46, 0.1);
                color: rgb(244, 33, 46);
            }
            
            .li-reply-custom-input {
                width: 100%;
                padding: 10px 14px;
                border-radius: 10px;
                border: 1px solid rgba(83, 100, 113, 0.5);
                background: rgba(0, 0, 0, 0.3);
                color: rgb(231, 233, 234);
                font-size: 14px;
                margin-bottom: 12px;
                box-sizing: border-box;
                transition: all 0.2s;
            }
            
            .li-reply-custom-input::placeholder {
                color: rgba(113, 118, 123, 0.8);
            }
            
            .li-reply-custom-input:focus {
                outline: none;
                border-color: #0a66c2;
                background: rgba(0, 0, 0, 0.6);
                box-shadow: 0 0 0 2px rgba(10, 102, 194, 0.2);
            }
            
            .li-reply-types-container {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 6px;
            }
            
            .li-reply-type-btn {
                padding: 6px 12px;
                border-radius: 16px;
                border: 1px solid rgba(83, 100, 113, 0.4);
                background: transparent;
                color: rgb(231, 233, 234);
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 5px;
                font-weight: 500;
            }
            
            .li-reply-type-btn:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }
            
            .li-reply-type-btn.active {
                background: rgba(10, 102, 194, 0.15);
                border-color: #0a66c2;
                color: #4d9de0;
            }
            
            .li-reply-status {
                margin-top: 10px;
                font-size: 12px;
                color: rgb(113, 118, 123);
                text-align: center;
                min-height: 18px;
                transition: color 0.3s;
            }
            
            .li-reply-status.error {
                color: rgb(244, 33, 46);
            }
            
            .li-reply-status.success {
                color: rgb(0, 186, 124);
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
        
        <div class="li-reply-container">
            <div class="li-reply-top-row">
                <div class="li-reply-dropdown" id="li-tone-dropdown">
                    <div class="li-reply-dropdown-trigger" id="li-tone-trigger">
                        <span id="li-tone-label">Auto</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="margin-left: 6px; opacity: 0.7;">
                            <path d="M12 15.4L6 9.4L7.4 8L12 12.6L16.6 8L18 9.4L12 15.4Z"></path>
                        </svg>
                    </div>
                    <div class="li-reply-dropdown-menu" id="li-tone-menu">
                        <button class="li-reply-dropdown-item selected" data-value="auto">Auto</button>
                        <button class="li-reply-dropdown-item" data-value="condense">Condense</button>
                        <button class="li-reply-dropdown-item" data-value="witty">Witty</button>
                        <button class="li-reply-dropdown-item" data-value="helpful">Helpful</button>
                        <button class="li-reply-dropdown-item" data-value="professional">Professional</button>
                        <button class="li-reply-dropdown-item" data-value="funny">Funny</button>
                        <button class="li-reply-dropdown-item" data-value="supportive">Supportive</button>
                    </div>
                </div>

                <div class="li-reply-actions">
                    <button class="li-reply-go-btn" id="li-go">Generate Comment</button>
                    <button class="li-reply-close-btn" id="li-close" aria-label="Close widget">×</button>
                </div>
            </div>
            
            <input type="text" class="li-reply-custom-input" id="li-custom" placeholder="Add custom instructions... (e.g. 'mention my SaaS product')">
            
            <div class="li-reply-types-container">
                <button class="li-reply-type-btn active" data-type="auto">⚡ Auto</button>
                <button class="li-reply-type-btn" data-type="support">♥ Support</button>
                <button class="li-reply-type-btn" data-type="agree">👍 Agree</button>
                <button class="li-reply-type-btn" data-type="disagree">👎 Disagree</button>
                <button class="li-reply-type-btn" data-type="congrats">🎉 Congrats</button>
                <button class="li-reply-type-btn" data-type="thanks">♥ Thanks</button>
                <button class="li-reply-type-btn" data-type="question">❓ Ask</button>
                <button class="li-reply-type-btn" data-type="insightful">💡 Insightful</button>
                <button class="li-reply-type-btn" data-type="building">🔨 Building</button>
            </div>
            
            <div class="li-reply-status" id="li-status"></div>
        </div>
    `;

    setupLinkedInWidgetListeners(shadow, postText, postAuthor, commentEditor, widgetHost);

    // Stop event propagation to prevent LinkedIn's handlers from interfering
    ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'focus', 'blur'].forEach(eventType => {
        widgetHost.addEventListener(eventType, (e) => {
            e.stopPropagation();
        });
    });

    return widgetHost;
}

// Setup event listeners for the LinkedIn widget
function setupLinkedInWidgetListeners(widget, postText, postAuthor, commentEditor, widgetHost) {
    const goBtn = widget.querySelector('#li-go');
    const closeBtn = widget.querySelector('#li-close');
    const customInput = widget.querySelector('#li-custom');
    const typeBtns = widget.querySelectorAll('.li-reply-type-btn');
    const statusDiv = widget.querySelector('#li-status');

    const toneDropdown = widget.querySelector('#li-tone-dropdown');
    const toneTrigger = widget.querySelector('#li-tone-trigger');
    const toneMenu = widget.querySelector('#li-tone-menu');
    const toneLabel = widget.querySelector('#li-tone-label');
    const toneItems = widget.querySelectorAll('.li-reply-dropdown-item');

    let selectedType = 'auto';
    let selectedTone = 'auto';

    // Dropdown toggle
    toneTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toneMenu.classList.toggle('show');
        toneTrigger.classList.toggle('active');
    });

    widget.addEventListener('click', (e) => {
        if (!toneDropdown.contains(e.target)) {
            toneMenu.classList.remove('show');
            toneTrigger.classList.remove('active');
        }
    });

    toneItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedTone = item.dataset.value;
            toneLabel.textContent = item.textContent;
            toneItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            toneMenu.classList.remove('show');
            toneTrigger.classList.remove('active');
        });
    });

    // Type buttons
    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedType = btn.dataset.type;
        });
    });

    // Close button
    closeBtn.addEventListener('click', () => {
        widgetHost.remove();
        injectedCommentBoxes.delete(commentEditor);
    });

    // Generate button
    goBtn.addEventListener('click', async () => {
        goBtn.disabled = true;
        goBtn.textContent = 'Generating...';
        statusDiv.textContent = 'Thinking...';
        statusDiv.className = 'li-reply-status';

        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                throw new Error('API key not set. Please set it in the extension popup.');
            }

            const customContent = customInput.value.trim();
            const comment = await generateLinkedInComment(
                postText, postAuthor, apiKey,
                selectedTone, selectedType, customContent
            );

            console.log('Generated LinkedIn comment:', comment);

            await insertLinkedInComment(commentEditor, comment);

            // Remove widget after successful generation
            widgetHost.remove();
            injectedCommentBoxes.delete(commentEditor);

        } catch (error) {
            console.error('Error generating comment:', error);
            statusDiv.textContent = error.message;
            statusDiv.className = 'li-reply-status error';
            goBtn.disabled = false;
            goBtn.textContent = 'Generate Comment';
        }
    });
}

// Get API key from Chrome storage
function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['geminiApiKey'], (result) => {
            resolve(result.geminiApiKey || null);
        });
    });
}

// Generate a LinkedIn comment using Gemini API
async function generateLinkedInComment(postText, postAuthor, apiKey, tone, replyType, customContent) {
    const toneInstructions = {
        auto: 'natural and contextually appropriate for LinkedIn',
        condense: 'brief and concise, getting straight to the point',
        witty: 'witty and engaging but still professional',
        helpful: 'helpful and informative',
        professional: 'professional and respectful',
        funny: 'humorous but appropriate for a professional platform',
        supportive: 'supportive and encouraging'
    };

    const typeInstructions = {
        auto: 'respond naturally based on the content',
        support: 'show support and encouragement',
        agree: 'express agreement and add your perspective',
        disagree: 'respectfully disagree or offer a different perspective',
        congrats: 'congratulate them on their achievement',
        thanks: 'express gratitude and appreciation',
        question: 'ask a thoughtful follow-up question',
        insightful: 'add an insightful observation or unique perspective',
        building: 'relate to their post and naturally mention that you are building OneScript - a simple tool that lets businesses add chat, support, lead capture, and automation to their website with just one script. Try it at onescript.xyz'
    };

    const toneInstruction = toneInstructions[tone] || toneInstructions.auto;
    const typeInstruction = typeInstructions[replyType] || typeInstructions.auto;
    const isBuildingType = replyType === 'building';

    let prompt = `You are writing a comment on a LinkedIn post as a real person. READ THE POST CAREFULLY.

POST${postAuthor ? ` by ${postAuthor}` : ''}: "${postText}"
${customContent ? `\nUser's direction: "${customContent}"` : ''}

CRITICAL - Understand the post first:
- If they're sharing a PROBLEM/frustration → empathize or relate (NEVER say "congrats" or "awesome")
- If they're celebrating success → congratulate genuinely
- If they're asking a question → engage with the question
- If they're sharing insights → add your own perspective
- If they're venting/complaining → show understanding, don't be dismissive

TASK:
Write a LinkedIn comment (max 500 characters).
Comment style: ${typeInstruction}

GUIDELINES:
1. PROFESSIONAL BUT HUMAN: LinkedIn is professional but conversational. Be genuine, not corporate.
2. TONE: ${toneInstruction}. No bot-like phrases like "Great post!" or "Thanks for sharing!" as openers.
3. RELEVANCE: Directly address what they said. Match the mood.
4. VALUE: Add insight, a question, or personal experience that adds to the conversation.
5. FORMAT: 2-3 sentences max. No hashtags. No emojis unless absolutely natural. No bullet points.
6. ENDING: Optionally end with "Let's connect!" if it fits naturally. Don't force it.
7. LENGTH: Under 500 characters.
${isBuildingType ? '8. IMPORTANT: Naturally mention you are building OneScript - a simple tool for website automation (chat, support, leads) with just one script. Try it at onescript.xyz' : ''}
`;

    const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 200,
                    temperature: 0.7
                }
            })
        }
    );

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

// Insert comment text into LinkedIn's TipTap/ProseMirror editor
async function insertLinkedInComment(editor, text) {
    console.log('Inserting LinkedIn comment into editor:', editor);

    editor.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(100);

    editor.focus();
    await sleep(100);

    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    await sleep(50);

    // Method 1: DataTransfer paste simulation
    try {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer
        });

        editor.dispatchEvent(pasteEvent);
        await sleep(150);

        if (editor.textContent.includes(text.substring(0, 20))) {
            console.log('LinkedIn paste method succeeded');
            dispatchEditorEvents(editor, text);
            return;
        }
    } catch (e) {
        console.log('LinkedIn paste method failed:', e);
    }

    // Method 2: execCommand insertText
    try {
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(50);

        const success = document.execCommand('insertText', false, text);
        if (success && editor.textContent.trim().length > 0) {
            console.log('LinkedIn execCommand method succeeded');
            dispatchEditorEvents(editor, text);
            return;
        }
    } catch (e) {
        console.log('LinkedIn execCommand method failed:', e);
    }

    // Method 3: Direct DOM manipulation for TipTap
    try {
        // Clear existing content
        editor.innerHTML = '';

        // TipTap expects content in <p> tags
        const p = document.createElement('p');
        p.textContent = text;
        editor.appendChild(p);

        console.log('LinkedIn direct DOM method used');
        dispatchEditorEvents(editor, text);
        return;
    } catch (e) {
        console.log('LinkedIn direct DOM failed:', e);
    }

    // Method 4: Last resort
    editor.textContent = text;
    dispatchEditorEvents(editor, text);
    console.log('LinkedIn fallback textContent method used');
}

// Dispatch events to trigger TipTap/React state updates
function dispatchEditorEvents(element, text) {
    element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
    }));

    element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
    }));

    const textInputEvent = new Event('textInput', { bubbles: true });
    textInputEvent.data = text;
    element.dispatchEvent(textInputEvent);

    element.dispatchEvent(new Event('change', { bubbles: true }));

    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Unidentified' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize on page load
initLinkedInObserver();
