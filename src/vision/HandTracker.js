import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
    constructor() {
        this.handLandmarker = undefined;
        this.runningMode = 'VIDEO';
        this.webcamRunning = false;
        this.video = document.getElementById('webcam');
        this.onResultCallback = null;

        // Data to expose
        this.results = null;
        this.isHandPresent = false;
        this.gestureValue = 0; // 0 = closed, 1 = open
        this.gestureValue = 0; // 0 = closed, 1 = open
        this.handPosition = { x: 0.5, y: 0.5 };
        this.handRotation = 0; // Radians, roll of the hand



        this.init();
    }

    async init() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
            );

            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: this.runningMode,
                numHands: 1
            });

            console.log('HandLandmarker initialized');
            this.enableCam();
        } catch (error) {
            console.error('Error initializing HandTracker:', error);
            document.getElementById('status').innerText = 'Error: ' + error.message;
        }
    }

    hasGetUserMedia() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    enableCam() {
        if (!this.handLandmarker) {
            console.log("Wait! objectDetector not loaded yet.");
            return;
        }

        if (this.hasGetUserMedia()) {
            const constraints = {
                video: { width: 640, height: 480 } // Lower res for performance
            };

            navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
                this.video.srcObject = stream;
                this.video.addEventListener("loadeddata", () => {
                    this.webcamRunning = true;
                    this.predictWebcam();
                    document.getElementById('status').innerText = 'Camera active. Show hand.';
                });
            }).catch((err) => {
                console.error('Error accessing camera:', err);
                document.getElementById('status').innerText = 'Camera denied.';
            });
        } else {
            console.warn("getUserMedia() is not supported by your browser");
            document.getElementById('status').innerText = 'Error: Camera not supported. Using HTTPS?';
        }
    }

    async predictWebcam() {
        if (this.handLandmarker && this.webcamRunning) {
            let startTimeMs = performance.now();

            if (this.video.currentTime > 0) {
                const results = this.handLandmarker.detectForVideo(this.video, startTimeMs);
                this.processResults(results);
            }

            window.requestAnimationFrame(this.predictWebcam.bind(this));
        }
    }

    processResults(results) {
        this.results = results;
        if (results.landmarks && results.landmarks.length > 0) {
            this.isHandPresent = true;
            this.gestureValue = this.calculateOpenness(results.landmarks[0]);

            // Extract wrist position (index 0)
            const wrist = results.landmarks[0][0];
            this.handPosition = { x: wrist.x, y: wrist.y };

            // Calculate Hand Rotation (Roll)
            // Vector from Wrist (0) to Index MCP (5)
            const indexMCP = results.landmarks[0][5];
            const dx = indexMCP.x - wrist.x;
            const dy = indexMCP.y - wrist.y;
            // Angle in radians. Note y is inverted in screen coords? 
            // Actually atan2(dy, dx) gives angle from X axis.
            // Vertical hand (fingers up) -> -PI/2 approx
            this.handRotation = Math.atan2(dy, dx);

            if (this.onResultCallback) {
                this.onResultCallback({
                    isHandPresent: true,
                    gestureValue: this.gestureValue,
                    handPosition: this.handPosition,
                    handRotation: this.handRotation
                });
            }
        } else {
            this.isHandPresent = false;
            // Optionally decay the value or keep last known
            if (this.onResultCallback) {
                this.onResultCallback({
                    isHandPresent: false,
                    gestureValue: 0
                });
            }
        }
    }

    // Calculate how "open" the hand is (0 to 1)
    calculateOpenness(landmarks) {
        // Simple heuristic: Distance between wrist (0) and finger tips (8, 12, 16, 20)
        // Normalized by palm size or just raw distance with clamping

        // Wrist: 0
        // Tips: 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
        // Bases: 5, 9, 13, 17

        const wrist = landmarks[0];
        const tips = [8, 12, 16, 20];
        let totalDist = 0;

        for (let tip of tips) {
            const dx = landmarks[tip].x - wrist.x;
            const dy = landmarks[tip].y - wrist.y;
            const dz = landmarks[tip].z - wrist.z;
            totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        // Average distance
        const avgDist = totalDist / 4;

        // Empirically determined range (needs tuning)
        // Closed ~0.15, Open ~0.4 (depending on coordinate system normalization)
        // MediaPipe returns normalized coordinates [0,1]

        const minVal = 0.2;
        const maxVal = 0.5;

        let val = (avgDist - minVal) / (maxVal - minVal);
        return Math.min(Math.max(val, 0), 1);
    }

    setCallback(callback) {
        this.onResultCallback = callback;
    }
}
