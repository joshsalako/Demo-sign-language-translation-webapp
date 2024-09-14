document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const signToSpeechOutput = document.getElementById('sign-to-speech');
    const speechToTextOutput = document.getElementById('speech-to-text');

    let model;
    let synth = window.speechSynthesis;
    let recognition;
    let isRunning = false;
    let animationFrameId;
    let lastGesture = '';

    startButton.addEventListener('click', startTranslation);
    stopButton.addEventListener('click', stopTranslation);

    async function startTranslation() {
        if (isRunning) return;
        console.log("Start button clicked");
        try {
            startButton.disabled = true;
            stopButton.disabled = false;

            console.log("Loading handpose model...");
            model = await handpose.load();
            console.log("Handpose model loaded successfully");

            console.log("Attempting to access camera...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            console.log("Camera accessed successfully");

            isRunning = true;
            video.addEventListener('loadeddata', predictHands);

            // Initialize speech recognition
            recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                if (finalTranscript) {
                    addSpeechToTextOutput(finalTranscript);
                }
                
                // Display interim results
                speechToTextOutput.lastChild.textContent = interimTranscript;
            };

            recognition.start();
            console.log("Speech recognition started");

        } catch (err) {
            console.error('Error:', err);
            startButton.disabled = false;
            stopButton.disabled = true;
        }
    }

    function stopTranslation() {
        if (!isRunning) return;
        console.log("Stop button clicked");
        isRunning = false;
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        cancelAnimationFrame(animationFrameId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (recognition) {
            recognition.stop();
        }
        startButton.disabled = false;
        stopButton.disabled = true;
    }

    async function predictHands() {
        if (!isRunning) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const predictions = await model.estimateHands(video);
        
        if (predictions.length > 0) {
            drawHand(predictions[0].landmarks);
            const gesture = recognizeGesture(predictions[0].landmarks);
            if (gesture && gesture !== lastGesture) {
                addSignToSpeechOutput(gesture);
                speakText(gesture);
                lastGesture = gesture;
            }
        } else {
            lastGesture = '';
        }

        animationFrameId = requestAnimationFrame(predictHands);
    }

    function drawHand(landmarks) {
        for (let i = 0; i < landmarks.length; i++) {
            const [x, y] = landmarks[i];
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
        }
    }

    function recognizeGesture(landmarks) {
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];

        const thumbIndexDistance = getDistance(thumbTip, indexTip);
        const indexMiddleDistance = getDistance(indexTip, middleTip);

        if (thumbIndexDistance < 30 && indexMiddleDistance > 100) {
            return "Hello";
        } else if (thumbIndexDistance < 30 && indexMiddleDistance < 30) {
            return "Thank you";
        }

        return null;
    }

    function getDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point1[0] - point2[0], 2) +
            Math.pow(point1[1] - point2[1], 2)
        );
    }

    function speakText(text) {
        if (synth.speaking) {
            console.log('Still speaking...');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        synth.speak(utterance);
    }

    function addSignToSpeechOutput(text) {
        const p = document.createElement('p');
        p.textContent = text;
        signToSpeechOutput.appendChild(p);
        signToSpeechOutput.scrollTop = signToSpeechOutput.scrollHeight;
    }

    function addSpeechToTextOutput(text) {
        const p = document.createElement('p');
        p.textContent = text;
        speechToTextOutput.appendChild(p);
        speechToTextOutput.scrollTop = speechToTextOutput.scrollHeight;
    }
});
