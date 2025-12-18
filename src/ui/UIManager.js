export class UIManager {
    constructor(particleSystem) {
        this.particleSystem = particleSystem;
        this.init();
    }

    init() {
        // Pattern Buttons
        const buttons = document.querySelectorAll('#pattern-buttons button');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                buttons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Set pattern
                const pattern = e.target.dataset.pattern;
                this.particleSystem.setPattern(pattern);
            });
        });

        // Color Picker
        const colorPicker = document.getElementById('color-picker');
        colorPicker.addEventListener('input', (e) => {
            this.particleSystem.setColor(e.target.value);
        });

        // Fullscreen
        const fsBtn = document.getElementById('fullscreen-btn');
        fsBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });
    }
}
