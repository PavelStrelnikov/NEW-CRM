/**
 * SPT Web Frontend
 * Speech recording and processing interface
 */

// Configuration
const API_BASE_URL = '';  // Same origin — served by FastAPI

// State
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let recordingStartTime = null;
let timerInterval = null;

// DOM Elements
const micButton = document.getElementById('mic-button');
const stopButton = document.getElementById('stop-button');
const convertButton = document.getElementById('convert-button');
const resetButton = document.getElementById('reset-button');
const copyButton = document.getElementById('copy-button');

const statusText = document.getElementById('status-text');
const timer = document.getElementById('timer');
const recordingTimer = document.querySelector('.recording-timer');

const outputLanguageSelect = document.getElementById('output-language');
const forceTranslationCheckbox = document.getElementById('force-translation');

const loading = document.getElementById('loading');
const resultsSection = document.getElementById('results-section');
const errorMessage = document.getElementById('error-message');

const rawTextArea = document.getElementById('raw-text');
const translatedTextArea = document.getElementById('translated-text');
const normalizedTextArea = document.getElementById('normalized-text');
const translatedBox = document.getElementById('translated-box');
const detectedLanguageBadge = document.getElementById('detected-language-badge');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('SPT Web UI initialized');
    checkMicrophonePermission();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    micButton.addEventListener('click', startRecording);
    stopButton.addEventListener('click', stopRecording);
    convertButton.addEventListener('click', convertToTicket);
    resetButton.addEventListener('click', resetUI);
    copyButton.addEventListener('click', copyToClipboard);
}

// Check microphone permission
async function checkMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        console.log('Microphone permission granted');
    } catch (error) {
        console.error('Microphone permission denied:', error);
        showError('Microphone access is required. Please grant permission.');
    }
}

// Start recording
async function startRecording() {
    try {
        hideError();

        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Initialize MediaRecorder
        const mimeType = getSupportedMimeType();
        mediaRecorder = new MediaRecorder(stream, { mimeType });

        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            // Create blob from chunks
            audioBlob = new Blob(audioChunks, { type: mimeType });
            console.log('Recording stopped, blob size:', audioBlob.size);

            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());

            // Enable convert button
            convertButton.disabled = false;
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();

        // Update UI
        micButton.classList.add('hidden');
        stopButton.classList.remove('hidden');
        recordingTimer.classList.remove('hidden');
        statusText.textContent = 'Идёт запись... Говорите сейчас';
        statusText.classList.add('recording');

        // Start timer
        startTimer();

        console.log('Recording started');

    } catch (error) {
        console.error('Failed to start recording:', error);
        showError('Failed to start recording. Please check microphone permissions.');
    }
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stopTimer();

        // Update UI
        stopButton.classList.add('hidden');
        micButton.classList.remove('hidden');
        recordingTimer.classList.add('hidden');
        convertButton.classList.remove('hidden');
        statusText.textContent = 'Запись завершена. Нажмите "Convert to Ticket"';
        statusText.classList.remove('recording');

        console.log('Recording stopped');
    }
}

// Start timer
function startTimer() {
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        timer.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }, 100);
}

// Stop timer
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Convert to ticket
async function convertToTicket() {
    if (!audioBlob) {
        showError('No audio recording found. Please record audio first.');
        return;
    }

    try {
        hideError();
        showLoading();

        // Prepare form data
        const formData = new FormData();

        // Determine file extension based on MIME type
        const extension = getFileExtension(audioBlob.type);
        const filename = `recording_${Date.now()}.${extension}`;

        formData.append('audio', audioBlob, filename);
        formData.append('output_language', outputLanguageSelect.value);
        formData.append('force_translation', forceTranslationCheckbox.checked);

        console.log('Sending request to API:', {
            filename,
            size: audioBlob.size,
            type: audioBlob.type,
            output_language: outputLanguageSelect.value,
            force_translation: forceTranslationCheckbox.checked
        });

        // Send to API
        const response = await fetch(`${API_BASE_URL}/api/speech-to-ticket`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'API request failed');
        }

        const result = await response.json();
        console.log('API response:', result);

        // Display results
        displayResults(result);

    } catch (error) {
        console.error('Error converting to ticket:', error);
        showError(`Error: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Display results
function displayResults(result) {
    // Update detected language badge
    const languageNames = {
        'ru': 'Russian',
        'he': 'Hebrew',
        'en': 'English'
    };
    detectedLanguageBadge.textContent = `Detected: ${languageNames[result.detected_language] || result.detected_language.toUpperCase()}`;

    // Fill raw transcript
    rawTextArea.value = result.raw_text;

    // Fill translated text (if available)
    if (result.translated_text) {
        translatedTextArea.value = result.translated_text;
        translatedBox.classList.remove('hidden');
    } else {
        translatedBox.classList.add('hidden');
    }

    // Fill normalized text
    normalizedTextArea.value = result.normalized_text;

    // Show results section
    resultsSection.classList.remove('hidden');
    convertButton.classList.add('hidden');

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Copy to clipboard
async function copyToClipboard() {
    const text = normalizedTextArea.value;

    if (!text) {
        showError('No text to copy');
        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        // Show feedback
        const originalText = copyButton.textContent;
        copyButton.textContent = '✅ Copied!';
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 2000);

        console.log('Copied to clipboard');
    } catch (error) {
        console.error('Failed to copy:', error);
        showError('Failed to copy to clipboard');
    }
}

// Reset UI
function resetUI() {
    // Clear audio data
    audioBlob = null;
    audioChunks = [];

    // Reset UI elements
    micButton.classList.remove('hidden');
    stopButton.classList.add('hidden');
    convertButton.classList.add('hidden');
    resultsSection.classList.add('hidden');
    translatedBox.classList.add('hidden');
    recordingTimer.classList.add('hidden');

    statusText.textContent = 'Нажмите на микрофон и говорите';
    statusText.classList.remove('recording');

    timer.textContent = '00:00';

    rawTextArea.value = '';
    translatedTextArea.value = '';
    normalizedTextArea.value = '';

    hideError();

    console.log('UI reset');
}

// Show loading
function showLoading() {
    loading.classList.remove('hidden');
}

// Hide loading
function hideLoading() {
    loading.classList.add('hidden');
}

// Show error
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide error
function hideError() {
    errorMessage.classList.add('hidden');
}

// Get supported MIME type for MediaRecorder
function getSupportedMimeType() {
    const types = [
        'audio/webm',
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
    ];

    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            console.log('Using MIME type:', type);
            return type;
        }
    }

    console.warn('No supported MIME type found, using default');
    return 'audio/webm';
}

// Get file extension from MIME type
function getFileExtension(mimeType) {
    const extensionMap = {
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/mp4': 'mp4',
        'audio/wav': 'wav',
        'audio/mpeg': 'mp3'
    };

    return extensionMap[mimeType.split(';')[0]] || 'webm';
}
