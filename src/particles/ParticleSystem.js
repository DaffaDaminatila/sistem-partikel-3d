import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particleCount = 15000;
        this.particles = null;
        this.geometry = null;
        this.material = null;

        // State
        this.currentPattern = 'sphere';
        this.baseColor = new THREE.Color('#00ffff');
        this.expansionFactor = 0; // 0 to 1 (based on hand gesture)

        // Store original positions for morphing reference
        this.originalPositions = new Float32Array(this.particleCount * 3);

        this.init();
    }

    init() {
        this.geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);

        // Initialize with default pattern
        this.generatePattern('sphere', positions);

        // Save original positions
        this.originalPositions.set(positions);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Shader Material for premium look
        this.material = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });

        this.particles = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particles);

        this.updateColors();
    }

    generatePattern(type, positionArray) {
        this.currentPattern = type;
        const positions = positionArray || this.geometry.attributes.position.array;

        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            let x, y, z;

            if (type === 'sphere') {
                const r = 10 * Math.cbrt(Math.random()); // Uniform distribution inside sphere
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);

                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            } else if (type === 'cube') {
                const s = 15;
                x = (Math.random() - 0.5) * s;
                y = (Math.random() - 0.5) * s;
                z = (Math.random() - 0.5) * s;
            } else if (type === 'ring') {
                const r = 8 + Math.random() * 4;
                const theta = Math.random() * 2 * Math.PI;
                x = r * Math.cos(theta);
                y = (Math.random() - 0.5) * 2;
                z = r * Math.sin(theta);
            } else if (type === 'love') {
                // Heart shape (Parametric Surface)
                // Source: http://mathworld.wolfram.com/HeartSurface.html
                // We'll use a slightly simpler one or the one proposed in plan
                // x = 16 sin^3(t)
                // y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)
                // This is 2D. For 3D we can rotate this profile or use a 3D implicit function.
                // Let's use the surface formula:
                // x = 16 sin^3(u) sin^2(v)
                // y = (13 cos(u) - 5 cos(2u) - 2 cos(3u) - cos(4t)) sin^2(v)
                // z = 6 cos(v) (approx depth)

                // Random u, v covering the surface
                const u = Math.random() * Math.PI * 2;
                const v = Math.random() * Math.PI;

                const scale = 0.8; // Adjust base size

                // 2D Heart Profile part (Heart Curve)
                const hx = 16 * Math.pow(Math.sin(u), 3);
                const hy = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);

                // 3D modulation
                // We can use v to create a shell
                // z = r * cos(v) ? No, let's try a different approach for 3D volume.
                // Let's stick to the 3D parametric formula derived from the 2D heart curve rotated?
                // Actually, the user wants it "clearly shaped".
                // Let's use the explicit parametric:

                // u in [0, 2PI], v in [0, PI]
                x = scale * hx * Math.sin(v);
                y = scale * hy * Math.sin(v);
                z = scale * 6 * Math.cos(v); // Depth thickness

                // Rotate to stand upright
                // Currently y is up, which is good.
            }

            positions[i3] = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;
        }

        if (positionArray) return;

        // If updating existing geometry, we might need to update originalPositions to target
        // For now, let's just snap to it or interpolate.
        // Simple snap:
        this.originalPositions.set(positions);
        this.geometry.attributes.position.needsUpdate = true;
    }

    setPattern(type) {
        // Regenerate positions
        this.generatePattern(type);
    }

    setColor(hex) {
        this.baseColor.set(hex);
        this.updateColors();
    }

    updateColors() {
        const colors = this.geometry.attributes.color.array;
        const c = this.baseColor;

        for (let i = 0; i < this.particleCount; i++) {
            // Add slight variation
            const mix = Math.random() * 0.2;
            colors[i * 3] = c.r + mix;
            colors[i * 3 + 1] = c.g + mix;
            colors[i * 3 + 2] = c.b + mix;
        }
        this.geometry.attributes.color.needsUpdate = true;
    }

    update(gestureValue, handPosition, handRotation) {
        // gestureValue: 0 (Closed) -> 1 (Open)
        // Lerp factor
        const targetExpansion = gestureValue;

        // Smoothly interpolate current expansion
        this.expansionFactor += (targetExpansion - this.expansionFactor) * 0.1;

        const positions = this.geometry.attributes.position.array;

        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            // Base position
            const ox = this.originalPositions[i3];
            const oy = this.originalPositions[i3 + 1];
            const oz = this.originalPositions[i3 + 2];

            // Expansion effect: Move away from center based on expansionFactor
            // Closed (0) -> Contract/Default?
            // Open (1) -> Expand/Disperse

            // Let's define: 
            // 0 = Contracted/Tight
            // 0.5 = Normal (Original)
            // 1.0 = Expanded/Dispersed

            // Actually, user wants: "camera capturing hand open–close gestures in real time to precisely control particle scaling, contraction, expansion, and dispersion effects"

            // Let's map gestureValue directly to a scale multiplier
            // Open Hand (1.0) -> Scale 2.0 (Expanded)
            // Closed Hand (0.0) -> Scale 0.2 (Contracted)

            // Map 0..1 to 0.2..2.5
            const scale = 0.2 + this.expansionFactor * 2.3;

            // Add some noise/turbulence if expanded
            const noise = this.expansionFactor * 0.1 * (Math.random() - 0.5);

            positions[i3] = ox * scale + noise;
            positions[i3 + 1] = oy * scale + noise;
            positions[i3 + 2] = oz * scale + noise;
        }

        this.geometry.attributes.position.needsUpdate = true;

        // Rotation Logic
        if (handPosition) {
            // Map hand position (0..1) to Rotation Angle (-PI..PI)
            // x: 0 (left) -> -PI, 1 (right) -> PI
            // y: 0 (top) -> -PI/2, 1 (bottom) -> PI/2

            // Note: MediaPipe X is mirrored? Usually 0 is left.
            // Let's assume standard 0->1.

            const targetRotY = (handPosition.x - 0.5) * Math.PI * 4; // Amplified range
            const targetRotX = (handPosition.y - 0.5) * Math.PI * 4;

            // Smooth lerp
            this.particles.rotation.y += (targetRotY - this.particles.rotation.y) * 0.1;
            this.particles.rotation.x += (targetRotX - this.particles.rotation.x) * 0.1;

            if (handRotation !== undefined) {
                // Hand Roll -> Z Rotation
                // handRotation is ~ -PI/2 (upright). Let's offset it.
                // We want upright hand -> 0 rotation.
                // So targetRotZ = handRotation + PI/2
                const targetRotZ = handRotation + Math.PI / 2;
                this.particles.rotation.z += (targetRotZ - this.particles.rotation.z) * 0.1;
            }
        } else {
            // Auto rotate if no hand (slow spin)
            this.particles.rotation.y += 0.002;
            this.particles.rotation.x = Math.sin(Date.now() * 0.001) * 0.1; // Gentle wobble
            this.particles.rotation.z *= 0.95; // Return to upright
        }
    }
}
