import { getGlobalDeviceInfo } from './device-detection.js';
import { getGlobalWebGLConfig, getSphereGeometryConfig, configureTextureFilters } from './webgl-config.js';
import { createCanvas2DRenderer, showErrorMessage } from './canvas2d-renderer.js';

// デバッグモード（開発時のみtrueに設定）
const DEBUG_MODE = true;

// WebGLコンテキストの管理用
const MAX_ACTIVE_VIEWERS = 3;
const activeViewers = new Set();

/**
 * ビューアーのコア機能を提供するクラス
 */
export class ViewerCore {
    constructor(viewer) {
        this.viewer = viewer;
    }
    
    /**
     * Intersection Observerをセットアップする
     */
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            if (DEBUG_MODE) {
                console.log('IntersectionObserver not supported, skipping visibility optimization');
            }
            return;
        }
        
        this.viewer.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                this.viewer.isVisible = entry.isIntersecting;
                if (this.viewer.isVisible) {
                    if (DEBUG_MODE) {
                        console.log('Viewer became visible, resuming animation');
                    }
                    this.startAnimation();
                } else {
                    if (DEBUG_MODE) {
                        console.log('Viewer became hidden, pausing animation');
                    }
                    this.stopAnimation();
                }
            });
        }, {
            threshold: 0.1
        });
        
        this.viewer.intersectionObserver.observe(this.viewer.container);
    }
    
    /**
     * シーン、カメラ、レンダラーを初期化する
     */
    initializeThreeJS() {
        try {
            this.viewer.scene = new THREE.Scene();
            this.viewer.camera = new THREE.PerspectiveCamera(
                75, 
                this.viewer.container.clientWidth / this.viewer.container.clientHeight, 
                1, 
                1100
            );
            this.viewer.camera.target = new THREE.Vector3(0, 0, 0);
            
            this.viewer.renderer = this.createRenderer();
            this.viewer.container.appendChild(this.viewer.renderer.domElement);
            
            if (!this.viewer.renderer.isCanvas2D) {
                this.viewer.renderer.domElement.addEventListener(
                    'webglcontextlost', 
                    this.handleContextLost.bind(this), 
                    false
                );
                this.viewer.renderer.domElement.addEventListener(
                    'webglcontextrestored', 
                    this.handleContextRestored.bind(this), 
                    false
                );
            }
        } catch (error) {
            console.error('ビューアーの初期化に失敗しました:', error);
            showErrorMessage(this.viewer.container, '360°ビューアーの初期化に失敗しました。');
            return;
        }
    }
    
    /**
     * 球体ジオメトリとテクスチャを作成する
     */
    createSphere() {
        const geometryConfig = getSphereGeometryConfig();
        const geometry = new THREE.SphereGeometry(500, geometryConfig.segments, geometryConfig.rings);
        geometry.scale(-1, 1, 1);
        
        const textureLoader = new THREE.TextureLoader();
        const useColorSpace = THREE.SRGBColorSpace !== undefined;
        
        if (!useColorSpace) {
            textureLoader.encoding = THREE.sRGBEncoding;
        }
        
        const texture = textureLoader.load(
            this.viewer.imageUrl,
            () => {
                if (useColorSpace) {
                    texture.colorSpace = THREE.SRGBColorSpace;
                } else {
                    texture.encoding = THREE.sRGBEncoding;
                }
                
                texture.wrapS = THREE.RepeatWrapping;
                texture.repeat.x = 1.0;
                
                configureTextureFilters(texture, this.viewer.renderer);
                
                const material = new THREE.MeshBasicMaterial({ 
                    map: texture,
                    side: THREE.DoubleSide
                });
                
                this.viewer.sphere = new THREE.Mesh(geometry, material);
                this.viewer.scene.add(this.viewer.sphere);
            },
            undefined,
            (error) => {
                console.error('テクスチャの読み込みに失敗しました:', error);
                showErrorMessage(this.viewer.container, '360°画像の読み込みに失敗しました。画像のURLを確認してください。');
            }
        );
    }
    
    /**
     * レンダラーを作成する
     */
    createRenderer() {
        if (!this.viewer.webglSupported) {
            if (DEBUG_MODE) {
                console.warn('WebGLがサポートされていません。Canvas2Dフォールバックを使用します。');
            }
            return createCanvas2DRenderer(this.viewer.container, this.viewer);
        }
        
        try {
            const webglConfig = getGlobalWebGLConfig();
            
            if (DEBUG_MODE) {
                console.log('Creating WebGL renderer with config:', webglConfig.rendererOptions);
            }
            
            let renderer;
            
            if (this.viewer.isMobile) {
                renderer = this.tryMobileWebGLConfigs(webglConfig);
            } else {
                renderer = new THREE.WebGLRenderer(webglConfig.rendererOptions);
                
                if (!renderer || !renderer.domElement || !renderer.getContext()) {
                    throw new Error('WebGL renderer creation failed');
                }
            }
            
            renderer.setPixelRatio(webglConfig.pixelRatio);
            if (DEBUG_MODE) {
                console.log('WebGL renderer created successfully - pixel ratio:', webglConfig.pixelRatio);
            }
            
            renderer.setSize(this.viewer.container.clientWidth, this.viewer.container.clientHeight);
            
            if (THREE.SRGBColorSpace !== undefined) {
                renderer.outputColorSpace = THREE.SRGBColorSpace;
            } else {
                renderer.outputEncoding = THREE.sRGBEncoding;
                renderer.gammaFactor = 2.2;
                renderer.gammaOutput = true;
            }
            
            return renderer;
        } catch (error) {
            console.error('WebGLレンダラーの作成に失敗しました:', error);
            if (DEBUG_MODE) {
                console.warn('WebGL initialization failed, switching to Canvas2D fallback');
                console.warn('Error details:', error.message);
            }
            return createCanvas2DRenderer(this.viewer.container, this.viewer);
        }
    }
    
    /**
     * モバイル用のWebGL設定を試行する
     */
    tryMobileWebGLConfigs(webglConfig) {
        const configs = [
            webglConfig.rendererOptions,
            { 
                antialias: false, 
                preserveDrawingBuffer: false,
                powerPreference: 'low-power',
                failIfMajorPerformanceCaveat: false
            },
            { 
                antialias: false,
                failIfMajorPerformanceCaveat: false
            },
            { failIfMajorPerformanceCaveat: false },
            {}
        ];
        
        for (let i = 0; i < configs.length; i++) {
            try {
                if (DEBUG_MODE) {
                    console.log(`Trying WebGL config ${i + 1}:`, configs[i]);
                }
                const renderer = new THREE.WebGLRenderer(configs[i]);
                
                if (renderer && renderer.domElement && renderer.getContext()) {
                    if (DEBUG_MODE) {
                        console.log(`WebGL renderer created successfully with config ${i + 1}`);
                    }
                    return renderer;
                } else {
                    throw new Error(`WebGL renderer creation failed with config ${i + 1}`);
                }
            } catch (configError) {
                if (DEBUG_MODE) {
                    console.warn(`WebGL config ${i + 1} failed:`, configError.message);
                }
                if (i === configs.length - 1) {
                    throw configError;
                }
            }
        }
    }
    
    /**
     * WebGLコンテキスト損失時の処理
     */
    handleContextLost(event) {
        event.preventDefault();
        if (DEBUG_MODE) {
            console.warn('WebGLコンテキストが失われました');
        }
        this.stopAnimation();
        
        if (this.viewer.isMobile && this.viewer.webglSupported) {
            if (DEBUG_MODE) {
                console.log('Mobile device - attempting Canvas2D fallback');
            }
            showErrorMessage(this.viewer.container, 'WebGLが利用できません。Canvas2Dモードに切り替えます...');
            setTimeout(() => {
                this.switchToCanvas2D();
            }, 1000);
        }
    }
    
    /**
     * WebGLコンテキスト復元時の処理
     */
    handleContextRestored() {
        if (DEBUG_MODE) {
            console.log('WebGLコンテキストが復元されました');
        }
        this.startAnimation();
    }
    
    /**
     * Canvas2Dフォールバックに切り替える
     */
    switchToCanvas2D() {
        if (DEBUG_MODE) {
            console.log('Switching to Canvas2D fallback');
        }
        
        if (this.viewer.renderer && this.viewer.renderer.domElement) {
            this.viewer.container.removeChild(this.viewer.renderer.domElement);
        }
        
        this.viewer.renderer = createCanvas2DRenderer(this.viewer.container, this.viewer);
        
        if (this.viewer.container.firstChild) {
            this.viewer.container.insertBefore(this.viewer.renderer.domElement, this.viewer.container.firstChild);
        } else {
            this.viewer.container.appendChild(this.viewer.renderer.domElement);
        }
        
        this.startAnimation();
        
        if (DEBUG_MODE) {
            console.log('Canvas2D fallback activated');
        }
    }
    
    /**
     * ビューアーをアクティブ化する
     */
    activate() {
        if (this.viewer.isDisposed) return;
        
        if (activeViewers.size >= MAX_ACTIVE_VIEWERS) {
            const oldestViewer = Array.from(activeViewers)[0];
            oldestViewer.core.deactivate();
        }
        
        activeViewers.add(this.viewer);
        this.startAnimation();
    }
    
    /**
     * ビューアーを非アクティブ化する
     */
    deactivate() {
        if (this.viewer.isDisposed) return;
        
        activeViewers.delete(this.viewer);
        this.stopAnimation();
    }
    
    /**
     * アニメーションを開始する
     */
    startAnimation() {
        if (!this.viewer.isAnimating) {
            this.viewer.isAnimating = true;
            this.animate();
        }
    }
    
    /**
     * アニメーションを停止する
     */
    stopAnimation() {
        this.viewer.isAnimating = false;
    }
    
    /**
     * アニメーションループ
     */
    animate() {
        if (!this.viewer.isAnimating || this.viewer.isDisposed) return;
        
        requestAnimationFrame(this.animate.bind(this));
        this.update();
    }
    
    /**
     * フレームごとの更新処理
     */
    update() {
        if (!this.viewer.camera || !this.viewer.renderer || this.viewer.isDisposed || !this.viewer.isVisible) return;
        
        // 時間ベースの自動回転
        if (this.viewer.autoRotate && !this.viewer.isUserInteracting) {
            const currentTime = performance.now();
            if (this.viewer.lastTime > 0) {
                const deltaTime = (currentTime - this.viewer.lastTime) / 1000;
                this.viewer.lon += this.viewer.autoRotateSpeed * deltaTime;
            }
            this.viewer.lastTime = currentTime;
        } else {
            this.viewer.lastTime = performance.now();
        }
        
        this.viewer.lat = Math.max(-85, Math.min(85, this.viewer.lat));
        this.viewer.phi = THREE.MathUtils.degToRad(90 - this.viewer.lat);
        this.viewer.theta = THREE.MathUtils.degToRad(this.viewer.lon);
        
        if (this.viewer.renderer.isCanvas2D) {
            this.viewer.renderer.render(this.viewer.scene, this.viewer.camera);
        } else {
            this.viewer.camera.position.x = 100 * Math.sin(this.viewer.phi) * Math.cos(this.viewer.theta);
            this.viewer.camera.position.y = 100 * Math.cos(this.viewer.phi);
            this.viewer.camera.position.z = 100 * Math.sin(this.viewer.phi) * Math.sin(this.viewer.theta);
            
            this.viewer.camera.lookAt(this.viewer.camera.target);
            this.viewer.renderer.render(this.viewer.scene, this.viewer.camera);
        }
    }
    
    /**
     * リソースを解放する
     */
    dispose() {
        if (this.viewer.isDisposed) return;
        
        this.viewer.isDisposed = true;
        this.deactivate();
        
        if (this.viewer.intersectionObserver) {
            this.viewer.intersectionObserver.disconnect();
            this.viewer.intersectionObserver = null;
        }
        
        if (this.viewer.autoRotateTimeout) {
            clearTimeout(this.viewer.autoRotateTimeout);
            this.viewer.autoRotateTimeout = null;
        }
        
        if (this.viewer.sphere) {
            this.viewer.sphere.geometry.dispose();
            this.viewer.sphere.material.map?.dispose();
            this.viewer.sphere.material.dispose();
            this.viewer.scene.remove(this.viewer.sphere);
        }
        
        if (this.viewer.scene) {
            this.viewer.scene.clear();
        }
        
        if (this.viewer.renderer) {
            if (!this.viewer.renderer.isCanvas2D) {
                this.viewer.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
                this.viewer.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
            }
            
            this.viewer.renderer.dispose();
            
            if (this.viewer.container.contains(this.viewer.renderer.domElement)) {
                this.viewer.container.removeChild(this.viewer.renderer.domElement);
            }
        }
        
        this.viewer.scene = null;
        this.viewer.camera = null;
        this.viewer.renderer = null;
        this.viewer.sphere = null;
    }
}

