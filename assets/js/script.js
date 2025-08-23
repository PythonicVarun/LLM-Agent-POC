import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@16/+esm";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3/+esm";
import prismjs from "https://cdn.jsdelivr.net/npm/prismjs@1/+esm";

async function loadLanguage(language) {
    try {
        const module = await import(
            `https://cdn.jsdelivr.net/npm/prismjs/components/prism-${language}.min.js`
        );
        console.debug(`${language} language loaded successfully.`);
        return module;
    } catch (err) {
        console.error(`Failed to load the ${language} language module:`, err);
    }
}

DOMPurify.addHook("afterSanitizeAttributes", async function (currentNode) {
    if (currentNode.tagName === "A" && currentNode.hasAttribute("href")) {
        currentNode.setAttribute("target", "_blank");
        currentNode.setAttribute("rel", "noopener noreferrer");
    }
});

const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const clearChatBtn = document.getElementById("clear-chat-btn");

const apiBaseUrlEl = document.getElementById("apiBaseUrl");
const apiKeyEl = document.getElementById("apiKey");
const serperApiKeyEl = document.getElementById("serperApiKey");
const apiModelEl = document.getElementById("apiModel");
const saveAndFetchModelsBtn = document.getElementById("saveAndFetchModels");
const toolsEnabledSwitch = document.getElementById("toolsEnabledSwitch");
const clearAllChatsBtn = document.getElementById("clearAllChatsBtn");
const totalChatsCount = document.getElementById("totalChatsCount");
const storageUsed = document.getElementById("storageUsed");

const systemPrompt = {
    role: "system",
    content: `You are a helpful, tool-using AI assistant for a browser chat app.

Primary goals:
- Be concise, accurate, and actionable.
- Use Markdown for formatting (headings, bullets, tables, code fences).
- Prefer step-by-step clarity without fluff.

Tools available:
- googleSearch(query: string)
    - Use for up-to-date facts, current events, statistics, or when you are uncertain.
    - After using it, cite the top 1-3 relevant sources as Markdown links.
- callAIPipe(pipeline: string)
    - Use when the user explicitly asks to run a known dataflow/pipeline by name.
    - If the pipeline is unclear, ask a brief clarifying question.
- executeJavaScript(code: string)
    - Use for small calculations, parsing, date time or quick transformations in a sandbox.
    - Do not access the DOM, or perform destructive actions.
    - Keep outputs small; summarize longer results.
- openInBrowser(url: string)
    - Use to open a URL in a new browser tab.
    - Only use it when it's too necessary.
- addToMemory(memory: string)
    - Save a memory string to persistent storage.
    - Can be used to remember important information across sessions like user preferences, past interactions, or specific details the user wants to remember.
    - Use to save concise, user-specified facts for long-term recall (e.g., "My favorite framework is React"). Do not add memories for trivial details.
- getMemories(): string[]
    - **Your memories are already in your context.** Do not call this tool to check them.
    - Only use this if the user explicitly asks you to list all saved memories.

Tool-use protocol:
- Call a tool only when it will materially improve the answer.
- Provide minimal, correct arguments. Never fabricate data or URLs.
- After tool results return, integrate them into your final answer with citations.
- Do not print tool-call JSON or internal IDs in your answer.

Style and limits:
- Keep responses short and impersonal. Avoid filler.
- Use fenced code blocks with language tags for code.
- If search is unavailable (e.g., missing API key) or a tool errors, say so briefly and proceed with best-effort reasoning.

Safety:
- Protect privacy; never request or reveal secrets or API keys.

Identity:
- Your Name: Anveshak.
- Your Developer: Varun Agnihotri <@PythonicVarun, code@pythonicvarun.me>`,
};

let conversationHistory = [];
let settings = {};
let chats = {};
let activeChat = null;
let chatToRename = null;
let chatToDelete = null;
let isDraftChat = false;

function scrollToBottom(smooth = false) {
    const messages = chatWindow.querySelectorAll("div");
    const lastMessage = messages[messages.length - 1];
    lastMessage.scrollIntoView({
        behavior: smooth ? "smooth" : "instant",
    });
}

function generateChatId() {
    return "chat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

function createNewChat() {
    const chatId = generateChatId();
    const chatName = `Chat ${Object.keys(chats).length + 1}`;

    chats[chatId] = {
        id: chatId,
        name: chatName,
        history: [systemPrompt],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    return chatId;
}

function startDraftChat() {
    if (activeChat && chats[activeChat] && !isDraftChat) {
        chats[activeChat].history = [...conversationHistory];
        chats[activeChat].updatedAt = new Date().toISOString();
    }

    activeChat = null;
    isDraftChat = true;
    conversationHistory = [systemPrompt];

    updateChatList();
    updateChatTitle();
    displayHistory();
}

function switchToChat(chatId) {
    if (activeChat && chats[activeChat] && !isDraftChat) {
        chats[activeChat].history = [...conversationHistory];
    }

    activeChat = chatId;
    isDraftChat = false;
    conversationHistory = chats[chatId]
        ? [...chats[chatId].history]
        : [systemPrompt];

    updateChatList();
    updateChatTitle();
    displayHistory();
    saveAllChats();
}

function updateChatTitle() {
    const titleEl = document.getElementById("chat-title");
    if (titleEl) {
        if (isDraftChat) {
            titleEl.textContent = "New Chat";
        } else if (activeChat && chats[activeChat]) {
            titleEl.textContent = chats[activeChat].name;
        } else {
            titleEl.textContent = "New Chat";
        }
    }
}

function updateChatList() {
    const chatList = document.getElementById("chat-list");
    chatList.innerHTML = "";

    // Sort chats by updatedAt descending
    const sortedChats = Object.values(chats).sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    );

    sortedChats.forEach((chat) => {
        const li = document.createElement("li");
        const isActive = !isDraftChat && chat.id === activeChat;
        li.className = `chat-item ${isActive ? "active" : ""}`;
        li.innerHTML = `
            <button class="chat-item-btn ${isActive ? "active" : ""}"
                    onclick="switchToChat('${chat.id}')" data-chat-id="${chat.id}">
                <span class="chat-title">${chat.name}</span>
                <div class="chat-actions">
                    <button class="chat-action-btn" onclick="event.stopPropagation(); renameChat('${chat.id}')" title="Rename">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="chat-action-btn" onclick="event.stopPropagation(); deleteChat('${chat.id}')" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </button>
        `;
        chatList.appendChild(li);
    });
    updateStorageInfo();
}

function updateStorageInfo() {
    if (totalChatsCount) {
        totalChatsCount.textContent = Object.keys(chats).length;
    }

    if (storageUsed) {
        try {
            const allData = localStorage.getItem("allChats") || "{}";
            const settings = localStorage.getItem("agentSettings") || "{}";
            const totalBytes = allData.length + settings.length;
            const totalKB = Math.round((totalBytes / 1024) * 100) / 100;
            storageUsed.textContent = `${totalKB} KB`;
        } catch (e) {
            storageUsed.textContent = "Unknown";
        }
    }
}

function clearAllChats() {
    chats = {};
    startDraftChat();
    saveAllChats();
    updateStorageInfo();

    bootstrapAlert({
        title: "Success",
        body: "All chats have been cleared successfully.",
        color: "success",
    });
}

function saveAllChats() {
    if (activeChat && chats[activeChat] && !isDraftChat) {
        chats[activeChat].history = [...conversationHistory];
    }

    localStorage.setItem("allChats", JSON.stringify(chats));
    localStorage.setItem("activeChat", isDraftChat ? null : activeChat);
}

function loadAllChats() {
    const savedChats = localStorage.getItem("allChats");
    const savedActiveChat = localStorage.getItem("activeChat");

    if (savedChats) {
        chats = JSON.parse(savedChats);

        if (Object.keys(chats).length === 0) {
            startDraftChat();
            return;
        } else {
            activeChat =
                savedActiveChat && chats[savedActiveChat]
                    ? savedActiveChat
                    : Object.keys(chats)[0];
            isDraftChat = false;
        }
    } else {
        startDraftChat();
        return;
    }

    conversationHistory = chats[activeChat]
        ? [...chats[activeChat].history]
        : [systemPrompt];
    updateChatList();
    updateChatTitle();
}

async function displayHistory() {
    chatWindow.innerHTML = "";
    const messagesToRender = conversationHistory.slice(1);
    const welcomeScreen = document.getElementById("welcome-screen");

    if (!settings.apiKey || !settings.baseUrl) {
        welcomeScreen.style.display = "block";
        addMessageToUI(
            "Hello! Please configure your provider and API keys in the <strong>Settings (⚙️)</strong> menu to get started.",
            "agent",
        );
        return;
    }

    if (messagesToRender.length === 0) {
        welcomeScreen.style.display = "block";
        return;
    } else {
        welcomeScreen.style.display = "none";
    }

    for (const message of messagesToRender) {
        if (message.role === "user") {
            addMessageToUI(message.content, "user");
        } else if (message.role === "assistant") {
            if (message.reasoning || message.tool_calls) {
                const thinkingElement = addThinkingToUI();
                if (message.reasoning) {
                    const reasoningEl =
                        thinkingElement.querySelector(".reasoning-stream");

                    if (reasoningEl) {
                        // reasoningEl.textContent = message.reasoning;

                        // Format and highlight syntax in reasoning
                        const cleanFragment = DOMPurify.sanitize(
                            marked.parse(message.reasoning),
                            { RETURN_DOM_FRAGMENT: true },
                        );
                        const html = await highlightSyntax(cleanFragment);
                        reasoningEl.appendChild(html);
                        reasoningEl
                            .querySelectorAll("pre:not(:has(.copy-btn))")
                            .forEach((pre) => {
                                const btn = document.createElement("button");
                                btn.className = "copy-btn";
                                btn.textContent = "Copy";
                                pre.appendChild(btn);
                            });
                    }
                }

                if (message.tool_calls) {
                    const toolCallsEl =
                        thinkingElement.querySelector(".tool-calls-final");
                    const btn =
                        thinkingElement.querySelector(".accordion-button");
                    if (toolCallsEl) {
                        toolCallsEl.querySelector("code").textContent =
                            JSON.stringify(message.tool_calls, null, 4);
                        toolCallsEl.style.display = "block";
                        await highlightSyntax(toolCallsEl);
                    }
                    if (btn) {
                        btn.innerHTML = `🧠 Thinking... (Plans to use ${message.tool_calls.length} tool${message.tool_calls.length > 1 ? "s" : ""})`;
                    }
                }
            }

            if (message.content) {
                const messageElement = addMessageToUI("", "agent");
                const cleanFragment = DOMPurify.sanitize(
                    marked.parse(message.content),
                    { RETURN_DOM_FRAGMENT: true },
                );
                const html = await highlightSyntax(cleanFragment);
                messageElement.appendChild(html);
                messageElement
                    .querySelectorAll("pre:not(:has(.copy-btn))")
                    .forEach((pre) => {
                        const btn = document.createElement("button");
                        btn.className = "copy-btn";
                        btn.textContent = "Copy";
                        pre.appendChild(btn);
                    });
            }
        } else if (message.role === "tool") {
            addMessageToUI(
                `⚙️ Used tool: <strong>${message.name}</strong>`,
                "tool",
            );
        }
    }
    scrollToBottom();
}

const highlightSyntax = async (html) => {
    const codeBlocks = html.querySelectorAll("pre code[class*='language-']");

    for (const codeEle of codeBlocks) {
        const regex = /language-(\w+)/;
        const match = codeEle.className.match(regex);
        if (match) {
            const language = match[1];
            try {
                await loadLanguage(language);

                const highlightedCode = Prism.highlight(
                    codeEle.textContent,
                    Prism.languages[language],
                    language,
                );
                codeEle.innerHTML = highlightedCode;
            } catch (e) {
                console.error(`Failed to highlight language ${language}`, e);
            }
        }
    }

    return html;
};

async function generateChatTitle(userMessage) {
    if (!settings.apiKey || !settings.model) {
        return null; // Can't generate title without API access
    }

    try {
        const messages = [
            {
                role: "system",
                content:
                    "You are an AI assistant that creates short, descriptive titles for chat conversations based on the user's first message. The title should be 3-5 words maximum. Respond only with the title itself, without any prefixes, suffixes, or quotation marks.",
            },
            {
                role: "user",
                content: userMessage,
            },
        ];

        const requestBody = {
            model: settings.model,
            messages: messages,
            temperature: 0.7,
        };

        const response = await fetch(`${settings.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${settings.apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const title = data.choices?.[0]?.message?.content?.trim();

        if (title && title.length > 0 && title.length <= 50) {
            // Remove quotes if present
            return title.replace(/^["']|["']$/g, "");
        }

        return null;
    } catch (error) {
        console.error("Failed to generate chat title:", error);
        return null;
    }
}

function loadSettings() {
    const savedSettings =
        JSON.parse(localStorage.getItem("agentSettings")) || {};
    settings = {
        baseUrl: savedSettings.baseUrl || "https://api.openai.com/v1",
        apiKey: savedSettings.apiKey || "",
        serperApiKey: savedSettings.serperApiKey || "",
        model: savedSettings.model || "",
        models: savedSettings.models || [],
        toolsEnabled: savedSettings.toolsEnabled !== false,
    };

    apiBaseUrlEl.value = settings.baseUrl;
    apiKeyEl.value = settings.apiKey;
    serperApiKeyEl.value = settings.serperApiKey;
    toolsEnabledSwitch.checked = settings.toolsEnabled;
    populateModelDropdown(settings.models);
    if (settings.model) apiModelEl.value = settings.model;
}

function saveSettings() {
    localStorage.setItem("agentSettings", JSON.stringify(settings));
}

function populateModelDropdown(models) {
    apiModelEl.innerHTML = "";
    if (models && models.length > 0) {
        models.forEach((modelName) => {
            const option = document.createElement("option");
            option.value = modelName;
            option.textContent = modelName;
            apiModelEl.appendChild(option);
        });
        apiModelEl.disabled = false;
    } else {
        apiModelEl.innerHTML = "<option>No models found. Fetch first.</option>";
        apiModelEl.disabled = true;
    }
}

saveAndFetchModelsBtn.addEventListener("click", async () => {
    const btnSpinner = saveAndFetchModelsBtn.querySelector(".spinner-border");
    btnSpinner.classList.remove("d-none");
    saveAndFetchModelsBtn.disabled = true;

    const baseUrl = apiBaseUrlEl.value.trim();
    const apiKey = apiKeyEl.value.trim();

    try {
        if (!apiKey)
            throw new Error(
                "LLM Provider API Key is required to fetch models.",
            );
        const response = await fetch(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!response.ok)
            throw new Error("Failed to fetch models. Check URL and API Key.");
        const data = await response.json();
        const models = data.data.map((m) => m.id).sort();

        settings.baseUrl = baseUrl;
        settings.models = models;
        settings.model = models[0] || "";
        saveSettings();
        populateModelDropdown(models);
        apiModelEl.value = settings.model;
        bootstrapAlert({
            title: "Success",
            body: `Found ${models.length} models. Settings saved.`,
            color: "success",
        });
    } catch (error) {
        bootstrapAlert({
            title: "Error",
            body: error.message,
            color: "danger",
        });
    } finally {
        btnSpinner.classList.add("d-none");
        saveAndFetchModelsBtn.disabled = false;
    }
});

apiKeyEl.addEventListener("change", () => {
    settings.apiKey = apiKeyEl.value.trim();
    saveSettings();
});

serperApiKeyEl.addEventListener("change", () => {
    settings.serperApiKey = serperApiKeyEl.value.trim();
    saveSettings();
});

apiModelEl.addEventListener("change", () => {
    settings.model = apiModelEl.value;
    saveSettings();
});

toolsEnabledSwitch.addEventListener("change", () => {
    settings.toolsEnabled = toolsEnabledSwitch.checked;
    saveSettings();
});

// Tools
async function googleSearch(query) {
    if (!settings.serperApiKey) {
        bootstrapAlert({
            title: "Configuration Needed",
            body: "Please set your Serper.dev API key in Settings > API Keys.",
            color: "warning",
        });
        throw new Error("Serper API key not provided.");
    }

    bootstrapAlert({ body: `Searching Google for: "${query}"`, color: "info" });
    try {
        const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
                "X-API-KEY": settings.serperApiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query }),
        });
        if (!response.ok)
            throw new Error(
                `API Error: ${response.status} ${response.statusText}`,
            );
        const data = await response.json();
        const simplifiedResults = (data.organic || [])
            .slice(0, 5)
            .map((item) => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet,
            }));
        return JSON.stringify(simplifiedResults);
    } catch (error) {
        bootstrapAlert({
            title: "Search Failed",
            body: error.message,
            color: "danger",
        });
        return JSON.stringify({
            error: `An error occurred during search: ${error.message}`,
        });
    }
}

async function callAIPipe(pipeline, data) {
    return JSON.stringify({ success: true });
}

async function executeJavaScript(code) {
    const workerSource = `
    self.onmessage = async (e) => {
        const { id, code } = e.data || {};

        const serialize = (obj) => {
            try {
            const seen = new WeakSet();
            return JSON.stringify(obj, function (k, v) {
                if (typeof v === 'bigint') return v.toString() + 'n';
                if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
                if (typeof v === 'symbol') return v.toString();
                if (v && typeof v === 'object') {
                if (seen.has(v)) return '[Circular]';
                seen.add(v);
                }
                return v;
            });
            } catch (e) {
            return JSON.stringify({ error: 'Could not serialize value' });
            }
        };

        const reply = (payload) => {
            try {
                const out = { id, type: payload.type };
                if (payload.type === 'log') {
                    out.level = payload.level;
                    out.args = serialize(payload.args);
                } else if (payload.type === 'result') {
                    out.result = serialize(payload.result);
                } else if (payload.type === 'error') {
                    out.error = serialize(payload.error);
                } else {
                    out.payload = serialize(payload);
                }
                self.postMessage(out);
            } catch (err) {
                try {
                    self.postMessage({ id, type: 'error', error: serialize('postMessage failed: ' + String(err)) });
                } catch (_) {
                    // pass
                }
            }
        };

        const consoleProxy = {
            log: (...args) => reply({ type: 'log', level: 'log', args }),
            info: (...args) => reply({ type: 'log', level: 'info', args }),
            warn: (...args) => reply({ type: 'log', level: 'warn', args }),
            error: (...args) => reply({ type: 'log', level: 'error', args })
        };

        try {
            // Shadow globals inside evaluated code
            const prelude = 'const window=undefined,document=undefined,postMessage=undefined,importScripts=undefined,XMLHttpRequest=undefined,fetch=undefined,WebSocket=undefined,navigator=undefined,location=undefined,localStorage=undefined,sessionStorage=undefined,FileReader=undefined,caches=undefined,globalThis=undefined,self=undefined;';

            const wrapped = '"use strict";\n' + prelude + '\nreturn (async () => { try { return eval(' + JSON.stringify(code || '') + '); } catch (e) { throw e } })()';
            const fn = new Function('console', wrapped);
            const result = await fn(consoleProxy);
            reply({ type: 'result', result });
        } catch (err) {
            reply({ type: 'error', error: err && err.message ? err.message : String(err) });
        }
    };
    `;

    const blobUrl = URL.createObjectURL(
        new Blob([workerSource], { type: "application/javascript" }),
    );
    const worker = new Worker(blobUrl);
    const id = Math.random().toString(36).slice(2);
    const logs = [];

    const SAFE_JSON = (obj) => {
        try {
            const seen = new WeakSet();
            const json = JSON.stringify(obj, (k, v) => {
                if (typeof v === "bigint") return `${v}n`;
                if (typeof v === "function")
                    return `[Function ${v.name || "anonymous"}]`;
                if (typeof v === "symbol") return v.toString();
                if (v && typeof v === "object") {
                    if (seen.has(v)) return "[Circular]";
                    seen.add(v);
                }
                return v;
            });
            if (json.length > 4000) {
                return JSON.stringify({
                    truncated: true,
                    length: json.length,
                    preview: json.slice(0, 4000) + "…",
                });
            }
            return json;
        } catch (_) {
            return JSON.stringify({ error: "Result not serializable" });
        }
    };

    return await new Promise((resolve) => {
        let settled = false;
        const cleanup = () => {
            if (!settled) {
                settled = true;
                worker.terminate();
                URL.revokeObjectURL(blobUrl);
            }
        };

        const timeoutMs = 2000;
        const timer = setTimeout(() => {
            cleanup();
            resolve(JSON.stringify({ error: "Execution timed out" }));
        }, timeoutMs);

        worker.onmessage = (ev) => {
            const msg = ev.data || {};
            if (msg.id !== id) return;

            if (msg.type === "log") {
                let args;
                try {
                    args = JSON.parse(msg.args);
                } catch (_) {
                    args = [msg.args];
                }
                logs.push({ level: msg.level || "log", args });
                return;
            }

            clearTimeout(timer);
            cleanup();

            if (msg.type === "result") {
                let res;
                try {
                    res = JSON.parse(msg.result);
                } catch (_) {
                    res = msg.result;
                }
                resolve(SAFE_JSON({ result: res, logs }));
            } else if (msg.type === "error") {
                let err;
                try {
                    err = JSON.parse(msg.error);
                } catch (_) {
                    err = msg.error;
                }
                resolve(SAFE_JSON({ error: err, logs }));
            } else {
                resolve(
                    SAFE_JSON({ error: "Unknown worker message", msg, logs }),
                );
            }
        };

        worker.onerror = (err) => {
            clearTimeout(timer);
            cleanup();
            resolve(SAFE_JSON({ error: err.message || "Worker error", logs }));
        };

        worker.postMessage({ id, code: String(code || "") });
    });
}

async function openInBrowser(url) {
    try {
        window.open(url, "_blank");
        return JSON.stringify({
            success: true,
            message: "Successfully opened link in the browser.",
        });
    } catch {
        return JSON.stringify({
            success: false,
            message: "Failed to open link in the browser.",
        });
    }
}

// Memory Tools
function addToMemory(memory) {
    // console.log("Adding memory:", memory);
    if (!memory || typeof memory !== "string" || !memory.trim()) {
        return JSON.stringify({
            success: false,
            message: "Memory must be a non-empty string.",
        });
    }

    let memories = [];
    try {
        memories = JSON.parse(localStorage.getItem("agentMemories") || "[]");
    } catch {
        memories = [];
    }

    memories.push({ memory, timestamp: new Date().toISOString() });
    localStorage.setItem("agentMemories", JSON.stringify(memories));
    return JSON.stringify({ success: true, message: "Memory saved." });
}

function getMemories() {
    try {
        const memories = JSON.parse(
            localStorage.getItem("agentMemories") || "[]",
        );
        return JSON.stringify(memories);
    } catch {
        return JSON.stringify([]);
    }
}

const availableTools = {
    googleSearch,
    callAIPipe,
    executeJavaScript,
    openInBrowser,
    addToMemory,
    getMemories,
};
const tools = [
    {
        type: "function",
        function: {
            name: "googleSearch",
            description: "Search Google for recent results.",
            parameters: {
                type: "object",
                properties: { query: { type: "string" } },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "callAIPipe",
            description: "Run a dataflow.",
            parameters: {
                type: "object",
                properties: { pipeline: { type: "string" } },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "executeJavaScript",
            description: "Execute JS code.",
            parameters: {
                type: "object",
                properties: { code: { type: "string" } },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "openInBrowser",
            description: "Open a URL in the browser.",
            parameters: {
                type: "object",
                properties: { url: { type: "string" } },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "addToMemory",
            description: "Save a memory string to persistent storage.",
            parameters: {
                type: "object",
                properties: {
                    memory: {
                        type: "string",
                        description: "The memory to save.",
                    },
                },
                required: ["memory"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "getMemories",
            description: "Retrieve all saved memories.",
            parameters: { type: "object", properties: {} },
        },
    },
];

async function runConversation() {
    toggleLoading(true);
    let messageElement = null,
        thinkingElement = null,
        lastEventTools = [],
        fullReasoningText = "",
        fullContent = "";

    try {
        let memories = [];
        try {
            memories = JSON.parse(
                localStorage.getItem("agentMemories") || "[]",
            );
        } catch {
            memories = [];
        }

        const baseSystemPrompt = systemPrompt.content;
        let dynamicSystemPromptContent = baseSystemPrompt;

        if (memories.length > 0) {
            const memoryStrings = memories
                .map((m) => `- ${m.memory}`)
                .join("\n");
            dynamicSystemPromptContent += `

---
Here are some memories you have saved. Use them for context, but do not mention them unless the user's query is directly related.
${memoryStrings}
---
`;
        }

        const dynamicSystemPrompt = {
            role: "system",
            content: dynamicSystemPromptContent,
        };

        const messagesToSend = conversationHistory.slice(1).map((msg) => {
            if (msg.role === "assistant" && msg.reasoning) {
                const { reasoning, ...messageWithoutReasoning } = msg;
                return messageWithoutReasoning;
            }
            return msg;
        });
        messagesToSend.unshift(dynamicSystemPrompt);

        const requestBody = {
            model: settings.model,
            messages: messagesToSend,
            stream: true,
        };

        if (settings.toolsEnabled) {
            requestBody.tools = tools;
            requestBody.tool_choice = "auto";
        }
        const request = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${settings.apiKey}`,
            },
            body: JSON.stringify(requestBody),
        };

        for await (const event of asyncLLM(
            `${settings.baseUrl}/chat/completions`,
            request,
        )) {
            const reasoningDelta =
                event.message?.choices?.[0]?.delta?.reasoning;
            if ((reasoningDelta || event.tools) && !thinkingElement) {
                thinkingElement = addThinkingToUI();
            }

            if (reasoningDelta) {
                fullReasoningText += reasoningDelta;
                const el = thinkingElement.querySelector(".reasoning-stream");

                if (el) {
                    // el.textContent = fullReasoningText;

                    // Format and highlight syntax in reasoning
                    const cleanFragment = DOMPurify.sanitize(
                        marked.parse(fullReasoningText),
                        { RETURN_DOM_FRAGMENT: true },
                    );
                    highlightSyntax(cleanFragment).then((html) => {
                        el.innerHTML = "";
                        el.appendChild(html);
                        el.querySelectorAll("pre:not(:has(.copy-btn))").forEach(
                            (pre) => {
                                const btn = document.createElement("button");
                                btn.className = "copy-btn";
                                btn.textContent = "Copy";
                                pre.appendChild(btn);
                            },
                        );
                    });
                }
            }

            if (event.content && !messageElement) {
                messageElement = addMessageToUI("", "agent");
            }

            if (messageElement && event.content) {
                const cleanFragment = DOMPurify.sanitize(
                    marked.parse(event.content),
                    { RETURN_DOM_FRAGMENT: true },
                );
                const html = await highlightSyntax(cleanFragment);

                messageElement.replaceChildren();
                messageElement.appendChild(html);
                fullContent = event.content;
            }

            if (event.tools) {
                lastEventTools = event.tools;
            }

            if (event.error) throw new Error(JSON.stringify(event.error));
            scrollToBottom(true);
        }

        if (messageElement) {
            const cleanFragment = DOMPurify.sanitize(
                marked.parse(fullContent),
                { RETURN_DOM_FRAGMENT: true },
            );
            const html = await highlightSyntax(cleanFragment);

            messageElement.replaceChildren();
            messageElement.appendChild(html);
            messageElement.querySelectorAll("pre").forEach((pre) => {
                const btn = document.createElement("button");
                btn.className = "copy-btn";
                btn.textContent = "Copy";
                pre.appendChild(btn);
            });
        }

        const finalToolCalls = lastEventTools.map((t) => ({
            id: t.id,
            type: "function",
            function: { name: t.name, arguments: t.args },
        }));
        const agentResponse = {
            role: "assistant",
            content: fullContent,
            tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
            reasoning: fullReasoningText || undefined,
        };
        conversationHistory.push(agentResponse);
        saveAllChats();

        if (agentResponse.tool_calls) {
            if (thinkingElement) {
                const el = thinkingElement.querySelector(".tool-calls-final");
                const btn = thinkingElement.querySelector(".accordion-button");
                if (el) {
                    el.querySelector("code").textContent = JSON.stringify(
                        finalToolCalls,
                        null,
                        4,
                    );
                    el.style.display = "block";
                    await highlightSyntax(el);
                }
                if (btn) {
                    btn.innerHTML = `🧠 Thinking... (Plans to use ${finalToolCalls.length} tool${finalToolCalls.length > 1 ? "s" : ""})`;
                }
            }

            for (const toolCall of agentResponse.tool_calls) {
                const { name, arguments: args } = toolCall.function;
                addMessageToUI(
                    `⚙️ Using tool: <strong>${name}</strong>`,
                    "tool",
                );
                const toolOutput = await availableTools[name](
                    ...Object.values(JSON.parse(args)),
                );
                conversationHistory.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name,
                    content: toolOutput,
                });
                saveAllChats();
            }
            await runConversation();
        } else {
            toggleLoading(false);
            updateChatList();
        }
    } catch (error) {
        bootstrapAlert({
            title: "Error",
            body: error.message,
            color: "danger",
        });
        toggleLoading(false);
    }
}

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = userInput.value.trim();
    if (!userText) return;

    const welcomeScreen = document.getElementById("welcome-screen");
    if (!settings.apiKey || !settings.model) {
        bootstrapAlert({
            title: "Configuration Needed",
            body: "Please set your API Key and fetch models in the Settings (⚙️) menu.",
            color: "warning",
        });
        new bootstrap.Modal(document.getElementById("appSettingsModal")).show();
        return;
    }

    welcomeScreen.style.display = "none";

    if (isDraftChat) {
        const newChatId = createNewChat();
        activeChat = newChatId;
        isDraftChat = false;

        const tempName =
            userText.length > 15 ? userText.substring(0, 15) + "..." : userText;
        chats[activeChat].name = tempName;
        chats[activeChat].updatedAt = new Date().toISOString();

        updateChatList();
        updateChatTitle();

        const titleEl = document.getElementById("chat-title");
        if (titleEl) {
            titleEl.innerHTML = `${tempName} <small class="text-muted"><i class="bi bi-three-dots"></i></small>`;
        }

        // Generate AI title in the background
        generateChatTitle(userText)
            .then((aiTitle) => {
                if (aiTitle && activeChat && chats[activeChat]) {
                    chats[activeChat].name = aiTitle;
                    chats[activeChat].updatedAt = new Date().toISOString();
                    updateChatList();
                    updateChatTitle();
                    saveAllChats();
                } else {
                    updateChatTitle();
                }
            })
            .catch((error) => {
                console.error("Title generation failed:", error);
                updateChatTitle();
            });
    } else if (
        activeChat &&
        chats[activeChat] &&
        chats[activeChat].history.length === 1
    ) {
        const tempName =
            userText.length > 30 ? userText.substring(0, 30) + "..." : userText;
        chats[activeChat].name = tempName;
        chats[activeChat].updatedAt = new Date().toISOString();
        updateChatList();
        updateChatTitle();

        const titleEl = document.getElementById("chat-title");
        if (titleEl) {
            titleEl.innerHTML = `${tempName} <small class="text-muted"><i class="bi bi-three-dots"></i></small>`;
        }

        // Generate AI title in the background
        generateChatTitle(userText)
            .then((aiTitle) => {
                if (aiTitle && activeChat && chats[activeChat]) {
                    chats[activeChat].name = aiTitle;
                    chats[activeChat].updatedAt = new Date().toISOString();
                    updateChatList();
                    updateChatTitle();
                    saveAllChats();
                } else {
                    updateChatTitle();
                }
            })
            .catch((error) => {
                console.error("Title generation failed:", error);
                updateChatTitle();
            });
    } else if (activeChat && chats[activeChat]) {
        chats[activeChat].updatedAt = new Date().toISOString();
        updateChatList();
    }

    addMessageToUI(userText, "user");
    conversationHistory.push({ role: "user", content: userText });
    saveAllChats();
    userInput.value = "";
    await runConversation();
});

function addMessageToUI(content, role) {
    const w = document.createElement("div");
    if (role === "user" || role === "agent") {
        w.className = `message-wrapper ${role}`;
        const a = document.createElement("div");
        a.className = `avatar avatar-${role}`;
        a.textContent = role === "user" ? "👤" : "🤖";
        const m = document.createElement("div");
        m.className = `message ${role}-message`;
        if (role === "user") {
            m.innerHTML = DOMPurify.sanitize(marked.parseInline(content));
        } else {
            m.innerHTML = content;
        }
        w.appendChild(a);
        w.appendChild(m);
        chatWindow.appendChild(w);
        scrollToBottom(true);
        return m;
    } else {
        w.className = "system-event";
        const m = document.createElement("div");
        m.className = "tool-message";
        m.innerHTML = content;
        w.appendChild(m);
        chatWindow.appendChild(w);
        scrollToBottom(true);
        return m;
    }
}

let accordionCounter = 0;
function addThinkingToUI() {
    accordionCounter++;
    const id = `accordion-${accordionCounter}`;
    const html = `
    <div class="accordion my-2 system-event" id="${id}">
        <div class="accordion-item">
            <h2 class="accordion-header">
                <button class="accordion-button collapsed py-2" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${id}">
                    🧠 Thinking...
                </button>
            </h2>
            <div id="collapse-${id}" class="accordion-collapse collapse" data-bs-parent="#${id}">
                <div class="accordion-body">
                    <div class="reasoning-stream"></div>
                    <div class="tool-calls-final" style="display: none;">
                        <pre><code class="language-json"></code></pre>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
    chatWindow.insertAdjacentHTML("beforeend", html);
    scrollToBottom(true);
    return document.getElementById(id);
}

chatWindow.addEventListener("click", (e) => {
    if (e.target.classList.contains("copy-btn")) {
        const pre = e.target.closest("pre");
        const code = pre.querySelector("code").textContent;
        navigator.clipboard.writeText(code).then(() => {
            e.target.textContent = "Copied!";
            setTimeout(() => {
                e.target.textContent = "Copy";
            }, 2000);
        });
    }
});

const clearChatBtnDesktop = document.getElementById("clear-chat-btn-desktop");
const newChatBtn = document.getElementById("new-chat-btn");
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

newChatBtn.addEventListener("click", () => {
    startDraftChat();
});

mobileMenuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("show");
    sidebarOverlay.classList.toggle("show");
});

sidebarOverlay.addEventListener("click", () => {
    sidebar.classList.remove("show");
    sidebarOverlay.classList.remove("show");
});

clearChatBtn.addEventListener("click", () => deleteChat(activeChat));
clearChatBtnDesktop.addEventListener("click", () => deleteChat(activeChat));

document.getElementById("confirmClearChat").addEventListener("click", () => {
    if (isDraftChat) {
        conversationHistory = [systemPrompt];
        displayHistory();
    } else if (activeChat && chats[activeChat]) {
        chats[activeChat].history = [systemPrompt];
        conversationHistory = [systemPrompt];
        chats[activeChat].updatedAt = new Date().toISOString();
        saveAllChats();
        displayHistory();
    }
    bootstrap.Modal.getInstance(
        document.getElementById("clearChatModal"),
    ).hide();
});

function renameChat(chatId) {
    chatToRename = chatId;
    const chatNameInput = document.getElementById("chatNameInput");
    chatNameInput.value = chats[chatId].name;
    const renameChatModal = new bootstrap.Modal(
        document.getElementById("renameChatModal"),
    );
    renameChatModal.show();
    setTimeout(() => chatNameInput.focus(), 100);
}

document.getElementById("confirmRenameChat").addEventListener("click", () => {
    const newName = document.getElementById("chatNameInput").value.trim();
    if (newName && chatToRename && chats[chatToRename]) {
        chats[chatToRename].name = newName;
        chats[chatToRename].updatedAt = new Date().toISOString();
        updateChatList();
        updateChatTitle();
        saveAllChats();
    }
    bootstrap.Modal.getInstance(
        document.getElementById("renameChatModal"),
    ).hide();
    chatToRename = null;
});

document.getElementById("chatNameInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        document.getElementById("confirmRenameChat").click();
    }
});

function deleteChat(chatId) {
    chatToDelete = chatId;
    const deleteChatModal = new bootstrap.Modal(
        document.getElementById("deleteChatModal"),
    );
    deleteChatModal.show();
}

document.getElementById("confirmDeleteChat").addEventListener("click", () => {
    if (chatToDelete && chats[chatToDelete]) {
        delete chats[chatToDelete];

        if (chatToDelete === activeChat) {
            const remainingChats = Object.keys(chats);
            if (remainingChats.length > 0) {
                switchToChat(remainingChats[0]);
            } else {
                startDraftChat();
            }
        } else {
            updateChatList();
            saveAllChats();
        }
    }
    bootstrap.Modal.getInstance(
        document.getElementById("deleteChatModal"),
    ).hide();
    chatToDelete = null;
});

clearAllChatsBtn.addEventListener("click", () => {
    const clearAllChatsModal = new bootstrap.Modal(
        document.getElementById("clearAllChatsModal"),
    );
    const countElement = document.getElementById("clearAllChatsCount");
    if (countElement) {
        countElement.textContent = Object.keys(chats).length;
    }
    clearAllChatsModal.show();
});

document
    .getElementById("confirmClearAllChats")
    .addEventListener("click", () => {
        clearAllChats();
        bootstrap.Modal.getInstance(
            document.getElementById("clearAllChatsModal"),
        ).hide();
    });

document.getElementById("data-tab").addEventListener("click", () => {
    updateStorageInfo();
});

window.switchToChat = switchToChat;
window.renameChat = renameChat;
window.deleteChat = deleteChat;

function toggleLoading(isLoading) {
    const btn = document.getElementById("submit-button");
    userInput.disabled = isLoading;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading
        ? '<span class="spinner-border spinner-border-sm"></span>'
        : "➤";
    if (!isLoading) userInput.focus();
}

function renderMemoryList() {
    const memoryList = document.getElementById("memoryList");
    const memoryEmptyMsg = document.getElementById("memoryEmptyMsg");
    if (!memoryList || !memoryEmptyMsg) return;
    let memories = [];
    try {
        memories = JSON.parse(localStorage.getItem("agentMemories") || "[]");
    } catch {
        memories = [];
    }
    memoryList.innerHTML = "";
    if (memories.length === 0) {
        memoryEmptyMsg.style.display = "block";
    } else {
        memoryEmptyMsg.style.display = "none";
        memories.forEach((mem, index) => {
            const li = document.createElement("li");
            li.className =
                "list-group-item d-flex justify-content-between align-items-center";
            li.textContent = mem.memory;
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "btn btn-sm btn-outline-danger";
            deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;
            deleteBtn.onclick = () => {
                memories.splice(index, 1);
                localStorage.setItem("agentMemories", JSON.stringify(memories));
                renderMemoryList();
            };
            li.appendChild(deleteBtn);
            memoryList.appendChild(li);
        });
    }
}

document
    .getElementById("data-tab")
    .addEventListener("shown.bs.tab", renderMemoryList);

document.getElementById("clearMemoriesBtn").addEventListener("click", () => {
    localStorage.removeItem("agentMemories");
    renderMemoryList();
    bootstrapAlert({
        title: "Success",
        body: "All memories have been cleared.",
        color: "success",
    });
});

// Initial load
loadSettings();
loadAllChats();
displayHistory();
toggleLoading(false);

window.switchToChat = switchToChat;
window.renameChat = renameChat;
window.deleteChat = deleteChat;
