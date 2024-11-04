const { OpenAI } = require('openai');
const { existsSync, readFileSync } = require('fs');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');

class cravli {
    #socket;
    #getText;
    #sendMessage;
    #openai;
    #chatHistory;
    #supabase;
    #HISTORY_FILE = 'chat_history.json';
    #BUCKET_NAME = 'images';
    #trigger;

    constructor(config = {}) {
        this.#trigger = config.trigger || 'ai';
        this.#openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        })

        // Initialize Supabase client
        this.#supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

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

        // Initialize Supabase bucket if it doesn't exist
        this.#initSupabaseBucket();
    }

    async #initSupabaseBucket() {
        try {
            // Check if bucket exists
            const { data: buckets, error: listError } = await this.#supabase.storage.listBuckets();

            const bucketExists = buckets.some(bucket => bucket.name === this.#BUCKET_NAME);

            if (!bucketExists) {
                // Create the bucket if it doesn't exist
                const { data, error } = await this.#supabase.storage.createBucket(this.#BUCKET_NAME, {
                    public: false, // Set to true if you want the images to be publicly accessible
                    fileSizeLimit: 5242880, // 5MB limit
                });

                if (error) throw error;
                console.log('Created Supabase bucket:', this.#BUCKET_NAME);
            }
        } catch (error) {
            console.error('Error initializing Supabase bucket:', error);
        }
    }

    async #uploadImageToSupabase(buffer, filename, metadata) {
        try {
            // Upload image to Supabase Storage
            const { data, error } = await this.#supabase.storage
                .from(this.#BUCKET_NAME)
                .upload(filename, buffer, {
                    contentType: 'image/jpeg',
                    upsert: false
                });

            if (error) throw error;

            // Get the public URL of the uploaded image
            const { data: { publicUrl } } = this.#supabase.storage
                .from(this.#BUCKET_NAME)
                .getPublicUrl(filename);

            // Store metadata in a separate table
            const { data: metadataEntry, error: metadataError } = await this.#supabase
                .from('image_metadata')
                .insert([{
                    filename: filename,
                    storage_path: data.path,
                    public_url: publicUrl,
                    sender_id: metadata.senderId,
                    chat_id: metadata.chatId,
                    timestamp: metadata.timestamp,
                    mime_type: 'image/jpeg'
                }]);

            if (metadataError) throw metadataError;

            console.log('Image uploaded successfully to Supabase');
            return { path: data.path, publicUrl };
        } catch (error) {
            console.error('Error uploading to Supabase:', error);
            throw error;
        }
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

    async #handleImage(message, remoteJid) {
        try {
            // Generate a unique filename
            const timestamp = new Date().getTime();
            const filename = `${timestamp}-${remoteJid.replace('@s.whatsapp.net', '')}.jpg`;

            // Download the image as buffer
            const buffer = await downloadMediaMessage(
                message,
                'buffer',
                {},
                {
                    logger: console,
                    reuploadRequest: this.#socket.updateMediaMessage
                }
            );

            // Prepare metadata
            const metadata = {
                senderId: remoteJid,
                chatId: remoteJid,
                timestamp: new Date().toISOString(),
            };

            // Upload to Supabase
            const { publicUrl } = await this.#uploadImageToSupabase(buffer, filename, metadata);

            return publicUrl;
        } catch (error) {
            console.error('Error handling image:', error);
            throw error;
        }
    }

    async process(key, message) {
        try {
            // Skip messages sent by the bot itself
            if (key.fromMe) return;

            // Check if the message contains an image
            const messageType = Object.keys(message.message || {})[0];
            if (messageType === 'imageMessage') {
                const publicUrl = await this.#handleImage(message, key.remoteJid);
                await this.#sendMessage(
                    key.remoteJid,
                    {
                        text: 'Image received and uploaded successfully! You can access it at: ' + publicUrl
                    },
                    { quoted: { key, message } }
                );
                return;
            }

            // Rest of your existing message processing code...
            const text = this.#getText(key, message);

            if (!text.startsWith('')) return;
            if (key.remoteJid.endsWith('@g.us')) return;

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
                    content: 'Your name is Cravli, a friendly and professional dietician bot dedicated to creating personalized meal plans based on comprehensive user information...'
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