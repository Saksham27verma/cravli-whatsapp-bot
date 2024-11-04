const { OpenAI } = require('openai');
const { existsSync, writeFileSync, readFileSync } = require('fs');

class cravli {
    #socket;
    #getText;
    #sendMessage;
    #openai;
    #chatHistory;
    #HISTORY_FILE = 'chat_history.json';
    #trigger;

    constructor(config = {}) {
        this.#trigger = config.trigger || 'ai'; // Default trigger word
        this.#openai = new OpenAI({
            apiKey: config.apiKey || process.env.OPENAI_API_KEY
        });
        this.#chatHistory = new Map();

        // Load chat history from file if exists
        if (existsSync(this.#HISTORY_FILE)) {
            const data = JSON.parse(readFileSync(this.#HISTORY_FILE, 'utf8'));
            Object.entries(data).forEach(([key, value]) => this.#chatHistory.set(key, value));
        }

        // Save chat history periodically
        setInterval(() => {
            this.#saveHistory();
        }, 5000);

        // Handle shutdown gracefully
        process.on('SIGINT', async () => {
            console.log('Saving chat history and shutting down...');
            this.#saveHistory();
            process.exit(0);
        });
    }

    init(socket, getText, sendMessage) {
        this.#socket = socket;
        this.#getText = getText;
        this.#sendMessage = sendMessage;
    }

    #saveHistory() {
        const historyObj = Object.fromEntries(this.#chatHistory);
        writeFileSync(this.#HISTORY_FILE, JSON.stringify(historyObj));
    }

    async process(key, message) {
        try {
            const text = this.#getText(key, message);
            
            // Check if message starts with trigger
            if (!text.startsWith('')) return;

            // Skip group messages if needed
            if (key.remoteJid.endsWith('@g.us')) return;

            // Skip messages sent by the bot itself
            if (key.fromMe) return;

            console.log(`Received message from ${key.remoteJid}: ${text}`);

            // Get chat history for this user
            if (!this.#chatHistory.has(key.remoteJid)) {
                this.#chatHistory.set(key.remoteJid, []);
            }
            const userHistory = this.#chatHistory.get(key.remoteJid);

            // Remove trigger word from message
            const userMessage = text.slice(this.#trigger.length + 1).trim();

            // Add user message to history
            userHistory.push({ role: 'user', content: userMessage });

            // Keep only last 10 messages to manage context size
            while (userHistory.length > 10) {
                userHistory.shift();
            }

            // Prepare messages for OpenAI
            const messages = [
                { 
                    role: 'system', 
                    content: 'Your name is Cravli, a friendly and professional dietician bot dedicated to creating personalized meal plans based on comprehensive user information. Begin by introducing yourself and explaining the process. Gather user details step-by-step in the following order: start with basic info, including the user’s name, age, and gender. Next, collect physical stats such as weight and height. Continue with health information, covering activity level, dietary preferences, and allergies. Ask about goals and preferences, including health goals, current health conditions, and any specific daily calorie intake goal. Inquire about meal preferences, like preferred cuisines, meal types, snack preferences, and disliked ingredients. Then, gather details on favorite ingredients, meal timing, number of meals per day, and meal prep frequency. Lastly, ask for practical considerations, including cooking skill level and budget for ingredients. Keep responses brief, clear, and free of emojis or complex punctuation.' 
                },
                ...userHistory
            ];

            // Get response from OpenAI
            const completion = await this.#openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 150,
                temperature: 0.7
            });

            // Use the JS library to create a bucket.

            const { data, error } = await supabase.storage.createBucket('images', {
                public: true,
                allowedMimeTypes: ['image/*'],
                fileSizeLimit: '1MB',
            })
  

            const response = completion.choices[0].message.content;

            // Add assistant's response to history
            userHistory.push({ role: 'assistant', content: response });

            // Send response
            await this.#sendMessage(
                key.remoteJid,
                { text: response },
                { quoted: { key, message } }
            );

            console.log(`Sent response to ${key.remoteJid}: ${response}`);

        } catch (error) {
            console.error('Error processing message:', error);
            // Send error message to user
            await this.#sendMessage(
                key.remoteJid,
                { 
                    text: 'Sorry, I encountered an error processing your message. Please try again later.' 
                },
                { quoted: { key, message } }
            );
        }
    }
}

module.exports = cravli;