import { SceneManager } from './scene/SceneManager.js';
import { ParticleSystem } from './particles/ParticleSystem.js';
import { HandTracker } from './vision/HandTracker.js';
import { UIManager } from './ui/UIManager.js';

class App {
    constructor() {
        this.init();
    }

    async init() {
        const container = document.getElementById('canvas-container');
        this.sceneManager = new SceneManager(container);

        // Initialize Particle System
        this.particleSystem = new ParticleSystem(this.sceneManager.scene);

        // Initialize UI
        this.uiManager = new UIManager(this.particleSystem);

        // Initialize Hand Tracking
        this.handTracker = new HandTracker();

        // Setup resize handling
        window.addEventListener('resize', () => {
            this.sceneManager.onWindowResize();
        });

        console.log('App initialized');
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        // Update particle system based on hand data
        if (this.handTracker.isHandPresent) {
            this.particleSystem.update(
                this.handTracker.gestureValue,
                this.handTracker.handPosition,
                this.handTracker.handRotation
            );
        } else {
            // Default idle animation if no hand
            // Maybe slight breathing effect (0.1)
            // this.particleSystem.update(0.1);
            // Or just decay slowly to 0
            this.particleSystem.update(0, null, 0);
        }

        this.sceneManager.render();
    }
}

new App();
