import { getGlobalDeviceInfo } from './device-detection.js';
import { ViewerCore } from './viewer-core.js';
import { EventHandlers } from './event-handlers.js';
import { FullscreenManager } from './fullscreen-manager.js';
import { UIControls } from './ui-controls.js';
import { DEBUG_MODE } from './debug-config.js';

/**
 * 360°パノラマビューアークラス
 */
export class PanoramaViewer {
	constructor( container, imageUrl ) {
		this.container = container;
		this.imageUrl = imageUrl;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.sphere = null;
		this.isUserInteracting = false;
		this.onMouseDownMouseX = 0;
		this.onMouseDownMouseY = 0;
		this.lat = 0;
		this.onMouseDownLon = 0;
		this.onMouseDownLat = 0;
		this.phi = 0;
		this.theta = 0;
		this.autoRotateTimeout = null;
		this.isDisposed = false;
		this.isAnimating = false;
		this.isVisible = true;
		this.intersectionObserver = null;

		// 時間ベースの自動回転用
		this.lastTime = 0;

		// data 属性から設定を読み込む（block 属性で上書き可能）
		const dataAutoRotate = container.getAttribute( 'data-auto-rotate' );
		const dataSpeed      = container.getAttribute( 'data-auto-rotate-speed' );
		const dataLon        = container.getAttribute( 'data-initial-longitude' );
		const dataHeight     = container.getAttribute( 'data-height' );

		this.autoRotate      = dataAutoRotate !== null ? dataAutoRotate !== 'false' : true;
		this.autoRotateSpeed = dataSpeed      !== null ? parseFloat( dataSpeed )    : 3;
		this.lon             = dataLon        !== null ? parseFloat( dataLon )      : 90;

		// 高さの適用
		if ( dataHeight ) {
			container.style.paddingTop = '0';
			container.style.height     = dataHeight + 'px';
		}

		// グローバルなデバイス情報を使用
		const deviceInfo = getGlobalDeviceInfo();
		this.isMobile = deviceInfo.isMobile;
		this.isMac = deviceInfo.isMac;
		this.webglSupported = deviceInfo.webglSupported;
		this.hardwareAccelerationEnabled =
			deviceInfo.hardwareAccelerationEnabled;
		this.deviceInfo = deviceInfo;

		// UI要素
		this.controlsContainer = null;
		this.zoomInButton = null;
		this.zoomOutButton = null;
		this.fullscreenButton = null;

		// モジュールの初期化
		this.core = new ViewerCore( this );
		this.eventHandlers = new EventHandlers( this );
		this.fullscreenManager = new FullscreenManager( this );
		this.uiControls = new UIControls( this );

		// デバッグ情報の表示
		if ( DEBUG_MODE ) {
			console.log( '360°ビューアーを初期化中...' );
			console.log( 'システム情報:', {
				isMobile: this.isMobile,
				isMac: this.isMac,
				webglSupported: this.webglSupported,
				hardwareAccelerationEnabled: this.hardwareAccelerationEnabled,
				userAgent: navigator.userAgent,
				hasTouch:
					'ontouchstart' in window || navigator.maxTouchPoints > 0,
			} );
		}

		if ( ! this.webglSupported && DEBUG_MODE ) {
			console.warn(
				'WebGLがサポートされていません。Canvas2Dフォールバックを使用します。'
			);
		} else if ( ! this.hardwareAccelerationEnabled && DEBUG_MODE ) {
			console.warn(
				'ハードウェアアクセラレーションが無効です。ソフトウェアレンダリングを使用します。'
			);
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
		if ( this.isDisposed ) return;

		// イベントリスナーの削除
		this.eventHandlers.removeEventListeners();
		this.fullscreenManager.removeEventListeners();

		// UIコントロールの削除
		this.uiControls.dispose();

		// コアのリソース解放
		this.core.dispose();
	}
}
