// content.js - Runs on X.com pages
console.log('X AI Reply Bot content script loaded');

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
        // Pass sendResponse to the async function
        generateAndReplyToPost(request.postId, request.postText, request.geminiApiKey, sendResponse);
        // Return true to indicate we will respond asynchronously
        return true;
    }
});

function extractPosts() {
    const posts = [];

    // X/Twitter uses article elements for posts
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

            // Extract username from href
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
            // Tag the element with the ID so we can find it later
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

        // Find the specific post element
        const postElement = document.querySelector(`article[data-x-reply-id="${postId}"]`);

        if (!postElement) {
            throw new Error('Could not find the original post. Please refresh the posts list.');
        }

        // Scroll to post
        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);

        console.log('Step 2: Getting settings');

        // Get tone from settings
        const settings = await getSettings();
        const tone = settings.tone || 'witty';
        console.log('Tone:', tone);

        console.log('Step 3: Calling Gemini API');
        const aiReply = await callGeminiAPI(postText, geminiApiKey, tone);
        console.log('Reply generated:', aiReply);

        console.log('Step 4: Clicking reply button');

        // Find the reply button within this specific post
        const replyButton = postElement.querySelector('[data-testid="reply"]');

        if (!replyButton) {
            throw new Error('Reply button not found on this post.');
        }

        replyButton.click();

        // Wait for modal to open
        await sleep(1000);

        console.log('Step 5: Finding reply modal textarea');

        // Find compose textarea in the modal
        // The modal usually appears at the end of the DOM or in a specific layer
        let replyBox = document.querySelector('[data-testid="tweetTextarea_0"]');

        if (!replyBox) {
            // Alternative selectors
            replyBox = document.querySelector('[contenteditable="true"][role="textbox"]');
        }

        if (!replyBox) {
            // Try finding in modal or drawer explicitly
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

        // Select all existing text (if any) and delete it
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);

        // Wait a small amount of time for React to process the clear
        await sleep(100);

        // Method 1: execCommand 'insertText' (most reliable for contenteditable)
        // This simulates a user typing the text
        const success = document.execCommand('insertText', false, aiReply);

        // Method 2: If execCommand failed or didn't trigger React, try direct manipulation with events
        if (!success || replyBox.textContent.trim() === '') {
            console.log('execCommand failed, trying fallback method');
            replyBox.textContent = aiReply;
        }

        // Dispatch a sequence of events to ensure React picks it up
        // React often listens for 'beforeinput', 'input', and 'change'

        // 1. Text Input event (legacy but helpful)
        const textInputEvent = new InputEvent('textInput', {
            bubbles: true,
            cancelable: true,
            data: aiReply,
            inputType: 'insertText'
        });
        replyBox.dispatchEvent(textInputEvent);

        // 2. Standard Input event
        const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: aiReply
        });
        replyBox.dispatchEvent(inputEvent);

        // 3. Change event
        replyBox.dispatchEvent(new Event('change', { bubbles: true }));

        // 4. Key events (sometimes needed for validation)
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
    // Look for the tweet button specifically in the modal if possible
    const modal = document.querySelector('[role="dialog"]');
    let context = modal || document;

    // Primary selector
    let button = context.querySelector('button[data-testid="tweetButton"]');
    if (button && isVisible(button)) return button;

    // Alternative: Look for button with specific aria-label
    button = context.querySelector('button[aria-label="Post"]');
    if (button && isVisible(button)) return button;

    button = context.querySelector('button[aria-label="Reply"]');
    if (button && isVisible(button)) return button;

    button = context.querySelector('button[aria-label="post"]');
    if (button && isVisible(button)) return button;

    // Last resort: Find button with text "Reply" or "Post"
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

    // Using gemini-2.0-flash as requested by user
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
        // Include the raw response in the error message for debugging
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}