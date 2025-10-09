import { getGlobalDeviceInfo } from './device-detection.js';
import { ViewerCore } from './viewer-core.js';
import { EventHandlers } from './event-handlers.js';
import { FullscreenManager } from './fullscreen-manager.js';
import { UIControls } from './ui-controls.js';

// デバッグモード（開発時のみtrueに設定）
const DEBUG_MODE = true;

/**
 * 360°パノラマビューアークラス
 */
export class PanoramaViewer {
    constructor(container, imageUrl) {
        this.container = container;
        this.imageUrl = imageUrl;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sphere = null;
        this.isUserInteracting = false;
        this.onMouseDownMouseX = 0;
        this.onMouseDownMouseY = 0;
        this.lon = 90;
        this.lat = 0;
        this.onMouseDownLon = 0;
        this.onMouseDownLat = 0;
        this.phi = 0;
        this.theta = 0;
        this.autoRotate = true;
        this.autoRotateTimeout = null;
        this.isDisposed = false;
        this.isVisible = true;
        this.intersectionObserver = null;
        
        // 時間ベースの自動回転用
        this.lastTime = 0;
        this.autoRotateSpeed = 3;
        
        // グローバルなデバイス情報を使用
        const deviceInfo = getGlobalDeviceInfo();
        this.isMobile = deviceInfo.isMobile;
        this.isMac = deviceInfo.isMac;
        this.webglSupported = deviceInfo.webglSupported;
        this.hardwareAccelerationEnabled = deviceInfo.hardwareAccelerationEnabled;
        
        // UI要素
        this.controlsContainer = null;
        this.zoomInButton = null;
        this.zoomOutButton = null;
        this.fullscreenButton = null;
        
        // モジュールの初期化
        this.core = new ViewerCore(this);
        this.eventHandlers = new EventHandlers(this);
        this.fullscreenManager = new FullscreenManager(this);
        this.uiControls = new UIControls(this);
        
        // Intersection Observer の設定
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.core.activate();
                    } else {
                        this.core.deactivate();
                    }
                });
            },
            { threshold: 0.1 }
        );
        
        // デバッグ情報の表示
        if (DEBUG_MODE) {
            console.log('360°ビューアーを初期化中...');
            console.log('システム情報:', {
                isMobile: this.isMobile,
                isMac: this.isMac,
                webglSupported: this.webglSupported,
                hardwareAccelerationEnabled: this.hardwareAccelerationEnabled,
                userAgent: navigator.userAgent,
                hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0
            });
        }
        
        if (!this.webglSupported && DEBUG_MODE) {
            console.warn('WebGLがサポートされていません。Canvas2Dフォールバックを使用します。');
        } else if (!this.hardwareAccelerationEnabled && DEBUG_MODE) {
            console.warn('ハードウェアアクセラレーションが無効です。ソフトウェアレンダリングを使用します。');
        }
        
        this.init();
        this.core.setupIntersectionObserver();
    }
    
    /**
     * 初期化処理
     */
    init() {
        // Three.jsの初期化
        this.core.initializeThreeJS();
        
        // UIコントロールの作成
        this.uiControls.createControls();
        
        // 球体ジオメトリとテクスチャの作成
        this.core.createSphere();
        
        // Intersection Observer の開始
        this.observer.observe(this.container);
        
        // イベントリスナーの設定
        this.eventHandlers.setupEventListeners();
        this.fullscreenManager.setupEventListeners();
        
        // アクティブビューアーとして登録
        this.core.activate();
    }
    
    /**
     * リソースの解放
     */
    dispose() {
        if (this.isDisposed) return;
        
        // Observerの停止
        this.observer.disconnect();
        
        // イベントリスナーの削除
        this.eventHandlers.removeEventListeners();
        this.fullscreenManager.removeEventListeners();
        
        // UIコントロールの削除
        this.uiControls.dispose();
        
        // コアのリソース解放
        this.core.dispose();
    }
}

